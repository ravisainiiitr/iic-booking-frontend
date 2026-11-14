import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type DsaFleetDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DsaActionsPanel } from "./DsaActionsPanel";
import { CheckIcon, CodeChip, Fact, HealthBadge, TraceChecklist, VersionPill } from "./DsaTraceBits";
import {
  type Dict,
  agentChecks,
  bookingHref,
  checkTally,
  cleanVersion,
  compareVersion,
  exactTime,
  formatBytes,
  formatUptime,
  pcFirewall,
  pcHealth,
  pcIsRetired,
  pcKey,
  pcName,
  relativeTime,
  section,
  traceErrors,
} from "./dsaTrace";

function minutesOrNever(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? (n <= 0 ? "Never" : `${n} min`) : null;
}

function lidAction(value: unknown) {
  if (value === null || value === undefined) return "No lid";
  return ({ 0: "Do nothing", 1: "Sleep", 2: "Hibernate", 3: "Shut down" } as Record<number, string>)[Number(value)] ?? String(value);
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Facts({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
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

export function BookingLink({ id, label }: { id?: number | null; label?: string }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <Link to={bookingHref(id)} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
      {label || `#${id}`}
    </Link>
  );
}

export function UploadsTable({ uploads }: { uploads: NonNullable<DsaFleetDetail["uploads"]> }) {
  if (!uploads.length) return <p className="py-3 text-sm text-muted-foreground">No uploads in the last 30 days.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Booking</TableHead>
            <TableHead>Upload</TableHead>
            <TableHead>Result processing</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((u) => {
            const failed = ["FAILED", "EXPIRED", "REJECTED"].includes(u.status);
            const pFailed = u.processing?.status === "FAILED";
            return (
              <TableRow key={u.id}>
                <TableCell className="max-w-[16rem]">
                  <div className="truncate font-medium" title={u.file_name}>
                    {u.file_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(u.bytes_received)} / {formatBytes(u.expected_size)}
                    {u.equipment ? ` · ${u.equipment.name || u.equipment.code}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  <BookingLink id={u.booking?.id} label={u.booking?.label} />
                </TableCell>
                <TableCell className="max-w-[16rem] text-sm">
                  <span className={cn(failed ? "text-red-700 dark:text-red-400" : u.status === "COMPLETED" ? "text-emerald-700 dark:text-emerald-400" : "")}>
                    {u.status.toLowerCase()}
                  </span>
                  {u.last_error ? <div className="break-words text-xs text-muted-foreground">{u.last_error}</div> : null}
                </TableCell>
                <TableCell className="max-w-[16rem] text-sm">
                  {u.processing ? (
                    <>
                      <span className={cn(pFailed ? "text-red-700 dark:text-red-400" : u.processing.status === "COMPLETED" ? "text-emerald-700 dark:text-emerald-400" : "")}>
                        {u.processing.status.toLowerCase().replace(/_/g, " ")}
                      </span>
                      {u.processing.retry_count ? <span className="text-xs text-muted-foreground"> · {u.processing.retry_count} retries</span> : null}
                      {u.processing.error ? <div className="break-words text-xs text-muted-foreground">{u.processing.error}</div> : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs" title={exactTime(u.created_at)}>
                  {relativeTime(u.created_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function WorkspacesTable({ workspaces }: { workspaces: NonNullable<DsaFleetDetail["workspaces"]> }) {
  if (!workspaces.length) return <p className="py-3 text-sm text-muted-foreground">No booking workspaces yet.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Workspace path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((w) => (
            <TableRow key={w.id}>
              <TableCell>
                <BookingLink id={w.booking?.id} label={w.booking?.label} />
              </TableCell>
              <TableCell className="text-sm">{w.equipment ? w.equipment.name || w.equipment.code : "—"}</TableCell>
              <TableCell className="max-w-[22rem]">
                <div className="break-all font-mono text-xs">{w.relative_folder || "—"}</div>
                {w.expected_result_folder ? (
                  <div className="break-all font-mono text-[11px] text-muted-foreground">results: {w.expected_result_folder}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{w.status.toLowerCase()}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{relativeTime(w.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ErrorsList({
  detail,
  subject,
  equipmentId,
}: {
  detail: DsaFleetDetail;
  subject?: string;
  equipmentId?: string;
}) {
  const [code, setCode] = useState("");
  const all = useMemo(() => {
    const rows = traceErrors(detail);
    if (!subject) return rows;
    const eq = (equipmentId || "").toLowerCase();
    return rows.filter(
      (r) => r.subject === subject || r.message.includes(subject) || (eq !== "" && (r.equipmentKeys || []).includes(eq)),
    );
  }, [detail, subject, equipmentId]);
  const codes = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((e) => e.codes.forEach((c) => m.set(c, (m.get(c) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const rows = code ? all.filter((e) => e.codes.includes(code)) : all;
  return (
    <div className="space-y-3">
      {codes.length ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Error codes">
          <span className="text-xs text-muted-foreground">Codes:</span>
          {codes.map(([c, n]) => (
            <span key={c} className="inline-flex items-center gap-1">
              <CodeChip code={c} active={code === c} onClick={() => setCode(code === c ? "" : c)} />
              <span className="text-[11px] text-muted-foreground">×{n}</span>
            </span>
          ))}
          {code ? (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setCode("")}>
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          ) : null}
        </div>
      ) : null}
      {rows.length ? (
        <ul className="max-h-[28rem] divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60" aria-label="Recent errors">
          {rows.map((e) => (
            <li key={e.id} className="flex gap-2.5 px-3 py-2">
              <CheckIcon state={e.severity === "error" ? "fail" : e.severity === "warning" ? "warn" : "unknown"} className="mt-0.5" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  {e.codes.map((c) => (
                    <CodeChip key={c} code={c} onClick={() => setCode(c)} />
                  ))}
                  <span className="break-words">{e.message}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span title={exactTime(e.at)}>{relativeTime(e.at)}</span>
                  <span>· {e.source}</span>
                  {e.subject ? <span>· {e.subject}</span> : null}
                  {e.equipment ? <span>· {e.equipment}</span> : null}
                  {e.bookingId ? (
                    <span>
                      · booking <BookingLink id={e.bookingId} label={e.bookingLabel} />
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> No warnings or errors reported.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Portal log: last 14 days of warnings/errors the agent sent. Agent log: the latest redacted lines from the DSA. Health
        rule: checks the portal runs on every heartbeat.
      </p>
    </div>
  );
}

export function DsaAgentView({
  detail,
  latestVersion,
  loading,
  onReload,
  onOpenPc,
}: {
  detail: DsaFleetDetail;
  latestVersion?: string;
  loading?: boolean;
  onReload: () => void;
  onOpenPc: (key: string) => void;
}) {
  const [tab, setTab] = useState("trace");
  const a = detail.agent;
  const diag = (detail.diagnostics || {}) as Dict;
  const latest = latestVersion || a.latest_version || "";
  const checks = useMemo(() => agentChecks(detail, latest), [detail, latest]);
  const tally = checkTally(checks);
  const errors = useMemo(() => traceErrors(detail), [detail]);
  const pcs = detail.equipment_pcs || [];
  const net = section(diag, "equipment_network");
  const service = section(diag, "service");
  const uploads = section(diag, "uploads");
  const openIncidents = detail.incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "EXPIRED");

  const acknowledge = async (incidentId: string) => {
    const res = await apiClient.acknowledgeDepartmentSyncIncident(a.id, incidentId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Acknowledged. Reminders pause for 12 hours.");
    onReload();
  };

  return (
    <div className="space-y-4" data-testid="fleet-detail">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {a.department || "Department"} · {a.agent_name}
                </h2>
                {a.retired ? (
                  <span className="rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">Retired ({a.status.toLowerCase()})</span>
                ) : (
                  <HealthBadge health={a.health} />
                )}
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {a.machine_name || "—"} · {String(service.os || "") || "Windows"} · diagnostics evaluated {relativeTime(detail.evaluated_at)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs" aria-label="Checklist summary">
              <span className="flex items-center gap-1"><CheckIcon state="fail" /> {tally.fail} failing</span>
              <span className="flex items-center gap-1"><CheckIcon state="warn" /> {tally.warn} warning</span>
              <span className="flex items-center gap-1"><CheckIcon state="pass" /> {tally.pass} OK</span>
              <span className="flex items-center gap-1"><CheckIcon state="unknown" /> {tally.unknown} not reported</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Last heartbeat">
              <span title={exactTime(a.last_heartbeat_at)}>{relativeTime(a.last_heartbeat_at)}</span>
            </Fact>
            <Fact label="Version">
              <VersionPill version={a.version} latest={latest} status={a.version_status || compareVersion(a.version, latest)} />
            </Fact>
            <Fact label="Equipment PCs">
              {a.equipment_pcs.online}/{a.equipment_pcs.total} online
            </Fact>
            <Fact label="Equipment Network">
              {net.enabled ? `${net.adapter_ip || "no IP"} · ${net.adapter_up ? "up" : "down"}` : "Not enabled"}
            </Fact>
            <Fact label="Uploads">
              {show(uploads.pending ?? a.uploads_pending)} waiting · {show(uploads.failed ?? a.uploads_failed)} failed
            </Fact>
            <Fact label="Uptime">{formatUptime(service.uptime_seconds ?? a.uptime_seconds)}</Fact>
          </dl>
          {a.why.length ? (
            <ul className="space-y-1" aria-label="Why">
              {detail.reasons
                .filter((r) => r.severity !== "info")
                .map((r, i) => (
                  <li key={`${r.code}-${r.subject || ""}-${i}`} className="flex flex-wrap items-start gap-1.5 text-sm">
                    <CodeChip code={r.code} />
                    <span className={cn("font-medium", r.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300")}>
                      {r.message}
                    </span>
                    {r.action ? <span className="w-full pl-0.5 text-xs text-muted-foreground sm:w-auto">{r.action}</span> : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 space-y-3">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/40 p-1">
            <TabsTrigger value="trace" className="rounded-lg text-xs sm:text-sm">Requirements</TabsTrigger>
            <TabsTrigger value="pcs" className="rounded-lg text-xs sm:text-sm">Equipment PCs ({pcs.length})</TabsTrigger>
            <TabsTrigger value="errors" className="rounded-lg text-xs sm:text-sm">Errors &amp; codes ({errors.length})</TabsTrigger>
            <TabsTrigger value="uploads" className="rounded-lg text-xs sm:text-sm">Uploads &amp; results</TabsTrigger>
            <TabsTrigger value="workspaces" className="rounded-lg text-xs sm:text-sm">Booking workspaces</TabsTrigger>
            <TabsTrigger value="diagnostics" className="rounded-lg text-xs sm:text-sm">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="trace">
            <TraceChecklist checks={checks} onCode={() => setTab("errors")} />
          </TabsContent>

          <TabsContent value="pcs">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="overflow-x-auto p-0">
                {pcs.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment PC</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Heartbeat</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Share / path</TableHead>
                        <TableHead>Firewall</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Last error</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pcs.map((pc, i) => {
                        const key = pcKey(pc, i);
                        const fw = pcFirewall(pc);
                        return (
                          <TableRow
                            key={key}
                            className={cn("cursor-pointer", pcIsRetired(pc) && "opacity-60")}
                            onClick={() => onOpenPc(key)}
                            data-testid={`pc-row-${key}`}
                          >
                            <TableCell className="font-medium">{pcName(pc)}</TableCell>
                            <TableCell>
                              {/* Heartbeat freshness verdict from the portal, never the DSA's stored status. */}
                              <HealthBadge health={pcHealth(pc)} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {relativeTime((pc.last_heartbeat_at ?? pc.last_seen ?? pc.last_status_at) as string | null)}
                            </TableCell>
                            <TableCell>
                              {pc.agent_version ? (
                                <VersionPill version={String(pc.agent_version)} latest={latest} status={compareVersion(String(pc.agent_version), latest)} />
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="flex items-center gap-1">
                                <CheckIcon state={pc.share_ok === true ? "pass" : pc.share_ok === false ? "fail" : "unknown"} className="h-3.5 w-3.5" />
                                {pc.share_name ? String(pc.share_name) : pc.share_ok === true ? "OK" : pc.share_ok === false ? "Unreachable" : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="flex items-center gap-1" title={fw.fact}>
                                <CheckIcon state={fw.state} className="h-3.5 w-3.5" />
                                {fw.state === "pass" ? "Open" : fw.state === "fail" ? "Blocked" : "Not probed"}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{show(pc.observed_ip ?? pc.assigned_ip)}</TableCell>
                            <TableCell className="max-w-[16rem] break-words text-xs">{show(pc.last_error)}</TableCell>
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">No Equipment PCs reported.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <ErrorsList detail={detail} />
          </TabsContent>

          <TabsContent value="uploads">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-0 sm:p-2">
                <UploadsTable uploads={detail.uploads || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspaces">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-0 sm:p-2">
                <WorkspacesTable workspaces={detail.workspaces || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Facts
                title="Service"
                rows={[
                  ["Version", cleanVersion(String(service.version ?? a.version))],
                  ["Uptime", formatUptime(service.uptime_seconds)],
                  ["Windows service", service.running_as_service],
                  ["Machine", service.machine_name ?? a.machine_name],
                  ["Memory", service.working_set_mb ? `${service.working_set_mb} MB` : null],
                ]}
              />
              <Facts
                title="Portal link"
                rows={[
                  ["Last heartbeat", relativeTime(a.last_heartbeat_at)],
                  ["Portal", section(diag, "portal").base_url],
                  ["Failed heartbeats (last 50)", section(diag, "portal").heartbeats_failed_last_50],
                  ["Clock skew", a.clock_skew_seconds == null ? null : `${a.clock_skew_seconds} s`],
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
                  ["Enabled", net.enabled],
                  ["Adapter", net.adapter_name ?? net.configured_adapter],
                  ["Connected", net.adapter_up],
                  ["IP", net.adapter_ip],
                  ["Configured IP", net.configured_ip],
                  ["Subnet", net.subnet],
                ]}
              />
              <Facts
                title="Uploads"
                rows={[
                  ["Waiting", uploads.pending],
                  ["Retrying", uploads.retrying],
                  ["Failed", uploads.failed],
                  ["Oldest waiting", uploads.oldest_pending_age_minutes == null ? null : `${uploads.oldest_pending_age_minutes} min`],
                  ["Oldest file", uploads.oldest_pending_file],
                  ["Last error", uploads.last_error],
                  ["Last upload", relativeTime(uploads.last_completed_at as string | null)],
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
              <Facts
                title="Power (must never sleep)"
                rows={[
                  ["Sleep after (mains)", minutesOrNever(section(diag, "power").standby_ac_minutes)],
                  ["Hibernate after (mains)", minutesOrNever(section(diag, "power").hibernate_ac_minutes)],
                  ["Lid closed", lidAction(section(diag, "power").lid_action_ac)],
                  ["Last put to sleep", section(diag, "power").last_sleep_at ? relativeTime(section(diag, "power").last_sleep_at as string) : null],
                ]}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Remote actions</CardTitle>
            </CardHeader>
            <CardContent>
              <DsaActionsPanel detail={detail} onDone={onReload} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Incidents{openIncidents.length ? ` · ${openIncidents.length} open` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.incidents.length ? (
                <ol className="max-h-80 space-y-2 overflow-y-auto border-l border-border pl-3" aria-label="Incident timeline">
                  {detail.incidents.slice(0, 30).map((inc) => {
                    const open = inc.status !== "RESOLVED" && inc.status !== "EXPIRED";
                    return (
                      <li key={inc.id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {open ? (
                            inc.code === "DSA_OFFLINE" ? (
                              <WifiOff className="h-3.5 w-3.5 text-red-700" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                            )
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                          )}
                          <CodeChip code={inc.code} />
                          <span className="font-medium">{inc.title}</span>
                          {open && inc.status !== "ACKNOWLEDGED" ? (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void acknowledge(inc.id)}>
                              Acknowledge
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {exactTime(inc.opened_at)}
                          {inc.resolved_at ? ` → ${exactTime(inc.resolved_at)}` : ` · ${inc.status.toLowerCase()}`}
                          {inc.acknowledged_by ? ` · ack ${inc.acknowledged_by}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{inc.message}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No incidents recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
