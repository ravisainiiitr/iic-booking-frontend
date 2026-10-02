import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { InfoTip } from "./InfoTip";

export const ALTERNATE_ASK_HELP =
  "If this equipment has no free slot for your booking, the next available equipment in the same group is searched and shown to you; nothing is booked on it until you confirm.";
export const ALTERNATE_AUTO_HELP =
  "If this equipment has no free slot for your booking, the next available equipment in the same group is searched and your booking is allocated there automatically.";
export const ANY_SLOTS_HELP =
  "First priority: book your required slots and duration. If selected slots are unavailable, the system will auto-select available slots in this window (in time order, even if not consecutive) until your required duration is covered.";
export const SINGLE_SLOT_HELP =
  "If required duration cannot be met, book a single available slot and charge accordingly (number of slots/samples adjusted).";
export const NO_SLOT_ALTERNATE_HINT =
  "No slot is free on this equipment in the selected week, so you can submit without selecting a slot.";

type Toggle = { show: boolean; checked: boolean; onChange: (checked: boolean) => void };

type Props = {
  /** Checkbox id prefix; ids stay as before ("auto-allocate-alternative", "template-auto-allocate-alternative", …). */
  idPrefix?: string;
  alternate: Toggle;
  waitlist: Toggle & { label?: string };
  /** Unchecking also unchecks `singleSlot` (the single-slot fallback only applies to "any free slots"). */
  anySlots: Toggle;
  singleSlot: Toggle;
  /** One-line hint under the options (e.g. "you can submit without selecting a slot"). */
  hint?: ReactNode;
  className?: string;
};

function Chip({
  id,
  label,
  checked,
  onChange,
  help,
  helpLabel,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
  helpLabel?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border text-sm transition-colors",
        help ? "pr-0.5" : "pr-2.5",
        checked
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border bg-background text-foreground hover:border-primary/40",
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-center gap-1.5 py-1 pl-2.5">
        <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="h-3.5 w-3.5" />
        {label}
      </label>
      {help ? <InfoTip label={helpLabel ?? `About ${label}`}>{help}</InfoTip> : null}
    </span>
  );
}

/** "If your slots aren't free:" options as one compact row of independent toggles; explanations sit behind "i" buttons. */
export function BookingFallbackOptions({ idPrefix = "", alternate, waitlist, anySlots, singleSlot, hint, className }: Props) {
  const showSingle = anySlots.show && anySlots.checked && singleSlot.show;
  if (!alternate.show && !waitlist.show && !anySlots.show) return null;
  const headingId = `${idPrefix}booking-fallback-heading`;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid="booking-fallback-options"
      className={cn("rounded-lg border border-border/70 bg-muted/30 px-3 py-2 dark:bg-muted/20", className)}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span id={headingId} className="mr-1 text-sm font-medium text-muted-foreground">
          If your slots aren&apos;t free:
        </span>
        {alternate.show && (
          <Chip
            id={`${idPrefix}auto-allocate-alternative`}
            label="Try alternate equipment"
            checked={alternate.checked}
            onChange={alternate.onChange}
            help={alternate.checked ? ALTERNATE_AUTO_HELP : ALTERNATE_ASK_HELP}
            helpLabel="About alternate equipment"
          />
        )}
        {waitlist.show && (
          <Chip
            id={`${idPrefix}waitlisted-booking`}
            label={waitlist.label ?? "Waitlisted booking"}
            checked={waitlist.checked}
            onChange={waitlist.onChange}
          />
        )}
        {anySlots.show && (
          <Chip
            id={`${idPrefix}book-any-available-slots`}
            label="Pick any free slots in this window"
            checked={anySlots.checked}
            onChange={(v) => {
              anySlots.onChange(v);
              if (!v) singleSlot.onChange(false);
            }}
            help={ANY_SLOTS_HELP}
            helpLabel="About picking any free slots"
          />
        )}
        {showSingle && (
          <Chip
            id={`${idPrefix}book-even-if-single-slot-available`}
            label="Accept a single slot"
            checked={singleSlot.checked}
            onChange={singleSlot.onChange}
            help={SINGLE_SLOT_HELP}
            helpLabel="About accepting a single slot"
          />
        )}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
