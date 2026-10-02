import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Clamp to the first two lines with "Show more" (peak window); never hides the note entirely. */
  clamp: boolean;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
};

export function ClampedNote({ clamp, children, className, buttonClassName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const clamped = clamp && !expanded;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !clamp) return;
    const measure = () => {
      if (!expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clamp, expanded, children]);

  return (
    <>
      <div
        ref={ref}
        id={contentId}
        className={cn("leading-snug", clamped && "overflow-hidden", className)}
        style={clamped ? { maxHeight: "2.75em" } : undefined}
        data-clamped={clamped ? "true" : undefined}
      >
        {children}
      </div>
      {clamp && (overflowing || expanded) ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-1 text-sm font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            buttonClassName,
          )}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}
