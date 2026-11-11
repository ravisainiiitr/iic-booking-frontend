import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

import { apiClient, type EquipmentMaintenanceStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PendingActionList, type PendingItem } from "@/components/PendingActions/PendingActionList";
import { MaintenanceAttention } from "@/components/PendingActions/MaintenanceAttention";

/**
 * Dashboard banner, the one place for everything that needs the user's attention: pending actions, equipment
 * maintenance and disruptions without a reason (these used to have a separate "Equipment alerts" panel).
 * Collapsed to one line on every visit; expandable to the full list with links.
 * `excludeKeys` drops items that already have their own card on the same page.
 * `includeMaintenance` (OIC and Lab Operator dashboards) folds the equipment maintenance events in: periods whose
 * expected recovery has passed count as actions; the others are listed under "Maintenance updates".
 * `showPendingItems` false leaves the pending actions out (the administration overview lists them itself).
 * `disruptionsMissingReason` adds the disruptions that still need a reason, with `onReviewDisruptions` to open them.
 */
export default function PendingActionsSummary({
  className = "",
  excludeKeys = [],
  includeMaintenance = false,
  showPendingItems = true,
  disruptionsMissingReason = 0,
  onReviewDisruptions,
}: {
  className?: string;
  excludeKeys?: string[];
  includeMaintenance?: boolean;
  showPendingItems?: boolean;
  disruptionsMissingReason?: number;
  onReviewDisruptions?: () => void;
}) {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<PendingItem[]>([]);
  const [periods, setPeriods] = useState<EquipmentMaintenanceStatus[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (showPendingItems) {
      apiClient.getPendingActions().then((res) => {
        if (!cancelled) setAllItems(res.data?.items ?? []);
      });
    } else {
      setAllItems([]);
    }
    if (!includeMaintenance) {
      setPeriods([]);
    } else {
      apiClient.getMaintenanceStatus().then((res) => {
        if (!cancelled) setPeriods(res.data?.periods ?? []);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [includeMaintenance, showPendingItems]);

  const excludeKey = excludeKeys.join("|");
  const items = useMemo(
    () => (excludeKey ? allItems.filter((i) => !excludeKey.split("|").includes(i.key)) : allItems),
    [allItems, excludeKey],
  );

  const maintenanceActions = periods.filter((p) => p.action_required).length;
  const maintenanceUpdates = periods.length - maintenanceActions;
  const disruptions = Math.max(0, disruptionsMissingReason || 0);
  if (items.length === 0 && periods.length === 0 && disruptions === 0) return null;
  const total = items.reduce((sum, i) => sum + i.count, 0) + maintenanceActions + disruptions;
  const summary = [
    ...items.map((i) => `${i.label} (${i.count})`),
    ...(maintenanceActions ? [`Maintenance action (${maintenanceActions})`] : []),
    ...(maintenanceUpdates ? [`Maintenance updates (${maintenanceUpdates})`] : []),
    ...(disruptions ? [`Disruptions without a reason (${disruptions})`] : []),
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
          {disruptions ? (
            <div
              className="rounded-lg border border-amber-400 bg-white/80 px-3 py-2 text-sm dark:border-amber-500/50 dark:bg-amber-500/10"
              data-testid="attention-disruptions"
            >
              <p>
                <strong>
                  {disruptions} disruption{disruptions === 1 ? "" : "s"} need{disruptions === 1 ? "s" : ""} a reason.
                </strong>{" "}
                Recording why equipment was unavailable keeps the downtime history useful.
              </p>
              {onReviewDisruptions ? (
                <Button size="sm" className="mt-2 h-8 gap-1 bg-amber-600 text-white hover:bg-amber-700" onClick={onReviewDisruptions}>
                  Review disruptions <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
