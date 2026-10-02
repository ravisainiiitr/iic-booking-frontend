import { RadioGroup } from "@/components/ui/radio-group";
import { SLOT_CHOICE_LABELS, type SlotChoice } from "@/lib/slotOptions";
import { cn } from "@/lib/utils";
import { RadioPill } from "./BookingFallbackOptions";

/** "How are slots chosen?" as one compact choice: pick yourself, auto-select, or a template's preferred slot. */
export function SlotChoiceOptions({
  idPrefix = "",
  heading,
  choices,
  value,
  onChange,
  labels,
  helps,
  className,
}: {
  idPrefix?: string;
  heading: string;
  choices: SlotChoice[];
  value: SlotChoice;
  onChange: (value: SlotChoice) => void;
  /** Overrides a choice's label, e.g. "Preferred: Thu 09:00". */
  labels?: Partial<Record<SlotChoice, string>>;
  /** Overrides a choice's explanation (e.g. equipment-specific auto-select rules). */
  helps?: Partial<Record<SlotChoice, string>>;
  className?: string;
}) {
  const headingId = `${idPrefix}slot-choice-heading`;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)} data-testid="slot-choice-options">
      <span id={headingId} className="mr-1 text-sm font-medium text-muted-foreground">
        {heading}
      </span>
      <RadioGroup
        aria-labelledby={headingId}
        value={value}
        onValueChange={(v) => onChange(v as SlotChoice)}
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
      >
        {choices.map((c) => (
          <RadioPill
            key={c}
            id={`${idPrefix}slot-choice-${c}`}
            value={c}
            label={labels?.[c] ?? SLOT_CHOICE_LABELS[c].label}
            checked={value === c}
            help={helps?.[c] ?? SLOT_CHOICE_LABELS[c].help}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
