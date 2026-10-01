import { useId } from "react";
import { CalendarClock } from "lucide-react";
import type { TemplateIfSlotTaken } from "@/lib/api";
import {
  IF_SLOT_TAKEN_OPTIONS,
  autoBookConsentText,
  type PreferredSlotDraft,
} from "@/lib/templatePreferredSlot";
import type { WeeklySlotRow } from "@/lib/weeklySlotTemplate";
import { WeeklyPreferredSlotPicker } from "@/components/WeeklyPreferredSlotPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

/** Template editor: optional weekly preferred slot and what to do if it is taken when the user clicks Book. */
export function TemplatePreferredSlotFields({
  draft,
  onChange,
  slotRows,
  hideTimes = false,
  slotsRequired,
  slotsRequiredPending = false,
  slotDurationMinutes,
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
}) {
  const id = useId();
  const set = (patch: Partial<PreferredSlotDraft>) => onChange({ ...draft, ...patch });
  const needsConsent = draft.ifSlotTaken !== "ask";

  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/20 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <Label htmlFor={`${id}-enabled`} className="text-sm font-medium text-foreground cursor-pointer">
            Preferred slot (optional)
          </Label>
        </div>
        <Switch id={`${id}-enabled`} checked={draft.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <p className="text-xs text-muted-foreground">
        A weekly preference. When you load this template, the next matching day and time in your open booking window is
        selected for you (next week&apos;s slots open on Wednesday at 9:00 PM). You still click Book; nothing is booked in
        advance.
      </p>

      {draft.enabled && (
        <div className="space-y-4">
          <WeeklyPreferredSlotPicker
            rows={slotRows}
            hideTimes={hideTimes}
            slotsRequired={slotsRequired}
            slotsRequiredPending={slotsRequiredPending}
            slotDurationMinutes={slotDurationMinutes}
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

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">If this slot is already taken when I click Book</p>
            <RadioGroup
              value={draft.ifSlotTaken}
              onValueChange={(v) => set({ ifSlotTaken: v as TemplateIfSlotTaken, consent: v === draft.consentedMode })}
              className="gap-1"
            >
              {IF_SLOT_TAKEN_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  htmlFor={`${id}-taken-${o.value}`}
                  className="flex items-start gap-3 cursor-pointer rounded-lg p-2.5 hover:bg-background/50"
                >
                  <RadioGroupItem id={`${id}-taken-${o.value}`} value={o.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm text-foreground">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {needsConsent && (
            <label
              htmlFor={`${id}-consent`}
              className="flex items-start gap-3 cursor-pointer rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-50"
            >
              <Checkbox
                id={`${id}-consent`}
                checked={draft.consent}
                onCheckedChange={(c) => set({ consent: c === true })}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm leading-relaxed">{autoBookConsentText(draft.ifSlotTaken)}</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default TemplatePreferredSlotFields;
