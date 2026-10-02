import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatNumericBound,
  formatStepAttr,
  nudgeNumericValue,
  numericFieldAllowsNegative,
  type NumericFieldBounds,
} from "@/lib/numericFieldLimits";
import {
  commitNumericInput,
  numericInputHint,
  numericInputStatus,
  sanitizeNumericTyping,
  type NumericClampNote,
} from "@/lib/numericInput";

export type NumericFieldInputProps = {
  id: string;
  value: unknown;
  bounds: NumericFieldBounds;
  /** Called with the text to store while typing, from the arrows, and after the blur correction. */
  onValueChange: (next: string) => void;
  /** Called with the corrected value on blur; defaults to `onValueChange`. */
  onCommit?: (next: string) => void;
  /** Replaces "Max N reached", e.g. for the combined maximum across sample sets. */
  maxHint?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: "default" | "compact";
  inputClassName?: string;
  className?: string;
  /** Extra id(s) for aria-describedby (e.g. an "Allowed: 1 – 10" line rendered by the caller). */
  describedBy?: string;
};

/**
 * Number box with up / down arrows for NUMERIC dynamic fields. The arrows stop at the min / max, a value
 * over the max is corrected while typing, a value under the min is corrected on blur, and a short hint next
 * to the box says when the max is reached or the value is out of range.
 */
export function NumericFieldInput({
  id,
  value,
  bounds,
  onValueChange,
  onCommit,
  maxHint,
  label,
  required,
  disabled,
  placeholder,
  size = "default",
  inputClassName,
  className,
  describedBy,
}: NumericFieldInputProps) {
  const [clampNote, setClampNote] = useState<NumericClampNote>(null);
  const status = numericInputStatus(value, bounds);
  const hint = numericInputHint(value, bounds, { maxHint, clampNote });
  const allowsNegative = numericFieldAllowsNegative(bounds);
  const stepAttr = formatStepAttr(bounds.step);
  const minText = formatNumericBound(bounds.min);
  const maxText = formatNumericBound(bounds.max);
  const hintId = `${id}-limit-hint`;
  const text = value === undefined || value === null ? "" : String(value);

  useEffect(() => {
    if (clampNote?.kind === "max" && !status.atMax) setClampNote(null);
    if (clampNote?.kind === "min" && !status.atMin) setClampNote(null);
  }, [clampNote, status.atMax, status.atMin]);

  const nudge = (direction: 1 | -1) => {
    if (disabled) return;
    if (direction === 1 ? !status.canIncrement : !status.canDecrement) return;
    setClampNote(null);
    onValueChange(nudgeNumericValue(text, direction, bounds));
  };

  const compact = size === "compact";
  const arrowClass = cn(
    "w-7 rounded-none border-input border-l-0 text-muted-foreground hover:bg-muted hover:text-foreground",
    compact ? "h-4" : "h-5",
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <div className="inline-flex items-stretch">
        <Input
          id={id}
          type="number"
          inputMode={allowsNegative ? "text" : "decimal"}
          value={text}
          onChange={(e) => {
            const next = sanitizeNumericTyping(e.target.value, bounds);
            if (!next) return;
            setClampNote(next.clampNote);
            onValueChange(next.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              nudge(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              nudge(-1);
            }
          }}
          onBlur={(e) => {
            const committed = commitNumericInput(e.target.value, bounds);
            if (committed.clampNote) setClampNote(committed.clampNote);
            if (committed.value !== e.target.value.trim() || onCommit) {
              (onCommit ?? onValueChange)(committed.value);
            }
          }}
          required={required}
          min={bounds.min}
          max={bounds.max}
          step={stepAttr}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          aria-valuemin={bounds.min}
          aria-valuemax={bounds.max}
          aria-valuenow={status.value}
          aria-invalid={status.belowMin || status.aboveMax || undefined}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
          className={cn(
            "rounded-r-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            compact ? "h-8 w-24 text-sm" : "w-28",
            (status.belowMin || status.aboveMax) && "border-destructive focus-visible:ring-destructive",
            inputClassName,
          )}
        />
        <div className="flex flex-col shrink-0">
          <span className="flex" title={!status.canIncrement && status.value !== undefined ? `Maximum is ${maxText}` : undefined}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(arrowClass, "rounded-tr-md border-b-0")}
              disabled={disabled || !status.canIncrement}
              aria-label={`Increase by ${stepAttr}`}
              aria-controls={id}
              onClick={() => nudge(1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </span>
          <span className="flex" title={status.value !== undefined && !status.canDecrement ? `Minimum is ${minText}` : undefined}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(arrowClass, "rounded-br-md")}
              disabled={disabled || !status.canDecrement}
              aria-label={`Decrease by ${stepAttr}`}
              aria-controls={id}
              onClick={() => nudge(-1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      </div>
      <span
        id={hintId}
        aria-live="polite"
        className={cn(
          "text-xs",
          hint?.tone === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {hint?.text ?? ""}
      </span>
    </div>
  );
}
