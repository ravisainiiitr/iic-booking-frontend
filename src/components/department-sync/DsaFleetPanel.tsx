import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type DsaFleetAgent, type DsaFleetDetail, type DsaFleetListResponse, type DsaHealth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DsaAgentView } from "./DsaAgentView";
import { DsaEquipmentPcView } from "./DsaEquipmentPcView";
import { CodeChip, Crumbs, HEALTH_DOT, HealthBadge, Stat, VersionPill } from "./DsaTraceBits";
import {
  HEALTH_RANK,
  type HealthFilter,
  actionKeyFor,
  matchesFleet,
  pcKey,
  pcName,
  relativeTime,
} from "./dsaTrace";

// Re-exported for existing imports and tests.
export { HealthBadge } from "./DsaTraceBits";
export { formatBytes, relativeTime } from "./dsaTrace";

const REFRESH_MS = 60_000;

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "text-emerald-700 dark:text-emerald-400",
  FAILED: "text-red-700 dark:text-red-400",
  EXPIRED: "text-red-700 dark:text-red-400",
};

const ACTION_SHORT: Record<string, string> = {
  restart_service: "Restart",
  resync_bookings: "Re-sync",
  retry_failed_uploads: "Retry uploads",
  support_bundle: "Bundle",
  refresh_equipment_pcs: "Refresh PCs",
  run_diagnostics: "Diagnostics",
};

function boolTone(ok: boolean | null | undefined) {
  return ok === true
    ? "text-emerald-700 dark:text-emerald-400"
    : ok === false
      ? "text-red-700 dark:text-red-400"
      : "text-muted-foreground";
}

function FleetRow({ r, onOpen }: { r: DsaFleetAgent; onOpen: () => void }) {
  const net = r.network;
  const netOk = net?.reported ? (net.enabled ? net.adapter_up !== false && net.adapter_found !== false : null) : null;
  const shareFail = r.share?.failing ?? 0;
  const last = r.last_command;
  const lastKey = last ? last.action || actionKeyFor(last.command_type) : "";
  return (
    <TableRow
      className={cn("cursor-pointer align-top", r.retired && "opacity-60")}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      data-testid={`fleet-row-${r.id}`}
    >
      <TableCell className="py-3">
        {r.retired ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">
            <Archive className="h-3 w-3" /> Retired
          </span>
        ) : (
          <HealthBadge health={r.health} />
        )}
      </TableCell>
      <TableCell className="py-3">
        <div className="font-medium">{r.department || "—"}</div>
        <div className="text-xs text-muted-foreground">
          {r.agent_name}
          {r.machine_name && r.machine_name !== r.agent_name ? ` · ${r.machine_name}` : ""}
        </div>
      </TableCell>
      <TableCell className="max-w-[20rem] py-3 text-sm">
        {r.why.length ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CodeChip code={r.why[0].code} />
              <span>{r.why[0].message}</span>
            </div>
            {r.why.length > 1 ? <span className="text-xs text-muted-foreground">+{r.why.length - 1} more</span> : null}
          </div>
        ) : (
          <span className="text-muted-foreground">{r.retired ? "Retired from the fleet" : "All checks passing"}</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap py-3 text-sm" title={r.last_heartbeat_at || ""}>
        {relativeTime(r.last_heartbeat_at)}
      </TableCell>
      <TableCell className="py-3">
        <VersionPill version={r.version} latest={r.latest_version} status={r.version_status} />
      </TableCell>
      <TableCell className="py-3 text-sm tabular-nums">
        <div>
          {r.equipment_pcs.online}/{r.equipment_pcs.total} online
        </div>
        {r.equipment_pcs.total ? (
          <div className={cn("text-xs", shareFail ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
            {shareFail ? `${shareFail} share failing` : `${r.share?.ok ?? 0} share OK`}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="py-3 text-sm">
        <div className={boolTone(netOk)}>{net?.adapter_ip || (net?.reported ? (net.enabled ? "No IP" : "Off") : "—")}</div>
        {net?.reported && net.ip_matches_config === false ? (
          <div className="text-xs text-amber-700 dark:text-amber-400">expected {net.configured_ip}</div>
        ) : null}
      </TableCell>
      <TableCell className="py-3 text-right text-sm tabular-nums">
        <div>{r.uploads_pending ?? "—"} waiting</div>
        <div className={cn("text-xs", r.uploads_failed ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {r.uploads_failed ?? 0} failed
        </div>
      </TableCell>
      <TableCell className="py-3 text-right text-sm tabular-nums">
        <span className={cn(r.errors_24h ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {r.errors_24h ?? "—"}
        </span>
      </TableCell>
      <TableCell className="py-3 text-xs">
        {last ? (
          <>
            <div className="font-medium">{ACTION_SHORT[lastKey] || last.command_type}</div>
            <div className={cn(STATUS_TONE[last.status] || "text-muted-foreground")}>
              {last.status.toLowerCase()} · {relativeTime(last.created_at)}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DsaFleetPanel({ initialAgentId }: { initialAgentId?: string }) {
  const [params, setParams] = useSearchParams();
  const agentId = params.get("agent") || initialAgentId || "";
  const pcId = params.get("pc") || "";
  const query = params.get("q") || "";
  const health = (params.get("health") || "all") as HealthFilter;
  const showRetired = params.get("retired") === "1";

  const [fleet, setFleet] = useState<DsaFleetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<DsaFleetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const loadFleet = useCallback(async () => {
    setRefreshing(true);
    const res = await apiClient.getDepartmentSyncFleet({ includeRetired: showRetired });
    if (res.error || !res.data) {
      setError(res.error || "Could not load the fleet.");
    } else {
      setError("");
      setFleet(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [showRetired]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    setDetailLoading(true);
    const res = await apiClient.getDepartmentSyncFleetAgent(id);
    setDetailLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the agent.");
      return;
    }
    setDetail(res.data);
  }, []);

  useEffect(() => {
    void loadFleet();
    const timer = window.setInterval(() => void loadFleet(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadFleet]);

  useEffect(() => {
    if (!agentId) {
      setDetail(null);
      return;
    }
    setDetail((d) => (d && d.agent.id === agentId ? d : null));
    void loadDetail(agentId);
    const timer = window.setInterval(() => void loadDetail(agentId), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [agentId, loadDetail]);

  const rows = useMemo(() => {
    const all = fleet?.results || [];
    return all
      .filter((r) => showRetired || !r.retired)
      .filter((r) => matchesFleet(r, query, health))
      .sort(
        (a, b) =>
          Number(Boolean(a.retired)) - Number(Boolean(b.retired)) ||
          HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
          a.department.localeCompare(b.department),
      );
  }, [fleet, query, health, showRetired]);

  const counts = fleet?.counts;
  const latest = fleet?.latest_version || detail?.agent.latest_version || "";
  const active = (fleet?.results || []).filter((r) => !r.retired);
  const onLatest = active.filter((r) => r.version_status === "current" || r.version_status === "ahead").length;
  const pcsTotal = active.reduce((n, r) => n + r.equipment_pcs.total, 0);
  const pcsOnline = active.reduce((n, r) => n + r.equipment_pcs.online, 0);
  const failedUploads = active.reduce((n, r) => n + (r.uploads_failed || 0), 0);
  const attention = (counts?.offline ?? 0) + (counts?.critical ?? 0) + (counts?.warning ?? 0);

  const selectedPc = useMemo(() => {
    if (!detail || !pcId) return null;
    return detail.equipment_pcs.find((pc, i) => pcKey(pc, i) === pcId) || null;
  }, [detail, pcId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fleet health…
      </div>
    );
  }

  const crumbs: Array<{ label: string; onClick?: () => void }> = [
    { label: "All agents", onClick: agentId ? () => update({ agent: null, pc: null }) : undefined },
  ];
  if (agentId) {
    crumbs.push({
      label: detail ? `${detail.agent.department || "Agent"} · ${detail.agent.agent_name}` : "Agent",
      onClick: pcId ? () => update({ pc: null }) : undefined,
    });
  }
  if (agentId && pcId) crumbs.push({ label: selectedPc ? pcName(selectedPc) : "Equipment PC" });

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="rounded-2xl border-red-200 dark:border-red-900">
          <CardContent className="py-4 text-sm text-red-700 dark:text-red-400">{error}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Crumbs items={crumbs} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fleet?.server_time ? <span>Updated {relativeTime(fleet.server_time)} · auto every minute</span> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadFleet();
              if (agentId) void loadDetail(agentId);
            }}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Refresh
          </Button>
        </div>
      </div>

      {!agentId ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="Fleet summary">
            <Stat
              label="Needs attention"
              value={attention}
              hint="offline, critical or warning"
              active={health === "attention"}
              onClick={() => update({ health: health === "attention" ? null : "attention" })}
              testId="stat-attention"
            />
            {(["offline", "critical", "warning", "healthy"] as DsaHealth[]).map((h) => (
              <Stat
                key={h}
                label={h === "healthy" ? "Healthy" : h.charAt(0).toUpperCase() + h.slice(1)}
                value={counts?.[h] ?? 0}
                tone={HEALTH_DOT[h]}
                active={health === h}
                onClick={() => update({ health: health === h ? null : h })}
                testId={`stat-${h}`}
              />
            ))}
            <Stat
              label="On latest"
              value={`${onLatest}/${active.length}`}
              hint={latest ? `published ${latest}` : "no release published"}
            />
            <Stat label="Equipment PCs" value={`${pcsOnline}/${pcsTotal}`} hint="online" />
            <Stat label="Failed uploads" value={failedUploads} hint="across the fleet" />
          </div>

          <Card className="rounded-2xl border-border/60">
            <div className="flex flex-col gap-3 border-b border-border/60 p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="Search agent, department, Equipment PC, IP, version or code (e.g. EQPC_SHARE)…"
                  className="rounded-xl pl-8"
                  aria-label="Search the fleet"
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => update({ q: null })}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch
                  checked={showRetired}
                  onCheckedChange={(v) => update({ retired: v ? "1" : null })}
                  aria-label="Show retired agents"
                />
                Show retired{fleet?.retired_count ? ` (${fleet.retired_count})` : ""}
              </label>
            </div>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Health</TableHead>
                    <TableHead>Department / agent</TableHead>
                    <TableHead>Why</TableHead>
                    <TableHead>Heartbeat</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Equipment PCs</TableHead>
                    <TableHead>Equipment Network</TableHead>
                    <TableHead className="text-right">Uploads</TableHead>
                    <TableHead className="text-right">Errors 24 h</TableHead>
                    <TableHead>Last action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                        {(fleet?.results || []).length === 0
                          ? "No Department Sync Agents enrolled yet."
                          : "No agents match these filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => <FleetRow key={r.id} r={r} onOpen={() => update({ agent: r.id, pc: null })} />)
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
              Agents run unattended. Problems lasting more than 10 minutes are emailed to Main Administrators.
              {!showRetired && fleet?.retired_count ? ` ${fleet.retired_count} retired agent(s) hidden.` : ""}
            </p>
          </Card>
        </>
      ) : !detail ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          {detailLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading agent…
            </>
          ) : (
            "Agent not found."
          )}
        </div>
      ) : pcId ? (
        selectedPc ? (
          <DsaEquipmentPcView
            detail={detail}
            pc={selectedPc}
            latestVersion={latest}
            onAction={() => void loadDetail(detail.agent.id)}
          />
        ) : (
          <p className="py-6 text-sm text-muted-foreground">This Equipment PC is no longer reported by the agent.</p>
        )
      ) : (
        <DsaAgentView
          detail={detail}
          latestVersion={latest}
          loading={detailLoading}
          onReload={() => void loadDetail(detail.agent.id)}
          onOpenPc={(key) => update({ pc: key })}
        />
      )}
    </div>
  );
}

export default DsaFleetPanel;
