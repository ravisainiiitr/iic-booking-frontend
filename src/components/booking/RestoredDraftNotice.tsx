import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  savedAt: number;
  onDiscard: () => void;
};

export function RestoredDraftNotice({ savedAt, onDiscard }: Props) {
  return (
    <div
      role="status"
      className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
      data-testid="restored-draft-notice"
    >
      <span className="flex items-center gap-2">
        <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          Restored your unsaved booking
          <span className="text-muted-foreground"> (from {formatDistanceToNow(savedAt, { addSuffix: true })})</span>
        </span>
      </span>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onDiscard}>
        Discard
      </Button>
    </div>
  );
}

export default RestoredDraftNotice;
