import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { hasRbacPermission } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, HardDrive, Loader2, Monitor, Network, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type DashboardMetrics = {
  total_workstations: number;
  online: number;
  offline: number;
  busy: number;
  maintenance: number;
  average_cpu: number;
  average_memory: number;
  average_disk: number;
  average_health_score: number;
  recent_alerts: Array<{ id: string; action: string; details: string; workstation?: string; created_at: string }>;
  last_heartbeats: Array<{
    id: string;
    hostname: string;
    display_name: string;
    status: string;
    last_heartbeat: string;
    health_score: number;
  }>;
};

type Workstation = {
  id: string;
  agent_id: string;
  hostname: string;
  display_name: string;
  status: string;
  enabled: boolean;
  health_score: number;
  last_heartbeat?: string | null;
  cpu?: string;
  memory_gb?: number;
  storage_gb?: number;
  gpu?: string;
  building?: string;
  room?: string;
  department_name?: string;
  current_command?: string;
  agent_version?: string;
};

type SoftwareRow = {
  id: number;
  software_name: string;
  publisher: string;
  version: string;
  workstation_hostname?: string;
  licensed: boolean;
  category?: string;
};

type CommandRow = {
  id: string;
  command_type: string;
  status: string;
  workstation_hostname?: string;
  created_at: string;
  result_message?: string;
  error_message?: string;
};

type EventRow = {
  id: string;
  category: string;
  action: string;
  details: string;
  success: boolean;
  workstation_hostname?: string;
  created_at: string;
};

type HeartbeatRow = {
  id: number;
  received_at: string;
  cpu: number;
  memory: number;
  disk: number;
  logged_in_user: string;
  current_state: string;
};

type ReservationRow = {
  id: string;
  status: string;
  user_email?: string;
  workstation_hostname?: string | null;
  requested_start: string;
  requested_end: string;
  reserved_start?: string | null;
  reserved_end?: string | null;
  priority: number;
  booking_id?: number | null;
  allocation_score?: number | null;
};

type SessionDash = {
  active_sessions: number;
  idle_sessions: number;
  preparing_sessions: number;
  browser_sessions: number;
  open_sessions: number;
  total_sessions: number;
  failure_rate: number;
  average_duration_seconds: number;
  average_idle_seconds: number;
  average_launch_latency_ms: number;
  bandwidth_bytes_in: number;
  bandwidth_bytes_out: number;
  guacamole_reachable: boolean;
  mock_guacamole: boolean;
  timeline?: Array<{
    id: string;
    status: string;
    created_at: string;
    launch_time?: string | null;
    connected_at?: string | null;
    workstation__hostname?: string;
    user__email?: string;
  }>;
  recent_disconnects?: Array<{
    id: string;
    status: string;
    termination_reason?: string;
    disconnected_at?: string | null;
    workstation__hostname?: string;
    user__email?: string;
  }>;
};

type SessionRow = {
  id: string;
  status: string;
  user_email?: string;
  workstation_hostname?: string;
  workstation_display_name?: string;
  reservation_id?: string;
  created_at: string;
  launch_time?: string | null;
  connected_at?: string | null;
  disconnected_at?: string | null;
  expires_at?: string | null;
  termination_reason?: string;
  failure_detail?: string;
  clipboard_enabled?: boolean;
  file_transfer_enabled?: boolean;
  audio_enabled?: boolean;
};

type WorkspaceDash = {
  workspaces_total: number;
  active: number;
  archived: number;
  storage_bytes: number;
  average_workspace_bytes: number;
  transfer_failure_rate: number;
  transfer_queue?: Array<{
    id: string;
    direction: string;
    status: string;
    bytes_transferred: number;
    bytes_total: number;
  }>;
  recent_audits?: Array<{ action: string; details: string; success: boolean; created_at: string }>;
};

type WorkspaceRow = {
  id: string;
  status: string;
  user_email?: string;
  workstation_hostname?: string;
  reservation_id?: string;
  quota_gb: number;
  current_usage_bytes: number;
  current_usage_gb?: number;
  quota_usage_percent?: number;
  archive_status?: string;
  read_only?: boolean;
  created_at: string;
  folders?: Array<{ name: string; relative_path: string; read_only: boolean }>;
};

type WorkspaceFileRow = {
  id: string;
  original_name: string;
  relative_path: string;
  size: number;
  sha256: string;
  version: number;
  virus_status: string;
  category: string;
  uploaded_at: string;
};

type QueueRow = {
  id: string;
  reservation_id: string;
  reservation_status: string;
  user_email?: string;
  requested_start?: string;
  status: string;
  priority: number;
  enqueued_at: string;
};

type SchedulerDash = {
  scheduler?: Record<string, unknown>;
  statistics?: { by_status?: Record<string, number>; created_24h?: number; allocated_24h?: number };
  upcoming?: ReservationRow[];
  expired?: ReservationRow[];
  queue?: QueueRow[];
  maintenance?: Array<{ id: string; start: string; end: string; reason: string; workstation_hostname?: string; active: boolean }>;
  calendar?: ReservationRow[];
  available_now?: number;
};

const COMMAND_TYPES = [
  "PING",
  "REFRESH",
  "REFRESH_SOFTWARE",
  "COLLECT_LOGS",
  "RESTART_AGENT",
  "PREPARE_WORKSTATION",
  "CLEAN_WORKSTATION",
  "SYNC_WORKSPACE",
  "COLLECT_WORKSPACE",
  "DIAGNOSE_RDP",
];

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const s = status.toUpperCase();
  if (["AVAILABLE", "ONLINE"].includes(s)) return "default";
  if (["OFFLINE", "ERROR", "DISABLED"].includes(s)) return "destructive";
  if (["MAINTENANCE", "BUSY", "PREPARING", "CLEANING"].includes(s)) return "secondary";
  return "outline";
};

export default function RemoteAnalysis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage =
    userType === "admin" ||
    userType === "dept_admin" ||
    userType === "manager" ||
    hasRbacPermission(user, "remote_analysis.manage");
  const canView =
    canManage ||
    userType === "operator" ||
    hasRbacPermission(user, "remote_analysis.view");

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [software, setSoftware] = useState<SoftwareRow[]>([]);
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [heartbeats, setHeartbeats] = useState<HeartbeatRow[]>([]);
  const [commandType, setCommandType] = useState("PING");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busyAction, setBusyAction] = useState(false);
  const [schedulerDash, setSchedulerDash] = useState<SchedulerDash | null>(null);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [sessionDash, setSessionDash] = useState<SessionDash | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionRow[]>([]);
  const [workspaceDash, setWorkspaceDash] = useState<WorkspaceDash | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [archivedWorkspaces, setArchivedWorkspaces] = useState<WorkspaceRow[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileRow[]>([]);
  const [uploadFolder, setUploadFolder] = useState("RawData");
  const [fileVersions, setFileVersions] = useState<Array<{ version: number; size: number; sha256: string; created_at: string; note?: string }>>([]);
  const [opsDash, setOpsDash] = useState<Record<string, unknown> | null>(null);
  const [opsAlerts, setOpsAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [opsReports, setOpsReports] = useState<Array<Record<string, unknown>>>([]);
  const [reportType, setReportType] = useState("DAILY_OPERATIONS");
  const [reportFormat, setReportFormat] = useState("JSON");
  const [collabDash, setCollabDash] = useState<Record<string, unknown> | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [helpSubject, setHelpSubject] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [timelineSessionId, setTimelineSessionId] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<Array<Record<string, unknown>>>([]);

  const selected = useMemo(
    () => workstations.find((w) => w.id === selectedId) || null,
    [workstations, selectedId]
  );

  const loadAll = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const [dashRes, wsRes, softRes, cmdRes, evtRes, schedRes, resRes, sessDashRes, sessRes, histRes, wspDashRes, wspRes, wspArchRes, opsRes, alertRes, reportRes, collabRes] =
        await Promise.all([
          apiClient.getRemoteAnalysisDashboard(),
          apiClient.getRemoteAnalysisWorkstations(),
          apiClient.getRemoteAnalysisSoftware(),
          apiClient.getRemoteAnalysisCommands(),
          apiClient.getRemoteAnalysisEvents(),
          apiClient.getRemoteAnalysisSchedulerDashboard(),
          apiClient.getRemoteAnalysisReservations(),
          apiClient.getRemoteAnalysisSessionDashboard(),
          apiClient.getRemoteAnalysisSessions(),
          apiClient.getRemoteAnalysisSessionHistory(),
          apiClient.getRemoteAnalysisWorkspaceDashboard(),
          apiClient.getRemoteAnalysisWorkspaces(),
          apiClient.getRemoteAnalysisWorkspaces(undefined, true),
          apiClient.getRemoteAnalysisOperationsDashboard(),
          apiClient.getRemoteAnalysisAlerts(),
          apiClient.getRemoteAnalysisReports(),
          apiClient.getRemoteAnalysisCollaborationDashboard(),
        ]);
      if (dashRes.error || wsRes.error) {
        toast.error(dashRes.error || wsRes.error || "Failed to load Remote Analysis data");
        return;
      }
      setDashboard((dashRes.data as DashboardMetrics) || null);
      setWorkstations((wsRes.data as Workstation[]) || []);
      setSoftware((softRes.data as SoftwareRow[]) || []);
      setCommands((cmdRes.data as CommandRow[]) || []);
      setEvents((evtRes.data as EventRow[]) || []);
      setSchedulerDash((schedRes.data as SchedulerDash) || null);
      setReservations((resRes.data as ReservationRow[]) || []);
      setSessionDash((sessDashRes.data as SessionDash) || null);
      setSessions((sessRes.data as SessionRow[]) || []);
      setSessionHistory((histRes.data as SessionRow[]) || []);
      setWorkspaceDash((wspDashRes.data as WorkspaceDash) || null);
      setWorkspaces((wspRes.data as WorkspaceRow[]) || []);
      setArchivedWorkspaces((wspArchRes.data as WorkspaceRow[]) || []);
      setOpsDash((opsRes.data as Record<string, unknown>) || null);
      setOpsAlerts((alertRes.data as Array<Record<string, unknown>>) || []);
      setOpsReports((reportRes.data as Array<Record<string, unknown>>) || []);
      setCollabDash((collabRes.data as Record<string, unknown>) || null);
      if (!selectedId && (wsRes.data as Workstation[])?.length) {
        setSelectedId((wsRes.data as Workstation[])[0].id);
      }
      if (!selectedWorkspaceId && (wspRes.data as WorkspaceRow[])?.length) {
        setSelectedWorkspaceId((wspRes.data as WorkspaceRow[])[0].id);
      }
    } catch {
      toast.error("Failed to load Remote Analysis data");
    } finally {
      setLoading(false);
    }
  }, [canView, selectedId, selectedWorkspaceId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedId) {
      setHeartbeats([]);
      return;
    }
    apiClient.getRemoteAnalysisHeartbeats(selectedId).then((res) => {
      setHeartbeats((res.data as HeartbeatRow[]) || []);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setWorkspaceFiles([]);
      return;
    }
    apiClient.getRemoteAnalysisWorkspaceFiles(selectedWorkspaceId).then((res) => {
      setWorkspaceFiles((res.data as WorkspaceFileRow[]) || []);
    });
  }, [selectedWorkspaceId]);

  const filteredWorkstations = useMemo(() => {
    if (statusFilter === "ALL") return workstations;
    return workstations.filter((w) => w.status === statusFilter);
  }, [workstations, statusFilter]);

  const runAction = async (action: "enable" | "disable" | "maintenance" | "command") => {
    if (!selected || !canManage) return;
    setBusyAction(true);
    try {
      if (action === "command") {
        const res = await apiClient.createRemoteAnalysisCommand(selected.id, commandType);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`${commandType} queued`);
      } else {
        const res = await apiClient.postRemoteAnalysisWorkstationAction(
          selected.id,
          action,
          action === "maintenance" ? { reason: "Portal maintenance" } : undefined
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Workstation ${action}d`);
      }
      await loadAll();
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setBusyAction(false);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Remote Analysis</CardTitle>
              <CardDescription>You do not have permission to view this module.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Monitor className="h-6 w-6 text-primary" />
              Remote Analysis
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Portal workstation registry, health, inventory, and remote command queue.
              Guacamole and browser sessions are not part of this milestone.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/remote-analysis/rdp-diagnostics")}>
              <Network className="mr-2 h-4 w-4" /> RDP Diagnostics
            </Button>
            <Button variant="outline" onClick={() => navigate("/remote-analysis/agent-installer")}>
              <HardDrive className="mr-2 h-4 w-4" /> Agent Installer
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button variant="secondary" onClick={loadAll} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {loading && !dashboard ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading remote analysis…
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="workstations">Workstations</TabsTrigger>
              <TabsTrigger value="software">Installed Software</TabsTrigger>
              <TabsTrigger value="heartbeats">Heartbeat History</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {[
                  ["Total", dashboard?.total_workstations],
                  ["Online", dashboard?.online],
                  ["Offline", dashboard?.offline],
                  ["Busy", dashboard?.busy],
                  ["Maintenance", dashboard?.maintenance],
                  ["Avg CPU %", dashboard?.average_cpu],
                  ["Avg Memory %", dashboard?.average_memory],
                  ["Avg Disk %", dashboard?.average_disk],
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                      <CardTitle className="text-2xl">{value ?? "—"}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard?.recent_alerts || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No recent alerts.</p>
                    )}
                    {(dashboard?.recent_alerts || []).map((a) => (
                      <div key={a.id} className="text-sm border-b border-border/60 pb-2">
                        <div className="font-medium">{a.action}</div>
                        <div className="text-muted-foreground">{a.details}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.workstation || "—"} · {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Last heartbeats</CardTitle>
                    <CardDescription>Average health score: {dashboard?.average_health_score ?? "—"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard?.last_heartbeats || []).map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-sm gap-2">
                        <div>
                          <div className="font-medium">{h.display_name || h.hostname}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.last_heartbeat ? new Date(h.last_heartbeat).toLocaleString() : "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(h.status)}>{h.status}</Badge>
                          <Badge variant="outline">{h.health_score}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="workstations" className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {["AVAILABLE", "ONLINE", "OFFLINE", "BUSY", "MAINTENANCE", "DISABLED", "ERROR"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="max-w-xs"
                  placeholder="Filter is client-side via status above"
                  disabled
                />
              </div>
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostname</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Last heartbeat</TableHead>
                        <TableHead>Agent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWorkstations.map((w) => (
                        <TableRow
                          key={w.id}
                          className={`cursor-pointer ${selectedId === w.id ? "bg-muted/50" : ""}`}
                          onClick={() => setSelectedId(w.id)}
                        >
                          <TableCell>
                            <div className="font-medium">{w.display_name || w.hostname}</div>
                            <div className="text-xs text-muted-foreground">{w.agent_id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                          </TableCell>
                          <TableCell>{w.health_score}</TableCell>
                          <TableCell>
                            {[w.building, w.room].filter(Boolean).join(" / ") || "—"}
                          </TableCell>
                          <TableCell>
                            {w.last_heartbeat ? new Date(w.last_heartbeat).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>{w.agent_version || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="software">
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Software</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Publisher</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Licensed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {software.slice(0, 200).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.software_name}</TableCell>
                          <TableCell>{s.version || "—"}</TableCell>
                          <TableCell>{s.publisher || "—"}</TableCell>
                          <TableCell>{s.workstation_hostname || "—"}</TableCell>
                          <TableCell>{s.licensed ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="heartbeats" className="space-y-4">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue placeholder="Select workstation" />
                </SelectTrigger>
                <SelectContent>
                  {workstations.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.display_name || w.hostname || w.agent_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Disk</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heartbeats.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{new Date(h.received_at).toLocaleString()}</TableCell>
                          <TableCell>{h.cpu}%</TableCell>
                          <TableCell>{h.memory}%</TableCell>
                          <TableCell>{h.disk}%</TableCell>
                          <TableCell>{h.logged_in_user || "—"}</TableCell>
                          <TableCell>{h.current_state || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commands" className="space-y-4">
              {canManage && selected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Issue command</CardTitle>
                    <CardDescription>
                      Target: {selected.display_name || selected.hostname}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 items-center">
                    <Select value={commandType} onValueChange={setCommandType}>
                      <SelectTrigger className="w-[240px]">
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
                    <Button onClick={() => runAction("command")} disabled={busyAction}>
                      Queue command
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commands.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.command_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.status}</Badge>
                          </TableCell>
                          <TableCell>{c.workstation_hostname || "—"}</TableCell>
                          <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {c.error_message || c.result_message || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Maintenance controls</CardTitle>
                  <CardDescription>
                    Only System Administrator, Department Administrator, and Officer In Charge may change workstation mode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder="Select workstation" />
                    </SelectTrigger>
                    <SelectContent>
                      {workstations.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.display_name || w.hostname || w.agent_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected && (
                    <div className="text-sm text-muted-foreground">
                      Current status: <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>{" "}
                      · Enabled: {selected.enabled ? "yes" : "no"}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!canManage || !selected || busyAction} onClick={() => runAction("maintenance")}>
                      Maintenance mode
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canManage || !selected || busyAction}
                      onClick={() => runAction("enable")}
                    >
                      Enable
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!canManage || !selected || busyAction}
                      onClick={() => runAction("disable")}
                    >
                      Disable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Health scores</CardTitle>
                  <CardDescription>
                    Score 0–100 from heartbeat age, CPU/memory/disk, inventory freshness, agent version, and command failures.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>CPU model</TableHead>
                        <TableHead>Memory GB</TableHead>
                        <TableHead>Storage GB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workstations
                        .slice()
                        .sort((a, b) => a.health_score - b.health_score)
                        .map((w) => (
                          <TableRow key={w.id}>
                            <TableCell>{w.display_name || w.hostname}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{w.health_score}</TableCell>
                            <TableCell className="max-w-[220px] truncate">{w.cpu || "—"}</TableCell>
                            <TableCell>{w.memory_gb ?? "—"}</TableCell>
                            <TableCell>{w.storage_gb ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scheduler" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["Available now", schedulerDash?.available_now],
                  ["Created 24h", schedulerDash?.statistics?.created_24h],
                  ["Allocated 24h", schedulerDash?.statistics?.allocated_24h],
                  ["Queue waiting", (schedulerDash?.queue || []).length],
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                      <CardTitle className="text-2xl">{value ?? "—"}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scheduler status</CardTitle>
                  <CardDescription>
                    Allocates workstations only — Guacamole / browser sessions are future milestones.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>State: {String(schedulerDash?.scheduler?.scheduler ?? "—")}</div>
                  <div>Active reservations: {String((schedulerDash?.scheduler as any)?.active_reservations ?? "—")}</div>
                  <div>Active maintenance: {String((schedulerDash?.scheduler as any)?.active_maintenance_windows ?? "—")}</div>
                  <div className="text-muted-foreground">{String((schedulerDash?.scheduler as any)?.note ?? "")}</div>
                </CardContent>
              </Card>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Upcoming reservations</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(schedulerDash?.upcoming || []).slice(0, 10).map((r) => (
                      <div key={r.id} className="text-sm flex justify-between gap-2 border-b border-border/50 pb-2">
                        <div>
                          <div className="font-medium">{r.user_email || r.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.requested_start).toLocaleString()} → {new Date(r.requested_end).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="outline">{r.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Maintenance calendar</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(schedulerDash?.maintenance || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No active maintenance windows.</p>
                    )}
                    {(schedulerDash?.maintenance || []).map((m) => (
                      <div key={m.id} className="text-sm border-b border-border/50 pb-2">
                        <div className="font-medium">{m.workstation_hostname || "All workstations"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.start).toLocaleString()} – {new Date(m.end).toLocaleString()}
                        </div>
                        <div>{m.reason || "—"}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Reservation timeline / calendar</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schedulerDash?.calendar || []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.requested_start).toLocaleString()}</TableCell>
                          <TableCell>{new Date(r.requested_end).toLocaleString()}</TableCell>
                          <TableCell>{r.user_email || "—"}</TableCell>
                          <TableCell>{r.workstation_hostname || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reservations" className="space-y-4">
              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create reservation</CardTitle>
                    <CardDescription>
                      Link an approved equipment booking, or create a manual admin reservation window.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 items-end">
                    <div>
                      <Label className="text-xs">Booking ID</Label>
                      <Input value={bookingIdInput} onChange={(e) => setBookingIdInput(e.target.value)} placeholder="optional" className="w-36" />
                    </div>
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input type="datetime-local" value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input type="datetime-local" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} />
                    </div>
                    <Button
                      disabled={busyAction}
                      onClick={async () => {
                        setBusyAction(true);
                        try {
                          const body: Record<string, unknown> = { auto_allocate: true };
                          if (bookingIdInput) body.booking_id = Number(bookingIdInput);
                          if (manualStart) body.requested_start = new Date(manualStart).toISOString();
                          if (manualEnd) body.requested_end = new Date(manualEnd).toISOString();
                          const res = await apiClient.createRemoteAnalysisReservation(body);
                          if (res.error) toast.error(res.error);
                          else {
                            toast.success("Reservation created");
                            await loadAll();
                          }
                        } finally {
                          setBusyAction(false);
                        }
                      }}
                    >
                      Create
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Window</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Booking</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          <TableCell>{r.user_email || "—"}</TableCell>
                          <TableCell>{r.workstation_hostname || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(r.requested_start).toLocaleString()}
                            <br />
                            {new Date(r.requested_end).toLocaleString()}
                          </TableCell>
                          <TableCell>{r.priority}</TableCell>
                          <TableCell>{r.booking_id ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {["RESERVED", "READY", "ACTIVE", "PREPARING"].includes(r.status) && (
                                <Button
                                  size="sm"
                                  disabled={busyAction}
                                  onClick={async () => {
                                    setBusyAction(true);
                                    try {
                                      const created = await apiClient.createRemoteAnalysisSession(r.id);
                                      if (created.error) {
                                        toast.error(created.error);
                                        return;
                                      }
                                      const sid = String((created.data as SessionRow).id);
                                      const launch = await apiClient.launchRemoteAnalysisSession(sid);
                                      if (launch.error) {
                                        toast.error(launch.error);
                                        return;
                                      }
                                      const launchUrl = String((launch.data as { launch_url?: string }).launch_url || "");
                                      toast.success(
                                        (launch.data as { mock?: boolean }).mock
                                          ? "Mock session launched"
                                          : "Session launch URL ready"
                                      );
                                      if (launchUrl) {
                                        window.open(launchUrl, "_blank", "noopener,noreferrer");
                                      }
                                      await loadAll();
                                    } finally {
                                      setBusyAction(false);
                                    }
                                  }}
                                >
                                  Launch desktop
                                </Button>
                              )}
                              {canManage && !["COMPLETED", "CANCELLED", "EXPIRED", "FAILED"].includes(r.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    const res = await apiClient.cancelRemoteAnalysisReservation(r.id);
                                    if (res.error) toast.error(res.error);
                                    else {
                                      toast.success("Cancelled");
                                      await loadAll();
                                    }
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Expired reservations</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(schedulerDash?.expired || []).slice(0, 15).map((r) => (
                    <div key={r.id} className="text-sm flex justify-between">
                      <span>{r.user_email || r.id}</span>
                      <Badge variant="destructive">{r.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Active</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{sessionDash?.active_sessions ?? "—"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Idle</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{sessionDash?.idle_sessions ?? "—"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Browser sessions</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{sessionDash?.browser_sessions ?? "—"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Avg duration (s)</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {sessionDash ? Math.round(sessionDash.average_duration_seconds || 0) : "—"}
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Connection health</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>Guacamole: {sessionDash?.guacamole_reachable ? "Reachable" : "Unreachable"}</div>
                    <div>Mode: {sessionDash?.mock_guacamole ? "Mock (dev)" : "Live"}</div>
                    <div>Failure rate: {sessionDash ? `${Math.round((sessionDash.failure_rate || 0) * 100)}%` : "—"}</div>
                    <div>
                      Bandwidth: {sessionDash ? `${sessionDash.bandwidth_bytes_in + sessionDash.bandwidth_bytes_out} B` : "—"}
                    </div>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Session timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                    {(sessionDash?.timeline || []).map((t) => (
                      <div key={t.id} className="text-sm flex justify-between gap-2">
                        <span className="truncate">{t.user__email || t.id}</span>
                        <span className="text-muted-foreground truncate">{t.workstation__hostname || "—"}</span>
                        <Badge variant="outline">{t.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current sessions</CardTitle>
                  <CardDescription>Portal-orchestrated browser remote desktop. Credentials never leave the server.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Connected</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                          <TableCell>{s.user_email || "—"}</TableCell>
                          <TableCell>{s.workstation_display_name || s.workstation_hostname || "—"}</TableCell>
                          <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                          <TableCell>{s.connected_at ? new Date(s.connected_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="flex gap-2">
                            {!["COMPLETED", "TERMINATED", "EXPIRED", "FAILED"].includes(s.status) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busyAction}
                                  onClick={async () => {
                                    setBusyAction(true);
                                    try {
                                      const launch = await apiClient.launchRemoteAnalysisSession(s.id);
                                      if (launch.error) {
                                        toast.error(launch.error);
                                        return;
                                      }
                                      const launchUrl = String((launch.data as { launch_url?: string }).launch_url || "");
                                      if (launchUrl) window.open(launchUrl, "_blank", "noopener,noreferrer");
                                      toast.success("Launch URL opened");
                                      await loadAll();
                                    } finally {
                                      setBusyAction(false);
                                    }
                                  }}
                                >
                                  Launch
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyAction}
                                  onClick={async () => {
                                    setBusyAction(true);
                                    try {
                                      const res = await apiClient.terminateRemoteAnalysisSession(s.id);
                                      if (res.error) toast.error(res.error);
                                      else {
                                        toast.success("Session terminated");
                                        await loadAll();
                                      }
                                    } finally {
                                      setBusyAction(false);
                                    }
                                  }}
                                >
                                  Terminate
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Session history / recent disconnects</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Disconnected</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionHistory.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                          <TableCell>{s.user_email || "—"}</TableCell>
                          <TableCell>{s.workstation_hostname || "—"}</TableCell>
                          <TableCell>{s.disconnected_at ? new Date(s.disconnected_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="max-w-xs truncate">{s.termination_reason || s.failure_detail || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workspaces" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Active</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{workspaceDash?.active ?? "—"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Archived</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{workspaceDash?.archived ?? "—"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Storage (MB)</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {workspaceDash ? Math.round((workspaceDash.storage_bytes || 0) / (1024 * 1024)) : "—"}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Transfer failure %</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {workspaceDash ? Math.round((workspaceDash.transfer_failure_rate || 0) * 100) : "—"}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Workspace browser</CardTitle>
                    <CardDescription>Portal-managed secure file exchange (not Guacamole drive).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={selectedWorkspaceId || undefined} onValueChange={setSelectedWorkspaceId}>
                      <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                      <SelectContent>
                        {workspaces.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.user_email || w.id.slice(0, 8)} · {w.status} · {w.quota_usage_percent ?? 0}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <Select value={uploadFolder} onValueChange={setUploadFolder}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["RawData", "Processed", "Reports", "Exports", "Temp", "Logs", "Metadata"].map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="file"
                        className="max-w-xs"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !selectedWorkspaceId) return;
                          setBusyAction(true);
                          try {
                            const res = await apiClient.uploadRemoteAnalysisWorkspaceFile(
                              selectedWorkspaceId,
                              file,
                              uploadFolder
                            );
                            if (res.error) toast.error(res.error);
                            else {
                              toast.success("Uploaded");
                              const files = await apiClient.getRemoteAnalysisWorkspaceFiles(selectedWorkspaceId);
                              setWorkspaceFiles((files.data as WorkspaceFileRow[]) || []);
                              await loadAll();
                            }
                          } finally {
                            setBusyAction(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!selectedWorkspaceId || busyAction}
                        onClick={async () => {
                          if (!selectedWorkspaceId) return;
                          const res = await apiClient.downloadRemoteAnalysisWorkspaceZip(selectedWorkspaceId);
                          if (res.error || !res.data) {
                            toast.error(res.error || "Download failed");
                            return;
                          }
                          const { blob, filename } = res.data as { blob: Blob; filename: string };
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                      >
                        Download ZIP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedWorkspaceId || busyAction}
                        onClick={async () => {
                          if (!selectedWorkspaceId) return;
                          const res = await apiClient.syncRemoteAnalysisWorkspace(selectedWorkspaceId);
                          if (res.error) toast.error(res.error);
                          else toast.success("Sync queued");
                          await loadAll();
                        }}
                      >
                        Sync to agent
                      </Button>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedWorkspaceId || busyAction}
                          onClick={async () => {
                            if (!selectedWorkspaceId) return;
                            const res = await apiClient.archiveRemoteAnalysisWorkspace(selectedWorkspaceId);
                            if (res.error) toast.error(res.error);
                            else toast.success("Archived");
                            await loadAll();
                          }}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Ver</TableHead>
                          <TableHead>Virus</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workspaceFiles.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="text-xs max-w-[220px] truncate">{f.relative_path}</TableCell>
                            <TableCell>{f.size}</TableCell>
                            <TableCell>{f.version}</TableCell>
                            <TableCell><Badge variant="outline">{f.virus_status}</Badge></TableCell>
                            <TableCell className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const res = await apiClient.downloadRemoteAnalysisWorkspaceFile(selectedWorkspaceId, f.id);
                                  if (res.error || !res.data) {
                                    toast.error(res.error || "Failed");
                                    return;
                                  }
                                  const { blob, filename } = res.data as { blob: Blob; filename: string };
                                  const a = document.createElement("a");
                                  a.href = URL.createObjectURL(blob);
                                  a.download = filename;
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                }}
                              >
                                Get
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const res = await apiClient.getRemoteAnalysisWorkspaceFileVersions(selectedWorkspaceId, f.id);
                                  setFileVersions((res.data as typeof fileVersions) || []);
                                  toast.message(`Versions for ${f.original_name}`);
                                }}
                              >
                                Hist
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {fileVersions.length > 0 && (
                      <div className="text-sm space-y-1">
                        <div className="font-medium">Version history</div>
                        {fileVersions.map((v) => (
                          <div key={v.version} className="flex justify-between text-muted-foreground">
                            <span>v{v.version}</span>
                            <span>{v.size} B</span>
                            <span className="font-mono text-xs">{v.sha256.slice(0, 12)}…</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Transfer queue</CardTitle></CardHeader>
                    <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                      {(workspaceDash?.transfer_queue || []).map((t) => (
                        <div key={t.id} className="text-sm flex justify-between gap-2">
                          <span>{t.direction}</span>
                          <Badge variant="outline">{t.status}</Badge>
                          <span className="text-muted-foreground">{t.bytes_transferred}/{t.bytes_total}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Quota usage</CardTitle></CardHeader>
                    <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                      {workspaces.map((w) => (
                        <div key={w.id} className="text-sm flex justify-between">
                          <span className="truncate">{w.user_email || w.id.slice(0, 8)}</span>
                          <span>{w.quota_usage_percent ?? 0}% of {w.quota_gb} GB</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Archived workspaces</CardTitle></CardHeader>
                    <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                      {archivedWorkspaces.map((w) => (
                        <div key={w.id} className="text-sm flex justify-between gap-2">
                          <span className="truncate">{w.user_email || w.id.slice(0, 8)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canManage}
                            onClick={async () => {
                              const res = await apiClient.restoreRemoteAnalysisWorkspace(w.id);
                              if (res.error) toast.error(res.error);
                              else {
                                toast.success("Restored");
                                await loadAll();
                              }
                            }}
                          >
                            Restore
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4">
              {(() => {
                const exec = (opsDash?.executive || {}) as Record<string, number>;
                const util = (opsDash?.utilization || {}) as Record<string, number>;
                const cap = (opsDash?.capacity || {}) as Record<string, number>;
                const perf = ((opsDash?.performance as Record<string, unknown>)?.metrics || {}) as Record<string, number>;
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-semibold">Operations Center</h2>
                        <p className="text-sm text-muted-foreground">Executive KPIs, alerts, capacity, and reports.</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="secondary"
                          disabled={busyAction}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              const res = await apiClient.getRemoteAnalysisOperationsDashboard(true);
                              if (res.error) toast.error(res.error);
                              else {
                                setOpsDash(res.data as Record<string, unknown>);
                                toast.success("Dashboard refreshed");
                              }
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                        >
                          Refresh KPIs
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Online / Total</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{exec.online_workstations ?? "—"} / {exec.total_workstations ?? "—"}</CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Utilization</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Math.round(exec.average_utilization || 0)}%</CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Availability</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Math.round(exec.availability_percent || 0)}%</CardContent></Card>
                      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Open alerts</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{exec.open_alerts ?? opsAlerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED").length}</CardContent></Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Executive summary</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <div>Busy: {exec.busy_workstations ?? "—"} · Available: {exec.available_workstations ?? "—"}</div>
                          <div>Session success: {Math.round((exec.session_success_rate || 0) * 100)}%</div>
                          <div>Reservation success: {Math.round((exec.reservation_success_rate || 0) * 100)}%</div>
                          <div>Queue length: {exec.current_queue_length ?? "—"}</div>
                          <div>Session hours (day): {Math.round(util.session_hours || 0)}</div>
                          <div>Peak concurrent: {cap.peak_concurrent_sessions ?? "—"}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Performance</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <div>CPU: {Math.round(Number(perf.cpu_utilization || 0))}%</div>
                          <div>Memory: {Math.round(Number(perf.memory_utilization || 0))}%</div>
                          <div>Disk: {Math.round(Number(perf.disk_usage || 0))}%</div>
                          <div>Launch latency: {Math.round(Number(perf.remote_desktop_launch_latency || 0))} ms</div>
                          <div>Portal latency: {Math.round(Number(perf.portal_response_latency || 0))} ms</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Capacity</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <div>Occupancy: {Math.round(Number(cap.average_occupancy_percent || 0))}%</div>
                          <div>Unused: {Math.round(Number(cap.unused_capacity_percent || 0))}%</div>
                          <div>Overbooked periods: {cap.overbooked_periods ?? "—"}</div>
                          <div>Predicted need (rule): {cap.predicted_capacity_need ?? "—"}</div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Alerts</CardTitle></CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                          {opsAlerts.map((a) => (
                            <div key={String(a.id)} className="flex items-center justify-between gap-2 text-sm border-b pb-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{String(a.title)}</div>
                                <div className="text-muted-foreground text-xs">{String(a.severity)} · {String(a.status)}</div>
                              </div>
                              {canManage && a.status !== "RESOLVED" && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={async () => {
                                    const res = await apiClient.acknowledgeRemoteAnalysisAlert(String(a.id));
                                    if (res.error) toast.error(res.error);
                                    else { toast.success("Acknowledged"); await loadAll(); }
                                  }}>Ack</Button>
                                  <Button size="sm" variant="ghost" onClick={async () => {
                                    const res = await apiClient.acknowledgeRemoteAnalysisAlert(String(a.id), true);
                                    if (res.error) toast.error(res.error);
                                    else { toast.success("Resolved"); await loadAll(); }
                                  }}>Resolve</Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Export center</CardTitle>
                          <CardDescription>Generate JSON / CSV / Excel / PDF reports.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Select value={reportType} onValueChange={setReportType}>
                              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["DAILY_OPERATIONS","WEEKLY_UTILIZATION","MONTHLY_UTILIZATION","SESSION_SUMMARY","CAPACITY_REPORT","ALERT_REPORT","FAILURE_REPORT","WORKSPACE_USAGE"].map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={reportFormat} onValueChange={setReportFormat}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["JSON","CSV","EXCEL","PDF"].map((f) => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {canManage && (
                              <Button disabled={busyAction} onClick={async () => {
                                setBusyAction(true);
                                try {
                                  const res = await apiClient.generateRemoteAnalysisReport(reportType, reportFormat);
                                  if (res.error) toast.error(res.error);
                                  else { toast.success("Report generated"); await loadAll(); }
                                } finally { setBusyAction(false); }
                              }}>Generate</Button>
                            )}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Format</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {opsReports.slice(0, 15).map((r) => (
                                <TableRow key={String(r.id)}>
                                  <TableCell className="text-xs">{String(r.report_type)}</TableCell>
                                  <TableCell>{String(r.format)}</TableCell>
                                  <TableCell><Badge variant="outline">{String(r.status)}</Badge></TableCell>
                                  <TableCell className="text-xs">{r.created_at ? new Date(String(r.created_at)).toLocaleString() : "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="collaboration" className="space-y-4">
              {(() => {
                const notifications = (collabDash?.notifications || []) as Array<Record<string, unknown>>;
                const activity = (collabDash?.activity || []) as Array<Record<string, unknown>>;
                const pending = (collabDash?.pending_assistance || []) as Array<Record<string, unknown>>;
                const shared = (collabDash?.shared_workspaces || []) as Array<Record<string, unknown>>;
                const announcements = (collabDash?.announcements || []) as Array<Record<string, unknown>>;
                const bookmarks = (collabDash?.bookmarks || []) as Array<Record<string, unknown>>;
                const favorites = (collabDash?.favorites || []) as Array<Record<string, unknown>>;
                const invitations = (collabDash?.invitations || []) as Array<Record<string, unknown>>;
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-semibold">Collaboration Center</h2>
                        <p className="text-sm text-muted-foreground">
                          Notifications, activity, notes, sharing, assistance, and session timelines.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={busyAction}
                        onClick={async () => {
                          setBusyAction(true);
                          try {
                            const res = await apiClient.getRemoteAnalysisCollaborationDashboard();
                            if (res.error) toast.error(res.error);
                            else setCollabDash(res.data as Record<string, unknown>);
                          } finally {
                            setBusyAction(false);
                          }
                        }}
                      >
                        Refresh
                      </Button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-base">Notification Center</CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const res = await apiClient.markRemoteAnalysisNotificationsRead(undefined, true);
                              if (res.error) toast.error(res.error);
                              else {
                                toast.success(`Marked ${res.data?.marked ?? 0} read`);
                                await loadAll();
                              }
                            }}
                          >
                            Mark all read
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto text-sm">
                          {notifications.map((n) => (
                            <div key={String(n.id)} className="border-b pb-2">
                              <div className="font-medium">{String(n.title)}</div>
                              <div className="text-muted-foreground text-xs">
                                {String(n.type)} · {n.created_at ? new Date(String(n.created_at)).toLocaleString() : ""}
                              </div>
                              <div className="text-xs">{String(n.body || "")}</div>
                            </div>
                          ))}
                          {!notifications.length && <div className="text-muted-foreground">No notifications</div>}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Activity Feed</CardTitle></CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto text-sm">
                          {activity.map((e) => (
                            <div key={String(e.id)} className="border-b pb-2">
                              <div className="font-medium">{String(e.summary)}</div>
                              <div className="text-muted-foreground text-xs">
                                {String(e.verb)} · {String(e.actor || "system")} ·{" "}
                                {e.created_at ? new Date(String(e.created_at)).toLocaleString() : ""}
                              </div>
                            </div>
                          ))}
                          {!activity.length && <div className="text-muted-foreground">No activity yet</div>}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Announcements</CardTitle></CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto text-sm">
                          {announcements.map((a) => (
                            <div key={String(a.id)} className="border-b pb-2">
                              <div className="font-medium">{String(a.title)}</div>
                              <div className="text-xs whitespace-pre-wrap">{String(a.body || "")}</div>
                            </div>
                          ))}
                          {!announcements.length && <div className="text-muted-foreground">No announcements</div>}
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Session notes &amp; comments</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={commentBody}
                              onChange={(e) => setCommentBody(e.target.value)}
                              placeholder="Comment body"
                              className="flex-1 min-w-[160px]"
                            />
                            <Button
                              size="sm"
                              disabled={!commentBody || (!sessions[0]?.id && !selectedWorkspaceId)}
                              onClick={async () => {
                                const body: Record<string, unknown> = { body: commentBody };
                                if (sessions[0]?.id) body.session_id = sessions[0].id;
                                else body.workspace_id = selectedWorkspaceId;
                                const res = await apiClient.postRemoteAnalysisComment(body);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Comment added");
                                  setCommentBody("");
                                  await loadAll();
                                }
                              }}
                            >
                              Add comment
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={noteBody}
                              onChange={(e) => setNoteBody(e.target.value)}
                              placeholder="Note body (markdown)"
                              className="flex-1 min-w-[160px]"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!noteBody}
                              onClick={async () => {
                                const body: Record<string, unknown> = {
                                  body: noteBody,
                                  visibility: "PUBLIC",
                                  title: "Research note",
                                };
                                if (sessions[0]?.id) body.session_id = sessions[0].id;
                                if (selectedWorkspaceId) body.workspace_id = selectedWorkspaceId;
                                const res = await apiClient.postRemoteAnalysisNote(body);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Note saved");
                                  setNoteBody("");
                                  await loadAll();
                                }
                              }}
                            >
                              Add note
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Sharing &amp; invitations</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={shareEmail}
                              onChange={(e) => setShareEmail(e.target.value)}
                              placeholder="Share workspace with email"
                              className="flex-1 min-w-[160px]"
                            />
                            <Button
                              size="sm"
                              disabled={!shareEmail || !selectedWorkspaceId}
                              onClick={async () => {
                                const res = await apiClient.postRemoteAnalysisShare({
                                  workspace_id: selectedWorkspaceId,
                                  user_email: shareEmail,
                                  permissions: ["READ", "COMMENT", "DOWNLOAD"],
                                });
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Workspace shared");
                                  setShareEmail("");
                                  await loadAll();
                                }
                              }}
                            >
                              Share
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="Invite collaborator email"
                              className="flex-1 min-w-[160px]"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!inviteEmail}
                              onClick={async () => {
                                const body: Record<string, unknown> = {
                                  user_email: inviteEmail,
                                  kind: "COLLABORATOR",
                                  message: "Please join this analysis session",
                                };
                                if (sessions[0]?.id) body.session_id = sessions[0].id;
                                if (selectedWorkspaceId) body.workspace_id = selectedWorkspaceId;
                                const res = await apiClient.postRemoteAnalysisInvite(body);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Invitation sent");
                                  setInviteEmail("");
                                  await loadAll();
                                }
                              }}
                            >
                              Invite
                            </Button>
                          </div>
                          <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                            <div className="font-medium text-xs text-muted-foreground">Shared workspaces</div>
                            {shared.map((s) => (
                              <div key={String(s.id)} className="text-xs">
                                {String(s.name)} · {String(s.workspace_id).slice(0, 8)}…
                              </div>
                            ))}
                            <div className="font-medium text-xs text-muted-foreground pt-2">Pending invitations</div>
                            {invitations.map((i) => (
                              <div key={String(i.id)} className="flex items-center justify-between gap-2 text-xs">
                                <span>
                                  {String(i.kind)} · {String(i.status)}
                                </span>
                                {i.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      const res = await apiClient.postRemoteAnalysisInvite({ accept_id: i.id });
                                      if (res.error) toast.error(res.error);
                                      else {
                                        toast.success("Accepted");
                                        await loadAll();
                                      }
                                    }}
                                  >
                                    Accept
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Help requests</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={helpSubject}
                              onChange={(e) => setHelpSubject(e.target.value)}
                              placeholder="Help subject"
                              className="flex-1 min-w-[160px]"
                            />
                            <Button
                              size="sm"
                              disabled={!helpSubject}
                              onClick={async () => {
                                const body: Record<string, unknown> = {
                                  action: "request",
                                  subject: helpSubject,
                                  description: "Assistance needed during remote analysis",
                                  priority: "NORMAL",
                                };
                                if (sessions[0]?.id) body.session_id = sessions[0].id;
                                const res = await apiClient.postRemoteAnalysisAssistance(body);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Help requested");
                                  setHelpSubject("");
                                  await loadAll();
                                }
                              }}
                            >
                              Request help
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                            {pending.map((r) => (
                              <div key={String(r.id)} className="flex items-center justify-between gap-2 border-b pb-2">
                                <div>
                                  <div className="font-medium">{String(r.subject)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {String(r.status)} · {String(r.priority)} · {String(r.requested_by || "")}
                                  </div>
                                </div>
                                {canManage && r.status !== "CLOSED" && r.status !== "RESOLVED" && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const res = await apiClient.postRemoteAnalysisAssistance({
                                          action: "accept",
                                          request_id: r.id,
                                        });
                                        if (res.error) toast.error(res.error);
                                        else await loadAll();
                                      }}
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        const res = await apiClient.postRemoteAnalysisAssistance({
                                          action: "resolve",
                                          request_id: r.id,
                                          resolution: "Resolved via Collaboration Center",
                                        });
                                        if (res.error) toast.error(res.error);
                                        else await loadAll();
                                      }}
                                    >
                                      Resolve
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {!pending.length && <div className="text-muted-foreground">No pending assistance</div>}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><CardTitle className="text-base">Timeline viewer</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              value={timelineSessionId}
                              onChange={(e) => setTimelineSessionId(e.target.value)}
                              placeholder="Session UUID"
                              className="flex-1 min-w-[200px]"
                            />
                            <Button
                              size="sm"
                              disabled={!timelineSessionId && !sessions[0]?.id}
                              onClick={async () => {
                                const sid = timelineSessionId || sessions[0]?.id;
                                if (!sid) return;
                                const res = await apiClient.getRemoteAnalysisTimeline({ session_id: sid });
                                if (res.error) toast.error(res.error);
                                else {
                                  const events = ((res.data as Record<string, unknown>)?.events || []) as Array<
                                    Record<string, unknown>
                                  >;
                                  setTimelineEvents(events);
                                  setTimelineSessionId(sid);
                                }
                              }}
                            >
                              Load timeline
                            </Button>
                          </div>
                          <div className="space-y-1 max-h-56 overflow-y-auto text-xs">
                            {timelineEvents.map((ev, idx) => (
                              <div key={`${ev.timestamp}-${idx}`} className="border-l-2 pl-2 py-1">
                                <div className="font-medium">{String(ev.stage)}</div>
                                <div className="text-muted-foreground">
                                  {ev.timestamp ? new Date(String(ev.timestamp)).toLocaleString() : ""} ·{" "}
                                  {String(ev.detail || "")}
                                </div>
                              </div>
                            ))}
                            {!timelineEvents.length && (
                              <div className="text-muted-foreground">Select a session to view its lifecycle timeline.</div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-base">Favorites</CardTitle>
                          {selectedId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const res = await apiClient.postRemoteAnalysisFavorite(selectedId);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Favorited");
                                  await loadAll();
                                }
                              }}
                            >
                              Favorite selected WS
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          {favorites.map((f) => (
                            <div key={String(f.id)}>{String(f.hostname)}</div>
                          ))}
                          {!favorites.length && <div className="text-muted-foreground">No favorites</div>}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-base">Bookmarks</CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const res = await apiClient.postRemoteAnalysisBookmark({
                                label: selected?.hostname || "Remote Analysis",
                                target_type: selectedId ? "workstation" : "url",
                                target_id: selectedId || "",
                                url: "/remote-analysis",
                              });
                              if (res.error) toast.error(res.error);
                              else {
                                toast.success("Bookmarked");
                                await loadAll();
                              }
                            }}
                          >
                            Bookmark
                          </Button>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          {bookmarks.map((b) => (
                            <div key={String(b.id)}>
                              {String(b.label)} · {String(b.target_type)}
                            </div>
                          ))}
                          {!bookmarks.length && <div className="text-muted-foreground">No bookmarks</div>}
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="queue">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reservation queue</CardTitle>
                  <CardDescription>Priority ascending, FIFO within same priority.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Requested start</TableHead>
                        <TableHead>Enqueued</TableHead>
                        <TableHead>Reservation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schedulerDash?.queue || []).map((q) => (
                        <TableRow key={q.id}>
                          <TableCell>{q.priority}</TableCell>
                          <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                          <TableCell>{q.user_email || "—"}</TableCell>
                          <TableCell>{q.requested_start ? new Date(q.requested_start).toLocaleString() : "—"}</TableCell>
                          <TableCell>{new Date(q.enqueued_at).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">{q.reservation_id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="availability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Available workstations</CardTitle>
                  <CardDescription>
                    Eligibility excludes offline, disabled, maintenance, low-health, and expired-token agents.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const res = await apiClient.getRemoteAnalysisAvailability();
                      if (res.error) toast.error(res.error);
                      else toast.success(`${(res.data as any)?.count ?? 0} available`);
                      await loadAll();
                    }}
                  >
                    Refresh availability
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3">
                    Currently available (next hour): {schedulerDash?.available_now ?? "—"}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Workstation</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>OK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                          <TableCell>{e.category}</TableCell>
                          <TableCell>{e.action}</TableCell>
                          <TableCell>{e.workstation_hostname || "—"}</TableCell>
                          <TableCell className="max-w-md truncate">{e.details}</TableCell>
                          <TableCell>{e.success ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
