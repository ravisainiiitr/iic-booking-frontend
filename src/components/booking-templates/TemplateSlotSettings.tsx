import type { ComponentProps } from "react";
import { BookingFallbackOptions } from "@/components/booking/BookingFallbackOptions";
import { SlotChoiceOptions } from "@/components/booking/SlotChoiceOptions";
import { TemplatePreferredSlotFields } from "@/components/TemplatePreferredSlotFields";
import { Checkbox } from "@/components/ui/checkbox";
import {
  flagsForFallback,
  isTemplateFallback,
  modeForFallback,
  slotChoiceFrom,
  slotFallbackFrom,
  type SlotChoice,
  type SlotFallback,
} from "@/lib/slotOptions";
import { autoBookConsentText, type PreferredSlotDraft } from "@/lib/templatePreferredSlot";

type Toggle = { show: boolean; checked: boolean; onChange: (checked: boolean) => void };

/**
 * Template editor: how slots are chosen (one choice) and what happens if they are taken (one choice),
 * mapped onto auto_slot_selection, the preferred slot, if_slot_taken and the "any free slots" flags.
 */
export function TemplateSlotSettings({
  autoSlotSelection,
  onAutoSlotSelectionChange,
  draft,
  onDraftChange,
  bookAny,
  single,
  onFallbackFlagsChange,
  allowAnySlots,
  alternate,
  waitlist,
  picker,
}: {
  autoSlotSelection: boolean;
  onAutoSlotSelectionChange: (auto: boolean) => void;
  draft: PreferredSlotDraft;
  onDraftChange: (next: PreferredSlotDraft) => void;
  bookAny: boolean;
  single: boolean;
  onFallbackFlagsChange: (flags: { bookAny: boolean; single: boolean }) => void;
  /** "Any free slots" fallbacks (not offered to external users). */
  allowAnySlots: boolean;
  alternate: Toggle;
  waitlist: Toggle;
  picker: Omit<ComponentProps<typeof TemplatePreferredSlotFields>, "draft" | "onChange">;
}) {
  const choice = slotChoiceFrom({ preferred: draft.enabled, auto: autoSlotSelection });
  const fallback = slotFallbackFrom({ bookAny, single, templateMode: draft.enabled ? draft.ifSlotTaken : null });
  const choices: SlotFallback[] = [
    "none",
    ...(draft.enabled ? (["same_day", "any_day"] as const) : []),
    ...(allowAnySlots ? (["any_slots", "any_slots_or_one"] as const) : []),
  ];

  const changeChoice = (next: SlotChoice) => {
    onAutoSlotSelectionChange(next === "auto");
    const enabled = next === "preferred";
    if (enabled !== draft.enabled) {
      onDraftChange({ ...draft, enabled, ...(enabled ? {} : { ifSlotTaken: "ask" as const, consent: false }) });
    }
  };

  const changeFallback = (next: SlotFallback) => {
    onFallbackFlagsChange(flagsForFallback(next));
    const mode = modeForFallback(next);
    if (mode !== draft.ifSlotTaken) onDraftChange({ ...draft, ifSlotTaken: mode, consent: mode === draft.consentedMode });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3 dark:bg-muted/20" data-testid="template-slot-settings">
      <SlotChoiceOptions
        idPrefix="template-"
        heading="Choose slots:"
        choices={["manual", "auto", "preferred"]}
        value={choice}
        onChange={changeChoice}
      />
      {draft.enabled && <TemplatePreferredSlotFields draft={draft} onChange={onDraftChange} {...picker} />}
      <BookingFallbackOptions
        idPrefix="template-"
        className="border-0 bg-transparent p-0 dark:bg-transparent"
        choices={choices}
        value={fallback}
        onChange={changeFallback}
        alternate={alternate}
        waitlist={{ ...waitlist, label: "Join the waitlist if nothing is booked" }}
        footer={
          isTemplateFallback(fallback) ? (
            <label
              htmlFor="template-auto-book-consent"
              className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50"
            >
              <Checkbox
                id="template-auto-book-consent"
                checked={draft.consent}
                onCheckedChange={(c) => onDraftChange({ ...draft, consent: c === true })}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm leading-snug">{autoBookConsentText(draft.ifSlotTaken)}</span>
            </label>
          ) : null
        }
      />
    </div>
  );
}

export default TemplateSlotSettings;
