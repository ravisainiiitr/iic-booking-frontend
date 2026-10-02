import type { PreferredSlotDraft } from "@/lib/templatePreferredSlot";
import type { WeeklySlotRow } from "@/lib/weeklySlotTemplate";
import { WeeklyPreferredSlotPicker } from "@/components/WeeklyPreferredSlotPicker";

/** Template editor: the weekly calendar for choosing the preferred slot (shown when "My preferred slot" is chosen). */
export function TemplatePreferredSlotFields({
  draft,
  onChange,
  slotRows,
  hideTimes = false,
  slotsRequired,
  slotsRequiredPending = false,
  slotDurationMinutes,
  availableColor,
}: {
  draft: PreferredSlotDraft;
  onChange: (next: PreferredSlotDraft) => void;
  /** This equipment's weekly slot timings (vertical axis of the calendar). */
  slotRows: WeeklySlotRow[];
  hideTimes?: boolean;
  /** Slots the template's sample details need; null while unknown. */
  slotsRequired: number | null;
  slotsRequiredPending?: boolean;
  slotDurationMinutes?: number | null;
  /** The equipment's "Available" calendar colour, so cells look like the booking grid. */
  availableColor?: string | null;
}) {
  return (
    <div className="space-y-2" data-testid="template-preferred-slot">
      <WeeklyPreferredSlotPicker
        rows={slotRows}
        hideTimes={hideTimes}
        slotsRequired={slotsRequired}
        slotsRequiredPending={slotsRequiredPending}
        slotDurationMinutes={slotDurationMinutes}
        availableColor={availableColor}
        value={draft.startTime ? { weekday: draft.weekday, startTime: draft.startTime, slotCount: draft.slotCount } : null}
        onChange={(next, reason) =>
          onChange(
            next
              ? {
                  ...draft,
                  weekday: next.weekday,
                  startTime: next.startTime,
                  slotCount: next.slotCount,
                  slotMaster: reason === "resize" ? draft.slotMaster : null,
                }
              : { ...draft, startTime: "", slotMaster: null }
          )
        }
      />
      <p className="text-xs text-muted-foreground">
        If your sample details need a different number of slots when you book, that number is used instead.
      </p>
    </div>
  );
}

export default TemplatePreferredSlotFields;
