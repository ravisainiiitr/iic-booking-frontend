import { useEffect, useId, useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ShieldAlert, Wrench } from "lucide-react";

import { apiClient, type EquipmentMaintenanceStatus } from "@/lib/api";
import { EquipmentLink } from "@/components/EquipmentLink";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { maintenanceBannerText } from "./MaintenanceBanner";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The chips of the collapsed panel: one per kind of alert, empty kinds left out. */
export function operationsAlertChips(periods: EquipmentMaintenanceStatus[], disruptionsMissingReason: number): string[] {
  const chips: string[] = [];
  if (periods.length) {
    const bookings = periods.reduce((sum, p) => sum + (p.bookings_affected || 0), 0);
    chips.push(`${periods.length} under maintenance${bookings ? ` · ${plural(bookings, "booking")} affected` : ""}`);
  }
  if (disruptionsMissingReason > 0) {
    chips.push(`${plural(disruptionsMissingReason, "disruption")} without a reason`);
  }
  return chips;
}

interface OperationsAlertsProps {
  /** Load and list equipment under maintenance. */
  showMaintenance: boolean;
  /** Disruptions with no recorded reason (0 hides that part). */
  disruptionsMissingReason: number;
  onReviewDisruptions?: () => void;
  className?: string;
}

/**
 * One collapsed panel for equipment that is not running normally: equipment under maintenance and disruptions that
 * still need a reason. Collapsed on every visit, so the dashboard's own figures come first; nothing is rendered
 * when there is nothing to report.
 */
export default function OperationsAlerts({
  showMaintenance,
  disruptionsMissingReason,
  onReviewDisruptions,
  className,
}: OperationsAlertsProps) {
  const [periods, setPeriods] = useState<EquipmentMaintenanceStatus[]>([]);
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

  useEffect(() => {
    if (!showMaintenance) {
      setPeriods([]);
      return;
    }
    let cancelled = false;
    apiClient.getMaintenanceStatus().then((res) => {
      if (!cancelled) setPeriods(res.data?.periods ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [showMaintenance]);

  const disruptions = Math.max(0, disruptionsMissingReason || 0);
  const chips = operationsAlertChips(periods, disruptions);
  if (chips.length === 0) return null;
  const total = periods.length + (disruptions > 0 ? 1 : 0);

  return (
    <section
      role="status"
      aria-label="Equipment alerts"
      className={cn(
        "overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50 via-amber-50/70 to-background text-sm text-amber-950 shadow-sm",
        "dark:border-amber-500/30 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-transparent dark:text-amber-50",
        className,
      )}
      data-testid="operations-alerts"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition-colors hover:bg-amber-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 dark:hover:bg-amber-500/10"
        data-testid="operations-alerts-toggle"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-semibold">Equipment alerts</span>
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-500/25 dark:text-amber-100"
            >
              {chip}
            </span>
          ))}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium">
          {expanded ? "Hide" : `Show ${total > 1 ? "all" : ""}`.trim()}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </span>
      </button>

      {expanded ? (
        <div id={bodyId} className="grid gap-3 border-t border-amber-200/80 px-4 py-3 dark:border-amber-500/20 lg:grid-cols-2">
          {periods.length ? (
            <div className={cn("space-y-1.5", disruptions === 0 && "lg:col-span-2")} data-testid="operations-alerts-maintenance">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <Wrench className="h-3.5 w-3.5" aria-hidden /> Under maintenance
              </p>
              <ul className="space-y-1.5">
                {periods.map((p) => (
                  <li key={p.period_id} className="rounded-lg bg-background/70 px-3 py-2 ring-1 ring-amber-500/15 dark:bg-background/30">
                    <span className="font-semibold">
                      <EquipmentLink id={p.equipment_id} name={p.equipment_name} code={p.equipment_code} />
                    </span>
                    <span className="block text-xs opacity-85">{maintenanceBannerText(p)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs opacity-75">
                Each morning at 08:30 that day&apos;s slots are set Under Maintenance and the users booked that day are
                emailed to choose a refund or another slot. Mark the equipment Operational when it is working again.
              </p>
            </div>
          ) : null}
          {disruptions > 0 ? (
            <div className={cn("space-y-2", periods.length === 0 && "lg:col-span-2")} data-testid="operations-alerts-disruptions">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Disruptions
              </p>
              <div className="rounded-lg bg-background/70 px-3 py-2.5 ring-1 ring-amber-500/15 dark:bg-background/30">
                <p>
                  <strong>
                    {plural(disruptions, "disruption")} need{disruptions === 1 ? "s" : ""} a reason.
                  </strong>{" "}
                  Recording why equipment was unavailable keeps the downtime history useful.
                </p>
                {onReviewDisruptions ? (
                  <Button size="sm" className="mt-2 h-8 gap-1 bg-amber-600 text-white hover:bg-amber-700" onClick={onReviewDisruptions}>
                    Review disruptions <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
