import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { MODE_INACTIVE_LABEL, modeInactiveNextLine, type ModeInactive } from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

const PILL = "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-100";

export function ModeInactivePill({ info, className }: { info: Pick<ModeInactive, "label">; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PILL, className)}>
      {info.label || MODE_INACTIVE_LABEL}
    </span>
  );
}

type Props = {
  info: ModeInactive;
  /** Catalog card: two short lines, no link. Equipment page: boxed notice with a link to the running mode. */
  compact?: boolean;
  className?: string;
};

/** Why a listed instrument cannot be booked now: another of its modes runs on its own. */
export default function ModeInactiveNotice({ info, compact = false, className }: Props) {
  const next = modeInactiveNextLine(info);
  if (compact) {
    return (
      <div className={cn("space-y-0.5 text-xs leading-snug text-amber-900 dark:text-amber-200", className)}>
        <p>{info.message}</p>
        {next ? <p className="text-muted-foreground">{next}</p> : null}
      </div>
    );
  }
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950",
        "dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
    >
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{info.label || MODE_INACTIVE_LABEL}: not available for booking</p>
        <p>{info.message}</p>
        {next ? <p>{next}</p> : null}
        <p>
          <Link
            to={`/equipment/${info.active_mode.equipment_id}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            Open {info.active_mode.name}
          </Link>{" "}
          to book the mode that is running now.
        </p>
      </div>
    </div>
  );
}
