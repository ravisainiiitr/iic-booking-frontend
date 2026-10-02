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

export const SLOT_FALLBACK_LABELS: Record<SlotFallback, { label: string; help: string }> = {
  none: {
    label: "Let me choose again",
    help: "Nothing is booked. Your details stay filled in and you pick other slots; with a template, the nearest free slots of the same length are suggested.",
  },
  same_day: {
    label: "Next free time, same day",
    help: "Books the next free slots of the same length after your preferred time, on the same date, and charges your wallet.",
  },
  any_day: {
    label: "Next free time, any day",
    help: "Books the next free slots of the same length after your preferred time, on any date you can currently book, and charges your wallet.",
  },
  any_slots: {
    label: "Any free slots this week",
    help: "Books other free slots in the week shown, in time order (they may not be back-to-back), until your required time is covered.",
  },
  any_slots_or_one: {
    label: "Any free slots, or just one",
    help: "Like “Any free slots this week”; if not enough are free, books one free slot and reduces your samples to fit (charged for one slot).",
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

/** Short summary for template cards, e.g. "If taken: any free slots this week". */
export const slotFallbackSummary = (f: SlotFallback) =>
  f === "none" ? "If taken: you choose again" : `If taken: ${SLOT_FALLBACK_LABELS[f].label.toLowerCase()}`;
