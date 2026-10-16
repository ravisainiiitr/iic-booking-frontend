import type { BookingTemplateOptions, TemplateIfSlotTaken } from "@/lib/api";

/** How the slots of a booking are chosen. "preferred" exists only with a template's weekly preferred slot. */
export type SlotChoice = "manual" | "auto" | "preferred";

/**
 * What happens when the selected slots are taken by the time the user clicks Book (one choice).
 * same_day / any_day are a template's preferred-slot fallback (if_slot_taken, needs consent);
 * any_slots / any_slots_or_one are book_any_available_slots (+ book_even_if_single_slot_available).
 */
export type SlotFallback = "none" | "same_day" | "any_day" | "any_slots" | "any_slots_or_one";

export const SLOT_CHOICE_LABELS: Record<SlotChoice, { label: string; help?: string }> = {
  manual: { label: "I'll pick" },
  auto: {
    label: "Auto-select",
    help: "The required number of slots is selected for you on the calendar as soon as the charge is known. You can still review them before you click Book.",
  },
  preferred: {
    label: "My preferred slot",
    help: "Your usual weekday and time. Using the template selects it in the next week you can book (next week's slots open on Wednesday at 9:00 PM). Nothing is booked until you click Book.",
  },
};

/** The question these choices answer, on the booking page and in the template editor. */
export const SLOT_FALLBACK_QUESTION = "If someone books your selected slots before you confirm, what should we do?";

export const SLOT_FALLBACK_QUESTION_HELP =
  "This only matters if another user books one of your slots between selecting it and Confirm — most often in the first minutes after next week's slots open (Wednesday 9:00 PM). The usual checks (wallet, quota) still apply, and no slot is ever booked twice.";

/** The answer used when the user changes nothing. */
export const DEFAULT_SLOT_FALLBACK: SlotFallback = "none";

export const SLOT_FALLBACK_LABELS: Record<SlotFallback, { label: string; help: string; example: string }> = {
  none: {
    label: "Let me choose again",
    help: "Nothing is booked or charged. Your details stay filled in, the taken slots are marked “Just taken” and you pick other slots; with a template, the nearest free slots of the same length are suggested.",
    example: "You picked Thu 10:00–11:30 and someone books 10:30 first: you choose another time.",
  },
  same_day: {
    label: "Next free time, same day",
    help: "Books the next free slots of the same length after your preferred time, on the same date, and charges your wallet.",
    example: "Thu 10:00–11:00 is taken: Thu 14:00–15:00 is booked if it is free.",
  },
  any_day: {
    label: "Next free time, any day",
    help: "Books the next free slots of the same length after your preferred time, on any date you can currently book, and charges your wallet.",
    example: "Thu 10:00–11:00 is taken and Thursday is full: Fri 09:30–10:30 is booked.",
  },
  any_slots: {
    label: "Book other free slots this week",
    help: "Books the earliest free slots in the week shown until your time is covered; they may be on different days or have gaps between them. If not enough time is free that week, nothing is booked.",
    example: "You need 1 hour and Thu 10:00–11:00 is taken: Thu 15:00–15:30 and Fri 09:30–10:00 are booked.",
  },
  any_slots_or_one: {
    label: "Other free slots, or one slot with fewer samples",
    help: "Like “Book other free slots this week”; if not enough time is free, books the first free slot and reduces your samples to 1 so the job fits it (charged for one slot).",
    example: "You need 3 slots for 6 samples but only one slot is free: that slot is booked for 1 sample.",
  },
};

export const isTemplateFallback = (f: SlotFallback): f is "same_day" | "any_day" => f === "same_day" || f === "any_day";

export const fallbackForMode = (mode: TemplateIfSlotTaken | null | undefined): SlotFallback =>
  mode === "next_available_same_day" ? "same_day" : mode === "next_available_any" ? "any_day" : "none";

export const modeForFallback = (f: SlotFallback): TemplateIfSlotTaken =>
  f === "same_day" ? "next_available_same_day" : f === "any_day" ? "next_available_any" : "ask";

/** The single fallback the current flags amount to; "any free slots" wins, as on the server. */
export function slotFallbackFrom(state: {
  bookAny: boolean;
  single: boolean;
  templateMode?: TemplateIfSlotTaken | null;
}): SlotFallback {
  if (state.bookAny) return state.single ? "any_slots_or_one" : "any_slots";
  return fallbackForMode(state.templateMode);
}

export const flagsForFallback = (f: SlotFallback) => ({
  bookAny: f === "any_slots" || f === "any_slots_or_one",
  single: f === "any_slots_or_one",
});

export const slotChoiceFrom = (state: { preferred: boolean; auto: boolean }): SlotChoice =>
  state.preferred ? "preferred" : state.auto ? "auto" : "manual";

/**
 * A saved template's options made consistent, for templates saved before slot choice and fallback became
 * single choices: a preferred slot turns auto-select off, "any free slots" replaces the preferred-slot
 * fallback, and "a single slot" needs "any free slots". (The server reads templates the same way.)
 */
export function normaliseTemplateSlotOptions(t: {
  options?: BookingTemplateOptions | null;
  preferred_slot?: unknown;
  if_slot_taken?: TemplateIfSlotTaken | null;
}): { options: BookingTemplateOptions; ifSlotTaken: TemplateIfSlotTaken } {
  const options: BookingTemplateOptions = { ...(t.options || {}) };
  const bookAny = options.book_any_available_slots === true;
  if (t.preferred_slot && options.auto_slot_selection === true) options.auto_slot_selection = false;
  if (!bookAny && options.book_even_if_single_slot_available === true) options.book_even_if_single_slot_available = false;
  const ifSlotTaken = t.preferred_slot && !bookAny ? t.if_slot_taken ?? "ask" : "ask";
  return { options, ifSlotTaken };
}

/** Short summary for template cards, e.g. "If taken: book other free slots this week". */
export const slotFallbackSummary = (f: SlotFallback) =>
  f === "none" ? "If taken: you choose again" : `If taken: ${SLOT_FALLBACK_LABELS[f].label.toLowerCase()}`;
