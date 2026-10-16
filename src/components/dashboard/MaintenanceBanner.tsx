import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { apiClient, type EquipmentMaintenanceStatus } from "@/lib/api";
import { EquipmentLink } from "@/components/EquipmentLink";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function maintenanceBannerText(p: EquipmentMaintenanceStatus): string {
  return (
    `Under maintenance since ${p.since_display} — ${plural(p.bookings_affected, "booking")} affected, ` +
    `${plural(p.users_notified, "user")} notified, results-overdue paused for ${plural(p.results_paused, "booking")}`
  );
}

/**
 * Staff dashboard: one line per equipment of the user (all for Admin) that is Under Maintenance and handled day by
 * day (today's slots at marking, then every morning at 08:30). Renders nothing when there is none.
 */
export default function MaintenanceBanner({ className = "" }: { className?: string }) {
  const [periods, setPeriods] = useState<EquipmentMaintenanceStatus[]>([]);

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

  return (
    <div
      role="status"
      className={`space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}
      data-testid="maintenance-banner"
    >
      {periods.map((p) => (
        <div key={p.period_id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5" data-testid="maintenance-banner-row">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">
            <EquipmentLink id={p.equipment_id} name={p.equipment_name} code={p.equipment_code} />
          </span>
          <span>{maintenanceBannerText(p)}</span>
        </div>
      ))}
      <p className="pl-6 text-xs opacity-80">
        Each morning at 08:30 that day&apos;s slots are set Under Maintenance and the users booked that day are emailed
        to choose a refund or another slot. Mark the equipment Operational when it is working again.
      </p>
    </div>
  );
}
