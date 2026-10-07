import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlotCellDisplay, SlotLegendItem } from "@/lib/slotCalendarDisplay";

/** Cell look of the booking screen's slot grid, used by every slot calendar. */
export const SLOT_CELL_CLASS =
  "calendar-color-cell flex min-h-[48px] w-full items-center justify-center rounded-md border-2 border-white/50 p-2 text-center text-xs font-medium leading-tight shadow-sm sm:text-sm";

/** A cell the viewer has picked (booking selection, slots to change). */
export const SLOT_CELL_SELECTED_CLASS = "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background";

export function slotCellStyle(display: Pick<SlotCellDisplay, "background" | "color">): CSSProperties {
  return { backgroundColor: display.background, color: display.color };
}

const ALL_DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
const PHONE_QUERY = "(max-width: 767px)";

function useIsPhoneViewport(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  return isPhone;
}

export interface SlotWeekGridRow {
  key: string;
  label: ReactNode;
}

interface SlotWeekGridProps {
  weekStart: Date;
  rows: SlotWeekGridRow[];
  renderCell: (day: Date, rowKey: string, dayOffset: number, rowIndex: number) => ReactNode;
  /** Days of the week to show (0 = Monday); all seven by default. */
  dayOffsets?: number[];
  timeHeader?: ReactNode;
  renderDayHeader?: (day: Date, dayOffset: number) => ReactNode;
  renderRowLabel?: (row: SlotWeekGridRow, rowIndex: number) => ReactNode;
  /** On phones show one day at a time with a day picker, like the booking screen. */
  singleDayOnMobile?: boolean;
  /** Puts a green dot on days that still have a free slot in the phone day picker. */
  dayHasFreeSlot?: (day: Date) => boolean;
  className?: string;
  gridProps?: HTMLAttributes<HTMLDivElement>;
}

export function SlotDayHeader({ day }: { day: Date }) {
  return (
    <>
      <div>{format(day, "EEE")}</div>
      <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
    </>
  );
}

export const SLOT_DAY_HEADER_CLASS = "p-2 text-center text-sm font-semibold";
export const SLOT_ROW_LABEL_CLASS =
  "sticky left-0 z-10 flex items-center rounded-md bg-muted/90 p-2 text-sm font-medium tabular-nums dark:bg-background/95";

/** Weekly slot grid (time rows × days) laid out like the booking screen. */
export function SlotWeekGrid({
  weekStart,
  rows,
  renderCell,
  dayOffsets = ALL_DAY_OFFSETS,
  timeHeader = "Time",
  renderDayHeader,
  renderRowLabel,
  singleDayOnMobile = false,
  dayHasFreeSlot,
  className,
  gridProps,
}: SlotWeekGridProps) {
  const isPhone = useIsPhoneViewport();
  const singleDay = singleDayOnMobile && isPhone && dayOffsets.length > 1;
  const [phoneDay, setPhoneDay] = useState<number>(dayOffsets[0] ?? 0);
  const activePhoneDay = dayOffsets.includes(phoneDay) ? phoneDay : dayOffsets[0] ?? 0;
  const visible = singleDay ? [activePhoneDay] : dayOffsets;
  const columns: CSSProperties = singleDay
    ? { gridTemplateColumns: "5.5rem minmax(0, 1fr)" }
    : { gridTemplateColumns: `repeat(${visible.length + 1}, minmax(0, 1fr))` };
  const minWidth = singleDay ? undefined : Math.max(320, (visible.length + 1) * 100);

  return (
    <div className={cn("relative overflow-x-auto", className)}>
      {singleDay && (
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Choose a day">
          {dayOffsets.map((offset) => {
            const day = addDays(weekStart, offset);
            const active = offset === activePhoneDay;
            const hasFree = dayHasFreeSlot?.(day) ?? false;
            return (
              <button
                key={offset}
                type="button"
                aria-pressed={active}
                aria-label={`${format(day, "EEEE d MMMM")}${hasFree ? ", has free slots" : ""}`}
                onClick={() => setPhoneDay(offset)}
                className={cn(
                  "flex min-w-[3.25rem] flex-col items-center rounded-md border px-2 py-1 text-xs",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                )}
              >
                <span className="font-semibold">{format(day, "EEE")}</span>
                <span>{format(day, "d")}</span>
                <span
                  className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", hasFree ? "bg-emerald-500" : "bg-transparent")}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}
      <div {...gridProps} style={{ ...gridProps?.style, minWidth }}>
        <div className="mb-2 grid gap-2" style={columns}>
          <div className={cn(SLOT_ROW_LABEL_CLASS, "font-semibold")}>{timeHeader}</div>
          {visible.map((offset) => {
            const day = addDays(weekStart, offset);
            return renderDayHeader ? (
              <div key={offset} className="min-w-0">
                {renderDayHeader(day, offset)}
              </div>
            ) : (
              <div key={offset} className={SLOT_DAY_HEADER_CLASS}>
                <SlotDayHeader day={day} />
              </div>
            );
          })}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={row.key} className="mb-2 grid gap-2" style={columns}>
            {renderRowLabel ? renderRowLabel(row, rowIndex) : <div className={SLOT_ROW_LABEL_CLASS}>{row.label}</div>}
            {visible.map((offset) => (
              <div key={offset} className="min-w-0">
                {renderCell(addDays(weekStart, offset), row.key, offset, rowIndex)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SlotWeekNavProps {
  weekStart: Date;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  /** Shown under the date range (e.g. how many free slots, booking window). */
  subtitle?: ReactNode;
  /** Extra controls before Next Week (refresh, hide…). */
  actions?: ReactNode;
  className?: string;
}

/** Previous Week · date range · Next Week, as on the booking screen. */
export function SlotWeekNav({
  weekStart,
  onPrevious,
  onNext,
  canPrevious = true,
  canNext = true,
  subtitle,
  actions,
  className,
}: SlotWeekNavProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <Button type="button" variant="outline" size="sm" onClick={onPrevious} disabled={!canPrevious}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous Week
      </Button>
      <div className="order-first min-w-0 basis-full text-center sm:order-none sm:flex-1 sm:basis-auto">
        <div className="font-semibold">
          {format(weekStart, "MMM dd")} - {format(addDays(weekStart, 6), "MMM dd, yyyy")}
        </div>
        {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
          Next Week
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Colour key shared by every slot calendar. */
export function SlotCalendarLegend({
  items,
  trailing,
  className,
}: {
  items: SlotLegendItem[];
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="calendar-color-cell h-3 w-3 rounded-sm border border-black/10 dark:border-white/20"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
      {trailing}
    </div>
  );
}
