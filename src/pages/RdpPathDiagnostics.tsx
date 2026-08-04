import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { hasRbacPermission } from "@/lib/rbac";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Network,
  RefreshCw,
  Server,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type PipelineStage = {
  name?: string;
  status?: string;
  detail?: string;
  [key: string]: unknown;
};

type TraceStage = {
  stage?: string;
  status?: string;
  detail?: string;
  at?: string | null;
};

type RdpReport = {
  overall?: string;
  generated_at?: string;
  workstation?: {
    id?: string;
    hostname?: string;
    ip_address?: string;
    status?: string;
    agent_id?: string;
  } | null;
  pipeline?: PipelineStage[];
  inventory?: Record<string, unknown>;
  agent_rdp_readiness?: Record<string, unknown>;
  tcp_3389?: Record<string, unknown>;
  guacamole?: Record<string, unknown>;
  connection_trace?: {
    stages?: TraceStage[];
    first_failure?: TraceStage | null;
    session_id?: string;
    failure_detail?: string;
  } | null;
  warnings?: string[];
  first_failure?: PipelineStage | null;
  diagnose_command?: Record<string, unknown> | null;
};

type WorkstationRow = {
  id?: string;
  hostname?: string;
  ip_address?: string;
  status?: string;
};

function StatusChip({ status }: { status?: string }) {
  const s = String(status || "UNKNOWN").toUpperCase();
  if (s === "PASS" || s === "OK") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" /> PASS
      </Badge>
    );
  }
  if (s === "FAIL") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> FAIL
      </Badge>
    );
  }
  if (s === "SKIP" || s === "PENDING") {
    return <Badge variant="secondary">{s}</Badge>;
  }
  return <Badge variant="outline">{s}</Badge>;
}

export default function RdpPathDiagnosticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage =
    userType === "admin" ||
    userType === "dept_admin" ||
    userType === "manager" ||
    Boolean(user?.is_superuser) ||
    hasRbacPermission(user, "remote_analysis.manage");

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [workstations, setWorkstations] = useState<WorkstationRow[]>([]);
  const [workstationId, setWorkstationId] = useState<string>("");
  const [report, setReport] = useState<RdpReport | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    readiness: true,
    tcp: true,
    inventory: false,
    trace: true,
  });

  const loadWorkstations = useCallback(async () => {
    const res = await apiClient.getRemoteAnalysisWorkstations();
    const rows = (Array.isArray(res.data) ? res.data : (res.data as any)?.results || []) as WorkstationRow[];
    setWorkstations(rows.filter((r) => r.id));
    if (!workstationId && rows[0]?.id) setWorkstationId(String(rows[0].id));
  }, [workstationId]);

  const loadReport = useCallback(
    async (id?: string) => {
      setLoading(true);
      const res = await apiClient.getRemoteAnalysisRdpPath({
        workstation_id: id || workstationId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        setReport(null);
      } else {
        setReport((res.data as RdpReport) || null);
      }
      setLoading(false);
    },
    [workstationId]
  );

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void (async () => {
      await loadWorkstations();
    })();
  }, [canManage, loadWorkstations]);

  useEffect(() => {
    if (!canManage || !workstationId) return;
    void loadReport(workstationId);
  }, [canManage, workstationId, loadReport]);

  const runDiagnostics = async () => {
    if (!workstationId) {
      toast.error("Select a workstation");
      return;
    }
    setRunning(true);
    const res = await apiClient.runRemoteAnalysisRdpPath({
      workstation_id: workstationId,
      issue_diagnose_command: true,
    });
    if (res.error) {
      toast.error(res.error);
    } else {
      setReport((res.data as RdpReport) || null);
      toast.success("Diagnostics completed (DIAGNOSE_RDP queued if agent online)");
    }
    setRunning(false);
  };

  const pipeline = report?.pipeline || [];
  const readinessChecks = useMemo(() => {
    const payload = (report?.agent_rdp_readiness?.payload || {}) as { checks?: PipelineStage[] };
    return Array.isArray(payload.checks) ? payload.checks : [];
  }, [report]);

  if (!canManage) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto max-w-3xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Permission denied</CardTitle>
              <CardDescription>You need Remote Analysis manage permission to view RDP path diagnostics.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/remote-analysis")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
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
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Administration · Remote Analysis</p>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
              <Network className="h-6 w-6 text-primary" />
              RDP Path Diagnostics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Portal → Agent → Guacamole → Analysis PC (TCP 3389). No passwords are shown.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/remote-analysis">
                <ArrowLeft className="mr-2 h-4 w-4" /> Remote Analysis
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => void loadReport()} disabled={loading || running}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button onClick={() => void runDiagnostics()} disabled={running || !workstationId}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
              Run diagnostics
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workstation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px] space-y-2">
              <Label>Select workstation</Label>
              <Select value={workstationId} onValueChange={setWorkstationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose workstation" />
                </SelectTrigger>
                <SelectContent>
                  {workstations.map((ws) => (
                    <SelectItem key={String(ws.id)} value={String(ws.id)}>
                      {ws.hostname || ws.id} {ws.ip_address ? `(${ws.ip_address})` : ""} · {ws.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              Overall: <StatusChip status={report?.overall} />
              {report?.generated_at ? (
                <span className="text-muted-foreground">· {new Date(report.generated_at).toLocaleString()}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {loading && !report ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading diagnostics…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" /> Pipeline
                </CardTitle>
                <CardDescription>First failure is highlighted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pipeline.map((stage) => {
                  const isFirstFail =
                    report?.first_failure?.name === stage.name && String(stage.status).toUpperCase() === "FAIL";
                  return (
                    <div
                      key={String(stage.name)}
                      className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 ${
                        isFirstFail ? "border-rose-500/50 bg-rose-500/5" : ""
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{stage.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{String(stage.detail || "")}</p>
                      </div>
                      <StatusChip status={stage.status} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {(report?.warnings || []).length > 0 ? (
              <Card className="border-amber-500/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                    <ShieldAlert className="h-4 w-4" /> Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {(report?.warnings || []).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded((e) => ({ ...e, tcp: !e.tcp }))}>
                  <CardTitle className="text-base">TCP 3389 probe</CardTitle>
                  <CardDescription>From Portal/Guacamole host to Analysis PC</CardDescription>
                </CardHeader>
                {expanded.tcp ? (
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusChip status={String(report?.tcp_3389?.status)} />
                      <span className="text-muted-foreground">
                        {String(report?.tcp_3389?.classification || "")}
                        {report?.tcp_3389?.latency_ms != null ? ` · ${report.tcp_3389.latency_ms} ms` : ""}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{String(report?.tcp_3389?.detail || "")}</p>
                    <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                      {JSON.stringify(report?.tcp_3389 || {}, null, 2)}
                    </pre>
                  </CardContent>
                ) : null}
              </Card>

              <Card>
                <CardHeader
                  className="pb-2 cursor-pointer"
                  onClick={() => setExpanded((e) => ({ ...e, inventory: !e.inventory }))}
                >
                  <CardTitle className="text-base">Credential inventory</CardTitle>
                  <CardDescription>Flags only — no secrets</CardDescription>
                </CardHeader>
                {expanded.inventory ? (
                  <CardContent>
                    <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-48">
                      {JSON.stringify(report?.inventory || {}, null, 2)}
                    </pre>
                  </CardContent>
                ) : null}
              </Card>
            </div>

            <Card>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setExpanded((e) => ({ ...e, readiness: !e.readiness }))}
              >
                <CardTitle className="text-base">Agent RDP readiness</CardTitle>
                <CardDescription>
                  Source: {String(report?.agent_rdp_readiness?.source || "none")} ·{" "}
                  <StatusChip status={String(report?.agent_rdp_readiness?.status)} />
                </CardDescription>
              </CardHeader>
              {expanded.readiness ? (
                <CardContent className="space-y-2">
                  {readinessChecks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {String(report?.agent_rdp_readiness?.detail || "No readiness payload yet — run diagnostics.")}
                    </p>
                  ) : (
                    readinessChecks.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm border rounded-md px-2 py-1.5">
                        <span>
                          {String(c.name || c.Name || "check")} —{" "}
                          <span className="text-muted-foreground">{String(c.detail || c.Detail || "")}</span>
                        </span>
                        <StatusChip status={String(c.status || c.Status)} />
                      </div>
                    ))
                  )}
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setExpanded((e) => ({ ...e, trace: !e.trace }))}
              >
                <CardTitle className="text-base">Last connection trace</CardTitle>
                <CardDescription>
                  Session {report?.connection_trace?.session_id || "—"}
                  {report?.connection_trace?.failure_detail
                    ? ` · ${report.connection_trace.failure_detail}`
                    : ""}
                </CardDescription>
              </CardHeader>
              {expanded.trace ? (
                <CardContent className="space-y-2">
                  {(report?.connection_trace?.stages || []).map((s) => (
                    <div
                      key={String(s.stage)}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{s.stage}</p>
                        <p className="text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                      <StatusChip status={s.status} />
                    </div>
                  ))}
                  {!report?.connection_trace?.stages?.length ? (
                    <p className="text-sm text-muted-foreground">No recent session for this workstation.</p>
                  ) : null}
                </CardContent>
              ) : null}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
