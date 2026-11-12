import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, PlugZap, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  apiClient,
  type DsaFleetAgent,
  type DsaFleetDetail,
  type DsaFleetListResponse,
  type DsaHealth,
  type DsaReason,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const HEALTH_STYLE: Record<DsaHealth, string> = {
  healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
  offline: "bg-zinc-800 text-zinc-50 border-zinc-700",
  unknown: "bg-muted text-muted-foreground border-border",
};

const HEALTH_LABEL: Record<DsaHealth, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
  unknown: "Never reported",
};

const REFRESH_MS = 60_000;

export function HealthBadge({ health }: { health: DsaHealth }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", HEALTH_STYLE[health] || HEALTH_STYLE.unknown)}>
      {HEALTH_LABEL[health] || health}
    </Badge>
  );
}

export function relativeTime(value?: string | null, now: number = Date.now()) {
  if (!value) return "never";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return value;
  const s = Math.round((now - t) / 1000);
  if (s < 60) return `${Math.max(0, s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function formatBytes(value?: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatUptime(seconds?: unknown) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return "—";
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function section(diag: Record<string, unknown>, name: string): Record<string, unknown> {
  const v = diag?.[name];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function ReasonLine({ reason }: { reason: DsaReason }) {
  const tone =
    reason.severity === "critical" ? "text-red-700" : reason.severity === "warning" ? "text-amber-800" : "text-muted-foreground";
  return (
    <li className="text-sm">
      <span className={cn("font-medium", tone)}>{reason.message}</span>
      {reason.action ? <span className="block text-xs text-muted-foreground">{reason.action}</span> : null}
    </li>
  );
}

function Facts({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-words">{show(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DsaFleetPanel({ initialAgentId }: { initialAgentId?: string }) {
  const [fleet, setFleet] = useState<DsaFleetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>(initialAgentId || "");
  const [detail, setDetail] = useState<DsaFleetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const loadFleet = useCallback(async () => {
    const res = await apiClient.getDepartmentSyncFleet();
    if (res.error || !res.data) {
      setError(res.error || "Could not load the fleet.");
    } else {
      setError("");
      setFleet(res.data);
    }
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (agentId: string) => {
    if (!agentId) return;
    setDetailLoading(true);
    const res = await apiClient.getDepartmentSyncFleetAgent(agentId);
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
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
    const timer = window.setInterval(() => void loadDetail(selectedId), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetail]);

  const runAction = async (key: string, label: string) => {
    if (!detail) return;
    const agentName = detail.agent.agent_name;
    let force = false;
    if (key === "restart_service") {
      if (!window.confirm(`Restart the Department Sync Agent service on ${agentName}? Uploads resume after restart.`)) {
        return;
      }
    }
    setBusyAction(key);
    let res = await apiClient.runDepartmentSyncFleetAction(detail.agent.id, key, reason.trim(), force);
    if (res.error && key === "restart_service" && /less than/i.test(res.error)) {
      if (window.confirm(`${res.error} Send it anyway?`)) {
        force = true;
        res = await apiClient.runDepartmentSyncFleetAction(detail.agent.id, key, reason.trim(), force);
      }
    }
    setBusyAction("");
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${label} sent. The agent picks it up within a minute.`);
    setReason("");
    void loadDetail(detail.agent.id);
  };

  const acknowledge = async (incidentId: string) => {
    if (!detail) return;
    const res = await apiClient.acknowledgeDepartmentSyncIncident(detail.agent.id, incidentId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Acknowledged. Reminders pause for 12 hours.");
    void loadDetail(detail.agent.id);
  };

  const downloadBundle = async (bundleId: string, fileName: string) => {
    const res = await apiClient.getDepartmentSyncBundleBlob(bundleId);
    if (!res.blob) {
      toast.error(res.error || "Download failed.");
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "dsa-support.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = fleet?.results || [];
  const counts = fleet?.counts;
  const diag = useMemo(() => (detail?.diagnostics || {}) as Record<string, unknown>, [detail]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fleet health…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="rounded-2xl border-red-200">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-label="Fleet summary">
        {(["offline", "critical", "warning", "healthy", "unknown"] as DsaHealth[]).map((h) => (
          <span key={h} className="flex items-center gap-1 text-sm">
            <HealthBadge health={h} />
            <span className="tabular-nums">{counts?.[h] ?? 0}</span>
          </span>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void loadFleet()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Department Sync Agents</CardTitle>
          <CardDescription>
            Agents run unattended. Problems that last more than 10 minutes are emailed to Main Administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Health</TableHead>
                <TableHead>Department / agent</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Last heartbeat</TableHead>
                <TableHead className="text-right">Uploads</TableHead>
                <TableHead className="text-right">Equipment PCs</TableHead>
                <TableHead className="text-right">Disk free</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No Department Sync Agents enrolled yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: DsaFleetAgent) => (
                  <TableRow
                    key={r.id}
                    className={cn("cursor-pointer", selectedId === r.id && "bg-muted/60")}
                    onClick={() => setSelectedId(r.id)}
                    data-testid={`fleet-row-${r.id}`}
                  >
                    <TableCell>
                      <HealthBadge health={r.health} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.department || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.agent_name}
                        {r.machine_name ? ` · ${r.machine_name}` : ""} · v{r.version || "?"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[22rem] text-sm">
                      {r.why.length ? r.why[0].message : <span className="text-muted-foreground">All good</span>}
                      {r.why.length > 1 ? (
                        <span className="text-xs text-muted-foreground"> (+{r.why.length - 1} more)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{relativeTime(r.last_heartbeat_at)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {show(r.uploads_pending)} / <span className={cn(r.uploads_failed ? "text-red-700" : "")}>{show(r.uploads_failed)} failed</span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.equipment_pcs.online}/{r.equipment_pcs.total}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.disk_free_percent == null ? "—" : `${Number(r.disk_free_percent).toFixed(0)}%`}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedId ? (
        <Card className="rounded-2xl border-border/60" data-testid="fleet-detail">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">
                {detail ? `${detail.agent.department} · ${detail.agent.agent_name}` : "Agent"}
              </CardTitle>
              {detail ? <HealthBadge health={detail.agent.health} /> : null}
              {detailLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedId("")}>
                Close
              </Button>
            </div>
            {detail ? (
              <CardDescription>
                Last heartbeat {relativeTime(detail.agent.last_heartbeat_at)} · diagnostics evaluated{" "}
                {relativeTime(detail.evaluated_at)}
              </CardDescription>
            ) : null}
          </CardHeader>
          {detail ? (
            <CardContent className="space-y-5">
              {detail.reasons.length ? (
                <ul className="space-y-1.5" aria-label="Findings">
                  {detail.reasons.map((r, i) => (
                    <ReasonLine key={`${r.code}-${r.subject || ""}-${i}`} reason={r} />
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> No problems reported.
                </p>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold">Remote actions</p>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (recorded in the audit log)"
                  maxLength={300}
                  className="max-w-lg"
                />
                <div className="flex flex-wrap gap-2">
                  {detail.actions.map((a) => (
                    <Button
                      key={a.key}
                      size="sm"
                      variant={a.key === "restart_service" ? "destructive" : "outline"}
                      disabled={!a.supported || Boolean(busyAction)}
                      title={a.supported ? a.label : "Update this agent to use this action"}
                      onClick={() => void runAction(a.key, a.label)}
                    >
                      {busyAction === a.key ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      {a.label}
                    </Button>
                  ))}
                </div>
                {!detail.agent.diagnostics_supported ? (
                  <p className="text-xs text-muted-foreground">
                    This agent version sends no remote diagnostics; some actions need DSA 1.0.7 or later.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Facts
                  title="Service"
                  rows={[
                    ["Version", section(diag, "service").version ?? detail.agent.version],
                    ["Uptime", formatUptime(section(diag, "service").uptime_seconds)],
                    ["Windows service", section(diag, "service").running_as_service],
                    ["Machine", section(diag, "service").machine_name ?? detail.agent.machine_name],
                    ["Memory", section(diag, "service").working_set_mb ? `${section(diag, "service").working_set_mb} MB` : null],
                  ]}
                />
                <Facts
                  title="Portal link"
                  rows={[
                    ["Last heartbeat", relativeTime(detail.agent.last_heartbeat_at)],
                    ["Portal", section(diag, "portal").base_url],
                    ["Failed heartbeats (last 50)", section(diag, "portal").heartbeats_failed_last_50],
                    ["Clock skew", detail.agent.clock_skew_seconds == null ? null : `${detail.agent.clock_skew_seconds} s`],
                    ["Token valid", section(diag, "enrollment").token_valid],
                    ["Token expires in", section(diag, "enrollment").token_expires_in_hours == null ? null : `${section(diag, "enrollment").token_expires_in_hours} h`],
                  ]}
                />
                <Facts
                  title="Storage"
                  rows={[
                    ["Data drive", section(diag, "storage").data_drive],
                    ["Free", section(diag, "storage").data_drive_free_percent == null ? null : `${section(diag, "storage").data_drive_free_percent}% (${formatBytes(section(diag, "storage").data_drive_free_bytes)})`],
                    ["Agent database", formatBytes(section(diag, "storage").sqlite_bytes)],
                    ["Database WAL", formatBytes(section(diag, "storage").sqlite_wal_bytes)],
                  ]}
                />
                <Facts
                  title="Equipment Network"
                  rows={[
                    ["Enabled", section(diag, "equipment_network").enabled],
                    ["Adapter", section(diag, "equipment_network").adapter_name ?? section(diag, "equipment_network").configured_adapter],
                    ["Connected", section(diag, "equipment_network").adapter_up],
                    ["IP", section(diag, "equipment_network").adapter_ip],
                    ["Configured IP", section(diag, "equipment_network").configured_ip],
                  ]}
                />
                <Facts
                  title="Uploads"
                  rows={[
                    ["Waiting", section(diag, "uploads").pending],
                    ["Retrying", section(diag, "uploads").retrying],
                    ["Failed", section(diag, "uploads").failed],
                    ["Oldest waiting", section(diag, "uploads").oldest_pending_age_minutes == null ? null : `${section(diag, "uploads").oldest_pending_age_minutes} min`],
                    ["Last error", section(diag, "uploads").last_error],
                    ["Last upload", relativeTime(section(diag, "uploads").last_completed_at as string | null)],
                  ]}
                />
                <Facts
                  title="Detection, workspaces, live feed, UPS"
                  rows={[
                    ["Last file detected", relativeTime(section(diag, "detection").last_file_detected_at as string | null)],
                    ["Files queued (24 h)", section(diag, "detection").files_queued_24h],
                    ["Workspaces", section(diag, "workspaces").total],
                    ["Live feeds running", section(diag, "live_feed").active_sessions],
                    ["UPS units polled", section(diag, "ups").devices],
                  ]}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Equipment PCs</p>
                {detail.equipment_pcs.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PC</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last heartbeat</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Share</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Last error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.equipment_pcs.map((pc, i) => (
                          <TableRow key={String(pc.id ?? i)}>
                            <TableCell className="font-medium">{show(pc.hostname)}</TableCell>
                            <TableCell>
                              {/* Heartbeat freshness verdict from the portal, never the DSA's stored status. */}
                              <HealthBadge health={pc.online === true ? "healthy" : "offline"} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {relativeTime((pc.last_heartbeat_at ?? pc.last_seen ?? pc.last_status_at) as string | null)}
                            </TableCell>
                            <TableCell>{show(pc.agent_version)}</TableCell>
                            <TableCell>{show(pc.share_ok)}</TableCell>
                            <TableCell>{show(pc.observed_ip ?? pc.assigned_ip)}</TableCell>
                            <TableCell className="max-w-[18rem] break-words text-xs">{show(pc.last_error)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No Equipment PCs reported.</p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold">Incident timeline</p>
                  {detail.incidents.length ? (
                    <ol className="space-y-2 border-l border-border pl-3" aria-label="Incident timeline">
                      {detail.incidents.map((inc) => {
                        const open = inc.status !== "RESOLVED" && inc.status !== "EXPIRED";
                        return (
                          <li key={inc.id} className="text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              {open ? (
                                inc.code === "DSA_OFFLINE" ? (
                                  <WifiOff className="h-3.5 w-3.5 text-red-700" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                )
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                              )}
                              <span className="font-medium">{inc.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(inc.opened_at || "").toLocaleString()}
                                {inc.resolved_at ? ` → ${new Date(inc.resolved_at).toLocaleString()}` : " · open"}
                              </span>
                              {open && inc.status !== "ACKNOWLEDGED" ? (
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void acknowledge(inc.id)}>
                                  Acknowledge
                                </Button>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{inc.message}</p>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">No incidents recorded.</p>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Recent warnings and errors (redacted)</p>
                    {Array.isArray(section(diag, "problems").recent) && (section(diag, "problems").recent as unknown[]).length ? (
                      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                        {(section(diag, "problems").recent as Array<Record<string, unknown>>).map((p, i) => (
                          <li key={i}>
                            <span className="text-muted-foreground">{relativeTime(p.at as string)}</span>{" "}
                            <span className={p.level === "Warning" ? "text-amber-800" : "text-red-700"}>{show(p.level)}</span>{" "}
                            {show(p.message)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">None in the last 24 hours.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Actions sent</p>
                    {detail.commands.length ? (
                      <ul className="space-y-1 text-xs">
                        {detail.commands.slice(0, 10).map((c) => (
                          <li key={c.id}>
                            <span className="font-medium">{c.command_type}</span> · {c.status} · {relativeTime(c.created_at)}
                            {c.created_by ? ` · ${c.created_by}` : ""}
                            {c.last_error ? <span className="block text-red-700">{c.last_error}</span> : null}
                            {c.result && typeof c.result.decision === "string" ? (
                              <span className="block text-muted-foreground">
                                {String(c.result.decision)}
                                {c.result.message ? `: ${String(c.result.message)}` : ""}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No actions sent yet.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Support bundles</p>
                    {detail.bundles.length ? (
                      <ul className="space-y-1 text-sm">
                        {detail.bundles.map((b) => (
                          <li key={b.id} className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void downloadBundle(b.id, b.file_name)}>
                              <Download className="mr-1 h-3.5 w-3.5" /> {b.file_name}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {formatBytes(b.size_bytes)} · {relativeTime(b.created_at)}
                              {b.truncated ? " · trimmed" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <PlugZap className="h-3.5 w-3.5" /> Use “Collect support bundle” to fetch logs and diagnostics.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export default DsaFleetPanel;
