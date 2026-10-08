import { useEffect, useState } from "react";
import { AlertTriangle, Hourglass } from "lucide-react";
import type { BookingResultsDeadline, BookingResultsOverdue } from "@/lib/api";
import { resultsDeadlineApplies } from "@/components/booking/ResultsDeadlineNotice";

/** Same wording as the backend `overdue_label`: "less than 1 h", "5 h", "2 days", "2 days 3 h". */
export function formatOverdueBy(ms: number): string {
  const hours = Math.max(Math.floor(ms / 3_600_000), 0);
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  if (days) return `${days} day${days !== 1 ? "s" : ""}${rem ? ` ${rem} h` : ""}`;
  return hours ? `${hours} h` : "less than 1 h";
}

/** Overdue once the due time is reached, unless the sample is waiting for the user; recomputed live from `due_at`. */
export function resultsOverdueState(results: BookingResultsOverdue, now: Date): { overdue: boolean; overdueBy: string | null } {
  const due = new Date(results.due_at).getTime();
  if (Number.isNaN(due)) return { overdue: results.overdue, overdueBy: results.overdue_by };
  const overdue = !results.waiting_for_user && now.getTime() >= due;
  return { overdue, overdueBy: overdue ? formatOverdueBy(now.getTime() - due) : null };
}

function ruleText(hours: number): string {
  return `${hours} hour${hours !== 1 ? "s" : ""} after the booking end, or after the sample receipt plus the booked time if that is later`;
}

function useMinuteClock(initial?: Date): Date {
  const [now, setNow] = useState(() => initial ?? new Date());
  useEffect(() => {
    if (initial) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [initial]);
  return initial ?? now;
}

/**
 * Booking details: when the results become overdue (equipment's results overdue time). Staff always see it; the
 * booking user only when the OIC turned on "Show results countdown to users" (the server sends nothing otherwise).
 * `userDeadline` is the equipment's results deadline when it is also shown to the user, so both appear together.
 */
export function ResultsOverdueNotice({
  results,
  status,
  staffView,
  userDeadline,
  now: fixedNow,
}: {
  results?: BookingResultsOverdue | null;
  status: string;
  staffView: boolean;
  userDeadline?: BookingResultsDeadline | null;
  now?: Date;
}) {
  const now = useMinuteClock(fixedNow);
  if (!results || !resultsDeadlineApplies(status)) return null;
  if (!staffView && !results.visible_to_user) return null;
  const { overdue, overdueBy } = resultsOverdueState(results, now);
  const waiting = results.waiting_for_user && now.getTime() >= new Date(results.due_at).getTime();
  const box = overdue
    ? "mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
    : "mb-4 flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm";
  const icon = overdue ? (
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
  ) : (
    <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
  );
  const sub = overdue ? "text-xs" : "text-xs text-muted-foreground";

  if (staffView) {
    return (
      <div className={box} data-testid="results-overdue-staff">
        {icon}
        <div className="min-w-0">
          <p className="font-semibold">
            {overdue
              ? `Results overdue by ${overdueBy}`
              : waiting
                ? "Results on hold: the sample is waiting for the user"
                : `Results due by ${results.due_display}`}
          </p>
          <p className={sub}>
            {overdue ? `Results were due by ${results.due_display}: ` : "Results become overdue "}
            {ruleText(results.hours)}
            {results.extended ? " (extended for this booking)" : ""}.{" "}
            {results.visible_to_user ? "The user can see this countdown." : "Not shown to the user."}
          </p>
        </div>
      </div>
    );
  }

  if (waiting) return null;
  return (
    <div className={box} data-testid="results-overdue-user">
      {icon}
      <div className="min-w-0">
        <p className="font-semibold text-foreground">
          {overdue ? `Results overdue by ${overdueBy}` : `Results expected by ${results.due_display}`}
        </p>
        <p className={sub}>
          {overdue
            ? `Results were expected by ${results.due_display}. The laboratory is working on your results and will update you. You can use Message the lab for any question.`
            : `The laboratory aims to share results within ${ruleText(results.hours)}. You receive an email and a notification when they are available.`}
        </p>
        {userDeadline?.visible_to_user ? (
          <p className={sub}>Results deadline for this equipment: {userDeadline.due_display}.</p>
        ) : null}
      </div>
    </div>
  );
}
