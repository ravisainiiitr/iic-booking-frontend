import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const BOOKING_STEPS = ["Sample info", "Charges", "Slots", "Confirm"] as const;

type Props = {
  /** 0-based index of the step the user is on. */
  current: number;
  /** When set, reached steps become buttons that jump back to their section. */
  onStepClick?: (index: number) => void;
  className?: string;
};

/** "1 Sample info · 2 Charges · 3 Slots · 4 Confirm" with the current step highlighted. */
export function BookingStepIndicator({ current, onStepClick, className }: Props) {
  return (
    <ol aria-label="Booking steps" className={cn("flex flex-wrap items-center gap-x-1 gap-y-1 text-xs sm:text-sm", className)}>
      {BOOKING_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const content = (
          <>
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-emerald-600 bg-emerald-700 text-white",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-muted-foreground/40 text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn(active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
            </span>
          </>
        );
        return (
          <li key={label} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span className="mx-1 text-muted-foreground" aria-hidden>
                ·
              </span>
            )}
            {onStepClick && i <= current ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`Go to ${label}`}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default BookingStepIndicator;
