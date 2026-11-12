import { useEffect, useState } from "react";

import { apiClient, type DsaFleetListResponse, type DsaHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

const ORDER: Array<{ key: DsaHealth; label: string; tone: string }> = [
  { key: "offline", label: "Offline", tone: "bg-zinc-800 text-zinc-50" },
  { key: "critical", label: "Critical", tone: "bg-red-100 text-red-800" },
  { key: "warning", label: "Warning", tone: "bg-amber-100 text-amber-900" },
  { key: "healthy", label: "Healthy", tone: "bg-emerald-100 text-emerald-800" },
];

/** Live DSA fleet health on the Main Administrator dashboard card (refreshes every 2 min). */
export function DsaFleetDashboardSummary() {
  const [fleet, setFleet] = useState<DsaFleetListResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await apiClient.getDepartmentSyncFleet();
      if (!alive) return;
      if (res.error || !res.data) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setFleet(res.data);
    };
    void load();
    const timer = window.setInterval(() => void load(), 120_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (failed) {
    return <p className="text-xs text-muted-foreground">Fleet health unavailable.</p>;
  }
  if (!fleet) {
    return <p className="text-xs text-muted-foreground">Checking agents…</p>;
  }
  if (fleet.count === 0) {
    return <p className="text-xs text-muted-foreground">No agents enrolled yet.</p>;
  }

  const attention = fleet.results.filter((r) => r.health === "offline" || r.health === "critical" || r.health === "warning");
  return (
    <div className="space-y-1.5" data-testid="dsa-fleet-summary">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map(({ key, label, tone }) =>
          fleet.counts?.[key] ? (
            <span key={key} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
              {fleet.counts[key]} {label}
            </span>
          ) : null,
        )}
      </div>
      {attention.length ? (
        <p className="truncate text-xs text-muted-foreground">
          {attention[0].department || attention[0].agent_name}: {attention[0].why[0]?.message || attention[0].health}
          {attention.length > 1 ? ` (+${attention.length - 1} more)` : ""}
        </p>
      ) : (
        <p className="text-xs text-emerald-700">All agents healthy.</p>
      )}
    </div>
  );
}

export default DsaFleetDashboardSummary;
