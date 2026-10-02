import { Clock } from "lucide-react";
import { formatDeadlineText, type CancelRescheduleDeadline } from "@/lib/bookingDeadlines";
import { cn } from "@/lib/utils";

interface BookingDeadlineNoteProps {
  deadline: CancelRescheduleDeadline | null;
  /** Optional secondary line, e.g. the sample-details edit refund window. */
  secondaryText?: string | null;
  className?: string;
}

export function BookingDeadlineNote({ deadline, secondaryText, className }: BookingDeadlineNoteProps) {
  const text = deadline ? formatDeadlineText(deadline) : null;
  if (!text && !secondaryText) return null;
  const passed = deadline?.kind === "passed";
  return (
    <div className={cn("space-y-0.5 text-xs", className)}>
      {text && (
        <p
          className={cn(
            "inline-flex items-center gap-1",
            passed ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground",
          )}
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          <span>{text}</span>
        </p>
      )}
      {secondaryText && <p className="text-muted-foreground">{secondaryText}</p>}
    </div>
  );
}
