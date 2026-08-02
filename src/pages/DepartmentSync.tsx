import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, getAdminBaseUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AgentRow = {
  id: string;
  agent_uuid: string;
  agent_name: string;
  online: boolean;
  status: string;
  department: string;
  equipment_name?: string;
  equipment_code?: string;
  computer?: string;
  hostname?: string;
  agent_version?: string;
  cpu_percent?: number | null;
  memory_percent?: number | null;
  disk_percent?: number | null;
  queue_length?: number | null;
  last_heartbeat_at?: string | null;
};

const COMMAND_TYPES = [
  "REFRESH_CONFIGURATION",
  "RESTART_AGENT",
  "RUN_DIAGNOSTICS",
  "COLLECT_LOGS",
  "RESCAN_FOLDER",
  "SYNCHRONIZE_BOOKINGS",
  "BOOTSTRAP_REQUIRED",
];

function fmtTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusBadge(online: boolean, status: string) {
  if (online) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
        Online
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
      {status || "Offline"}
    </Badge>
  );
}

export default function DepartmentSync() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const [consoleData, setConsoleData] = useState<Record<string, unknown> | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentMeta, setAgentMeta] = useState({ online: 0, offline: 0, timeout: 180 });
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [assignments, setAssignments] = useState<Array<Record<string, unknown>>>([]);
  const [heartbeats, setHeartbeats] = useState<Array<Record<string, unknown>>>([]);
  const [commands, setCommands] = useState<Array<Record<string, unknown>>>([]);
  const [workspaces, setWorkspaces] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [djangoLinks, setDjangoLinks] = useState<Array<{ key: string; label: string; path: string }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [commandType, setCommandType] = useState(COMMAND_TYPES[0]);
  const [commandBusy, setCommandBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) navigate("/dashboard");
  }, [isAdmin, navigate]);

  const load = useCallback(async (soft = false) => {
    if (!isAdmin) return;
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const [
        consoleRes,
        agentsRes,
        profilesRes,
        assignmentsRes,
        heartbeatsRes,
        commandsRes,
        workspacesRes,
        logsRes,
        linksRes,
      ] = await Promise.all([
        apiClient.getDepartmentSyncConsole(),
        apiClient.getDepartmentSyncAgents(),
        apiClient.getDepartmentSyncProfiles(),
        apiClient.getDepartmentSyncAssignments(true),
        apiClient.getDepartmentSyncHeartbeats(),
        apiClient.getDepartmentSyncCommands(),
        apiClient.getDepartmentSyncWorkspaces(),
        apiClient.getDepartmentSyncLogs(),
        apiClient.getDepartmentSyncDjangoLinks(),
      ]);

      if (consoleRes.error) throw new Error(consoleRes.error);
      if (agentsRes.error) throw new Error(agentsRes.error);

      setConsoleData((consoleRes.data as Record<string, unknown>) || null);
      const agentRows = ((agentsRes.data?.results || []) as AgentRow[]) ?? [];
      setAgents(agentRows);
      setAgentMeta({
        online: agentsRes.data?.online_count ?? 0,
        offline: agentsRes.data?.offline_count ?? 0,
        timeout: agentsRes.data?.heartbeat_timeout_seconds ?? 180,
      });
      if (!selectedAgentId && agentRows[0]) setSelectedAgentId(agentRows[0].id);

      setProfiles((profilesRes.data?.results as Array<Record<string, unknown>>) || []);
      setAssignments((assignmentsRes.data?.results as Array<Record<string, unknown>>) || []);
      setHeartbeats((heartbeatsRes.data?.results as Array<Record<string, unknown>>) || []);
      setCommands((commandsRes.data?.results as Array<Record<string, unknown>>) || []);
      setWorkspaces((workspacesRes.data?.results as Array<Record<string, unknown>>) || []);
      setLogs((logsRes.data?.results as Array<Record<string, unknown>>) || []);
      setDjangoLinks(linksRes.data?.links || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Department Sync data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, selectedAgentId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      `${a.agent_name} ${a.department} ${a.equipment_name} ${a.hostname} ${a.computer}`
        .toLowerCase()
        .includes(q),
    );
  }, [agents, query]);

  const cards = (consoleData?.cards as Record<string, number> | undefined) || {};

  const sendCommand = async () => {
    if (!selectedAgentId) {
      toast.error("Select an agent first.");
      return;
    }
    setCommandBusy(true);
    try {
      const res = await apiClient.createDepartmentSyncCommand(selectedAgentId, commandType);
      if (res.error) throw new Error(res.error);
      toast.success(`Queued ${commandType}`);
      const cmds = await apiClient.getDepartmentSyncCommands();
      setCommands((cmds.data?.results as Array<Record<string, unknown>>) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue command.");
    } finally {
      setCommandBusy(false);
    }
  };

  const openDjango = (path: string) => {
    const url = `${getAdminBaseUrl()}${path.replace(/^\//, "")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isAdmin) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="mx-auto max-w-[min(1600px,98vw)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 rounded-2xl border border-border/50 bg-gradient-to-br from-primary via-primary to-accent p-4 text-white shadow-lg sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="shrink-0 text-white/90 hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 opacity-90" />
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Department Sync Agents
                  </h1>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-white/85">
                  Fleet overview matching Django Admin Department Sync — agents, assignments,
                  profiles, commands, heartbeats, workspaces, and logs.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => navigate("/department-sync/agent-installer")}
              >
                <HardDrive className="mr-2 h-4 w-4" />
                Agent Installer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => void load(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => openDjango("sync/syncoperationsconsole/console/")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Django Ops Console
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Department Sync…
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {[
                { label: "Enrolled", value: cards.enrolled_agents ?? 0 },
                { label: "Online", value: agentMeta.online, icon: Wifi },
                { label: "Not reporting", value: cards.agents_not_reporting ?? agentMeta.offline, icon: WifiOff },
                { label: "Sync enabled", value: cards.equipment_sync_enabled ?? 0 },
                { label: "No agent", value: cards.equipment_without_agent ?? 0 },
                { label: "Errors today", value: cards.errors_today ?? 0 },
              ].map((c) => (
                <Card key={c.label} className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {c.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/40 p-1">
                {[
                  ["overview", "Operations"],
                  ["agents", "Agents"],
                  ["assignments", "Assignments"],
                  ["profiles", "Profiles"],
                  ["commands", "Commands"],
                  ["heartbeats", "Heartbeats"],
                  ["workspaces", "Workspaces"],
                  ["logs", "Logs"],
                  ["django", "Django Admin"],
                ].map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="rounded-xl px-3 py-1.5 text-xs sm:text-sm">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="rounded-2xl border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Recent errors</CardTitle>
                      <CardDescription>Critical and error sync events</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {((consoleData?.recent_errors as Array<Record<string, unknown>>) || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent errors.</p>
                      ) : (
                        ((consoleData?.recent_errors as Array<Record<string, unknown>>) || []).map((row) => (
                          <div key={String(row.id)} className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{String(row.event_code)}</span>
                              <Badge variant="outline">{String(row.severity)}</Badge>
                            </div>
                            <div className="mt-1 text-muted-foreground line-clamp-2">{String(row.message)}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {String(row.agent_name || "")} · {fmtTime(String(row.created_at || ""))}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Validation issues</CardTitle>
                      <CardDescription>Configuration checks across agents and profiles</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {((consoleData?.validation_issues as Array<Record<string, unknown>>) || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No validation issues detected.</p>
                      ) : (
                        ((consoleData?.validation_issues as Array<Record<string, unknown>>) || []).map((row, idx) => (
                          <div key={`${row.code}-${idx}`} className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
                            <div className="font-medium">{String(row.code)}</div>
                            <div className="text-muted-foreground">{String(row.message)}</div>
                            {row.object_repr ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">{String(row.object_repr)}</div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground">
                  Heartbeat timeout: {agentMeta.timeout}s · Uploads today: {cards.uploads_today ?? 0} ·
                  Config mismatches: {cards.configuration_mismatch ?? 0}
                </p>
              </TabsContent>

              <TabsContent value="agents" className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search agents, departments, equipment…"
                    className="max-w-md rounded-xl"
                  />
                  <div className="text-xs text-muted-foreground">
                    {filteredAgents.length} agents · {agentMeta.online} online
                  </div>
                </div>
                <Card className="overflow-hidden rounded-2xl border-border/60">
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>CPU / Mem</TableHead>
                          <TableHead>Queue</TableHead>
                          <TableHead>Last heartbeat</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAgents.map((a) => (
                          <TableRow key={a.id} className={cn(selectedAgentId === a.id && "bg-primary/[0.03]")}>
                            <TableCell>
                              <div className="font-medium">{a.agent_name}</div>
                              <div className="text-[11px] text-muted-foreground">{a.agent_version || "—"}</div>
                            </TableCell>
                            <TableCell>{statusBadge(a.online, a.status)}</TableCell>
                            <TableCell>{a.department || "—"}</TableCell>
                            <TableCell>
                              <div className="truncate max-w-[12rem]">{a.equipment_name || "—"}</div>
                              <div className="text-[11px] text-muted-foreground">{a.equipment_code}</div>
                            </TableCell>
                            <TableCell>{a.hostname || a.computer || "—"}</TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {a.cpu_percent != null ? `${Math.round(a.cpu_percent)}%` : "—"} /{" "}
                              {a.memory_percent != null ? `${Math.round(a.memory_percent)}%` : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {a.queue_length != null ? a.queue_length : "—"}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(a.last_heartbeat_at)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={selectedAgentId === a.id ? "default" : "outline"}
                                onClick={() => {
                                  setSelectedAgentId(a.id);
                                  setTab("commands");
                                }}
                              >
                                Commands
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="assignments">
                <DataTable
                  columns={["Agent", "Equipment", "Department", "Assigned", "Active"]}
                  rows={assignments.map((r) => [
                    String(r.agent_name || ""),
                    `${r.equipment_name || ""} (${r.equipment_code || ""})`,
                    String(r.department || ""),
                    fmtTime(String(r.assigned_at || "")),
                    r.is_active ? "Yes" : "No",
                  ])}
                />
              </TabsContent>

              <TabsContent value="profiles">
                <DataTable
                  columns={["Equipment", "Department", "Host / Watch", "Primary agent", "Sync", "Config ver"]}
                  rows={profiles.map((r) => [
                    `${r.equipment_name || ""} (${r.equipment_code || ""})`,
                    String(r.department || ""),
                    `${r.hostname || "—"} · ${r.watch_folder || "—"}`,
                    String(r.primary_agent_name || "—"),
                    r.sync_enabled ? "On" : "Off",
                    String(r.configuration_version ?? ""),
                  ])}
                />
              </TabsContent>

              <TabsContent value="commands" className="space-y-4">
                <Card className="rounded-2xl border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base">Queue remote command</CardTitle>
                    <CardDescription>
                      Sends a portal → agent command (same actions available in Django Admin).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">Agent</div>
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.agent_name} · {a.department || "No dept"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground">Command</div>
                      <Select value={commandType} onValueChange={setCommandType}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMAND_TYPES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => void sendCommand()} disabled={commandBusy}>
                      {commandBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Queue command
                    </Button>
                  </CardContent>
                </Card>
                <DataTable
                  columns={["Type", "Status", "Priority", "Agent", "Equipment", "Created", "Error"]}
                  rows={commands.map((r) => [
                    String(r.command_type || ""),
                    String(r.status || ""),
                    String(r.priority || ""),
                    String(r.agent_name || ""),
                    String(r.equipment_name || "—"),
                    fmtTime(String(r.created_at || "")),
                    String(r.last_error || "—"),
                  ])}
                />
              </TabsContent>

              <TabsContent value="heartbeats">
                <DataTable
                  columns={["Agent", "Reported", "CPU", "Mem", "Disk", "Queue", "Host", "Message"]}
                  rows={heartbeats.map((r) => [
                    String(r.agent_name || ""),
                    fmtTime(String(r.reported_at || "")),
                    r.cpu_percent != null ? `${Math.round(Number(r.cpu_percent))}%` : "—",
                    r.memory_percent != null ? `${Math.round(Number(r.memory_percent))}%` : "—",
                    r.disk_percent != null ? `${Math.round(Number(r.disk_percent))}%` : "—",
                    String(r.queue_size ?? "—"),
                    String(r.hostname || "—"),
                    String(r.status_message || "—"),
                  ])}
                />
              </TabsContent>

              <TabsContent value="workspaces">
                <DataTable
                  columns={["Workspace", "Status", "Agent", "Booking", "Equipment", "Folder", "Updated"]}
                  rows={workspaces.map((r) => [
                    String(r.workspace_name || ""),
                    String(r.status || ""),
                    String(r.agent_name || ""),
                    String(r.booking_id ?? "—"),
                    String(r.equipment_name || "—"),
                    String(r.relative_folder || "—"),
                    fmtTime(String(r.updated_at || "")),
                  ])}
                />
              </TabsContent>

              <TabsContent value="logs">
                <DataTable
                  columns={["When", "Severity", "Code", "Agent", "Equipment", "Message"]}
                  rows={logs.map((r) => [
                    fmtTime(String(r.created_at || "")),
                    String(r.severity || ""),
                    String(r.event_code || ""),
                    String(r.agent_name || ""),
                    String(r.equipment_name || "—"),
                    String(r.message || ""),
                  ])}
                />
              </TabsContent>

              <TabsContent value="django">
                <Card className="rounded-2xl border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base">Open Django Admin (Department Sync)</CardTitle>
                    <CardDescription>
                      Use these links for deep CRUD, enrollment secrets, and profile/assignment
                      editors that remain in Django Admin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(djangoLinks.length
                      ? djangoLinks
                      : [
                          { key: "ops", label: "Sync Operations Console", path: "sync/syncoperationsconsole/console/" },
                          { key: "agents", label: "Department Sync Agents", path: "sync/departmentsyncagent/" },
                          { key: "assignments", label: "Agent Assignments", path: "sync/agentassignment/" },
                          { key: "profiles", label: "Equipment Sync Profiles", path: "sync/equipmentsyncprofile/" },
                          { key: "commands", label: "Agent Commands", path: "sync/agentcommand/" },
                          { key: "heartbeats", label: "Agent Heartbeats", path: "sync/agentheartbeat/" },
                          { key: "workspaces", label: "Booking Workspaces", path: "sync/bookingworkspace/" },
                          { key: "logs", label: "Sync Logs", path: "sync/synclog/" },
                        ]
                    ).map((link) => (
                      <Button
                        key={link.key}
                        variant="outline"
                        className="justify-between rounded-xl"
                        onClick={() => openDjango(link.path)}
                      >
                        <span className="truncate">{link.label}</span>
                        <ExternalLink className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60">
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={idx}>
                  {row.map((cell, cIdx) => (
                    <TableCell key={cIdx} className={cn(cIdx === row.length - 1 && "max-w-xs truncate")}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
