import { useCallback, useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY_PREFIX = "iic.booking.expanded.";

function readFlag(key: string): boolean | null {
  try {
    const v = window.sessionStorage.getItem(KEY_PREFIX + key);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/** Expanded/collapsed choice remembered for this browser tab (sessionStorage); `fallback` until the user chooses. */
export function useSessionExpanded(key: string, fallback: boolean): [boolean, (open: boolean) => void] {
  const [stored, setStored] = useState<boolean | null>(() => readFlag(key));
  const set = useCallback(
    (open: boolean) => {
      setStored(open);
      try {
        window.sessionStorage.setItem(KEY_PREFIX + key, open ? "1" : "0");
      } catch {
        /* storage unavailable (private mode); the choice lasts until reload */
      }
    },
    [key],
  );
  return [stored ?? fallback, set];
}

type Props = {
  /** Session key for the remembered choice. */
  id: string;
  /** When false the content renders as-is (outside the peak booking window). */
  collapsible: boolean;
  title: ReactNode;
  /** Short state shown on the collapsed row, e.g. the applied template name. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Optional booking-page panel that starts as a one-line row during the peak window and expands on click. */
export function PeakCollapsible({ id, collapsible, title, summary, children, className }: Props) {
  const [open, setOpen] = useSessionExpanded(`peak.${id}`, false);
  const contentId = useId();
  if (!collapsible) return <>{children}</>;
  return (
    <div className={className} data-testid={`peak-collapsible-${id}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "mb-1.5 px-1 py-0.5 text-muted-foreground hover:text-foreground" : "border border-border/70 bg-muted/20 px-3 py-1.5 hover:bg-muted/40",
        )}
      >
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
        <span className="shrink-0 font-medium text-foreground">{title}</span>
        {summary && !open ? <span className="min-w-0 truncate text-muted-foreground">{summary}</span> : null}
        <span className="ml-auto shrink-0 text-xs font-medium text-primary">{open ? "Hide" : "Show"}</span>
      </button>
      <div id={contentId} hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  );
}
