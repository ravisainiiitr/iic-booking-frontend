import { useId, useState } from "react";
import { AlertTriangle, ChevronDown, Wrench } from "lucide-react";

import type { EquipmentMaintenanceStatus } from "@/lib/api";
import { EquipmentLink } from "@/components/EquipmentLink";
import { cn } from "@/lib/utils";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Bookings affected, users notified and results-overdue pauses of one maintenance period, in one line. */
function maintenanceCounts(p: EquipmentMaintenanceStatus): string {
  return (
    `${plural(p.bookings_affected, "booking")} affected · ${plural(p.users_notified, "user")} notified · ` +
    `results-overdue paused for ${plural(p.results_paused, "booking")}`
  );
}

function MaintenanceRow({ p, action }: { p: EquipmentMaintenanceStatus; action?: boolean }) {
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        action
          ? "border-amber-400 bg-white/80 dark:border-amber-500/50 dark:bg-amber-500/10"
          : "border-border/60 bg-background/70"
      )}
      data-testid={action ? "maintenance-action" : "maintenance-update"}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Wrench className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <span className="font-semibold">
          <EquipmentLink id={p.equipment_id} name={p.equipment_name} code={p.equipment_code} />
        </span>
        <span className="text-muted-foreground">Under maintenance since {p.since_display}</span>
      </div>
      <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{maintenanceCounts(p)}</p>
      {p.recovery_text ? <p className="pl-6 text-xs text-muted-foreground">{p.recovery_text}</p> : null}
      {action && p.action ? <p className="mt-1 pl-6 text-xs font-medium text-amber-900 dark:text-amber-200">{p.action}</p> : null}
    </li>
  );
}

/**
 * Maintenance inside "Needs your attention" (OIC and Lab Operator dashboards): periods whose expected recovery has
 * passed are actions; the rest are listed under a collapsed "Maintenance updates". Replaces the separate banner.
 */
export function MaintenanceAttention({
  periods,
  show = "all",
}: {
  periods: EquipmentMaintenanceStatus[];
  /** "actions": only the periods that need the OIC; "updates": only the informational ones. */
  show?: "all" | "actions" | "updates";
}) {
  const listId = useId();
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const actions = show === "updates" ? [] : periods.filter((p) => p.action_required);
  const updates = show === "actions" ? [] : periods.filter((p) => !p.action_required);
  if (actions.length === 0 && updates.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="maintenance-attention">
      {actions.length ? (
        <section aria-label="Maintenance actions">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Maintenance: action required ({actions.length})
          </p>
          <ul className="space-y-1.5">
            {actions.map((p) => (
              <MaintenanceRow key={p.period_id} p={p} action />
            ))}
          </ul>
        </section>
      ) : null}
      {updates.length ? (
        <section>
          <button
            type="button"
            onClick={() => setUpdatesOpen((v) => !v)}
            aria-expanded={updatesOpen}
            aria-controls={listId}
            className="flex w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden />
            Maintenance updates ({updates.length})
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", updatesOpen && "rotate-180")} aria-hidden />
          </button>
          <ul id={listId} hidden={!updatesOpen} className="mt-1.5 space-y-1.5">
            {updates.map((p) => (
              <MaintenanceRow key={p.period_id} p={p} />
            ))}
          </ul>
          {updatesOpen ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Each morning at 08:30 that day&apos;s slots are set Under Maintenance and the users booked that day are
              emailed to choose a refund or another slot. Mark the equipment Operational when it is working again.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
