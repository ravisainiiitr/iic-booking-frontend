import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

export type PendingEntry = {
  label: string;
  link: string;
  /** Bell notifications behind this entry; marked read when it is opened. */
  notification_ids?: number[];
};

export type PendingItem = {
  key: string;
  label: string;
  count: number;
  link: string;
  description: string;
  details?: string[];
  entries?: PendingEntry[];
};

function openEntry(entry: PendingEntry, onOpen: (link: string) => void) {
  for (const id of entry.notification_ids ?? []) {
    void apiClient.markNotificationAsRead(id).catch(() => undefined);
  }
  onOpen(entry.link);
}

export function PendingActionList({
  items,
  onOpen,
  compact = false,
}: {
  items: PendingItem[];
  onOpen: (link: string) => void;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => {
        const entries = item.entries ?? [];
        const listed = entries.length || item.details?.length || 0;
        const more = item.count - listed;
        return (
          <li
            key={item.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {item.label}
                <Badge className="bg-amber-500 text-amber-950 dark:text-amber-950 hover:bg-amber-500">{item.count}</Badge>
              </div>
              {!compact ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
              {entries.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {entries.map((entry) => (
                    <li key={entry.link} className="min-w-0">
                      <button
                        type="button"
                        className="block w-full truncate text-left text-primary underline-offset-2 hover:underline"
                        title={entry.label}
                        onClick={() => openEntry(entry, onOpen)}
                      >
                        • {entry.label}
                      </button>
                    </li>
                  ))}
                  {more > 0 ? <li className="text-muted-foreground">and {more} more</li> : null}
                </ul>
              ) : item.details && item.details.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-foreground/80">
                  {item.details.map((line, idx) => (
                    <li key={idx} className="truncate" title={line}>
                      • {line}
                    </li>
                  ))}
                  {more > 0 ? <li className="text-muted-foreground">and {more} more</li> : null}
                </ul>
              ) : null}
            </div>
            <Button size="sm" className="shrink-0" onClick={() => onOpen(item.link)}>
              {entries.length > 0 ? "View all" : "Open"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
