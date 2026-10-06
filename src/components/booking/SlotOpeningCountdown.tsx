import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { countdownAriaText, formatCountdown, formatOpeningLabel, nextSlotOpening } from "@/lib/slotOpening";
import { useServerClockOffset } from "@/lib/useServerClockOffset";

export type SlotOpeningState = {
  /** Epoch ms of the next opening, or null when the schedule is unknown. */
  openingMs: number | null;
  remainingMs: number | null;
  /** "Wed 9:00 pm" in server time. */
  label: string | null;
  synced: boolean;
};

/**
 * Live countdown to the next weekly slot opening. One server-time sync per page session, then a local
 * timer (1 s in the last hour, otherwise every 15 s) — no polling.
 */
export function useSlotOpening(refWeekday: number | null | undefined, refTime: string | null | undefined): SlotOpeningState {
  const clock = useServerClockOffset();
  const [now, setNow] = useState(() => Date.now());
  const openingMs =
    refWeekday == null || !refTime
      ? null
      : nextSlotOpening(now + clock.offsetMs, clock.utcOffsetMinutes, refWeekday, refTime);
  const remainingMs = openingMs != null ? Math.max(0, openingMs - (now + clock.offsetMs)) : null;
  const fast = remainingMs != null && remainingMs < 60 * 60 * 1000;

  useEffect(() => {
    if (openingMs == null) return;
    const id = window.setInterval(() => setNow(Date.now()), fast ? 1000 : 15_000);
    return () => window.clearInterval(id);
  }, [openingMs, fast]);

  return {
    openingMs,
    remainingMs,
    label: openingMs != null ? formatOpeningLabel(openingMs, clock.utcOffsetMinutes) : null,
    synced: clock.synced,
  };
}

// Several calendars can be on one page; only the first mounted countdown speaks to screen readers.
let announcers: symbol[] = [];
const announcerListeners = new Set<() => void>();
function setAnnouncers(next: symbol[]) {
  announcers = next;
  announcerListeners.forEach((fn) => fn());
}
function subscribeAnnouncers(fn: () => void) {
  announcerListeners.add(fn);
  return () => announcerListeners.delete(fn);
}

function useIsAnnouncer(active: boolean): boolean {
  const id = useRef(Symbol("slot-opening")).current;
  useEffect(() => {
    if (!active) return;
    setAnnouncers([...announcers, id]);
    return () => setAnnouncers(announcers.filter((a) => a !== id));
  }, [active, id]);
  return useSyncExternalStore(subscribeAnnouncers, () => announcers[0] === id, () => false);
}

type Props = {
  /** 0 = Monday … 6 = Sunday, as returned by the slots API. */
  refWeekday: number | null | undefined;
  /** "HH:MM" server time. */
  refTime: string | null | undefined;
  /** Called once when the countdown reaches zero (e.g. reload slots). */
  onOpen?: () => void;
  /** Text before the time; defaults to "Next week's slots open". */
  lead?: string;
  className?: string;
};

export function SlotOpeningCountdown({ refWeekday, refTime, onOpen, lead = "Next week's slots open", className }: Props) {
  const { openingMs, remainingMs, label } = useSlotOpening(refWeekday, refTime);
  const firedFor = useRef<number | null>(null);
  const prevOpening = useRef<number | null>(null);
  const announce = useIsAnnouncer(openingMs != null);

  useEffect(() => {
    // When the opening passes, nextSlotOpening rolls forward a week; fire for the one that just passed.
    if (prevOpening.current != null && openingMs != null && openingMs > prevOpening.current && firedFor.current !== prevOpening.current) {
      firedFor.current = prevOpening.current;
      onOpen?.();
    }
    prevOpening.current = openingMs;
  }, [openingMs, onOpen]);

  useEffect(() => {
    if (remainingMs === 0 && openingMs != null && firedFor.current !== openingMs) {
      firedFor.current = openingMs;
      onOpen?.();
    }
  }, [remainingMs, openingMs, onOpen]);

  if (openingMs == null || remainingMs == null || !label) return null;

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-info-border bg-info-subtle px-3 py-1.5 text-sm text-info-subtle-foreground",
        className,
      )}
      data-testid="slot-opening-countdown"
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {lead} <span className="font-semibold">{label}</span>
      </span>
      <span className="font-mono tabular-nums font-semibold" aria-hidden>
        in {formatCountdown(remainingMs)}
      </span>
      {announce ? (
        <span className="sr-only" aria-live="polite">
          in {countdownAriaText(remainingMs)}
        </span>
      ) : (
        <span className="sr-only">in {countdownAriaText(remainingMs)}</span>
      )}
    </div>
  );
}

export default SlotOpeningCountdown;
