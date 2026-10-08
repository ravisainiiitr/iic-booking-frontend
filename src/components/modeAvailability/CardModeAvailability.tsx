import { CalendarDays } from "lucide-react";
import ModeWeekdayChips from "@/components/modeAvailability/ModeWeekdayChips";
import {
  cardHeadline,
  familyColors,
  type CardModeAvailability as CardModeAvailabilityData,
  type ModeState,
} from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

const MAX_ROWS = 3;

const STATE_TEXT: Record<ModeState, string> = {
  available: "text-emerald-700 dark:text-emerald-300",
  full: "text-rose-700 dark:text-rose-300",
  not_open: "text-sky-700 dark:text-sky-300",
  not_running: "text-muted-foreground",
  maintenance: "text-amber-700 dark:text-amber-300",
};

type Props = {
  availability: CardModeAvailabilityData;
  className?: string;
};

/** Catalog card line for multi-mode equipment: running days per mode and the next free day. */
export default function CardModeAvailability({ availability, className }: Props) {
  const modes = availability.modes ?? [];
  if (modes.length === 0) return null;
  const colors = familyColors(modes);

  if (modes.length === 1) {
    const m = modes[0];
    return (
      <div
        className={cn("space-y-1.5 border-t border-border/60 pt-3", className)}
        data-testid="card-mode-availability"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground/90">
            <CalendarDays className="h-3 w-3" aria-hidden />
            Mode runs on
          </p>
          <ModeWeekdayChips weekdays={m.weekdays} color={colors.get(m.equipment_id)!} variant="letter" />
        </div>
        <p className={cn("text-xs font-medium", STATE_TEXT[m.state])}>{cardHeadline(m)}</p>
      </div>
    );
  }

  const shown = modes.slice(0, MAX_ROWS);
  const more = modes.length - shown.length;
  return (
    <div className={cn("space-y-1.5 border-t border-border/60 pt-3", className)} data-testid="card-mode-availability">
      <p className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground/90">
        <CalendarDays className="h-3 w-3" aria-hidden />
        {modes.length} modes share this instrument
      </p>
      <ul className="space-y-1.5">
        {shown.map((m) => (
          <li
            key={m.equipment_id}
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5"
            data-testid="card-mode-row"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors.get(m.equipment_id) }}
              aria-hidden
            />
            <span className="min-w-0 truncate text-xs font-medium text-foreground" title={m.name}>
              {m.code}
            </span>
            <span className={cn("text-right text-[11px] font-medium", STATE_TEXT[m.state])}>
              {cardHeadline(m, true)}
            </span>
            <ModeWeekdayChips
              weekdays={m.weekdays}
              color={colors.get(m.equipment_id)!}
              variant="letter"
              dense
              className="col-start-2 col-end-4 flex-nowrap gap-0.5"
            />
          </li>
        ))}
      </ul>
      {more > 0 ? <p className="text-[11px] text-muted-foreground">+{more} more mode{more === 1 ? "" : "s"}</p> : null}
    </div>
  );
}
