/**
 * Unsaved booking form, kept per user and equipment so a failed or interrupted booking
 * (slot taken, no wallet, recharge, closed tab) can be picked up again.
 */

export const BOOKING_DRAFT_VERSION = 1;
export const BOOKING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = "iic_booking_draft";

export type BookingDraftValue = string | boolean | string[] | number | string[][];

export type BookingDraftOptions = {
  auto_slot_selection?: boolean;
  book_any_available_slots?: boolean;
  book_even_if_single_slot_available?: boolean;
  waitlist_on_failure?: boolean;
  auto_allocate_alternative?: boolean;
  sample_return_after_analysis?: boolean;
  atmosphere_sensitive_sample?: boolean;
  research_workspace?: string | null;
};

export type BookingDraft = {
  v: number;
  savedAt: number;
  inputValues: Record<string, BookingDraftValue>;
  sampleSets: Array<Record<string, BookingDraftValue>>;
  options: BookingDraftOptions;
};

export type BookingDraftContent = Omit<BookingDraft, "v" | "savedAt">;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function bookingDraftKey(userId: string | number, equipmentId: string | number): string {
  return `${KEY_PREFIX}:v${BOOKING_DRAFT_VERSION}:${userId}:${equipmentId}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** True when the form still holds only the equipment's default values (nothing worth restoring). */
export function draftMatchesDefaults(
  content: Pick<BookingDraftContent, "inputValues" | "sampleSets">,
  defaults: Record<string, BookingDraftValue>,
): boolean {
  if (content.sampleSets.length > 0) return false;
  return stableStringify(content.inputValues) === stableStringify(defaults);
}

export function saveBookingDraft(
  userId: string | number,
  equipmentId: string | number,
  content: BookingDraftContent,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  const draft: BookingDraft = { v: BOOKING_DRAFT_VERSION, savedAt: now, ...content };
  try {
    storage.setItem(bookingDraftKey(userId, equipmentId), JSON.stringify(draft));
  } catch {
    // Quota exceeded / private mode: the form still works, only without autosave.
  }
}

export function clearBookingDraft(
  userId: string | number,
  equipmentId: string | number,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(bookingDraftKey(userId, equipmentId));
  } catch {
    // ignore
  }
}

function isDraftShape(value: unknown): value is BookingDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<BookingDraft>;
  return (
    typeof d.v === "number" &&
    typeof d.savedAt === "number" &&
    !!d.inputValues &&
    typeof d.inputValues === "object" &&
    !Array.isArray(d.inputValues) &&
    Array.isArray(d.sampleSets) &&
    !!d.options &&
    typeof d.options === "object"
  );
}

/** Returns the saved draft, or null (and removes it) when missing, from another version, corrupt or older than 7 days. */
export function loadBookingDraft(
  userId: string | number,
  equipmentId: string | number,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): BookingDraft | null {
  if (!storage) return null;
  const key = bookingDraftKey(userId, equipmentId);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearBookingDraft(userId, equipmentId, storage);
    return null;
  }
  if (!isDraftShape(parsed) || parsed.v !== BOOKING_DRAFT_VERSION || now - parsed.savedAt > BOOKING_DRAFT_TTL_MS || parsed.savedAt > now + 60_000) {
    clearBookingDraft(userId, equipmentId, storage);
    return null;
  }
  return parsed;
}

/** Restore keeps only fields the equipment still has, so a changed form never receives stale keys. */
export function draftInputsForFields(
  draft: Pick<BookingDraft, "inputValues">,
  fieldKeys: Iterable<string>,
): Record<string, BookingDraftValue> {
  const allowed = new Set<string>();
  for (const key of fieldKeys) {
    allowed.add(key);
    allowed.add(`${key}_elements`);
  }
  const out: Record<string, BookingDraftValue> = {};
  for (const [k, v] of Object.entries(draft.inputValues)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/** URL parameters that prefill the form from somewhere else; a saved draft must not overwrite them. */
export const BOOKING_PREFILL_PARAMS = [
  "template",
  "template_id",
  "repeatOf",
  "rebookOf",
  "alt_from",
  "from",
  "date",
  "embed",
  "proforma",
  "proformaLineIndex",
  "urgent",
  "rush_relief",
] as const;

export function bookingDraftAllowed(params: URLSearchParams, opts: { bookingForAnotherUser: boolean; staff: boolean }): boolean {
  if (opts.bookingForAnotherUser || opts.staff) return false;
  const mode = params.get("mode");
  if (mode && mode !== "book") return false;
  return !BOOKING_PREFILL_PARAMS.some((p) => (params.get(p) || "").trim() !== "");
}
