import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { formatPeakClock } from "@/lib/peakWindow";

type Props = {
  startsAt: string | null;
  endsAt: string | null;
};

const DISMISS_KEY = "iic.peakNoticeDismissed";

export default function ExternalNoticeBanner({ startsAt, endsAt }: Props) {
  const [dismissedFor, setDismissedFor] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });
  if (!startsAt || dismissedFor === startsAt) return null;
  const start = formatPeakClock(startsAt);
  const end = formatPeakClock(endsAt);

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-start gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        New IIT Roorkee booking slots open soon. External access will be paused from{" "}
        <strong className="tabular-nums">{start}</strong> to <strong className="tabular-nums">{end}</strong>. Please
        finish what you are doing before {start}, or come back after {end}.
      </p>
      <button
        type="button"
        aria-label="Dismiss notice"
        className="rounded p-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-900"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, startsAt);
          } catch {
            /* private mode */
          }
          setDismissedFor(startsAt);
        }}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
