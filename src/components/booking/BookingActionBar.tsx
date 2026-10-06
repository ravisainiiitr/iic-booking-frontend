import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Floating launchers (Booking Assistant) read this to sit above the bar. */
export const ACTION_BAR_OFFSET_VAR = "--booking-action-bar-h";

type Props = {
  /** e.g. "3 slots · ₹1,200"; announced politely when it changes. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Booking actions pinned to the bottom of the viewport while the slot picker scrolls (sticky, in page flow). */
export function BookingActionBar({ summary, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    // Space from the viewport bottom to the bar's top edge: the bar height while pinned, more once the
    // page end scrolls into view and the bar rides up with the content. 0 when the bar is off screen or in
    // the upper half, where the launcher's default spot is already clear of it.
    const update = () => {
      const vh = window.innerHeight;
      const rect = el.getBoundingClientRect();
      const inLowerHalf = rect.bottom > 0 && rect.top < vh && rect.bottom > vh / 2;
      const offset = inLowerHalf ? Math.max(0, Math.ceil(vh - rect.top)) : 0;
      root.style.setProperty(ACTION_BAR_OFFSET_VAR, `${offset}px`);
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    ro?.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty(ACTION_BAR_OFFSET_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="booking-action-bar"
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-3 border-t border-border/80 bg-background/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-6px_16px_-10px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {summary ? (
          <p className="w-full min-w-0 truncate text-sm text-foreground sm:w-auto sm:flex-1" aria-live="polite">
            {summary}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
