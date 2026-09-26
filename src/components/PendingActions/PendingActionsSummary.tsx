import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PendingActionList, type PendingItem } from "@/components/PendingActions/PendingActionList";

/** Dashboard banner: how many items need the user's attention, expandable to the full list with links. */
export default function PendingActionsSummary({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getPendingActions().then((res) => {
      if (!cancelled) setItems(res.data?.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/30 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            Needs your attention ({total})
          </span>
          {!expanded ? (
            <span className="hidden truncate text-sm text-amber-900/80 dark:text-amber-200/80 md:inline">
              {items.map((i) => `${i.label} (${i.count})`).join(" · ")}
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-400 bg-white/70 dark:bg-transparent"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Hide <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              View details <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {expanded ? (
        <div className="mt-3">
          <PendingActionList items={items} onOpen={(link) => navigate(link)} />
        </div>
      ) : null}
    </div>
  );
}
