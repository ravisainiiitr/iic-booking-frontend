import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { AnalysisSetup } from "@/lib/analysisSetupTypes";
import { isMissingEndpoint, myResearchFolderHref, plural } from "@/lib/analysisSync";
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
import { WorkspaceStatusStrip } from "@/components/analysis/WorkspaceHero";
import { AnalysisWorkspaceChrome } from "@/components/analysis/AnalysisWorkspaceChrome";
import { DataWorkspaceBanner, type DataWorkspaceInfo } from "@/components/analysis/DataWorkspaceBanner";
import { AnalysisSetupDialog, type PreparedSetup } from "@/components/analysis/AnalysisSetupDialog";
import { SyncProgressPanel } from "@/components/analysis/SyncProgressPanel";
import { useAnalysisLiveState } from "@/components/analysis/useAnalysisLiveState";
import { cn } from "@/lib/utils";
import {
  AppWindow,
  FlaskConical,
  FolderOutput,
  HardDrive,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Settings2,
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

type SoftwareOption = Record<string, unknown>;

type QueueInfo = {
  is_queued?: boolean;
  title?: string;
  body?: string[] | string;
  position?: number | null;
  queue_size?: number;
  estimated_wait_minutes?: number | null;
  expected_start_at?: string | null;
  environments?: { available?: number; busy?: number; offline?: number; waiting?: number };
};

type SessionInfo = {
  id?: string;
  status?: string;
  remaining_seconds?: number | null;
  default_duration_minutes?: number;
  environment_label?: string;
  can_extend?: boolean;
  extension_minutes?: number;
  extend_blocked_reason?: string | null;
  others_waiting?: boolean;
  save_reminder?: string;
};

type Experience = {
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  awaiting_checkin?: boolean;
  checkin?: { required?: boolean; remaining_seconds?: number | null };
  data_workspace?: DataWorkspaceInfo | null;
  input_choice?: { booking_raw?: { file_count?: number } };
  queue?: QueueInfo;
  session?: SessionInfo;
  results?: { available?: boolean };
  poll_interval_seconds?: number;
};

const OPEN_SESSION = ["LAUNCHED", "CONNECTING", "CONNECTED", "ACTIVE", "IDLE"];
const SESSION_READY = ["CREATED", "PREPARING", "READY", "TOKEN_GENERATED", ...OPEN_SESSION];

/** Stable key for equipment-mapped catalog software options. */
function softwareOptionKey(sw: SoftwareOption): string {
  return String(sw.id || sw.mapping_id || sw.catalog_id || sw.slug || sw.name || "");
}

function softwareFromSummary(summary: Record<string, unknown> | null): SoftwareOption[] {
  const analyze = (summary?.analyze || {}) as Record<string, unknown>;
  return ((summary?.software_options as SoftwareOption[]) || (analyze.software_options as SoftwareOption[]) || []);
}

function workflowsFromSummary(summary: Record<string, unknown> | null): WorkflowOption[] {
  const analyze = (summary?.analyze || {}) as Record<string, unknown>;
  return ((summary?.workflows as WorkflowOption[]) || (analyze.workflows as WorkflowOption[]) || []);
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

export default function AnalysisWorkspacePage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const setupRequested = searchParams.get("setup") === "1";
  const bookingPk = Number(bookingId);
  const [busy, setBusy] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [selectedSoftwareKey, setSelectedSoftwareKey] = useState<string>("");
  const [catalogSoftware, setCatalogSoftware] = useState<SoftwareOption[] | null>(null);
  const [setup, setSetup] = useState<AnalysisSetup | null>(null);
  const [setupState, setSetupState] = useState<"loading" | "ready" | "unsupported">("loading");
  const [legacyInputLabel, setLegacyInputLabel] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pollMs, setPollMs] = useState(8000);
  const autoOpened = useRef(false);
  const softwareRequested = useRef(false);

  const live = useAnalysisLiveState(bookingPk, {
    summaryEveryMs: Math.max(pollMs, 10000),
    legacySummaryEveryMs: pollMs,
  });
  const { summary, summaryError, sync, syncSupported, refreshSummary, pollNow } = live;
  const loading = !summary && !summaryError;

  useEffect(() => {
    if (summaryError && !summary) toast.error(summaryError);
  }, [summaryError, summary]);

  const experience = (summary?.experience || {}) as Experience;
  useEffect(() => {
    setPollMs(Math.max(3, Number(experience.poll_interval_seconds || 8)) * 1000);
  }, [experience.poll_interval_seconds]);

  const loadSetup = useCallback(async () => {
    if (!Number.isFinite(bookingPk)) return;
    const res = await apiClient.getBookingAnalysisSetup(bookingPk);
    if (res.error || !res.data) {
      if (!isMissingEndpoint(res) && res.status !== 403) console.warn("Analysis setup unavailable:", res.error);
      setSetupState("unsupported");
      return;
    }
    setSetup(res.data);
    setSetupState("ready");
  }, [bookingPk]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  const workflows = useMemo(() => workflowsFromSummary(summary), [summary]);

  useEffect(() => {
    if (selectedWorkflow || !workflows.length) return;
    setSelectedWorkflow((workflows.find((w) => w.is_default) || workflows[0]).id);
  }, [workflows, selectedWorkflow]);

  const summarySoftware = useMemo(() => softwareFromSummary(summary), [summary]);

  useEffect(() => {
    if (!summary || summarySoftware.length || softwareRequested.current) return;
    softwareRequested.current = true;
    void apiClient.getBookingAnalysisSoftware(bookingPk).then((res) => {
      if (!res.error && res.data?.software_options?.length) setCatalogSoftware(res.data.software_options);
    });
  }, [summary, summarySoftware.length, bookingPk]);

  const softwareOptions = useMemo<SoftwareOption[]>(() => {
    if (summarySoftware.length) return summarySoftware;
    if (catalogSoftware?.length) return catalogSoftware;
    const selected = workflows.find((w) => w.id === selectedWorkflow) || workflows[0];
    return (selected?.required_software || []).map((name) => ({
      name,
      display_name: name,
      description: "Provided on this Analysis PC",
    }));
  }, [summarySoftware, workflows, selectedWorkflow, catalogSoftware]);

  const catalogSelectable = useMemo(
    () => softwareOptions.some((sw) => Boolean(sw.slug || sw.catalog_id || sw.id || sw.mapping_id)),
    [softwareOptions]
  );

  useEffect(() => {
    if (!catalogSelectable || !softwareOptions.length) return;
    if (selectedSoftwareKey && softwareOptions.some((sw) => softwareOptionKey(sw) === selectedSoftwareKey)) return;
    const def = softwareOptions.find((sw) => Boolean(sw.is_default)) || softwareOptions[0];
    setSelectedSoftwareKey(softwareOptionKey(def));
  }, [catalogSelectable, softwareOptions, selectedSoftwareKey]);

  const analyze = (summary?.analyze || {}) as Record<string, unknown>;
  const canAnalyze = Boolean(summary?.can_analyze ?? analyze.can_analyze);
  const selected = workflows.find((w) => w.id === selectedWorkflow) || workflows[0];
  const virtualBookingId = String(
    setup?.booking.virtual_id || experience.virtual_booking_id || summary?.virtual_booking_id || bookingPk
  );
  const equipmentName = String(
    setup?.booking.equipment_name || experience.equipment_name || experience.equipment_code || "Analysis Equipment"
  );
  const queue = experience.queue || {};
  const checkinExp = experience.checkin || {};
  const sessionExp = experience.session || {};
  const resultsExp = experience.results || {};
  const bookingRaw = experience.input_choice?.booking_raw || {};
  const dataWorkspace = experience.data_workspace || null;
  const reservation = (summary?.reservation || {}) as { status?: string; allocated?: boolean };
  const session = (summary?.session || {}) as SessionInfo;

  const awaitingCheckin = Boolean(
    experience.awaiting_checkin || checkinExp.required || reservation.status === "AWAITING_CHECKIN"
  );
  const queued = Boolean(queue.is_queued);
  const sessionStatus = String(session.status || sessionExp.status || "");
  const started = OPEN_SESSION.includes(sessionStatus);
  const sessionReadyToOpen = SESSION_READY.includes(sessionStatus);
  const envReady =
    Boolean(reservation.allocated || awaitingCheckin) &&
    !queued &&
    ["READY", "TOKEN_GENERATED", "RESERVED", "ACTIVE", "AWAITING_CHECKIN", ""].includes(String(reservation.status || ""));
  const resultsReady = Boolean(resultsExp.available);
  const checkinRemainingSeconds =
    typeof checkinExp.remaining_seconds === "number" ? checkinExp.remaining_seconds : null;
  const remainingSeconds =
    typeof sessionExp.remaining_seconds === "number"
      ? sessionExp.remaining_seconds
      : typeof session.remaining_seconds === "number"
        ? session.remaining_seconds
        : awaitingCheckin
          ? checkinRemainingSeconds
          : null;

  const bannerMode = resultsReady ? "results" : started ? "running" : queued ? "queued" : envReady || canAnalyze ? "ready" : "default";

  const plannedSeconds = (() => {
    const mins = Number(sessionExp.default_duration_minutes || selected?.estimated_duration_minutes || 30);
    return Number.isFinite(mins) && mins > 0 ? Math.floor(mins * 60) : null;
  })();

  const envLabel = sessionExp.environment_label || selected?.name || experience.equipment_name || "Analysis PC";

  const selectedSoftwareLabel = useMemo(() => {
    const sw = softwareOptions.find((s) => softwareOptionKey(s) === selectedSoftwareKey) || softwareOptions[0];
    return sw ? String(sw.display_name || sw.name || sw.slug || "") : "";
  }, [selectedSoftwareKey, softwareOptions]);

  const analysisEnded = Boolean(summary?.analysis_ended || analyze.analysis_ended || summary?.analysis_closed_at);

  const eligible = Boolean(setup?.my_research.eligible);
  const link = setup?.my_research.current_link ?? null;
  const setupComplete =
    setupState === "ready"
      ? Boolean(setup?.input.selected) && (!eligible || Boolean(link))
      : Boolean(legacyInputLabel);
  const needsSetup = setupState === "ready" ? !setupComplete : !legacyInputLabel && !awaitingCheckin;
  /** Every new session confirms input data and the results folder, pre-filled with the last choices. */
  const askBeforeStart = needsSetup || setupState === "ready";
  const canOpen = canAnalyze || envReady || awaitingCheckin || started || sessionReadyToOpen;
  const startDisabled = busy || queued || analysisEnded || !canOpen || setupState === "loading";

  useEffect(() => {
    if (autoOpened.current || !summary || setupState === "loading") return;
    autoOpened.current = true;
    if (setupRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete("setup");
      setSearchParams(next, { replace: true });
    }
    if (analysisEnded || started || sessionReadyToOpen || queued || !canOpen) return;
    if (!needsSetup && !setupRequested) return;
    setDialogOpen(true);
    // searchParams is only read on the first settled render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, setupState, analysisEnded, started, sessionReadyToOpen, queued, canOpen, needsSetup, setupRequested]);

  const launchHref = `/analysis-launch/${bookingPk}${session.id ? `?session=${session.id}` : ""}`;

  const startAnalysis = async (): Promise<boolean> => {
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
        return false;
      }
      const data = res.data || {};
      if (data.queued) {
        toast.message("You are in the queue for an Analysis PC.");
        await refreshSummary();
      } else if (data.awaiting_checkin) {
        toast.success("Your Analysis PC is ready — start your session.");
        navigate(`/analysis-launch/${bookingPk}`);
      } else {
        toast.success(String(data.ux_status || "Preparing your Analysis PC"));
        navigate(`/analysis-launch/${bookingPk}${data.session_id ? `?session=${data.session_id}` : ""}`);
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const openOrStart = async () => {
    if (!Number.isFinite(bookingPk)) return;
    if (started || sessionReadyToOpen) {
      navigate(launchHref);
      return;
    }
    if (askBeforeStart) {
      setDialogOpen(true);
      return;
    }
    if (awaitingCheckin) {
      navigate(`/analysis-launch/${bookingPk}`);
      return;
    }
    await startAnalysis();
  };

  const onPrepared = async ({ setup: saved, inputLabel }: PreparedSetup) => {
    if (saved) setSetup(saved);
    else setLegacyInputLabel(inputLabel);
    void pollNow();
    if (started || sessionReadyToOpen) {
      setDialogOpen(false);
      navigate(launchHref);
      return true;
    }
    if (awaitingCheckin) {
      setDialogOpen(false);
      navigate(`/analysis-launch/${bookingPk}`);
      return true;
    }
    const ok = await startAnalysis();
    if (ok) setDialogOpen(false);
    return ok;
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.syncBookingAnalysisNow(bookingPk);
      if (res.status === 409) toast.message("Sync is available while your analysis session is running.");
      else if (res.error) toast.error(res.error);
      else toast.success("Copying your Output folder now.");
      void pollNow();
    } finally {
      setSyncing(false);
    }
  };

  const endAnalysis = async () => {
    if (!window.confirm("End analysis now? Your Output folder is copied and the Analysis PC is freed for the next user.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.endBookingAnalysis(bookingPk);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Analysis ended — copying your results.");
        await refreshSummary();
        void pollNow();
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
        toast.success(String((res.data as Record<string, unknown> | undefined)?.message || "Session extended"));
        await refreshSummary();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(bookingPk)) {
    return <div className="p-8">Invalid booking.</div>;
  }

  const rawFileCount = Number(bookingRaw.file_count || 0);
  const destinationLabel = setup?.output.destination_label || "Booking Details › Analyzed Data";
  const syncTarget = eligible ? "Processed Data" : "Analyzed Data";
  const syncHref = myResearchFolderHref(
    sync?.destination?.workspace_id || link?.workspace_id,
    sync?.destination?.folder_id || link?.processed_folder_id,
  );
  const selectedInput = setup?.input.selected ?? null;
  const inputSummary = selectedInput
    ? selectedInput.source === "upload"
      ? `Files uploaded to ${setup?.folders_preview.raw || "Raw Data"} (${plural(selectedInput.file_count, "file")})`
      : `${selectedInput.virtual_id || virtualBookingId} · ${plural(selectedInput.file_count, "file")}`
    : legacyInputLabel;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef8_0%,_#f8fafc_45%,_#ffffff_100%)] dark:bg-none dark:bg-background">
      <AnalysisWorkspaceChrome
        equipmentName={equipmentName}
        bookingLabel={virtualBookingId}
        remainingSeconds={remainingSeconds}
        showSessionControls={started || remainingSeconds != null || awaitingCheckin}
        canExtend={Boolean(sessionExp.can_extend)}
        extendMinutes={Number(sessionExp.extension_minutes || 15)}
        extendBlockedReason={sessionExp.extend_blocked_reason ? String(sessionExp.extend_blocked_reason) : null}
        busy={busy}
        onExtend={extendSession}
        onEnd={endAnalysis}
        showEnd={started || resultsReady}
        showReturnToDashboard
        confirmLeaveSession={Boolean(started || remainingSeconds != null)}
      />

      <div className="mx-auto w-full max-w-[1800px] space-y-5 px-4 py-4 sm:px-6 sm:py-6 xl:px-8 2xl:px-10">
        <DataWorkspaceBanner showDataRoot={false} data={dataWorkspace} />

        {analysisEnded ? (
          <Card className="border-muted bg-muted/30">
            <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">This booking's remote analysis is over</p>
              <p>
                You cannot start or rejoin a remote analysis session for this booking.{" "}
                {link ? (
                  <>Your results are in My Research › {link.workspace_name} / {link.folder_path || virtualBookingId}.</>
                ) : (
                  <>
                    Download <strong>Raw Data</strong> / <strong>Analyzed Data</strong> from Booking Details when available.
                  </>
                )}
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link to="/my-bookings">Back to Booking Details</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!analysisEnded && !loading ? (
          <Card className="overflow-hidden border-[#0b3d91]/25 bg-white shadow-md dark:border-sky-800/50 dark:bg-card">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0b3d91] dark:text-sky-300">
                  Analysis Workspace
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                  {equipmentName}
                  <span className="font-normal text-muted-foreground"> · Booking {virtualBookingId}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    Software: <span className="font-medium text-foreground">{selectedSoftwareLabel || envLabel || "—"}</span>
                  </span>
                  <span className="hidden text-slate-300 sm:inline">|</span>
                  <span>
                    Status:{" "}
                    <span className="font-medium text-foreground">
                      {queued
                        ? "Waiting in queue"
                        : started
                          ? "Session active"
                          : awaitingCheckin
                            ? "Ready — start session"
                            : envReady || canAnalyze
                              ? "Ready"
                              : "Preparing"}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Button
                  size="lg"
                  className="min-w-[240px] rounded-xl bg-[#0b3d91] px-6 shadow-md transition hover:bg-[#0a357f] hover:shadow-lg active:translate-y-px active:shadow-sm disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                  disabled={startDisabled}
                  onClick={openOrStart}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MonitorSmartphone className="mr-2 h-4 w-4" />}
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[15px] font-semibold">
                      {queued
                        ? "Waiting in queue…"
                        : busy
                          ? "Starting…"
                          : awaitingCheckin && !started && !sessionReadyToOpen && !askBeforeStart
                            ? "Start Analysis"
                            : "Open Analysis PC"}
                    </span>
                    {!queued && !busy ? (
                      <span className="text-[10px] font-normal text-white/80">
                        {started || sessionReadyToOpen
                          ? "Connect to your reserved Analysis PC"
                          : askBeforeStart
                            ? "Choose your data and where results are saved"
                            : awaitingCheckin
                              ? "Your Analysis PC is reserved — start before the timer expires"
                              : "Connect to your Analysis PC"}
                      </span>
                    ) : null}
                  </span>
                </Button>
                {resultsReady && !link ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/my-bookings">Download results</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {remainingSeconds != null && remainingSeconds > 0 && remainingSeconds <= 15 * 60 ? (
          <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {remainingSeconds <= 5 * 60
              ? "Final warning: your session is ending soon. "
              : remainingSeconds <= 10 * 60
                ? "Your scheduled session is ending soon. "
                : "Session ending in under 15 minutes. "}
            Please save your work to the <strong>Output</strong> folder.
            {sessionExp.others_waiting ? " Another user is waiting for this Analysis PC." : ""}
            {sessionExp.save_reminder ? ` ${sessionExp.save_reminder}` : ""}
          </div>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Loading Analysis Workspace…</CardContent>
          </Card>
        ) : (
          <>
            <WorkspaceStatusStrip
              remainingSeconds={remainingSeconds}
              plannedSeconds={remainingSeconds == null ? plannedSeconds : null}
              environmentLabel={envLabel}
              environmentReady={envReady || canAnalyze || awaitingCheckin}
              queued={queued}
              heroMode={bannerMode}
              queueTitle={awaitingCheckin ? queue.title || "Your Analysis PC is ready" : queued ? queue.title : null}
              queueBody={
                awaitingCheckin
                  ? queue.body || [
                      "A compatible Analysis PC has been allocated automatically.",
                      "Start your session before the check-in timer expires.",
                    ]
                  : queued
                    ? queue.body
                    : null
              }
              timerLabel={awaitingCheckin && !started ? "Check-in expires in" : undefined}
              timerHint={awaitingCheckin && !started ? "Start Analysis before this timer reaches zero" : undefined}
            />

            {queued ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{queue.title || "Analysis PC currently unavailable"}</CardTitle>
                  <CardDescription className="space-y-1 text-sm text-foreground/80">
                    {(Array.isArray(queue.body) ? queue.body : []).map((line: string) => (
                      <p key={line}>{line}</p>
                    ))}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(240px,1.05fr)_minmax(0,2.1fr)_minmax(240px,1.05fr)] lg:gap-5 xl:gap-6">
              <Card className="border-slate-200/80 shadow-sm dark:border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Booking details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Booking ID" value={virtualBookingId} />
                  <InfoRow label="Equipment" value={equipmentName} />
                  <InfoRow
                    label="Access window"
                    value={summary?.analysis_available_from ? formatUpdated(String(summary.analysis_available_from)) : "—"}
                  />
                  <InfoRow label="Expires" value={summary?.analysis_expiry ? formatUpdated(String(summary.analysis_expiry)) : "—"} />
                  <InfoRow label="Workflow" value={selected?.name || "—"} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Session status</p>
                    <Badge
                      className={cn(
                        "mt-1",
                        started && "bg-emerald-500 hover:bg-emerald-500",
                        !started && "bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground"
                      )}
                    >
                      {sessionStatus || "Not started"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-md dark:border-border" data-testid="analysis-setup-summary">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Your analysis setup</CardTitle>
                    <CardDescription>
                      {setupComplete
                        ? "Your data, and where results from the Analysis PC are saved."
                        : "Choose the data to analyze and where results are saved."}
                    </CardDescription>
                  </div>
                  {!analysisEnded ? (
                    <Button
                      size="sm"
                      variant={setupComplete ? "outline" : "default"}
                      className="shrink-0 gap-1.5"
                      onClick={() => setDialogOpen(true)}
                      disabled={setupState === "loading" || started}
                      title={started ? "The session is already running" : undefined}
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden />
                      {setupComplete ? "Change" : "Set up analysis"}
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <SetupRow icon={<FlaskConical className="h-4 w-4" aria-hidden />} label="Saved to">
                    {eligible && link ? (
                      <>
                        My Research › <strong>{link.workspace_name}</strong> / {link.folder_path || virtualBookingId}
                      </>
                    ) : eligible ? (
                      <span className="text-muted-foreground">Choose a My Research project</span>
                    ) : (
                      "Booking Details › Analyzed Data"
                    )}
                  </SetupRow>
                  <SetupRow icon={<HardDrive className="h-4 w-4" aria-hidden />} label="Input data">
                    {inputSummary ? (
                      inputSummary
                    ) : (
                      <span className="text-muted-foreground">
                        Not chosen yet{rawFileCount ? ` · this booking has ${plural(rawFileCount, "file")}` : ""}
                      </span>
                    )}
                  </SetupRow>
                  <SetupRow icon={<FolderOutput className="h-4 w-4" aria-hidden />} label="Results">
                    Save them in the <strong>Output</strong> folder on the Analysis PC
                    {setup?.output.pc_output_path || dataWorkspace?.output_path ? (
                      <code className="ml-1 break-all rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        {setup?.output.pc_output_path || String(dataWorkspace?.output_path)}
                      </code>
                    ) : null}
                    . They are copied to <strong>{destinationLabel}</strong> when you end the session
                    {setup?.output.auto_delete_after_verify ? ", then removed from the Analysis PC once the copy is verified" : ""}.
                  </SetupRow>

                  <SyncProgressPanel
                    status={sync}
                    targetLabel={syncTarget}
                    myResearchHref={syncHref}
                    onRetry={syncSupported ? syncNow : undefined}
                    retrying={syncing}
                  />

                  {started && syncSupported ? (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={syncNow} disabled={syncing}>
                      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                      Sync now
                    </Button>
                  ) : null}

                  {workflows.length > 1 ? (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</p>
                      <Select value={selectedWorkflow || selected?.id} onValueChange={setSelectedWorkflow}>
                        <SelectTrigger aria-label="Workflow">
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

              <div className="space-y-4">
                <Card className="border-slate-200/80 shadow-sm dark:border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Queue information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {queued ? (
                      <>
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your position</p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {queue.position != null
                              ? `${queue.position} of ${Math.max(queue.queue_size || queue.position, queue.position)}`
                              : "—"}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="rounded-lg border p-2">
                            <p className="text-xs text-muted-foreground">Estimated wait</p>
                            <p className="font-semibold">
                              {queue.estimated_wait_minutes != null ? `${queue.estimated_wait_minutes} min` : "—"}
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
                        {awaitingCheckin
                          ? "Your Analysis PC is reserved. Click Start Analysis before the check-in timer runs out."
                          : "You are not waiting in queue. You can start when ready."}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <EnvStat label="Available" value={queue.environments?.available ?? "—"} tone="ok" />
                      <EnvStat label="Busy" value={queue.environments?.busy ?? "—"} tone="busy" />
                      <EnvStat label="Offline" value={queue.environments?.offline ?? "—"} tone="wait" />
                      <EnvStat label="Waiting" value={queue.environments?.waiting ?? "—"} tone="wait" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-sky-200/70 bg-sky-50/80 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Session rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-sky-950/90 dark:text-sky-100/90">
                    <p>· Default session length is set per equipment (typically 30 minutes).</p>
                    <p>· Extend (+15 min) unlocks only when 2 minutes or less remain, and only if nobody else is waiting.</p>
                    <p>· Always click End Analysis when finished — do not only close the browser.</p>
                    <p>· Only the Output folder is kept. Everything else on the Analysis PC is cleaned before the next user.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="border-slate-200/80 shadow-sm dark:border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{catalogSelectable ? "Select analysis software" : "Available software"}</CardTitle>
                <CardDescription>
                  {catalogSelectable
                    ? "Choose software mapped to this equipment. The portal allocates the best available Analysis PC automatically."
                    : "Applications provided on this Analysis PC"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {softwareOptions.length ? (
                    softwareOptions.map((sw, idx) => (
                      <SoftwareCard
                        key={softwareOptionKey(sw) || `${String(sw.name)}-${idx}`}
                        sw={sw}
                        selectable={catalogSelectable}
                        selected={catalogSelectable && softwareOptionKey(sw) === selectedSoftwareKey}
                        onSelect={() => setSelectedSoftwareKey(softwareOptionKey(sw))}
                      />
                    ))
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
              {resultsReady && !link ? (
                <Button variant="secondary" asChild>
                  <Link to="/my-bookings">Download results</Link>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use <span className="font-medium text-foreground">Open Analysis PC</span> at the top of this page to connect.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {setupState !== "loading" ? (
        <AnalysisSetupDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          bookingId={bookingPk}
          setup={setupState === "ready" ? setup : null}
          legacy={{
            virtualId: virtualBookingId,
            equipmentName,
            fileCount: rawFileCount > 0 ? rawFileCount : summary?.raw_ready ? null : 0,
            outputPath: dataWorkspace?.output_path ? String(dataWorkspace.output_path) : null,
          }}
          onPrepared={onPrepared}
          title={setupComplete ? "Confirm your analysis setup" : undefined}
        />
      ) : null}
    </div>
  );
}

function SetupRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sky-500/15 dark:text-sky-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="leading-snug">{children}</div>
      </div>
    </div>
  );
}

function SoftwareCard({
  sw,
  selectable,
  selected,
  onSelect,
}: {
  sw: SoftwareOption;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = String(sw.display_name || sw.name || sw.software_name || "Software");
  const version = String(sw.version || sw.version_constraint || "");
  const description = String(
    sw.description ||
      sw.notes ||
      (selectable ? "Mapped for this equipment — PC selected automatically" : "Installed on this Analysis PC")
  );
  const typicalUsage = String(sw.typical_usage || "");
  const fileTypes = Array.isArray(sw.accepted_file_types)
    ? (sw.accepted_file_types as unknown[]).map(String)
    : Array.isArray(sw.file_types)
      ? (sw.file_types as unknown[]).map(String)
      : [];
  const aiTags = Array.isArray(sw.ai_tags) ? (sw.ai_tags as unknown[]).map(String) : [];
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const installedCount = num(sw.installed_count);
  const cardClass = cn(
    "flex gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-card",
    selectable
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      : "hover:-translate-y-0.5 hover:shadow-md",
    selected ? "border-primary ring-2 ring-primary/30" : "border-slate-200/80 dark:border-border"
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
        {selected ? <Badge className="ml-1 mt-1 text-[10px]">Selected</Badge> : null}
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        {typicalUsage ? <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">Typical use: {typicalUsage}</p> : null}
        {installedCount !== null ? (
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span>Installed: {installedCount}</span>
            <span>Online: {num(sw.online_count) ?? "—"}</span>
            <span>Available: {num(sw.available_count) ?? "—"}</span>
            <span>Busy: {num(sw.busy_count) ?? "—"}</span>
            <span>Offline: {num(sw.offline_count) ?? "—"}</span>
          </div>
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
  if (selectable) {
    return (
      <button type="button" onClick={onSelect} className={cardClass} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className={cardClass}>{body}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium leading-snug">{value}</p>
    </div>
  );
}

function EnvStat({ label, value, tone }: { label: string; value: string | number; tone: "ok" | "busy" | "wait" }) {
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
