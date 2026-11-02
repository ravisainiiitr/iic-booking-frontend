import { useEffect, useId, useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";

import { apiClient, type EquipmentMaintenanceStatus } from "@/lib/api";
import { EquipmentLink } from "@/components/EquipmentLink";
import { cn } from "@/lib/utils";

const EXPANDED_KEY = "dashboard.maintenancePanel.expanded";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function maintenanceBannerText(p: EquipmentMaintenanceStatus): string {
  return (
    `Under maintenance since ${p.since_display} — ${plural(p.bookings_affected, "booking")} affected, ` +
    `${plural(p.users_notified, "user")} notified, results-overdue paused for ${plural(p.results_paused, "booking")}`
  );
}

/** One line for the collapsed panel: how many instruments, and the bookings / users affected across them. */
export function maintenanceSummary(periods: EquipmentMaintenanceStatus[]): string {
  const bookings = periods.reduce((sum, p) => sum + (p.bookings_affected || 0), 0);
  const users = periods.reduce((sum, p) => sum + (p.users_notified || 0), 0);
  const parts = [`${periods.length} equipment under maintenance`];
  if (bookings) parts.push(`${plural(bookings, "booking")} affected`);
  if (users) parts.push(`${plural(users, "user")} notified`);
  return parts.join(" · ");
}

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeExpanded(expanded: boolean): void {
  try {
    if (expanded) localStorage.setItem(EXPANDED_KEY, "1");
    else localStorage.removeItem(EXPANDED_KEY);
  } catch {
    // Storage unavailable (private window): the panel simply starts collapsed next time.
  }
}

/**
 * Staff dashboard: equipment of the user (all for Admin) that is Under Maintenance and handled day by day (today's
 * slots at marking, then every morning at 08:30). A compact panel, collapsed by default (the user's choice is
 * remembered in this browser); renders nothing when no equipment is under maintenance.
 */
export default function MaintenanceBanner({ className = "" }: { className?: string }) {
  const [periods, setPeriods] = useState<EquipmentMaintenanceStatus[]>([]);
  const [expanded, setExpanded] = useState(readExpanded);
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    apiClient.getMaintenanceStatus().then((res) => {
      if (!cancelled) setPeriods(res.data?.periods ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (periods.length === 0) return null;

  const toggle = () => {
    setExpanded((value) => {
      writeExpanded(!value);
      return !value;
    });
  };

  return (
    <section
      role="status"
      aria-label="Equipment under maintenance"
      className={`rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}
      data-testid="maintenance-banner"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-500/15"
        data-testid="maintenance-banner-toggle"
      >
        <Wrench className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-semibold">Equipment under maintenance</span>
        <span className="min-w-0 flex-1 truncate opacity-90">{maintenanceSummary(periods)}</span>
        <span className="shrink-0 text-xs font-medium underline-offset-2">{expanded ? "Hide" : "Show"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {expanded ? (
        <div id={listId} className="space-y-1.5 border-t border-amber-200 px-4 pb-3 pt-2 dark:border-amber-500/30">
          {periods.map((p) => (
            <div key={p.period_id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5" data-testid="maintenance-banner-row">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span className="font-semibold">
                <EquipmentLink id={p.equipment_id} name={p.equipment_name} code={p.equipment_code} />
              </span>
              <span>{maintenanceBannerText(p)}</span>
            </div>
          ))}
          <p className="pl-6 text-xs opacity-80">
            Each morning at 08:30 that day&apos;s slots are set Under Maintenance and the users booked that day are
            emailed to choose a refund or another slot. Mark the equipment Operational when it is working again.
          </p>
        </div>
      ) : null}
    </section>
  );
}
