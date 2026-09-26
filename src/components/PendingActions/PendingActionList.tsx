import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PendingItem = {
  key: string;
  label: string;
  count: number;
  link: string;
  description: string;
  details?: string[];
};

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
        const more = item.count - (item.details?.length ?? 0);
        return (
          <li
            key={item.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {item.label}
                <Badge className="bg-amber-500 hover:bg-amber-500">{item.count}</Badge>
              </div>
              {!compact ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
              {item.details && item.details.length > 0 ? (
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
              Open <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
