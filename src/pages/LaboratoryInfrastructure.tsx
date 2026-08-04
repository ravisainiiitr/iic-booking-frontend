import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Wrench,
} from "lucide-react";

type LabNode = {
  id: string;
  kind: string;
  status: string;
  computer_name?: string | null;
  equipment?: string | null;
  department?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  windows_version?: string | null;
  agent_version?: string | null;
  configuration_version?: number | null;
  health_score?: number | null;
  last_heartbeat?: string | null;
  cpu?: number | null;
  memory?: number | null;
  disk?: number | null;
  children?: LabNode[];
  last_user?: string | null;
  tunnel_status?: string | null;
};

type Dept = {
  id: number | null;
  name: string;
  nodes: LabNode[];
  node_count: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  online: "default",
  offline: "destructive",
  error: "destructive",
  busy: "secondary",
  maintenance: "outline",
  synchronizing: "secondary",
  waiting: "outline",
  commissioning: "outline",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] || "outline"} className="capitalize">
      {status}
    </Badge>
  );
}

function NodeRow({
  node,
  depth,
  onSelect,
  selectedId,
}: {
  node: LabNode;
  depth: number;
  onSelect: (n: LabNode) => void;
  selectedId?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${
          selectedId === node.id ? "bg-muted" : ""
        }`}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">{node.kind.replace("_", " ")}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{node.computer_name || node.id}</span>
        <StatusBadge status={node.status} />
        <span className="hidden w-24 truncate text-xs text-muted-foreground sm:inline">
          {node.agent_version || "—"}
        </span>
        <span className="hidden w-16 text-xs text-muted-foreground md:inline">
          {node.cpu != null ? `${Math.round(Number(node.cpu))}%` : "—"}
        </span>
      </button>
      {(node.children || []).map((c) => (
        <NodeRow key={c.id} node={c} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
      ))}
    </>
  );
}

const REPAIR_ACTIONS = [
  "repair",
  "reconfigure",
  "recommission",
  "restart_agent",
  "refresh_configuration",
  "rescan_software",
  "retry_synchronization",
] as const;

export default function LaboratoryInfrastructurePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage = userType === "admin" || Boolean(user?.is_superuser);

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [counts, setCounts] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<LabNode | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [software, setSoftware] = useState<Array<Record<string, unknown>>>([]);
  const [tab, setTab] = useState<"fleet" | "alerts" | "audit" | "software" | "updates">("fleet");
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [infra, alertRes, auditRes, softRes] = await Promise.all([
      apiClient.getLabInfrastructure(),
      apiClient.getLabAlerts(),
      apiClient.getLabAudit(),
      apiClient.getLabSoftwareCompliance(),
    ]);
    if (infra.error) toast.error(infra.error);
    else {
      setDepartments(((infra.data as any)?.departments || []) as Dept[]);
      setCounts(((infra.data as any)?.counts || {}) as Record<string, unknown>);
    }
    setAlerts(((alertRes.data as any)?.results || []) as Array<Record<string, unknown>>);
    setAudit(((auditRes.data as any)?.results || []) as Array<Record<string, unknown>>);
    setSoftware(((softRes.data as any)?.results || []) as Array<Record<string, unknown>>);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard");
      return;
    }
    void load();
    const t = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(t);
  }, [canManage, load, navigate]);

  const onSelect = async (n: LabNode) => {
    setSelected(n);
    setDiag(null);
    const res = await apiClient.getLabNodeDetail(n.id);
    if (res.error) toast.error(res.error);
    else setDetail((res.data as Record<string, unknown>) || n);
  };

  const runRepair = async (action: string) => {
    if (!selected) return;
    setBusy(true);
    const res = await apiClient.postLabRepair(selected.id, action);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success(`Queued ${action}`);
      void load();
    }
  };

  const runDiag = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await apiClient.runLabDiagnostics(selected.id);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else setDiag((res.data as Record<string, unknown>) || null);
  };

  const statusSummary = useMemo(() => {
    const by = (counts.by_status || {}) as Record<string, number>;
    return Object.entries(by);
  }, [counts]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Laboratory Infrastructure</h1>
              <p className="text-sm text-muted-foreground">
                Fleet visibility, health, repair, and lifecycle — Main Admin
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/deployment-center">Deployment Center</Link>
              {" · "}
              <Link to="/test-dashboard">Test Dashboard</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total nodes</CardDescription>
              <CardTitle className="text-2xl">{String(counts.total_nodes ?? "—")}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>DSA / EqPC / Analysis</CardDescription>
              <CardTitle className="text-lg">
                {String(counts.dsa ?? 0)} / {String(counts.equipment_pc ?? 0)} / {String(counts.analysis_pc ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open alerts</CardDescription>
              <CardTitle className="text-2xl">{alerts.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By status</CardDescription>
              <CardContent className="flex flex-wrap gap-1 p-0 pt-1">
                {statusSummary.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="capitalize">
                    {k}: {v}
                  </Badge>
                ))}
              </CardContent>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["fleet", "Fleet", Server],
              ["alerts", "Alerts", AlertTriangle],
              ["audit", "Audit", Shield],
              ["software", "Software", HardDrive],
              ["updates", "Updates", Activity],
            ] as const
          ).map(([id, label, Icon]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              <Icon className="mr-1 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {tab === "fleet" && (
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fleet tree</CardTitle>
                <CardDescription>Auto-refreshes every 20s</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[560px] overflow-auto p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                  </div>
                ) : (
                  departments.map((d) => (
                    <div key={d.name}>
                      <div className="sticky top-0 border-b bg-muted/80 px-3 py-2 text-sm font-semibold backdrop-blur">
                        {d.name}{" "}
                        <span className="text-muted-foreground font-normal">({d.node_count})</span>
                      </div>
                      {d.nodes.map((n) => (
                        <NodeRow
                          key={n.id}
                          node={n}
                          depth={0}
                          onSelect={(node) => void onSelect(node)}
                          selectedId={selected?.id}
                        />
                      ))}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Node detail</CardTitle>
                <CardDescription>{selected?.computer_name || "Select a node"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!selected ? (
                  <p className="text-muted-foreground">Select a DSA, Equipment PC, or Analysis PC.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Status</span>
                        <div>
                          <StatusBadge status={String(detail?.status || selected.status)} />
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Kind</span>
                        <div className="font-medium">{String(detail?.kind || selected.kind)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Agent</span>
                        <div>{String(detail?.agent_version || selected.agent_version || "—")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Config ver</span>
                        <div>{String(detail?.configuration_version ?? selected.configuration_version ?? "—")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPU / Mem / Disk</span>
                        <div>
                          {detail?.cpu ?? selected.cpu ?? "—"} / {detail?.memory ?? selected.memory ?? "—"} /{" "}
                          {detail?.disk ?? selected.disk ?? "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last heartbeat</span>
                        <div className="truncate text-xs">
                          {String(detail?.last_heartbeat || selected.last_heartbeat || "—")}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">IP / MAC</span>
                        <div>
                          {String(detail?.ip_address || selected.ip_address || "—")} ·{" "}
                          {String(detail?.mac_address || selected.mac_address || "—")}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button size="sm" onClick={() => void runDiag()} disabled={busy}>
                        <Activity className="mr-1 h-4 w-4" /> Diagnostics
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {REPAIR_ACTIONS.map((a) => (
                        <Button
                          key={a}
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void runRepair(a)}
                        >
                          <Wrench className="mr-1 h-3 w-3" />
                          {a.replace(/_/g, " ")}
                        </Button>
                      ))}
                    </div>
                    {diag ? (
                      <div className="rounded border bg-muted/30 p-3">
                        <div className="mb-1 font-medium">Diagnostics: {String(diag.overall)}</div>
                        <ul className="space-y-1 text-xs">
                          {((diag.checks as any[]) || []).map((c, i) => (
                            <li key={i}>
                              {c.passed ? "PASS" : "FAIL"} · {c.name}: {c.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "alerts" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open alerts.</p>
              ) : (
                alerts.map((a) => (
                  <div key={String(a.id)} className="flex items-start justify-between gap-2 border-b py-2 text-sm">
                    <div>
                      <div className="font-medium">
                        <Badge variant="outline" className="mr-2 capitalize">
                          {String(a.severity)}
                        </Badge>
                        {String(a.title)}
                      </div>
                      <div className="text-xs text-muted-foreground">{String(a.detail || "")}</div>
                    </div>
                    {String(a.id).includes("-") && !String(a.id).startsWith("dsa-") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await apiClient.ackLabAlert(String(a.id));
                          void load();
                        }}
                      >
                        Ack
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === "audit" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit log</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-auto">
              {audit.map((e) => (
                <div key={String(e.id)} className="border-b py-2 text-sm">
                  <div className="font-medium">
                    {String(e.event_type)} · {String(e.source || "lab")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String(e.created_at)} — {String(e.message || "").slice(0, 200)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === "software" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Software compliance</CardTitle>
              <CardDescription>Required vs installed on Analysis PCs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {software.map((row) => (
                <div key={String(row.workstation_id)} className="border-b py-2 text-sm">
                  <div className="font-medium">
                    {String(row.hostname)} · installed {String(row.installed_count)} · missing{" "}
                    {String(row.missing)}
                  </div>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {((row.requirements as any[]) || []).slice(0, 8).map((r, i) => (
                      <li key={i}>
                        {r.name}: {r.status} (req {r.required_version || "—"} / inst{" "}
                        {r.installed_version || "—"})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === "updates" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent updates</CardTitle>
              <CardDescription>
                Use Deployment Center for installers; DSA staged rollout via existing M16 APIs.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/deployment-center">Open Deployment Center</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const res = await apiClient.getLabUtilizationReport();
                  if (res.error) toast.error(res.error);
                  else toast.success("Utilization snapshot loaded — see console / download CSV from API");
                  console.log(res.data);
                }}
              >
                Utilization snapshot
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.open(
                    `${(apiClient as any).baseURL || "/api"}/v1/lab/reports/utilization/?format=csv`,
                    "_blank",
                  );
                }}
              >
                Export utilization CSV
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
