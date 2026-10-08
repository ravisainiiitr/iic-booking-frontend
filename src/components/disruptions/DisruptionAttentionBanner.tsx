import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onOpen: () => void;
  onDismiss: () => void;
}

/** Dashboard reminder that some disruptions have no recorded reason. */
export function DisruptionAttentionBanner({ count, onOpen, onDismiss }: Props) {
  if (count <= 0) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <AlertTriangle className="hidden h-5 w-5 shrink-0 text-amber-600 sm:block dark:text-amber-400" aria-hidden />
      <p className="flex-1">
        <strong>
          {count} disruption{count === 1 ? "" : "s"} need{count === 1 ? "s" : ""} a reason.
        </strong>{" "}
        Recording why equipment was unavailable keeps the downtime history useful.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 bg-amber-600 text-white hover:bg-amber-700" onClick={onOpen}>
          Review
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
          aria-label="Dismiss for this session"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
