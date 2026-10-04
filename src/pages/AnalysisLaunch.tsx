import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { AnalysisSetup, AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import {
  describeSync,
  isMissingEndpoint,
  isTransferPhase,
  legacySyncFromSummary,
  measureViewport,
  myResearchFolderHref,
} from "@/lib/analysisSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisWorkspaceChrome } from "@/components/analysis/AnalysisWorkspaceChrome";
import { DataWorkspaceBanner, type DataWorkspaceInfo } from "@/components/analysis/DataWorkspaceBanner";
import { AnalysisEnvironmentProgress } from "@/components/analysis/AnalysisEnvironmentProgress";
import { SyncProgressPanel } from "@/components/analysis/SyncProgressPanel";
import { useAnalysisLiveState } from "@/components/analysis/useAnalysisLiveState";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import IITRBanner from "@/components/IITRBanner";
import { useAdaptivePoll } from "@/hooks/use-adaptive-poll";
import { useCountdown } from "@/hooks/use-countdown";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";

type Phase = "prepare" | "desktop" | "closing";

type Experience = {
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  queue?: { is_queued?: boolean; position?: number | null; estimated_wait_minutes?: number | null };
  session?: {
    status?: string;
    remaining_seconds?: number | null;
    can_extend?: boolean;
    extension_minutes?: number;
    extend_blocked_reason?: string | null;
  };
  desktop_prepare?: Array<{ id: string; label: string; status: string }>;
  data_workspace?: DataWorkspaceInfo | null;
};

const READY_LIKE = new Set(["READY", "TOKEN_GENERATED", "LAUNCHED", "CONNECTING", "CONNECTED", "ACTIVE", "IDLE"]);
const PAINTED = new Set(["CONNECTED", "ACTIVE", "IDLE"]);
const LAUNCH_POLL_MS = 2500;
/** Re-POST launch even without a status change, in case the status endpoint cannot advance the session. */
const LAUNCH_SAFETY_REPOST_MS = 20000;
const LEGACY_SLOW_MS = 3 * 60 * 1000;
const HINT_VISIBLE_MS = 8000;

function resolveDesktopUrl(raw: string): string {
  try {
    return new URL(apiClient.resolveBackendUrl(raw), window.location.origin).toString();
  } catch {
    return raw;
  }
}

/** Extract one-time connect token + session id from a Portal launch_url. */
function parseLaunchConnect(launchUrl: string): { sessionId: string; token: string } | null {
  try {
    const u = new URL(resolveDesktopUrl(launchUrl), window.location.origin);
    const token = u.searchParams.get("t") || "";
    const match = u.pathname.match(/\/session\/([^/]+)\/connect\/?/i);
    const sessionId = match?.[1] || "";
    if (!token || !sessionId) return null;
    return { sessionId, token };
  } catch {
    return null;
  }
}

/**
 * Exchange Portal launch_url for a Guacamole client URL using authenticated API.
 * Never iframes /connect/ directly — SPA Token auth is not sent on iframe navigations.
 */
async function resolveGuacamoleDesktopUrl(launchUrl: string): Promise<string> {
  const parsed = parseLaunchConnect(launchUrl);
  if (!parsed) {
    if (/#\/client\//i.test(launchUrl) || /guacamole/i.test(launchUrl)) {
      return resolveDesktopUrl(launchUrl);
    }
    throw new Error("Invalid analysis launch URL — missing session token.");
  }
  const res = await apiClient.connectRemoteAnalysisSession(parsed.sessionId, parsed.token);
  if (res.error) {
    throw new Error(res.error);
  }
  const data = (res.data || {}) as Record<string, unknown>;
  const client = (data.client || {}) as Record<string, unknown>;
  const clientUrl =
    (typeof client.client_url === "string" && client.client_url) ||
    (typeof data.redirect_url === "string" && data.redirect_url) ||
    "";
  if (!clientUrl) {
    if (data.mock || data.mock_desktop) {
      return "";
    }
    throw new Error(
      "The Analysis PC could not start automatic login. Workstation credentials may be missing — contact your lab administrator."
    );
  }
  return resolveDesktopUrl(clientUrl);
}

/** Height taken by the compact chrome above the desktop (it wraps to two rows below lg). */
function reservedChromePx() {
  return window.innerWidth >= 1024 ? 64 : 112;
}

export default function AnalysisLaunchPage() {
  const { bookingId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const bookingPk = Number(bookingId);

  const [phase, setPhase] = useState<Phase>("prepare");
  const [sessionId, setSessionId] = useState<string | null>(search.get("session"));
  const [desktopUrl, setDesktopUrl] = useState<string | null>(null);
  const [desktopReady, setDesktopReady] = useState(false);
  /** After overlay clears, offer recovery if the remote canvas never paints (Welcome hang / dead RDP). */
  const [blankDesktopHint, setBlankDesktopHint] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<AnalysisSetup | null>(null);
  const [closingSince, setClosingSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const desktopResolved = useRef(false);
  const sessionIdRef = useRef<string | null>(sessionId);
  const lastLaunchAt = useRef(0);
  const launchPending = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const desktopSurfaceRef = useRef<HTMLDivElement>(null);
  const [bookingLabel, setBookingLabel] = useState<string>("");

  const live = useAnalysisLiveState(bookingPk, {
    summaryEveryMs: phase === "prepare" ? 10000 : null,
    legacySummaryEveryMs: phase === "prepare" ? 10000 : phase === "closing" ? 5000 : null,
  });
  const { summary, sync, syncSupported, refreshSummary, pollNow } = live;

  const experience = (summary?.experience || {}) as Experience;
  const sessionExp = experience.session || {};
  const queue = experience.queue || {};
  const prepareSteps = useMemo(() => experience.desktop_prepare || [], [experience.desktop_prepare]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const vid = String(experience.virtual_booking_id || summary?.virtual_booking_id || "").trim();
    if (vid) setBookingLabel(vid);
  }, [experience.virtual_booking_id, summary?.virtual_booking_id]);

  useEffect(() => {
    if (!Number.isFinite(bookingPk)) return;
    let alive = true;
    void apiClient.getBookings({ booking_id: bookingPk, limit: 1 }).then((bres) => {
      const row = bres.data?.bookings?.[0] as { virtual_booking_id?: string } | undefined;
      const vid = String(row?.virtual_booking_id || "").trim();
      if (alive && vid) setBookingLabel((prev) => prev || vid);
    });
    void apiClient.getBookingAnalysisSetup(bookingPk).then((res) => {
      if (alive && !res.error && res.data) setSetup(res.data);
      else if (res.error && !isMissingEndpoint(res)) console.warn("Analysis setup unavailable:", res.error);
    });
    return () => {
      alive = false;
    };
  }, [bookingPk]);

  const postLaunch = useCallback(async () => {
    lastLaunchAt.current = Date.now();
    const viewport = measureViewport(desktopSurfaceRef.current, reservedChromePx());
    const res = await apiClient.launchBookingAnalysisDesktop(bookingPk, { viewport });
    if (res.error) {
      setError(res.error);
      return;
    }
    const data = res.data || {};
    if (typeof data.session_id === "string") setSessionId(data.session_id);
    launchPending.current = Boolean(data.launch_pending);
    const failure = data.failure as { user_message?: string; failure_category?: string } | undefined;
    if (failure?.user_message) {
      const cat = failure.failure_category ? `[${failure.failure_category}] ` : "";
      setError(`${cat}${failure.user_message}`);
      if (failure.failure_category === "credentials" || /credentials/i.test(failure.user_message)) {
        desktopResolved.current = true;
      }
      return;
    } else if (data.launch_pending && data.detail) {
      setError(String(data.detail));
    }
    if (typeof data.status === "string" && data.status === "FAILED") {
      setError(String(data.detail || "Preparing the Analysis PC failed."));
      desktopResolved.current = true;
      return;
    }
    if (typeof data.launch_url === "string" && data.launch_url) {
      try {
        const guacUrl = await resolveGuacamoleDesktopUrl(data.launch_url);
        if (guacUrl) {
          desktopResolved.current = true;
          setDesktopUrl(guacUrl);
          setError(null);
        } else if (data.mock) {
          desktopResolved.current = true;
          setDesktopReady(true);
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to open the Analysis PC";
        setError(message);
        if (/credentials/i.test(message) && !/tunnel|secure link|not ready|try again/i.test(message)) {
          desktopResolved.current = true;
        }
      }
    }
  }, [bookingPk]);

  // The launch POST re-runs server-side setup, so while the PC prepares we poll the cheap session
  // status (which also advances preparation) and only POST again when a launch URL can be issued.
  const pollLaunchNow = useAdaptivePoll(
    async () => {
      if (desktopResolved.current) return 15000;
      const sid = sessionIdRef.current;
      const sinceLast = Date.now() - lastLaunchAt.current;
      let shouldPost = !sid || launchPending.current || sinceLast >= LAUNCH_SAFETY_REPOST_MS;
      if (sid && !shouldPost) {
        const st = await apiClient.getRemoteAnalysisSessionStatus(sid);
        const status = String((st.data as { status?: string } | undefined)?.status || "").toUpperCase();
        if (PAINTED.has(status)) setDesktopReady(true);
        if (READY_LIKE.has(status) || status === "FAILED") shouldPost = true;
      }
      if (shouldPost && sinceLast >= (launchPending.current ? 5000 : LAUNCH_POLL_MS)) await postLaunch();
      return LAUNCH_POLL_MS;
    },
    { enabled: phase === "prepare" && Number.isFinite(bookingPk), fallbackDelayMs: LAUNCH_POLL_MS },
  );

  // Enter desktop phase once URL exists — branded prepare covers the wait.
  useEffect(() => {
    if (phase !== "prepare" || !desktopUrl) return;
    const t = window.setTimeout(() => setPhase("desktop"), 400);
    return () => window.clearTimeout(t);
  }, [desktopUrl, phase]);

  // Keep branded overlay until iframe has loaded + a short settle, not only portal ACTIVE.
  useEffect(() => {
    if (phase !== "desktop" || desktopReady) return;
    const t = window.setTimeout(() => setDesktopReady(true), 12000);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady]);

  // If the canvas stays black after the overlay (console session steals RDP, agent < 1.0.22), offer recovery.
  useEffect(() => {
    if (phase !== "desktop" || !desktopReady || !desktopUrl) {
      setBlankDesktopHint(false);
      return;
    }
    setBlankDesktopHint(false);
    const t = window.setTimeout(() => setBlankDesktopHint(true), 8000);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady, desktopUrl]);

  useEffect(() => {
    if (phase !== "desktop" || !desktopReady) return;
    setHintVisible(true);
    const t = window.setTimeout(() => setHintVisible(false), HINT_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady]);

  const reconnectDesktop = useCallback(async () => {
    desktopResolved.current = false;
    lastLaunchAt.current = 0;
    setDesktopUrl(null);
    setDesktopReady(false);
    setBlankDesktopHint(false);
    setPhase("prepare");
    setError("Reconnecting to the Analysis PC…");
    pollLaunchNow();
  }, [pollLaunchNow]);

  const requestDesktopFullscreen = useCallback(async () => {
    const target = desktopSurfaceRef.current || iframeRef.current;
    if (!target) {
      toast.error("The desktop is not ready yet. Wait a moment, then try Fullscreen again.");
      return;
    }
    const req =
      target.requestFullscreen?.bind(target) ||
      (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }).webkitRequestFullscreen?.bind(target);
    if (!req) {
      toast.error("This browser does not support fullscreen for the Analysis PC.");
      return;
    }
    try {
      await Promise.resolve(req());
      window.setTimeout(() => {
        try {
          window.dispatchEvent(new Event("resize"));
          iframeRef.current?.contentWindow?.dispatchEvent(new Event("resize"));
        } catch {
          /* cross-origin remote desktop */
        }
      }, 250);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fullscreen request was blocked.";
      toast.error(`${msg} Try the browser’s fullscreen (F11), or click Reconnect if the desktop is blank.`);
    }
  }, []);

  const serverRemaining =
    typeof sessionExp.remaining_seconds === "number"
      ? sessionExp.remaining_seconds
      : typeof (summary?.session as { remaining_seconds?: unknown } | undefined)?.remaining_seconds === "number"
        ? ((summary?.session as { remaining_seconds: number }).remaining_seconds)
        : null;
  const remaining = useCountdown(serverRemaining);

  const enterClosing = useCallback(() => {
    setPhase("closing");
    setClosingSince(Date.now());
  }, []);

  useEffect(() => {
    if (phase === "desktop" && remaining != null && remaining <= 0) enterClosing();
  }, [remaining, phase, enterClosing]);

  useEffect(() => {
    if (phase === "closing") pollNow();
  }, [phase, pollNow]);

  useEffect(() => {
    if (phase !== "closing" || syncSupported !== false) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [phase, syncSupported]);

  const warn = useMemo(() => {
    if (remaining == null) return null;
    const mins = Math.ceil(remaining / 60);
    return [10, 5, 2, 1].find((m) => mins <= m && remaining > 0) ?? null;
  }, [remaining]);

  const endAnalysis = async () => {
    if (!window.confirm("End analysis now? Your Output folder is copied and the Analysis PC is freed for the next user.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.endBookingAnalysis(bookingPk);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      enterClosing();
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

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.syncBookingAnalysisNow(bookingPk);
      if (res.status === 409) toast.message("Sync is available while your analysis session is running.");
      else if (res.error) toast.error(res.error);
      else toast.success("Copying your Output folder now.");
      pollNow();
    } finally {
      setSyncing(false);
    }
  };

  /** User-facing provisioning ladder — never mention Guacamole / tunnels. */
  const provisionSteps = useMemo(() => {
    const sessionStatus = String(
      (summary?.session as { status?: string } | undefined)?.status || sessionExp.status || ""
    ).toUpperCase();
    const readyLike = READY_LIKE.has(sessionStatus);
    const allocated = readyLike || Boolean(desktopUrl) || prepareSteps.some((s) => s.status === "done");
    const connecting =
      Boolean(desktopUrl) || ["CONNECTING", "CONNECTED", "ACTIVE", "IDLE", "LAUNCHED"].includes(sessionStatus) || phase === "desktop";
    const loadingEnv = desktopReady || PAINTED.has(sessionStatus);

    if (prepareSteps.length >= 3) {
      return prepareSteps.map((s) => ({
        id: String(s.id),
        label: String(s.label).replace(/guacamole/gi, "remote desktop"),
        status: String(s.status || "pending"),
      }));
    }

    return [
      { id: "prepare-ws", label: "Preparing Analysis PC", status: allocated ? "done" : "active" },
      { id: "alloc", label: "Analysis PC allocated", status: allocated ? "done" : "pending" },
      { id: "software", label: "Software verified", status: allocated ? "done" : "pending" },
      { id: "session", label: "Starting analysis session", status: connecting ? "done" : allocated ? "active" : "pending" },
      { id: "connect", label: "Connecting remote desktop", status: loadingEnv ? "done" : connecting ? "active" : "pending" },
      { id: "load", label: "Loading desktop", status: loadingEnv ? "done" : connecting ? "active" : "pending" },
    ];
  }, [prepareSteps, desktopUrl, desktopReady, phase, summary?.session, sessionExp.status]);

  if (!Number.isFinite(bookingPk)) {
    return <div className="p-8">Invalid booking.</div>;
  }

  const virtualId = String(experience.virtual_booking_id || summary?.virtual_booking_id || bookingLabel || "").trim() || String(bookingPk);
  const equipment = experience.equipment_name || experience.equipment_code || "Equipment";
  const eligible = Boolean(setup?.my_research.eligible);
  const link = setup?.my_research.current_link ?? null;
  const destinationLabel = setup?.output.destination_label || "Booking Details › Analyzed Data";
  const targetLabel = eligible ? "Processed Data" : "Analyzed Data";
  const outputPath = setup?.output.pc_output_path || experience.data_workspace?.output_path || "";
  const myResearchHref = myResearchFolderHref(
    sync?.destination?.workspace_id || link?.workspace_id,
    sync?.destination?.folder_id || link?.processed_folder_id,
  );
  const liveTransfer = syncSupported && sync && isTransferPhase(sync.phase) ? describeSync(sync, targetLabel) : null;

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background dark:from-slate-950",
        phase === "desktop" && "h-[100dvh] overflow-hidden",
      )}
    >
      {phase === "desktop" && (
        <AnalysisWorkspaceChrome
          compact
          equipmentName={equipment}
          bookingLabel={virtualId}
          remainingSeconds={remaining}
          ticking={false}
          showSessionControls
          canExtend={Boolean(sessionExp.can_extend)}
          extendMinutes={Number(sessionExp.extension_minutes || 15)}
          extendBlockedReason={sessionExp.extend_blocked_reason ? String(sessionExp.extend_blocked_reason) : null}
          busy={busy}
          onExtend={extendSession}
          onEnd={endAnalysis}
          showEnd
          showReturnToDashboard
          confirmLeaveSession
          rightSlot={
            syncSupported ? (
              <div className="flex items-center gap-2">
                {liveTransfer ? (
                  <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground xl:inline" role="status" aria-live="polite">
                    {liveTransfer.percent != null ? `Syncing ${liveTransfer.percent}%` : liveTransfer.detail || "Syncing…"}
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={syncNow}
                  disabled={syncing || Boolean(liveTransfer)}
                  title={`Copy the Output folder to ${destinationLabel} now`}
                >
                  {syncing || liveTransfer ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                  Sync now
                </Button>
              </div>
            ) : null
          }
        />
      )}
      {phase === "desktop" && warn != null ? (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:text-amber-200">
          {warn} minute{warn === 1 ? "" : "s"} remaining
          {sessionExp.extend_blocked_reason ? ` · ${sessionExp.extend_blocked_reason}` : ""}
          {" · Save results to the Output folder"}
        </div>
      ) : null}
      {phase === "prepare" && (
        <div className="border-b border-slate-200/80 bg-white/95 px-4 py-2 dark:border-border dark:bg-background/95">
          <div className="mx-auto max-w-5xl">
            <DataWorkspaceBanner compact={false} showDataRoot={false} data={experience.data_workspace || null} />
          </div>
        </div>
      )}

      {phase === "prepare" && (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col justify-center gap-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm font-medium text-slate-600 dark:text-muted-foreground">
              {equipment} · Booking {virtualId}
            </p>
            <BackToDashboardButton
              variant="outline"
              size="sm"
              label="Return to Dashboard"
              confirmMessage="Leave while the Analysis PC is preparing?\n\nYour session will continue in the background. You can reopen it from your booking."
            />
          </div>

          <Card className="overflow-hidden border-slate-200/80 shadow-lg dark:border-border">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex justify-center">
                <IITRBanner size="sm" />
              </div>
              <AnalysisEnvironmentProgress
                title="Preparing your Analysis PC"
                subtitle="It opens automatically when ready. Please keep this tab open."
                steps={provisionSteps}
                onCancel={() => navigate(`/analysis-workspace/${bookingPk}`)}
                cancelLabel="Cancel"
              />

              {syncSupported && sync?.direction === "input" ? <SyncProgressPanel status={sync} /> : null}

              {queue.is_queued ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold">You are in the queue</p>
                  <p className="mt-1 text-muted-foreground">
                    Position {queue.position ?? "—"} · Est. wait {queue.estimated_wait_minutes ?? "—"} min
                  </p>
                </div>
              ) : null}

              {error ? <p className="text-center text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/analysis-workspace/${bookingPk}`}>Back to Analysis Workspace</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Save your results in the Output folder shown above. It is copied to {destinationLabel} when you end the session.
          </p>
        </div>
      )}

      {phase === "desktop" && (
        <div ref={desktopSurfaceRef} className="relative min-h-0 flex-1 bg-black">
          {!desktopReady && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90">
              <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-card sm:p-7">
                <div className="mb-4 flex justify-center">
                  <IITRBanner size="sm" />
                </div>
                <AnalysisEnvironmentProgress
                  compact
                  title="Connecting to your Analysis PC"
                  subtitle="Finalizing your secure connection. This opens automatically."
                  steps={provisionSteps}
                  onCancel={() => navigate(`/analysis-workspace/${bookingPk}`)}
                  cancelLabel="Cancel"
                />
                {error ? <p className="mt-3 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
              </div>
            </div>
          )}
          {desktopReady && blankDesktopHint ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[10050] flex justify-center px-3">
              <div className="pointer-events-auto max-w-xl rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-xl dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-50">
                <p className="font-semibold">Desktop looks blank?</p>
                <p className="mt-1 text-xs opacity-90">
                  The remote desktop waits while the Analysis PC's own screen is unlocked for the same Windows user. Do{" "}
                  <strong>not</strong> use the Analysis PC keyboard/screen during the session. If someone unlocked it, lock it
                  again (Win+L), then click <strong>Reconnect</strong>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="h-8" onClick={() => void reconnectDesktop()}>
                    Reconnect
                  </Button>
                  <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => void requestDesktopFullscreen()}>
                    Fullscreen
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setBlankDesktopHint(false)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {desktopUrl ? (
            <>
              <iframe
                ref={iframeRef}
                title="Analysis PC"
                src={desktopUrl}
                className="absolute inset-0 h-full w-full border-0 bg-black"
                style={{ touchAction: "none" }}
                allow="clipboard-read; clipboard-write; fullscreen"
                allowFullScreen
                onLoad={() => {
                  window.setTimeout(() => {
                    setDesktopReady(true);
                    try {
                      window.dispatchEvent(new Event("resize"));
                      iframeRef.current?.contentWindow?.dispatchEvent(new Event("resize"));
                    } catch {
                      /* cross-origin remote desktop — ignore */
                    }
                  }, 800);
                }}
              />
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[10050] flex flex-wrap items-end justify-between gap-2 sm:bottom-4 sm:left-4 sm:right-4">
                {hintVisible ? (
                  <div className="pointer-events-auto max-w-[70%] rounded-md bg-black/80 px-2 py-1 text-[10px] text-amber-50 sm:text-xs" data-testid="desktop-hint">
                    Save results in{" "}
                    <span className="font-mono">{outputPath || "the Output folder"}</span> — it is copied to {destinationLabel} when you
                    end the session.
                  </div>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto h-8 shadow-lg"
                    onClick={() => void requestDesktopFullscreen()}
                  >
                    Fullscreen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto h-8 shadow-lg"
                    onClick={() => void reconnectDesktop()}
                  >
                    Reconnect
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-muted-foreground">Preparing your Analysis PC…</div>
          )}
        </div>
      )}

      {phase === "closing" && (
        <FinishScreen
          equipment={equipment}
          virtualId={virtualId}
          bookingPk={bookingPk}
          status={
            syncSupported === false
              ? legacySyncFromSummary(summary)
              : sync
          }
          legacy={syncSupported === false}
          slow={syncSupported === false && closingSince != null && now - closingSince > LEGACY_SLOW_MS}
          targetLabel={targetLabel}
          destinationLabel={destinationLabel}
          myResearchHref={eligible ? myResearchHref : null}
          onRetry={syncSupported ? syncNow : undefined}
          retrying={syncing}
        />
      )}
    </div>
  );
}

const WAITING: AnalysisSyncStatus = {
  phase: "collecting",
  direction: "output",
  percent: null,
  bytes_done: null,
  bytes_total: null,
  files_done: 0,
  files_total: null,
  current_file: null,
  message: "Waiting for the Analysis PC to send your results",
  verified: false,
  pc_cleanup: null,
  kept_files: [],
  destination: null,
  updated_at: null,
  poll_after_ms: 2000,
};

function FinishScreen({
  equipment,
  virtualId,
  bookingPk,
  status,
  legacy,
  slow,
  targetLabel,
  destinationLabel,
  myResearchHref,
  onRetry,
  retrying,
}: {
  equipment: string;
  virtualId: string;
  bookingPk: number;
  status: AnalysisSyncStatus | null;
  legacy: boolean;
  slow: boolean;
  targetLabel: string;
  destinationLabel: string;
  myResearchHref: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const shown = status && describeSync(status, targetLabel).tone !== "idle" ? status : WAITING;
  const tone = describeSync(shown, targetLabel).tone;
  const title = tone === "done" ? "Results saved" : tone === "failed" ? "Some results need attention" : "Saving your results";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 p-6" data-testid="finish-screen">
      <div className="text-center">
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
            tone === "done" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
            tone === "failed" && "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            tone === "progress" && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
          )}
        >
          {tone === "done" ? (
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          ) : tone === "failed" ? (
            <AlertTriangle className="h-7 w-7" aria-hidden />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {equipment} · Booking {virtualId}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5 text-sm">
          <SyncProgressPanel status={shown} targetLabel={targetLabel} onRetry={onRetry} retrying={retrying} />
          {tone === "progress" ? (
            <p className="text-muted-foreground">
              Your Output folder is being copied to <strong className="text-foreground">{destinationLabel}</strong>. You can leave
              this page — copying continues in the background.
            </p>
          ) : null}
          {legacy && tone === "done" ? (
            <p className="text-muted-foreground">
              Results are in <strong className="text-foreground">{destinationLabel}</strong>.
            </p>
          ) : null}
          {slow && tone === "progress" ? (
            <p className="text-muted-foreground">
              This is taking longer than usual. Results appear in {destinationLabel} when the copy finishes. If you saved files on the
              Analysis PC and they don't appear, contact the lab team.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        {myResearchHref && tone === "done" ? (
          <Button size="lg" asChild>
            <Link to={myResearchHref}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Open in My Research
            </Link>
          </Button>
        ) : !myResearchHref ? (
          <Button size="lg" asChild variant={tone === "done" ? "default" : "outline"}>
            <Link to="/my-bookings">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Booking Details
            </Link>
          </Button>
        ) : null}
        <Button size="lg" variant="outline" asChild>
          <Link to={`/analysis-workspace/${bookingPk}`}>Return to Analysis Workspace</Link>
        </Button>
      </div>
    </div>
  );
}
