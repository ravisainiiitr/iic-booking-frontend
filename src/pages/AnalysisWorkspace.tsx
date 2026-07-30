import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WorkflowOption = {
  id: string;
  name: string;
  description?: string;
  estimated_duration_minutes?: number;
  required_software?: string[];
  steps?: Array<Record<string, unknown>>;
  is_default?: boolean;
};

type JobPayload = {
  id?: string;
  status?: string;
  ux_status?: string;
  progress_percent?: number;
  current_step?: number;
  total_steps?: number;
  current_environment?: string;
  current_step_detail?: Record<string, unknown> | null;
  steps?: Array<Record<string, unknown>>;
  workflow?: { name?: string; description?: string; estimated_duration_minutes?: number };
  results_available?: boolean;
  results_label?: string;
};

export default function AnalysisWorkspacePage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const bookingPk = Number(bookingId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!Number.isFinite(bookingPk)) return;
    setLoading(true);
    const res = await apiClient.getBookingAnalysis(bookingPk);
    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }
    const data = (res.data || {}) as Record<string, unknown>;
    setSummary(data);
    const workflows = ((data.workflows as WorkflowOption[]) ||
      ((data.analyze as any)?.workflows as WorkflowOption[]) ||
      []) as WorkflowOption[];
    if (!selectedWorkflow && workflows.length) {
      const def = workflows.find((w) => w.is_default) || workflows[0];
      setSelectedWorkflow(def.id);
    }
    setLoading(false);
  }, [bookingPk, selectedWorkflow]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const workflows = useMemo(() => {
    if (!summary) return [] as WorkflowOption[];
    return ((summary.workflows as WorkflowOption[]) ||
      ((summary.analyze as any)?.workflows as WorkflowOption[]) ||
      []) as WorkflowOption[];
  }, [summary]);

  const job = (summary?.job || (summary?.analyze as any)?.job || null) as JobPayload | null;
  const canAnalyze = Boolean(summary?.can_analyze ?? (summary?.analyze as any)?.can_analyze);
  const selected = workflows.find((w) => w.id === selectedWorkflow) || workflows[0];

  const launch = async () => {
    if (!Number.isFinite(bookingPk)) return;
    setBusy(true);
    try {
      const res = await apiClient.analyzeBookingData(bookingPk, {
        workflow_id: selectedWorkflow || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const data = res.data || {};
      if (data.queued) {
        toast.message(String(data.message || "Queued — Analysis Environment will start automatically."));
      } else {
        toast.success(String(data.ux_status || "Analysis Session Active"));
        const url = (data.launch_url || data.launcher_url) as string | undefined;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const completeStep = async () => {
    if (!job?.current_step) return;
    setBusy(true);
    try {
      const res = await apiClient.completeAnalysisJobStep(bookingPk, Number(job.current_step));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if ((res.data as any)?.needs_review) {
        toast.message("Needs Operator Review — expected outputs are missing.");
      } else if ((res.data as any)?.completed) {
        toast.success("Processed Results Available");
      } else {
        toast.success("Step checkpoint saved");
      }
      await refresh();
      const launchUrl = (res.data as any)?.launch_url;
      if (launchUrl) window.open(launchUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    setBusy(true);
    try {
      const res = await apiClient.pauseAnalysisJob(bookingPk);
      if (res.error) toast.error(res.error);
      else toast.message("Analysis Session Paused");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    try {
      const res = await apiClient.resumeAnalysisJob(bookingPk);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Analysis Session Active");
      const url = ((res.data as any)?.launch_url || (res.data as any)?.launcher_url) as string | undefined;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(bookingPk)) {
    return <div className="p-8">Invalid booking.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Booking #{bookingPk}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Analysis Workspace</h1>
          <p className="mt-1 text-muted-foreground">
            Continue from your completed booking into analysis and processed results.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
              <CardDescription>
                Choose the analysis pipeline. An Analysis Environment is allocated automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflows.length > 0 ? (
                <Select value={selectedWorkflow || selected?.id} onValueChange={setSelectedWorkflow}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                        {w.is_default ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No workflows configured yet — legacy software mappings still work via Analyze Data.
                </p>
              )}

              {selected && (
                <div className="space-y-2 rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{selected.name}</h2>
                    <Badge variant="secondary">
                      ~{selected.estimated_duration_minutes || "—"} min
                    </Badge>
                  </div>
                  {selected.description ? (
                    <p className="text-sm text-muted-foreground">{selected.description}</p>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Required software
                    </p>
                    <p className="text-sm">{(selected.required_software || []).join(" → ") || "—"}</p>
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {(selected.steps || []).map((s) => (
                      <li key={String(s.step_number)}>
                        {String(s.title || s.environment_label || `Step ${s.step_number}`)}
                        {s.mandatory === false ? " (optional)" : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={launch} disabled={busy || (!canAnalyze && !job)}>
                  {job ? "Launch Analysis" : "Launch Analysis"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/my-bookings`}>My bookings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {job && (
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>{job.ux_status || job.status}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={Number(job.progress_percent || 0)} />
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Current step</span>
                    <p className="font-medium">
                      {job.current_step} / {job.total_steps}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Analysis Environment</span>
                    <p className="font-medium">{job.current_environment || "Preparing…"}</p>
                  </div>
                </div>
                {job.current_step_detail?.operator_instructions ? (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="mb-1 font-medium">Operator instructions</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {String(job.current_step_detail.operator_instructions)}
                    </p>
                    {job.current_step_detail.help_url ? (
                      <a
                        className="mt-2 inline-block text-primary underline"
                        href={String(job.current_step_detail.help_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Help
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={completeStep} disabled={busy}>
                    Complete current step
                  </Button>
                  <Button variant="outline" onClick={pause} disabled={busy}>
                    Pause
                  </Button>
                  <Button variant="outline" onClick={resume} disabled={busy}>
                    Resume
                  </Button>
                </div>
                {job.results_available ? (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {job.results_label || "Processed Results Available"}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
