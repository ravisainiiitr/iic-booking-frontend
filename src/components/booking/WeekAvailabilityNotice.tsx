import type { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarClock, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountdown } from "@/lib/slotOpening";
import { cn } from "@/lib/utils";
import { useSlotOpening } from "./SlotOpeningCountdown";

/** Shown when the calendar opened on a later week because the current week has nothing left to book. */
export function AutoAdvancedWeekNote({
  fromWeekStart,
  weeksAhead = 1,
  onBack,
  className,
}: {
  fromWeekStart: Date;
  weeksAhead?: number;
  onBack: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      data-testid="auto-advanced-week-note"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-info-border bg-info-subtle px-3 py-2 text-sm text-info-subtle-foreground",
        className,
      )}
    >
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">
          {weeksAhead > 1 ? "Showing the first week with free slots" : "Showing next week"}
        </span>{" "}
        — no slots left this week (week of {format(fromWeekStart, "d MMM")}).
      </span>
      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onBack}>
        Back to this week
      </Button>
    </div>
  );
}

type NoSlotsProps = {
  /** The week on screen is the current calendar week. */
  isCurrentWeek: boolean;
  /** A later week can already be booked. */
  nextWeekOpen: boolean;
  onShowNextWeek?: () => void;
  /** Weekly opening rule (0 = Monday), for "Next week's slots open Wed 9:00 pm (in 1d 4h)". */
  refWeekday?: number | null;
  refTime?: string | null;
  /** Waitlist / other options to offer. */
  children?: ReactNode;
  className?: string;
};

/** The week on screen has no slot left that this user can book: say why and what to do next. */
export function NoSlotsLeftNotice({
  isCurrentWeek,
  nextWeekOpen,
  onShowNextWeek,
  refWeekday,
  refTime,
  children,
  className,
}: NoSlotsProps) {
  const opening = useSlotOpening(refWeekday, refTime);
  const showOpening = isCurrentWeek && !nextWeekOpen && opening.label != null && opening.remainingMs != null;
  return (
    <div
      role="status"
      data-testid="no-slots-left-notice"
      className={cn("rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-50", className)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CalendarX2 className="h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{isCurrentWeek ? "No slots left this week." : "No free slots in this week."}</span>
          {showOpening ? (
            <>
              {" "}
              Next week's slots open <span className="font-semibold">{opening.label}</span>{" "}
              <span className="whitespace-nowrap">(in {formatCountdown(opening.remainingMs!)})</span>.
            </>
          ) : nextWeekOpen ? (
            " Next week's slots are open."
          ) : null}
        </p>
        {nextWeekOpen && onShowNextWeek ? (
          <Button type="button" size="sm" variant="outline" onClick={onShowNextWeek}>
            Show next week
          </Button>
        ) : null}
      </div>
      {children ? <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
