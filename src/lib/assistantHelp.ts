/**
 * "Need help?" hand-off from a failed booking or charge calculation to the Booking Assistant.
 *
 * Pages call `offerAssistantHelp(...)` where they show the error; the assistant launcher listens for the
 * event, shows a small dismissible prompt and, if the user accepts, opens the assistant with a `ba_help`
 * action carrying the failure code. The assistant answers deterministically (free slots, quota reset,
 * wallet linking, missing fields) — nothing is booked or changed.
 */

export const ASSISTANT_OFFER_HELP_EVENT = "assistant:offer-help";

export const ASSISTANT_HELP_CODES = [
  "slot_taken",
  "no_slots",
  "quota_exceeded",
  "no_wallet",
  "insufficient_funds",
  "charge_error",
  "booking_failed",
] as const;

export type AssistantHelpCode = (typeof ASSISTANT_HELP_CODES)[number];

export type AssistantHelpDetail = {
  code: AssistantHelpCode;
  equipmentId?: number | null;
  equipmentName?: string | null;
  /** Error text the user saw; used to read quota numbers. Truncated before it is sent. */
  message?: string | null;
  /** Labels of required inputs that were empty (charge errors). */
  missingFields?: string[] | null;
  /** Date the user was booking (YYYY-MM-DD). */
  date?: string | null;
};

/** Aliases used by the booking page's own failure classifier. */
const CODE_ALIASES: Record<string, AssistantHelpCode> = {
  quota: "quota_exceeded",
  waitlist_full: "no_slots",
  other: "booking_failed",
};

export function normalizeHelpCode(code: string | null | undefined): AssistantHelpCode {
  const c = String(code || "").trim().toLowerCase();
  if ((ASSISTANT_HELP_CODES as readonly string[]).includes(c)) return c as AssistantHelpCode;
  return CODE_ALIASES[c] ?? "booking_failed";
}

/** Failure code for an error message from the booking API (mirrors the backend classifier). */
export function classifyBookingFailure(message: string | null | undefined): AssistantHelpCode {
  const m = String(message || "").toLowerCase();
  if (!m) return "booking_failed";
  if (m.includes("quota") && (m.includes("exceed") || m.includes("limit"))) return "quota_exceeded";
  if (m.includes("insufficient") || m.includes("enough balance")) return "insufficient_funds";
  if (
    m.includes("wallet") &&
    (m.includes("access") || m.includes("don't have") || m.includes("do not have") || m.includes("no wallet") || m.includes("not linked"))
  ) {
    return "no_wallet";
  }
  if (m.includes("no longer available") || m.includes("already booked") || m.includes("slot is taken") || (m.includes("not available") && m.includes("slot"))) {
    return "slot_taken";
  }
  if (m.includes("no slots") || m.includes("no available slots") || m.includes("fully booked")) return "no_slots";
  if (m.includes("charge") && (m.includes("calculat") || m.includes("estimate"))) return "charge_error";
  return "booking_failed";
}

const PROMPT_TEXT: Record<AssistantHelpCode, string> = {
  slot_taken: "The Booking Assistant can find you another free slot or add you to the waitlist.",
  no_slots: "The Booking Assistant can show the next free slots and the waitlist.",
  quota_exceeded: "The Booking Assistant can explain how much quota is left and when it resets.",
  no_wallet: "The Booking Assistant can show you how to link your supervisor's wallet.",
  insufficient_funds: "The Booking Assistant can explain how to top up the wallet this booking uses.",
  charge_error: "The Booking Assistant can tell you which details are missing for the charge.",
  booking_failed: "The Booking Assistant can find another free slot or explain what to do.",
};

const UTTERANCE: Record<AssistantHelpCode, string> = {
  slot_taken: "That slot was taken — help me find another one.",
  no_slots: "No free slots — what are my options?",
  quota_exceeded: "My booking went over the quota — what can I do?",
  no_wallet: "I can't book because I have no wallet — what do I do?",
  insufficient_funds: "Not enough wallet balance for my booking — what do I do?",
  charge_error: "The charge couldn't be calculated — what is missing?",
  booking_failed: "My booking didn't go through — what should I do?",
};

export function helpPromptText(code: AssistantHelpCode): string {
  return PROMPT_TEXT[code] ?? PROMPT_TEXT.booking_failed;
}

export function helpUtterance(detail: AssistantHelpDetail): string {
  const base = UTTERANCE[detail.code] ?? UTTERANCE.booking_failed;
  const name = (detail.equipmentName || "").trim();
  return name ? `${base} (${name.slice(0, 80)})` : base;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The structured `ba_help` action, trimmed to what the backend schema accepts. */
export function helpAction(detail: AssistantHelpDetail): { type: "ba_help"; payload: Record<string, unknown> } {
  const payload: Record<string, unknown> = { code: normalizeHelpCode(detail.code) };
  const eid = Number(detail.equipmentId);
  if (Number.isInteger(eid) && eid > 0) payload.equipment_id = eid;
  const message = String(detail.message || "").replace(/\s+/g, " ").trim();
  if (message) payload.message = message.slice(0, 400);
  const fields = (detail.missingFields || [])
    .map((f) => String(f || "").trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 12);
  if (fields.length) payload.missing_fields = fields;
  if (detail.date && DATE_RE.test(detail.date)) payload.date = detail.date;
  return { type: "ba_help", payload };
}

export function offerAssistantHelp(detail: Omit<AssistantHelpDetail, "code"> & { code: string }): void {
  if (typeof window === "undefined") return;
  const normalized: AssistantHelpDetail = { ...detail, code: normalizeHelpCode(detail.code) };
  window.dispatchEvent(new CustomEvent<AssistantHelpDetail>(ASSISTANT_OFFER_HELP_EVENT, { detail: normalized }));
}

/** Convenience for catch blocks: classify the error text and offer help. */
export function offerAssistantHelpForError(
  message: string | null | undefined,
  context: Omit<AssistantHelpDetail, "code" | "message"> = {},
): void {
  offerAssistantHelp({ ...context, code: classifyBookingFailure(message), message: message ?? undefined });
}
