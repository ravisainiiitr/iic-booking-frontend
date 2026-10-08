import { WEEKDAY_LETTER, WEEKDAY_SHORT, describeModeWeekdays } from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

type Props = {
  weekdays: number[];
  color: string;
  /** "short" = Mon … Sun (equipment page), "letter" = M T W … (catalog card). */
  variant?: "short" | "letter";
  /** Smaller letter chips for per-mode rows on a card. */
  dense?: boolean;
  className?: string;
};

/** Mon–Sun chips with the days the mode runs filled in its colour. */
export default function ModeWeekdayChips({ weekdays, color, variant = "short", dense = false, className }: Props) {
  const active = new Set(weekdays);
  const labels = variant === "letter" ? WEEKDAY_LETTER : WEEKDAY_SHORT;
  return (
    <div className={cn("flex flex-wrap gap-1", className)} data-testid="mode-weekday-chips">
      <span className="sr-only">{describeModeWeekdays(weekdays)}</span>
      {labels.map((label, day) => {
        const on = active.has(day);
        return (
          <span
            key={day}
            aria-hidden
            data-active={on ? "true" : "false"}
            title={`${WEEKDAY_SHORT[day]}: ${on ? "runs" : "does not run"}`}
            className={cn(
              "inline-flex items-center justify-center rounded font-semibold leading-none",
              variant === "short"
                ? "h-6 min-w-[2.1rem] px-1.5 text-[11px]"
                : dense
                  ? "h-4 w-4 text-[9px]"
                  : "h-5 w-5 text-[10px]",
              on
                ? "text-white shadow-sm"
                : "border border-dashed border-border bg-muted/40 text-muted-foreground/70",
            )}
            style={on ? { backgroundColor: color } : undefined}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
