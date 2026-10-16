import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DEFAULT_SLOT_FALLBACK,
  SLOT_FALLBACK_LABELS,
  SLOT_FALLBACK_QUESTION,
  SLOT_FALLBACK_QUESTION_HELP,
  type SlotFallback,
} from "@/lib/slotOptions";
import { cn } from "@/lib/utils";
import { InfoTip } from "./InfoTip";

export const ALTERNATE_ASK_HELP =
  "If this equipment has no free slot for your booking, the next available equipment in the same group is searched and shown to you; nothing is booked on it until you confirm.";
export const ALTERNATE_AUTO_HELP =
  "If this equipment has no free slot for your booking, the next available equipment in the same group is searched and your booking is allocated there automatically.";
export const WAITLIST_HELP =
  "If nothing can be booked, your request joins this equipment's waitlist and you are told your place in the queue.";
export const NO_SLOT_ALTERNATE_HINT =
  "No slot is free on this equipment in the selected week, so you can submit without selecting a slot.";

const pillClass = (checked: boolean, withHelp: boolean) =>
  cn(
    "inline-flex items-center rounded-full border text-sm transition-colors",
    withHelp ? "pr-0.5" : "pr-2.5",
    checked
      ? "border-primary/60 bg-primary/10 text-foreground"
      : "border-border bg-background text-foreground hover:border-primary/40",
  );

/** One option of a compact radio row; the explanation sits behind an "i" button outside the label. */
export function RadioPill({
  id,
  value,
  label,
  checked,
  help,
}: {
  id: string;
  value: string;
  label: string;
  checked: boolean;
  help?: ReactNode;
}) {
  return (
    <span className={pillClass(checked, !!help)}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-1.5 py-1 pl-2.5">
        <RadioGroupItem id={id} value={value} className="h-3.5 w-3.5" />
        {label}
      </label>
      {help ? <InfoTip label={`About ${label}`}>{help}</InfoTip> : null}
    </span>
  );
}

function CheckPill({
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
    <span className={pillClass(checked, !!help)}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-1.5 py-1 pl-2.5">
        <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="h-3.5 w-3.5" />
        {label}
      </label>
      {help ? <InfoTip label={helpLabel ?? `About ${label}`}>{help}</InfoTip> : null}
    </span>
  );
}

type Toggle = { show: boolean; checked: boolean; onChange: (checked: boolean) => void };

type Props = {
  /** Id prefix ("" on the booking page, "template-" in the template editor). */
  idPrefix?: string;
  /** Fallbacks that apply here, in order; the question is hidden when only "none" is left. */
  choices: SlotFallback[];
  value: SlotFallback;
  onChange: (value: SlotFallback) => void;
  /** Independent extras that apply after the chosen fallback. */
  alternate: Toggle;
  waitlist: Toggle & { label?: string };
  /** One-line hint under the options (e.g. "you can submit without selecting a slot"). */
  hint?: ReactNode;
  /** Shown under the options, e.g. the consent for automatic booking. */
  footer?: ReactNode;
  className?: string;
};

/** One answer as a card: the label, what happens in plain words, and an example. */
function FallbackCard({
  id,
  value,
  checked,
  isDefault,
  onSelect,
}: {
  id: string;
  value: SlotFallback;
  checked: boolean;
  isDefault: boolean;
  onSelect: (value: SlotFallback) => void;
}) {
  const { label, help, example } = SLOT_FALLBACK_LABELS[value];
  const descId = `${id}-desc`;
  return (
    <div
      onClick={() => onSelect(value)}
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors",
        checked
          ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <RadioGroupItem id={id} value={value} aria-describedby={descId} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <label htmlFor={id} className="cursor-pointer font-medium leading-snug text-foreground">
            {label}
          </label>
          {isDefault ? (
            <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">Default</span>
          ) : null}
        </div>
        <p id={descId} className="text-xs leading-snug text-muted-foreground">
          {help}
        </p>
        <p className="text-xs italic leading-snug text-muted-foreground/90">Example: {example}</p>
      </div>
    </div>
  );
}

/** "If your slots are taken" as one choice, plus the independent alternate-equipment and waitlist extras. */
export function BookingFallbackOptions({
  idPrefix = "",
  choices,
  value,
  onChange,
  alternate,
  waitlist,
  hint,
  footer,
  className,
}: Props) {
  const showChoice = choices.length > 1;
  if (!showChoice && !alternate.show && !waitlist.show) return null;
  const headingId = `${idPrefix}booking-fallback-heading`;
  const current = choices.includes(value) ? value : DEFAULT_SLOT_FALLBACK;
  return (
    <div
      data-testid="booking-fallback-options"
      className={cn("rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 dark:bg-muted/20", className)}
    >
      {showChoice && (
        <div className="mb-2">
          <div className="flex items-start gap-1">
            <span id={headingId} className="pt-0.5 text-sm font-semibold text-foreground">
              {SLOT_FALLBACK_QUESTION}
            </span>
            <InfoTip label="About this question">{SLOT_FALLBACK_QUESTION_HELP}</InfoTip>
          </div>
          <RadioGroup
            aria-labelledby={headingId}
            value={current}
            onValueChange={(v) => onChange(v as SlotFallback)}
            className={cn("mt-2 grid gap-2", choices.length > 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-3")}
          >
            {choices.map((c) => (
              <FallbackCard
                key={c}
                id={`${idPrefix}slot-fallback-${c}`}
                value={c}
                checked={current === c}
                isDefault={c === DEFAULT_SLOT_FALLBACK}
                onSelect={(v) => {
                  if (v !== current) onChange(v);
                }}
              />
            ))}
          </RadioGroup>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {(alternate.show || waitlist.show) && (
          <div
            role="group"
            aria-labelledby={`${idPrefix}booking-fallback-extras`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
          >
            <span id={`${idPrefix}booking-fallback-extras`} className="mr-1 text-sm font-medium text-muted-foreground">
              If nothing can be booked:
            </span>
            {alternate.show && (
              <CheckPill
                id={`${idPrefix}auto-allocate-alternative`}
                label="Try alternate equipment"
                checked={alternate.checked}
                onChange={alternate.onChange}
                help={alternate.checked ? ALTERNATE_AUTO_HELP : ALTERNATE_ASK_HELP}
                helpLabel="About alternate equipment"
              />
            )}
            {waitlist.show && (
              <CheckPill
                id={`${idPrefix}waitlisted-booking`}
                label={waitlist.label ?? "Join the waitlist"}
                checked={waitlist.checked}
                onChange={waitlist.onChange}
                help={WAITLIST_HELP}
                helpLabel="About the waitlist"
              />
            )}
          </div>
        )}
      </div>
      {footer}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
