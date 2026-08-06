import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AnalysisHorizontalStepper,
  toHorizontalSteps,
} from "@/components/analysis/AnalysisHorizontalStepper";
import { WorkspaceStatusStrip } from "@/components/analysis/WorkspaceHero";
import { WhatHappensNext, buildWhatHappensSteps } from "@/components/analysis/WhatHappensNext";
import { AnalysisWorkspaceChrome } from "@/components/analysis/AnalysisWorkspaceChrome";
import { DataFlowDiagram } from "@/components/analysis/DataFlowDiagram";
import { cn } from "@/lib/utils";
import {
  Activity,
  AppWindow,
  FolderSync,
  HardDrive,
  Info,
  MonitorSmartphone,
  Upload,
  Layers,
} from "lucide-react";

type WorkflowOption = {
  id: string;
  name: string;
  description?: string;
  estimated_duration_minutes?: number;
  required_software?: string[];
  steps?: Array<Record<string, unknown>>;
  is_default?: boolean;
};

type Experience = {
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  journey?: Array<{ id: string; label: string; status: string; timestamp?: string | null; detail?: string }>;
  input_choice?: {
    prompt?: string;
    booking_raw?: Record<string, unknown>;
    additional?: Record<string, unknown>;
    sync_note?: string;
  };
  queue?: Record<string, unknown>;
  session?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
  results?: Record<string, unknown>;
  poll_interval_seconds?: number;
};

/** Stable key for equipment-mapped catalog software options. */
function softwareOptionKey(sw: Record<string, unknown>): string {
  return String(sw.id || sw.mapping_id || sw.catalog_id || sw.slug || sw.name || "");
}

function formatBytes(n?: number) {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdated(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatStart(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

/** Map workspace sync phase / internal messages to user-facing copy. */
function formatSyncStatusLabel(phase?: unknown, message?: unknown): string {
  const p = String(phase || "").trim();
  const msg = String(message || "").trim();

  const PHASE_LABELS: Record<string, string> = {
    Preparing: "Preparing workspace",
    PREPARING: "Preparing workspace",
    QUEUED: "Waiting to sync",
    DownloadingInput: "Copying input data",
    DOWNLOADING: "Copying input data",
    VerifyingInput: "Verifying input data",
    InputReady: "Input data ready",
    READY: "Input data ready",
    SessionStarting: "Starting session",
    SessionActive: "Session active",
    CollectingOutput: "Collecting results",
    UploadingOutput: "Uploading results",
    UPLOADING: "Uploading results",
    UploadVerified: "Results uploaded",
    Cleanup: "Cleaning workspace",
    Completed: "Sync complete",
    COMPLETED: "Sync complete",
    PreparationFailed: "Sync failed — retry needed",
    FAILED: "Sync failed — retry needed",
    UploadFailed: "Results upload failed",
    RetryPending: "Retrying sync",
    RETRYING: "Retrying sync",
    CleanupFailed: "Cleanup issue",
    Cancelled: "Sync cancelled",
    CANCELLED: "Sync cancelled",
  };

  if (p && PHASE_LABELS[p]) return PHASE_LABELS[p];

  // Hide agent/ingest telemetry like "ingested=0 skipped=0 failed=0"
  const looksLikeTelemetry =
    /ingested\s*=/i.test(msg) ||
    /skipped\s*=/i.test(msg) ||
    /failed\s*=/i.test(msg) ||
    /^\d+\s*(file|bytes?)/i.test(msg);

  if (msg && !looksLikeTelemetry && msg.length < 80) return msg;
  if (p) return p.replace(/([a-z])([A-Z])/g, "$1 $2");
  return "Waiting to sync";
}

export default function AnalysisWorkspacePage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const bookingPk = Number(bookingId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [selectedSoftwareKey, setSelectedSoftwareKey] = useState<string>("");
  const [catalogSoftware, setCatalogSoftware] = useState<Array<Record<string, unknown>> | null>(null);
  const [inputMode, setInputMode] = useState<"booking_raw" | "additional">("booking_raw");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!Number.isFinite(bookingPk)) return;
      if (!opts?.silent) setLoading(true);
      const res = await apiClient.getBookingAnalysis(bookingPk);
      if (res.error) {
        if (!opts?.silent) toast.error(res.error);
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
      const fromSummary =
        ((data.software_options as Array<Record<string, unknown>>) ||
          ((data.analyze as any)?.software_options as Array<Record<string, unknown>>) ||
          []) as Array<Record<string, unknown>>;
      if (!fromSummary.length) {
        const swRes = await apiClient.getBookingAnalysisSoftware(bookingPk);
        if (!swRes.error && swRes.data?.software_options?.length) {
          setCatalogSoftware(swRes.data.software_options);
        }
      } else {
        setCatalogSoftware(null);
      }
      setLoading(false);
    },
    [bookingPk, selectedWorkflow]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const experience = (summary?.experience || {}) as Experience;
  const pollMs = Math.max(3, Number(experience.poll_interval_seconds || 8)) * 1000;

  useEffect(() => {
    if (!Number.isFinite(bookingPk)) return;
    const id = window.setInterval(() => void refresh({ silent: true }), pollMs);
    return () => window.clearInterval(id);
  }, [bookingPk, pollMs, refresh]);

  const workflows = useMemo(() => {
    if (!summary) return [] as WorkflowOption[];
    return ((summary.workflows as WorkflowOption[]) ||
      ((summary.analyze as any)?.workflows as WorkflowOption[]) ||
      []) as WorkflowOption[];
  }, [summary]);

  const softwareOptions = useMemo(() => {
    const fromSummary =
      ((summary?.software_options as Array<Record<string, unknown>>) ||
        ((summary?.analyze as any)?.software_options as Array<Record<string, unknown>>) ||
        []) as Array<Record<string, unknown>>;
    if (fromSummary.length) return fromSummary;
    if (catalogSoftware?.length) return catalogSoftware;
    const selected = workflows.find((w) => w.id === selectedWorkflow) || workflows[0];
    return (selected?.required_software || []).map((name) => ({
      name,
      display_name: name,
      description: "Provided in this Analysis Environment",
    }));
  }, [summary, workflows, selectedWorkflow, catalogSoftware]);

  const catalogSelectable = useMemo(
    () =>
      softwareOptions.some(
        (sw) => Boolean(sw.slug || sw.catalog_id || sw.id || sw.mapping_id)
      ),
    [softwareOptions]
  );

  useEffect(() => {
    if (!catalogSelectable || !softwareOptions.length) return;
    if (selectedSoftwareKey) {
      const stillValid = softwareOptions.some((sw) => softwareOptionKey(sw) === selectedSoftwareKey);
      if (stillValid) return;
    }
    const def =
      softwareOptions.find((sw) => Boolean(sw.is_default)) || softwareOptions[0];
    setSelectedSoftwareKey(softwareOptionKey(def));
  }, [catalogSelectable, softwareOptions, selectedSoftwareKey]);

  const canAnalyze = Boolean(summary?.can_analyze ?? (summary?.analyze as any)?.can_analyze);
  const selected = workflows.find((w) => w.id === selectedWorkflow) || workflows[0];
  const virtualBookingId = String(
    experience.virtual_booking_id || summary?.virtual_booking_id || bookingPk
  );
  const equipmentName = String(
    experience.equipment_name || experience.equipment_code || "Analysis Equipment"
  );
  const queue = (experience.queue || {}) as any;
  const sessionExp = (experience.session || {}) as any;
  const resultsExp = (experience.results || {}) as any;
  const workspaceExp = (experience.workspace || {}) as any;
  const inputChoice = experience.input_choice || {};
  const bookingRaw = (inputChoice.booking_raw || {}) as any;
  const additional = (inputChoice.additional || {}) as any;
  const reservation = (summary?.reservation || {}) as any;
  const session = (summary?.session || {}) as any;

  const queued = Boolean(queue.is_queued);
  const sessionStatus = String(session.status || sessionExp.status || "");
  const started = ["LAUNCHED", "CONNECTING", "CONNECTED", "ACTIVE", "IDLE"].includes(sessionStatus);
  const envReady =
    Boolean(reservation.allocated) &&
    !queued &&
    ["READY", "TOKEN_GENERATED", "RESERVED", "ACTIVE", ""].includes(String(reservation.status || ""));
  const resultsReady = Boolean(resultsExp.available);
  const remainingSeconds =
    typeof sessionExp.remaining_seconds === "number"
      ? sessionExp.remaining_seconds
      : typeof session.remaining_seconds === "number"
        ? session.remaining_seconds
        : null;

  const bannerMode = resultsReady
    ? "results"
    : started
      ? "running"
      : queued
        ? "queued"
        : envReady || canAnalyze
          ? "ready"
          : "default";

  const horizontalSteps = toHorizontalSteps(experience.journey, {
    queued,
    ready: envReady || canAnalyze,
    started,
    results: resultsReady,
  });

  const nextSteps = buildWhatHappensSteps({
    queued,
    preparing: !started && !resultsReady,
    started,
    results: resultsReady,
    cleanupDone: String((experience as any)?.cleanup?.status || "") === "done",
    journey: experience.journey,
  });

  const envLabel =
    (sessionExp as any)?.environment_label ||
    selected?.name ||
    experience.equipment_name ||
    "Analysis Environment";

  const startDisabled =
    busy ||
    queued ||
    (!canAnalyze && !started && !envReady) ||
    (inputMode === "booking_raw" &&
      Number(bookingRaw.file_count || 0) === 0 &&
      !(summary as any)?.raw_ready);

  const openOrStart = async () => {
    if (!Number.isFinite(bookingPk)) return;
    if (started) {
      navigate(`/analysis-launch/${bookingPk}${session.id ? `?session=${session.id}` : ""}`);
      return;
    }
    setBusy(true);
    try {
      const selectedSw = catalogSelectable
        ? softwareOptions.find((sw) => softwareOptionKey(sw) === selectedSoftwareKey)
        : undefined;
      const res = await apiClient.analyzeBookingData(bookingPk, {
        workflow_id: selectedWorkflow || undefined,
        mapping_id: selectedSw?.id ? String(selectedSw.id) : undefined,
        catalog_id: selectedSw?.catalog_id ? String(selectedSw.catalog_id) : undefined,
        software_slug: selectedSw?.slug ? String(selectedSw.slug) : undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const data = res.data || {};
      if (data.queued) {
        toast.message("Your request is in the execution queue.");
        await refresh({ silent: true });
      } else {
        toast.success(String(data.ux_status || "Preparing Analysis Environment"));
        navigate(`/analysis-launch/${bookingPk}${data.session_id ? `?session=${data.session_id}` : ""}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const endAnalysis = async () => {
    if (!window.confirm("End analysis now? This frees the Analysis Environment for the next user.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.endBookingAnalysis(bookingPk);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Analysis ended — environment released.");
        await refresh({ silent: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const extendSession = async () => {
    setBusy(true);
    try {
      const res = await apiClient.extendBookingAnalysis(bookingPk);
      if (res.error) toast.error(res.error);
      else {
        toast.success(String((res.data as any)?.message || "Session extended"));
        await refresh({ silent: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const uploadPastData = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await apiClient.uploadBookingAnalysisFile(bookingPk, file, "RawData");
      if (res.error) toast.error(res.error);
      else {
        setInputMode("additional");
        toast.success("File uploaded — it will sync before the environment launches.");
        await refresh({ silent: true });
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!Number.isFinite(bookingPk)) {
    return <div className="p-8">Invalid booking.</div>;
  }

  const syncStatus = formatSyncStatusLabel(
    workspaceExp.sync_phase || (summary as any)?.workspace?.sync_phase,
    workspaceExp.sync_message || (summary as any)?.workspace?.sync_message
  );
  const currentStepLabel =
    nextSteps.find((s) => s.status === "active")?.label ||
    horizontalSteps.find((s) => s.status === "active")?.label ||
    "Review & prepare";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef8_0%,_#f8fafc_45%,_#ffffff_100%)] dark:from-slate-950 dark:via-background dark:to-background">
      <AnalysisWorkspaceChrome
        equipmentName={equipmentName}
        bookingLabel={virtualBookingId}
        remainingSeconds={remainingSeconds}
        showSessionControls={started || remainingSeconds != null}
        canExtend={Boolean(sessionExp.can_extend)}
        extendMinutes={Number(sessionExp.extension_minutes || 15)}
        extendBlockedReason={
          sessionExp.extend_blocked_reason ? String(sessionExp.extend_blocked_reason) : null
        }
        busy={busy}
        onExtend={extendSession}
        onEnd={endAnalysis}
        showEnd={started || resultsReady}
        showReturnToDashboard
        confirmLeaveSession={Boolean(started || remainingSeconds != null)}
      />

      <div className="mx-auto w-full max-w-[1800px] space-y-5 px-4 py-4 sm:px-6 sm:py-6 xl:px-8 2xl:px-10">
        {loading && !summary ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Loading Analysis Workspace…
            </CardContent>
          </Card>
        ) : (
          <>
            <WorkspaceStatusStrip
              remainingSeconds={remainingSeconds}
              environmentLabel={envLabel}
              environmentReady={envReady || canAnalyze}
              queued={queued}
              heroMode={bannerMode as any}
            />

            <Card className="border-slate-200/80 shadow-sm dark:border-border">
              <CardContent className="py-4">
                <AnalysisHorizontalStepper steps={horizontalSteps} />
              </CardContent>
            </Card>

            {/* Live status dashboard */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatusTile
                icon={MonitorSmartphone}
                label="Environment"
                value={started ? "Active" : envReady || canAnalyze ? "Ready" : queued ? "Queued" : "Preparing"}
              />
              <StatusTile
                icon={Layers}
                label="Workspace"
                value={String(workspaceExp.status || (summary as any)?.workspace?.status || "Ready")}
              />
              <StatusTile icon={FolderSync} label="Synchronization" value={syncStatus} />
              <StatusTile
                icon={Activity}
                label="Session remaining"
                value={
                  remainingSeconds != null
                    ? `${Math.floor(remainingSeconds / 60)} min`
                    : started
                      ? "Active"
                      : "Not started"
                }
              />
              <StatusTile
                icon={Info}
                label="Queue"
                value={
                  queued
                    ? `Position ${queue.position ?? "—"}`
                    : "Not waiting"
                }
              />
              <StatusTile icon={AppWindow} label="Current step" value={currentStepLabel} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(240px,1.05fr)_minmax(0,2.1fr)_minmax(240px,1.05fr)] lg:gap-5 xl:gap-6">
              {/* Left — booking */}
              <Card className="border-slate-200/80 shadow-sm dark:border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Booking details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Booking ID" value={virtualBookingId} />
                  <InfoRow label="Equipment" value={equipmentName} />
                  <InfoRow
                    label="Access window"
                    value={
                      summary?.analysis_available_from
                        ? formatUpdated(String(summary.analysis_available_from))
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Expires"
                    value={
                      summary?.analysis_expiry ? formatUpdated(String(summary.analysis_expiry)) : "—"
                    }
                  />
                  <InfoRow label="Workflow" value={selected?.name || "—"} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Session status
                    </p>
                    <Badge
                      className={cn(
                        "mt-1",
                        started && "bg-emerald-500 hover:bg-emerald-500",
                        !started && "bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-muted"
                      )}
                    >
                      {sessionStatus || "Not started"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Center — data */}
              <Card className="border-slate-200/80 shadow-md dark:border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {inputChoice.prompt || "What data would you like to analyze?"}
                  </CardTitle>
                  <CardDescription>
                    Choose booking RAW data or upload additional files for this session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setInputMode("booking_raw")}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      inputMode === "booking_raw"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-4 w-4 rounded-full border-2",
                          inputMode === "booking_raw"
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-semibold">
                          <HardDrive className="h-4 w-4 text-primary" />
                          Use RAW Data uploaded with this booking
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <span>
                            <strong className="block text-foreground">{bookingRaw.file_count ?? 0}</strong>
                            Files
                          </span>
                          <span>
                            <strong className="block text-foreground">
                              {formatBytes(bookingRaw.total_size_bytes)}
                            </strong>
                            Size
                          </span>
                          <span>
                            <strong className="block text-foreground">
                              {formatUpdated(bookingRaw.last_updated)}
                            </strong>
                            Uploaded
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {inputMode === "booking_raw" ? (
                    <div className="space-y-3 rounded-2xl border border-sky-400/40 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-50">
                      <div className="flex gap-2">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                        <div>
                          <p className="text-base font-semibold">Where will my data be available?</p>
                          <p className="mt-1 leading-relaxed text-sky-900/90 dark:text-sky-100/90">
                            Your selected data will automatically be synchronized to your dedicated
                            Analysis Workspace before the Analysis Environment starts.
                          </p>
                        </div>
                      </div>
                      <ul className="ml-7 list-disc space-y-1.5 text-sky-900/90 dark:text-sky-100/90">
                        <li>
                          On the Analysis PC, files appear in the predefined{" "}
                          <strong>Input Data</strong> folder.
                        </li>
                        <li>
                          After analysis, generated files go to the <strong>Output Results</strong>{" "}
                          folder and sync securely to the Portal.
                        </li>
                        <li>
                          When sync completes, download processed files from your{" "}
                          <strong>Booking Details</strong> page (Analyzed Data).
                        </li>
                        <li>You will also receive an email when results are ready.</li>
                      </ul>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setInputMode("additional")}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      inputMode === "additional"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-4 w-4 rounded-full border-2",
                          inputMode === "additional"
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-semibold">
                          <Upload className="h-4 w-4 text-primary" />
                          Upload Additional / Alternative Data
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {additional.file_count ?? 0} files · {formatBytes(additional.total_size_bytes)}
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => void uploadPastData(e.target.files?.[0] || null)}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setInputMode("additional");
                              fileInputRef.current?.click();
                            }}
                          >
                            Browse files
                          </Button>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-50">
                    <p className="font-semibold">Where will my results be available?</p>
                    <p className="mt-1 leading-relaxed">
                      Generated results are collected from the Analysis PC <strong>Output Folder</strong>,
                      synchronized to the Portal, and then available for download from your Booking
                      Details page as <strong>Analyzed Data</strong>.
                    </p>
                  </div>

                  <DataFlowDiagram />

                  {workflows.length > 1 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Workflow
                      </p>
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
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Right — queue + rules */}
              <div className="space-y-4">
                <Card className="border-slate-200/80 shadow-sm dark:border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Queue information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {queued ? (
                      <>
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Your position
                          </p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {queue.position != null
                              ? `${queue.position} of ${Math.max(
                                  queue.queue_size || queue.position,
                                  queue.position
                                )}`
                              : "—"}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="rounded-lg border p-2">
                            <p className="text-xs text-muted-foreground">Estimated wait</p>
                            <p className="font-semibold">
                              {queue.estimated_wait_minutes != null
                                ? `${queue.estimated_wait_minutes} min`
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border p-2">
                            <p className="text-xs text-muted-foreground">Expected start</p>
                            <p className="font-semibold">{formatStart(queue.expected_start_at)}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                        You are not waiting in queue. You can start when ready.
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <EnvStat label="Available" value={queue.environments?.available ?? "—"} tone="ok" />
                      <EnvStat label="Busy" value={queue.environments?.busy ?? "—"} tone="busy" />
                      <EnvStat label="Waiting" value={queue.environments?.waiting ?? "—"} tone="wait" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-sky-200/70 bg-sky-50/80 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Session rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-sky-950/90 dark:text-sky-100/90">
                    <p>· Default interactive session length is set per equipment (typically 30 minutes).</p>
                    <p>· Extend (+15 min) unlocks only when 2 minutes or less remain, and only if nobody else is waiting.</p>
                    <p>· Always click End Analysis when finished — do not only close the browser.</p>
                    <p>· After completion, the workspace is cleaned before the next user.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <WhatHappensNext steps={nextSteps} />

            <Card className="border-slate-200/80 shadow-sm dark:border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {catalogSelectable ? "Select analysis software" : "Available software"}
                </CardTitle>
                <CardDescription>
                  {catalogSelectable
                    ? "Choose software mapped to this equipment. The portal allocates the best available Analysis PC automatically."
                    : "Applications provided in this Analysis Environment"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {softwareOptions.length ? (
                    softwareOptions.map((sw, idx) => {
                      const name = String(sw.display_name || sw.name || sw.software_name || "Software");
                      const version = String(sw.version || sw.version_constraint || "");
                      const description = String(
                        sw.description ||
                          sw.notes ||
                          (catalogSelectable
                            ? "Mapped for this equipment — PC selected automatically"
                            : "Installed for this Analysis Environment")
                      );
                      const typicalUsage = String(sw.typical_usage || "");
                      const fileTypes = Array.isArray(sw.accepted_file_types)
                        ? (sw.accepted_file_types as unknown[]).map(String)
                        : Array.isArray(sw.file_types)
                          ? (sw.file_types as unknown[]).map(String)
                          : [];
                      const aiTags = Array.isArray(sw.ai_tags) ? (sw.ai_tags as unknown[]).map(String) : [];
                      const key = softwareOptionKey(sw) || `${name}-${idx}`;
                      const selected = catalogSelectable && key === selectedSoftwareKey;
                      const cardClass = cn(
                        "flex gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-card",
                        catalogSelectable
                          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          : "hover:-translate-y-0.5 hover:shadow-md",
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-slate-200/80 dark:border-border"
                      );
                      const body = (
                        <>
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-sky-500/15 text-primary">
                            <AppWindow className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight">{name}</p>
                            {version ? (
                              <Badge variant="secondary" className="mt-1 text-[10px]">
                                v{version}
                              </Badge>
                            ) : null}
                            {selected ? (
                              <Badge className="mt-1 ml-1 text-[10px]">Selected</Badge>
                            ) : null}
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {description}
                            </p>
                            {typicalUsage ? (
                              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                Typical use: {typicalUsage}
                              </p>
                            ) : null}
                            {fileTypes.length ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                Files: {fileTypes.slice(0, 6).join(", ")}
                                {fileTypes.length > 6 ? "…" : ""}
                              </p>
                            ) : null}
                            {aiTags.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {aiTags.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="outline" className="text-[9px]">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </>
                      );
                      if (catalogSelectable) {
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedSoftwareKey(key)}
                            className={cardClass}
                          >
                            {body}
                          </button>
                        );
                      }
                      return (
                        <div key={key} className={cardClass}>
                          {body}
                        </div>
                      );
                    })
                  ) : (
                    <p className="col-span-full text-sm text-muted-foreground">
                      Software list appears when equipment↔software mappings or a workflow are configured.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-border">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {resultsReady ? (
                  <Button variant="secondary" asChild>
                    <Link to="/my-bookings">Download results</Link>
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  className="min-w-[220px] bg-[#0b3d91] hover:bg-[#0a357f]"
                  disabled={startDisabled}
                  onClick={openOrStart}
                >
                  <MonitorSmartphone className="mr-2 h-4 w-4" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>
                      {queued
                        ? "Waiting in queue…"
                        : started
                          ? "Open Analysis Environment"
                          : "Open Analysis Environment"}
                    </span>
                    {!queued ? (
                      <span className="text-[10px] font-normal text-white/80">
                        You will be connected to the Analysis PC
                      </span>
                    ) : null}
                  </span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium leading-snug">{value}</p>
    </div>
  );
}

function EnvStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "ok" | "busy" | "wait";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-2 text-center",
        tone === "ok" && "border-emerald-500/30 bg-emerald-500/10",
        tone === "busy" && "border-amber-500/30 bg-amber-500/10",
        tone === "wait" && "border-sky-500/30 bg-sky-500/10"
      )}
    >
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-border dark:bg-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
