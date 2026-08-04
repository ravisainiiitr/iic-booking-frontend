import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Loader2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Activity,
  Paperclip,
  Bug,
} from "lucide-react";

type Progress = {
  run_name?: string;
  run_id?: string;
  status?: string;
  recommendation?: string;
  total?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  skipped?: number;
  remaining?: number;
  completion_pct?: number;
};

type CurrentTest = {
  id: string;
  test_id: string;
  module: string;
  feature: string;
  severity: string;
  stage?: number;
  stage_label?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  status?: string;
  evidence_files?: Array<{ id: string; kind: string; title: string; url?: string }>;
  failure_snapshot?: Record<string, unknown>;
};

function recBadge(rec?: string) {
  const r = (rec || "pending").toLowerCase();
  if (r === "go") return <Badge className="bg-emerald-600 hover:bg-emerald-600">GO</Badge>;
  if (r === "conditional_go") return <Badge className="bg-amber-500 hover:bg-amber-500">Conditional GO</Badge>;
  if (r === "no_go") return <Badge className="bg-red-600 hover:bg-red-600">NO GO</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function TestDashboardPage() {
  const { user, userType } = useAuth();
  const navigate = useNavigate();
  const canManage = userType === "admin" || Boolean(user?.is_superuser);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stages, setStages] = useState<Array<Record<string, unknown>>>([]);
  const [modules, setModules] = useState<Array<Record<string, unknown>>>([]);
  const [readiness, setReadiness] = useState<Record<string, unknown> | null>(null);
  const [current, setCurrent] = useState<CurrentTest | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState("");
  const [actual, setActual] = useState("");
  const [defectTitle, setDefectTitle] = useState("");
  const [defectKind, setDefectKind] = useState("bug");
  const [labBuilding, setLabBuilding] = useState("");
  const [labFloor, setLabFloor] = useState("");
  const [labName, setLabName] = useState("");

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const dash = await apiClient.getTestingDashboard(runId || undefined);
      setModules(dash.modules || []);
      setProgress((dash.progress as Progress) || null);
      setStages(dash.stages || []);
      setReadiness(dash.readiness || null);
      setCurrent((dash.current_test as CurrentTest) || null);
      setHealth(dash.health_panel || null);
      if (dash.run_id) setRunId(String(dash.run_id));
      else if (dash.latest_run && (dash.latest_run as { id?: string }).id) {
        setRunId(String((dash.latest_run as { id: string }).id));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load SAT dashboard");
    } finally {
      setLoading(false);
    }
  }, [canManage, runId]);

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canManage, navigate, load]);

  useEffect(() => {
    if (!canManage || !runId) return;
    const t = setInterval(() => {
      void apiClient.getTestingHealthPanel().then(setHealth).catch(() => undefined);
    }, 20000);
    return () => clearInterval(t);
  }, [canManage, runId]);

  const recommendation = useMemo(
    () => String(readiness?.recommendation || progress?.recommendation || "pending"),
    [readiness, progress]
  );

  const startRun = async () => {
    setBusy(true);
    try {
      await apiClient.seedTestingCatalog();
      const run = await apiClient.startTestingRun({
        name: `Lab SAT ${new Date().toISOString().slice(0, 16)}`,
        lab_context: {
          building: labBuilding || undefined,
          floor: labFloor || undefined,
          lab: labName || undefined,
        },
      });
      setRunId(String(run.id));
      setNotes("");
      setActual("");
      toast.success("Lab SAT run started — Stage 1 wizard ready");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setBusy(false);
    }
  };

  const submitStatus = async (status: string) => {
    if (!current?.id) return;
    setBusy(true);
    try {
      const res = await apiClient.updateTestingResult(current.id, {
        status,
        actual_result: actual || (status === "passed" ? "Observed as expected in lab" : ""),
        administrator_notes: notes,
        advance: true,
      });
      if (status === "failed" && defectTitle.trim()) {
        await apiClient.createTestingDefect({
          run_id: runId,
          result_id: current.id,
          test_id: current.test_id,
          title: defectTitle,
          kind: defectKind,
          severity: current.severity === "critical" ? "critical" : "high",
          description: notes || actual,
          machine_name: labName,
        });
        setDefectTitle("");
      }
      toast.success(`${current.test_id} → ${status}`);
      setNotes("");
      setActual("");
      setCurrent((res.next_test as CurrentTest) || null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File, kind: string) => {
    if (!runId || !current?.id) return;
    const form = new FormData();
    form.append("file", file);
    form.append("run_id", runId);
    form.append("result_id", current.id);
    form.append("kind", kind);
    form.append("title", file.name);
    try {
      await apiClient.uploadTestingEvidence(form);
      toast.success("Evidence attached");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const openReport = (format: "csv" | "xlsx" | "pdf" | "json") => {
    if (!runId) return;
    const path = apiClient.getTestingReportUrl(runId, format);
    window.open(path, "_blank", "noopener,noreferrer");
  };

  if (!canManage) return null;

  const domains = (readiness?.domains || {}) as Record<string, { score?: number | null }>;
  const checklist = (readiness?.checklist || []) as Array<{ id: string; label: string; passed: boolean; notes?: string }>;
  const highlights = (health?.highlights || []) as string[];
  const nodes = (health?.nodes || []) as Array<Record<string, unknown>>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/dashboard" className="inline-flex items-center gap-1 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Link>
              <span>/</span>
              <span>Lab SAT Execution</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Laboratory SAT Execution Mode
            </h1>
            <p className="text-sm text-muted-foreground">
              Guided validation only — no new features. Attach evidence, log defects, and generate the SAT report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => void startRun()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start Lab SAT Run
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{progress?.run_name || "No active run"}</CardTitle>
                <CardDescription>
                  Completion {Number(progress?.completion_pct || 0)}% · {recBadge(recommendation)}
                </CardDescription>
              </div>
              {runId ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openReport("csv")}>
                    <FileDown className="mr-1 h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReport("xlsx")}>
                    <FileDown className="mr-1 h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReport("pdf")}>
                    <FileDown className="mr-1 h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Passed", progress?.passed, "text-emerald-600"],
              ["Failed", progress?.failed, "text-red-600"],
              ["Blocked", progress?.blocked, "text-amber-600"],
              ["Skipped", progress?.skipped, ""],
              ["Remaining", progress?.remaining, ""],
              ["Total", progress?.total, ""],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-xl font-semibold ${cls}`}>{Number(value || 0)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Current test wizard</CardTitle>
              <CardDescription>Execute Stage 1 → 5 in order. Pass / Fail / Block / Skip then Continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!runId ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Optional lab context for this SAT run:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input placeholder="Building" value={labBuilding} onChange={(e) => setLabBuilding(e.target.value)} />
                    <Input placeholder="Floor" value={labFloor} onChange={(e) => setLabFloor(e.target.value)} />
                    <Input placeholder="Lab" value={labName} onChange={(e) => setLabName(e.target.value)} />
                  </div>
                  <p className="text-sm text-muted-foreground">Start a Lab SAT run to begin the wizard at SAT-DEP-001 / SAT-COM-001 sequence.</p>
                </div>
              ) : !current ? (
                <p className="text-sm text-muted-foreground">
                  No remaining tests — generate the SAT report and review the GO / NO GO checklist.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">{current.stage_label || `Stage ${current.stage}`}</div>
                      <div className="text-lg font-semibold">
                        {current.test_id} — {current.feature}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {current.module} · Severity {current.severity}
                      </div>
                    </div>
                    <Badge variant="outline">{current.status || "not_run"}</Badge>
                  </div>
                  <section className="space-y-1">
                    <h3 className="text-sm font-medium">Preconditions</h3>
                    <pre className="whitespace-pre-wrap rounded-md bg-slate-100 dark:bg-slate-900 p-3 text-xs">
                      {current.preconditions || "—"}
                    </pre>
                  </section>
                  <section className="space-y-1">
                    <h3 className="text-sm font-medium">Steps</h3>
                    <pre className="whitespace-pre-wrap rounded-md bg-slate-100 dark:bg-slate-900 p-3 text-xs">
                      {current.steps || "—"}
                    </pre>
                  </section>
                  <section className="space-y-1">
                    <h3 className="text-sm font-medium">Expected result</h3>
                    <pre className="whitespace-pre-wrap rounded-md bg-slate-100 dark:bg-slate-900 p-3 text-xs">
                      {current.expected_result || "—"}
                    </pre>
                  </section>
                  <Textarea
                    placeholder="Actual result"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    rows={2}
                  />
                  <Textarea
                    placeholder="Administrator notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs border rounded-md px-2 py-1.5 cursor-pointer">
                      <Paperclip className="h-3.5 w-3.5" />
                      Screenshot
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onUpload(f, "screenshot");
                        }}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs border rounded-md px-2 py-1.5 cursor-pointer">
                      <Paperclip className="h-3.5 w-3.5" />
                      Log / config
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onUpload(f, "log");
                        }}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs border rounded-md px-2 py-1.5 cursor-pointer">
                      <Paperclip className="h-3.5 w-3.5" />
                      Network capture
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onUpload(f, "network");
                        }}
                      />
                    </label>
                  </div>
                  {(current.evidence_files || []).length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {current.evidence_files!.map((e) => (
                        <li key={e.id}>
                          <a className="text-sky-600 underline" href={e.url} target="_blank" rel="noreferrer">
                            [{e.kind}] {e.title || e.id}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Bug className="h-4 w-4" /> On Fail — create defect (optional)
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                      <Input
                        placeholder="Defect title"
                        value={defectTitle}
                        onChange={(e) => setDefectTitle(e.target.value)}
                      />
                      <select
                        className="h-9 rounded-md border bg-transparent px-2 text-sm"
                        value={defectKind}
                        onChange={(e) => setDefectKind(e.target.value)}
                      >
                        <option value="bug">Bug</option>
                        <option value="improvement">Improvement</option>
                        <option value="configuration">Configuration</option>
                        <option value="hardware">Hardware</option>
                        <option value="network">Network</option>
                        <option value="user_error">User Error</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => void submitStatus("passed")}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Pass & Continue
                    </Button>
                    <Button disabled={busy} variant="destructive" onClick={() => void submitStatus("failed")}>
                      <XCircle className="mr-1 h-4 w-4" /> Fail
                    </Button>
                    <Button disabled={busy} variant="outline" onClick={() => void submitStatus("blocked")}>
                      <AlertTriangle className="mr-1 h-4 w-4" /> Blocked
                    </Button>
                    <Button disabled={busy} variant="ghost" onClick={() => void submitStatus("skipped")}>
                      Skip
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Live health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {highlights.length ? (
                  <ul className="space-y-1 text-amber-700 dark:text-amber-400">
                    {highlights.slice(0, 8).map((h) => (
                      <li key={h}>⚠ {h}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No critical highlights</p>
                )}
                <div className="max-h-48 overflow-auto space-y-1">
                  {nodes.slice(0, 20).map((n) => (
                    <div key={String(n.id)} className="flex justify-between gap-2 border-b py-1">
                      <span className="truncate">
                        {String(n.kind)} · {String(n.name)}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {String(n.status || "—")}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Link to="/laboratory-infrastructure" className="text-sky-600 underline">
                  Open full fleet tree
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Readiness score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Overall</span>
                  <span className="font-semibold">
                    {readiness?.overall_score != null ? `${readiness.overall_score}%` : "—"} {recBadge(recommendation)}
                  </span>
                </div>
                {Object.entries(domains).map(([name, d]) => (
                  <div key={name} className="flex justify-between text-xs">
                    <span>{name}</span>
                    <span>{d?.score != null ? `${d.score}%` : "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stages</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Passed</th>
                  <th className="py-2 pr-3">Failed</th>
                  <th className="py-2 pr-3">Blocked</th>
                  <th className="py-2 pr-3">Remaining</th>
                  <th className="py-2">Completion</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={String(s.stage)} className="border-b">
                    <td className="py-2 pr-3">{String(s.label)}</td>
                    <td className="py-2 pr-3 text-emerald-700">{Number(s.passed || 0)}</td>
                    <td className="py-2 pr-3 text-red-700">{Number(s.failed || 0)}</td>
                    <td className="py-2 pr-3">{Number(s.blocked || 0)}</td>
                    <td className="py-2 pr-3">{Number(s.remaining || 0)}</td>
                    <td className="py-2">{Number(s.completion_pct || 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Module</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Passed</th>
                  <th className="py-2 pr-3">Failed</th>
                  <th className="py-2 pr-3">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={String(m.module)} className="border-b">
                    <td className="py-2 pr-3 font-medium">{String(m.module)}</td>
                    <td className="py-2 pr-3">{Number(m.total_tests || 0)}</td>
                    <td className="py-2 pr-3 text-emerald-700">{Number(m.passed || 0)}</td>
                    <td className="py-2 pr-3 text-red-700">{Number(m.failed || 0)}</td>
                    <td className="py-2">{Number(m.coverage_pct || 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final GO / NO GO checklist</CardTitle>
            <CardDescription>Production promotion requires GO with Critical=0 and High=0. Commits wait for explicit approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">Start a run to compute checklist.</p>
            ) : (
              checklist.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <span>{c.passed ? "✅" : "☐"}</span>
                  <div>
                    <div className="font-medium">{c.label}</div>
                    {c.notes ? <div className="text-xs text-muted-foreground">{c.notes}</div> : null}
                  </div>
                </div>
              ))
            )}
            <div className="pt-2 text-sm">
              Recommendation: {recBadge(recommendation)}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
