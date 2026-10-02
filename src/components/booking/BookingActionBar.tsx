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
    const update = () => root.style.setProperty(ACTION_BAR_OFFSET_VAR, `${Math.ceil(el.offsetHeight)}px`);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(ACTION_BAR_OFFSET_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="booking-action-bar"
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-3 border-t border-border/80 bg-background/95 px-4 py-2 shadow-[0_-6px_16px_-10px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6",
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
