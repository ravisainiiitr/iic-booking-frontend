import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";

/**
 * "Book again" support: open the booking page for the same equipment with the
 * inputs of an earlier booking (any status) or waitlist entry prefilled.
 *
 * Real bookings are referenced by PK (`rebookOf=<pk>`) and re-fetched on the booking page.
 * Waitlist entries are not fetchable by id, so their inputs travel via sessionStorage
 * (`rebookOf=wl-<entryId>`).
 */

export const REBOOK_PREFILL_KEY = "iic_rebook_prefill";

export type RebookInputValue = string | boolean | string[] | number;

export type RebookSourceBooking = {
  booking_id: string | number;
  real_booking_id?: number | null;
  equipment?: number | string | null;
  user?: number | string | null;
  virtual_booking_id?: string | null;
  input_values?: Record<string, unknown> | null;
  atmosphere_sensitive_sample?: boolean | null;
  sample_return_after_analysis?: boolean | null;
  is_waitlist_entry?: boolean | null;
  waitlist_entry_id?: number | null;
  status?: string | null;
};

export type RebookPrefill = {
  source: string;
  equipment_id: number;
  user_id: number | null;
  label: string;
  input_values: Record<string, unknown>;
  atmosphere_sensitive_sample?: boolean;
  sample_return_after_analysis?: boolean;
};

function isWaitlistRow(b: RebookSourceBooking): boolean {
  return (
    b.is_waitlist_entry === true ||
    (typeof b.status === "string" && b.status.toUpperCase() === "WAITLISTED") ||
    (typeof b.booking_id === "number" && b.booking_id < 0)
  );
}

/** URL token for `rebookOf`, or null when the row cannot be booked again. */
export function getRebookSourceToken(b: RebookSourceBooking | null | undefined): string | null {
  if (!b) return null;
  if (isWaitlistRow(b)) {
    const entryId =
      typeof b.waitlist_entry_id === "number"
        ? b.waitlist_entry_id
        : typeof b.booking_id === "number" && b.booking_id < 0
          ? -b.booking_id
          : null;
    return entryId != null && entryId > 0 ? `wl-${entryId}` : null;
  }
  const pk =
    typeof b.real_booking_id === "number"
      ? b.real_booking_id
      : typeof b.booking_id === "number"
        ? b.booking_id
        : typeof b.booking_id === "string" && /^\d+$/.test(b.booking_id.trim())
          ? parseInt(b.booking_id.trim(), 10)
          : null;
  return pk != null && pk > 0 ? String(pk) : null;
}

export function canRebook(b: RebookSourceBooking | null | undefined): boolean {
  if (!b) return false;
  const eq = Number(b.equipment);
  return Number.isFinite(eq) && eq > 0 && getRebookSourceToken(b) != null;
}

/** Booking page URL for "Book again"; stashes waitlist inputs for the booking page to pick up. */
export function prepareRebook(b: RebookSourceBooking): string | null {
  const token = getRebookSourceToken(b);
  const eq = Number(b.equipment);
  if (!token || !Number.isFinite(eq) || eq <= 0) return null;
  if (token.startsWith("wl-")) {
    const prefill: RebookPrefill = {
      source: token,
      equipment_id: eq,
      user_id: b.user != null && Number.isFinite(Number(b.user)) ? Number(b.user) : null,
      label: (b.virtual_booking_id || "").trim() || "your waitlist request",
      input_values: b.input_values && typeof b.input_values === "object" ? b.input_values : {},
      ...(typeof b.atmosphere_sensitive_sample === "boolean"
        ? { atmosphere_sensitive_sample: b.atmosphere_sensitive_sample }
        : {}),
      ...(typeof b.sample_return_after_analysis === "boolean"
        ? { sample_return_after_analysis: b.sample_return_after_analysis }
        : {}),
    };
    try {
      sessionStorage.setItem(REBOOK_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // Storage unavailable: the booking page falls back to default inputs.
    }
  }
  return `/book-equipment?equipment_id=${eq}&rebookOf=${encodeURIComponent(token)}`;
}

export function readStashedRebookPrefill(source: string, equipmentId: number): RebookPrefill | null {
  try {
    const raw = sessionStorage.getItem(REBOOK_PREFILL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as RebookPrefill;
    if (p?.source !== source || Number(p.equipment_id) !== Number(equipmentId)) return null;
    return p;
  } catch {
    return null;
  }
}

type RebookFieldConfig = {
  field_key?: string;
  field_type?: string;
  options?: unknown;
};

/**
 * Keep only values the equipment still accepts: configured field keys (plus periodic `_elements`),
 * choices that still exist, and numbers/booleans coerced to the field's type.
 */
export function sanitizeRebookInputValues(
  source: Record<string, unknown>,
  fields: RebookFieldConfig[] | null | undefined,
  opts?: { skipKeys?: Set<string> }
): { carried: Record<string, RebookInputValue>; dropped: string[] } {
  const carried: Record<string, RebookInputValue> = {};
  const dropped: string[] = [];
  const byKey = new Map<string, RebookFieldConfig>();
  (fields ?? []).forEach((f) => {
    if (f.field_key) byKey.set(f.field_key, f);
  });

  Object.entries(source || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (opts?.skipKeys?.has(key)) return;
    if (key.endsWith("_elements")) {
      const base = byKey.get(key.slice(0, -"_elements".length));
      if (base && String(base.field_type || "").toUpperCase().trim() === "PERIODIC_TABLE") {
        carried[key] = Array.isArray(value) ? value.map(String).join(",") : String(value);
      } else {
        dropped.push(key);
      }
      return;
    }
    const field = byKey.get(key);
    if (!field) {
      dropped.push(key);
      return;
    }
    const type = String(field.field_type || "").toUpperCase().trim();
    const choices = Array.isArray(field.options)
      ? field.options.flatMap((o, i) => {
          const c = normalizeChoiceOption(o, i);
          return [c.value, c.label];
        })
      : [];
    if (type === "ICPMS_STANDARD_COVERAGE") {
      return;
    }
    if (type === "RADIO" || type === "COMBO") {
      const s = String(value);
      if (choices.length > 0 && !choices.includes(s)) {
        dropped.push(key);
        return;
      }
      carried[key] = s;
      return;
    }
    if (type === "MULTI_SELECT") {
      const list = (Array.isArray(value) ? value : String(value).split(","))
        .map((v) => String(v).trim())
        .filter(Boolean);
      const kept = choices.length > 0 ? list.filter((v) => choices.includes(v)) : list;
      if (kept.length < list.length) dropped.push(key);
      carried[key] = kept;
      return;
    }
    if (type === "TOGGLE") {
      carried[key] = value === true || String(value).toLowerCase() === "true";
      return;
    }
    if (type === "NUMERIC" || type === "PERIODIC_TABLE") {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) {
        dropped.push(key);
        return;
      }
      carried[key] = type === "NUMERIC" ? String(value).trim() : n;
      return;
    }
    carried[key] = value as RebookInputValue;
  });

  return { carried, dropped };
}
