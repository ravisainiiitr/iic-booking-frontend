import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "30 Sep 2026" over "10:49 pm"; neither line wraps, so a date never spreads over four lines. */
export function StackedDateTime({ value, className }: { value: string | null | undefined; className?: string }) {
  const d = parseDate(value);
  if (!d) return <span className="text-muted-foreground">{value || "—"}</span>;
  return (
    <time dateTime={value ?? undefined} className={cn("block leading-tight", className)}>
      <span className="block whitespace-nowrap">{format(d, "d MMM yyyy")}</span>
      <span className="block whitespace-nowrap text-xs text-muted-foreground">{format(d, "h:mm aaa")}</span>
    </time>
  );
}

/** "30 Sep 2026, 10:49 pm" that breaks only between the date and the time. */
export function InlineDateTime({ value, className }: { value: string | null | undefined; className?: string }) {
  const d = parseDate(value);
  if (!d) return <span className={cn("text-muted-foreground", className)}>{value || "—"}</span>;
  return (
    <time dateTime={value ?? undefined} className={className}>
      <span className="whitespace-nowrap">{format(d, "d MMM yyyy")},</span>{" "}
      <span className="whitespace-nowrap">{format(d, "h:mm aaa")}</span>
    </time>
  );
}

const CLAMP_CLASS = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" } as const;

type ClampedTextProps = {
  text: string;
  lines?: 1 | 2 | 3;
  className?: string;
  /** Shown only once expanded (e.g. the inputs of a booking attempt). */
  details?: ReactNode;
  /** Extra controls on the "more" row (e.g. a Details link). */
  actions?: ReactNode;
};

/**
 * Long text clamped to a few lines, with the full text as a tooltip and a "more" / "less" toggle
 * when it is cut off (or when there are hidden details).
 */
export function ClampedText({ text, lines = 2, className, details, actions }: ClampedTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  const canToggle = overflowing || expanded || details != null;
  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={ref}
        title={expanded ? undefined : text}
        className={cn("[overflow-wrap:anywhere]", !expanded && CLAMP_CLASS[lines])}
      >
        {text}
      </div>
      {expanded && details ? <div className="mt-1 [overflow-wrap:anywhere]">{details}</div> : null}
      {canToggle || actions ? (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {canToggle ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? "less" : "more"}
            </button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

const CHIP_TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  gray: "border-border bg-muted text-muted-foreground",
} as const;

export type StatusChipTone = keyof typeof CHIP_TONES;

export function StatusChip({
  tone,
  children,
  title,
  className,
}: {
  tone: StatusChipTone;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
