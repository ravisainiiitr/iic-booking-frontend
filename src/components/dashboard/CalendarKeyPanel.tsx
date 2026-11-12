import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The calendar's key under the OIC / Lab In-charge weekly calendar: how to select slots, the status legend and the
 * personal calendar colours. Collapsed on every visit so the dashboard stays clean; the bar for selected slots
 * stays outside it, in view.
 */
export function CalendarKeyPanel({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/20", className)} data-testid="calendar-key-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        Calendar key, slot selection and colours
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={bodyId} className="space-y-3 border-t border-border/60 px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
