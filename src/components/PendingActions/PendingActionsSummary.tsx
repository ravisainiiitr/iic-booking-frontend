import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

import { apiClient, type EquipmentMaintenanceStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PendingActionList, type PendingItem } from "@/components/PendingActions/PendingActionList";
import { MaintenanceAttention } from "@/components/PendingActions/MaintenanceAttention";

/**
 * Dashboard banner: how many items need the user's attention, expandable to the full list with links.
 * `excludeKeys` drops items that already have their own card on the same page.
 * `includeMaintenance` (OIC and Lab Operator dashboards) folds the equipment maintenance events in: periods whose
 * expected recovery has passed count as actions; the others are listed under "Maintenance updates".
 */
export default function PendingActionsSummary({
  className = "",
  excludeKeys = [],
  includeMaintenance = false,
}: {
  className?: string;
  excludeKeys?: string[];
  includeMaintenance?: boolean;
}) {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<PendingItem[]>([]);
  const [periods, setPeriods] = useState<EquipmentMaintenanceStatus[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getPendingActions().then((res) => {
      if (!cancelled) setAllItems(res.data?.items ?? []);
    });
    if (includeMaintenance) {
      apiClient.getMaintenanceStatus().then((res) => {
        if (!cancelled) setPeriods(res.data?.periods ?? []);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [includeMaintenance]);

  const excludeKey = excludeKeys.join("|");
  const items = useMemo(
    () => (excludeKey ? allItems.filter((i) => !excludeKey.split("|").includes(i.key)) : allItems),
    [allItems, excludeKey],
  );

  const maintenanceActions = periods.filter((p) => p.action_required).length;
  const maintenanceUpdates = periods.length - maintenanceActions;
  if (items.length === 0 && periods.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.count, 0) + maintenanceActions;
  const summary = [
    ...items.map((i) => `${i.label} (${i.count})`),
    ...(maintenanceActions ? [`Maintenance action (${maintenanceActions})`] : []),
    ...(maintenanceUpdates ? [`Maintenance updates (${maintenanceUpdates})`] : []),
  ].join(" · ");

  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/30 ${className}`}
      data-testid="pending-actions-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            Needs your attention ({total})
          </span>
          {!expanded ? (
            <span className="hidden truncate text-sm text-amber-900/80 dark:text-amber-200/80 md:inline">
              {summary}
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-400 bg-white/70 dark:bg-transparent"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
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
      {/* Maintenance that needs the OIC stays in view; everything else opens with "View details". */}
      {maintenanceActions ? (
        <div className="mt-3">
          <MaintenanceAttention periods={periods} show="actions" />
        </div>
      ) : null}
      {expanded ? (
        <div className="mt-3 space-y-3">
          {items.length ? <PendingActionList items={items} onOpen={(link) => navigate(link)} /> : null}
          <MaintenanceAttention periods={periods} show="updates" />
        </div>
      ) : null}
    </div>
  );
}
