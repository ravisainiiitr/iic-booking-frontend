import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small "Updating…" note shown while a list refetches after a filter change (the rows stay visible). */
export function UpdatingIndicator({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span role="status" className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Updating…
    </span>
  );
}

/** Inline hint under a date range that is out of order; the list keeps its previous results until fixed. */
export function DateRangeHint({ message, className }: { message: string | null | undefined; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-xs text-destructive", className)}>
      {message}
    </p>
  );
}

/** Classes for a table that is refetching: dimmed, rows kept. */
export function refetchingClass(active: boolean) {
  return active ? "opacity-60 transition-opacity" : "transition-opacity";
}
