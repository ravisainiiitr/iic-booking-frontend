import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AnalysisWorkspaceChrome } from "@/components/analysis/AnalysisWorkspaceChrome";
import { DataWorkspaceBanner } from "@/components/analysis/DataWorkspaceBanner";
import { AnalysisEnvironmentProgress } from "@/components/analysis/AnalysisEnvironmentProgress";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import IITRBanner from "@/components/IITRBanner";
import {
  Check,
  Clock3,
  Download,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type Phase = "prepare" | "desktop" | "closing" | "results";

type Experience = {
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  journey?: Array<{ id: string; status: string; label?: string; timestamp?: string | null; detail?: string }>;
  queue?: any;
  session?: any;
  workspace?: any;
  sync_pipeline?: any[];
  desktop_prepare?: Array<{ id: string; label: string; status: string }>;
  results?: any;
  cleanup?: any;
  input_choice?: any;
  poll_interval_seconds?: number;
};

const CLOSING_STEPS = [
  { id: "closed", label: "Desktop Closed" },
  { id: "collect", label: "Collecting Results" },
  { id: "sync", label: "Synchronizing Results" },
  { id: "portal", label: "Uploading to Portal" },
  { id: "cloud", label: "Uploading to Cloud Storage" },
  { id: "clean", label: "Cleaning Workspace" },
  { id: "downloads", label: "Preparing Downloads" },
];

function formatHMS(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatBytes(n?: number) {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

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
    // Legacy absolute Guacamole URL already returned
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
      // Keep prepare overlay / mock message — no Guacamole iframe needed
      return "";
    }
    throw new Error(
      "Analysis Environment could not start automatic login. Workstation credentials may be missing — contact your lab administrator."
    );
  }
  return resolveDesktopUrl(clientUrl);
}

export default function AnalysisLaunchPage() {
  const { bookingId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const bookingPk = Number(bookingId);

  const [phase, setPhase] = useState<Phase>("prepare");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(search.get("session"));
  const [desktopUrl, setDesktopUrl] = useState<string | null>(null);
  const [desktopReady, setDesktopReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closingStep, setClosingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const launchAttempted = useRef(false);
  const desktopResolved = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [bookingLabel, setBookingLabel] = useState<string>("");

  const experience = (summary?.experience || {}) as Experience;
  const sessionExp = experience.session || {};
  const queue = experience.queue || {};
  const results = experience.results || {};
  const workspace = experience.workspace || {};
  const input = experience.input_choice || {};
  const prepareSteps = experience.desktop_prepare || [];

  const refreshSummary = useCallback(async () => {
    if (!Number.isFinite(bookingPk)) return null;
    const res = await apiClient.getBookingAnalysis(bookingPk);
    if (res.error) return null;
    const data = (res.data || {}) as Record<string, unknown>;
    setSummary(data);
    const exp = (data.experience || {}) as Experience;
    const vid = String(exp.virtual_booking_id || data.virtual_booking_id || "").trim();
    if (vid) setBookingLabel(vid);
    return data;
  }, [bookingPk]);

  const pollLaunch = useCallback(async () => {
    if (!Number.isFinite(bookingPk)) return;
    // Already exchanged Portal launch token → Guacamole client URL.
    if (desktopResolved.current) {
      await refreshSummary();
      return;
    }
    const res = await apiClient.launchBookingAnalysisDesktop(bookingPk);
    if (res.error) {
      setError(res.error);
      return;
    }
    const data = res.data || {};
    if (typeof data.session_id === "string") setSessionId(data.session_id);
    const failure = data.failure as
      | { user_message?: string; detail?: string; failure_category?: string; failed_stage?: string }
      | undefined;
    if (failure?.user_message) {
      const cat = failure.failure_category ? `[${failure.failure_category}] ` : "";
      setError(`${cat}${failure.user_message}`);
    } else if (data.launch_pending && data.detail) {
      setError(String(data.detail));
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
        const message = err instanceof Error ? err.message : "Failed to open Analysis Environment";
        setError(message);
      }
    }
    await refreshSummary();
  }, [bookingPk, refreshSummary]);

  // Initial load + auto prepare
  useEffect(() => {
    if (!Number.isFinite(bookingPk)) return;
    void (async () => {
      // Prefer virtual booking id for chrome even before experience payload arrives.
      try {
        const bres = await apiClient.getBookings({ booking_id: bookingPk, limit: 1 });
        const row = bres.data?.bookings?.[0] as
          | { virtual_booking_id?: string; booking_id?: string | number }
          | undefined;
        const vid = String(row?.virtual_booking_id || "").trim();
        if (vid) setBookingLabel(vid);
      } catch {
        /* ignore */
      }
      await refreshSummary();
      if (!launchAttempted.current) {
        launchAttempted.current = true;
        await pollLaunch();
      }
    })();
  }, [bookingPk, refreshSummary, pollLaunch]);

  // Poll while preparing
  useEffect(() => {
    if (phase !== "prepare" || !Number.isFinite(bookingPk)) return;
    const id = window.setInterval(() => {
      void (async () => {
        await pollLaunch();
        if (sessionId) {
          const st = await apiClient.getRemoteAnalysisSessionStatus(sessionId);
          const status = String((st.data as any)?.status || "");
          if (["READY", "TOKEN_GENERATED", "LAUNCHED", "CONNECTING", "CONNECTED", "ACTIVE"].includes(status)) {
            // keep polling launch_url
          }
          if (["CONNECTED", "ACTIVE", "IDLE"].includes(status)) {
            setDesktopReady(true);
          }
        }
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [phase, bookingPk, pollLaunch, sessionId]);

  // Enter desktop phase once URL exists — branded prepare covers the wait; never surface Guacamole UI.
  useEffect(() => {
    if (phase !== "prepare" || !desktopUrl) return;
    const status = String(
      (summary?.session as any)?.status || sessionExp.status || ""
    );
    const canEnter = [
      "READY",
      "TOKEN_GENERATED",
      "LAUNCHED",
      "CONNECTING",
      "CONNECTED",
      "ACTIVE",
      "IDLE",
    ].includes(status) || Boolean(desktopUrl);
    if (!canEnter) return;
    // Short handoff into desktop with branded overlay until CONNECTED/ACTIVE.
    const t = window.setTimeout(() => setPhase("desktop"), 400);
    return () => window.clearTimeout(t);
  }, [desktopUrl, phase, summary, sessionExp.status]);

  // Keep branded overlay until session is interactive (hides underlying connection chrome).
  useEffect(() => {
    if (phase !== "desktop") return;
    const status = String(
      (summary?.session as any)?.status || sessionExp.status || ""
    );
    if (["CONNECTED", "ACTIVE", "IDLE"].includes(status)) {
      setDesktopReady(true);
      return;
    }
    if (desktopReady) return;
    const t = window.setTimeout(() => setDesktopReady(true), 18000);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady, summary, sessionExp.status]);

  // Live remaining timer from experience
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const r =
      typeof sessionExp.remaining_seconds === "number"
        ? sessionExp.remaining_seconds
        : typeof (summary?.session as any)?.remaining_seconds === "number"
          ? (summary?.session as any).remaining_seconds
          : null;
    setRemaining(r);
  }, [sessionExp.remaining_seconds, summary]);

  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((x) => (x == null ? x : Math.max(0, x - 1))), 1000);
    return () => window.clearInterval(id);
  }, [remaining == null]);

  // Expiry → closing flow
  useEffect(() => {
    if (phase !== "desktop" || remaining == null) return;
    if (remaining > 0) return;
    setPhase("closing");
  }, [remaining, phase]);

  // Closing animation sequence then results
  useEffect(() => {
    if (phase !== "closing") return;
    setClosingStep(0);
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setClosingStep(step);
      if (step >= CLOSING_STEPS.length - 1) {
        window.clearInterval(id);
        void refreshSummary().then(() => setPhase("results"));
      }
    }, 900);
    return () => window.clearInterval(id);
  }, [phase, refreshSummary]);

  const warn = useMemo(() => {
    if (remaining == null) return null;
    const mins = Math.ceil(remaining / 60);
    return [10, 5, 2, 1].find((m) => mins <= m && remaining > 0) ?? null;
  }, [remaining]);

  const endAnalysis = async () => {
    if (!window.confirm("End analysis now? Results will be collected and the workspace cleaned.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.endBookingAnalysis(bookingPk);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setPhase("closing");
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
        await refreshSummary();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(bookingPk)) {
    return <div className="p-8">Invalid booking.</div>;
  }

  const virtualId = String(
    experience.virtual_booking_id ||
      summary?.virtual_booking_id ||
      bookingLabel ||
      ""
  ).trim() || String(bookingPk);
  const equipment = experience.equipment_name || experience.equipment_code || "Equipment";

  /** User-facing provisioning ladder — never mention Guacamole / tunnels. */
  const provisionSteps = useMemo(() => {
    const sessionStatus = String(
      (summary?.session as { status?: string } | undefined)?.status || sessionExp.status || ""
    ).toUpperCase();
    const readyLike = [
      "READY",
      "TOKEN_GENERATED",
      "LAUNCHED",
      "CONNECTING",
      "CONNECTED",
      "ACTIVE",
      "IDLE",
    ].includes(sessionStatus);
    const allocated = readyLike || Boolean(desktopUrl) || prepareSteps.some((s) => s.status === "done");
    const connecting =
      Boolean(desktopUrl) ||
      ["CONNECTING", "CONNECTED", "ACTIVE", "IDLE", "LAUNCHED"].includes(sessionStatus) ||
      phase === "desktop";
    const loadingEnv =
      desktopReady || ["CONNECTED", "ACTIVE", "IDLE"].includes(sessionStatus);

    // Prefer API desktop_prepare when present; otherwise branded ladder.
    if (prepareSteps.length >= 3) {
      return prepareSteps.map((s) => ({
        id: String(s.id),
        label: String(s.label).replace(/guacamole/gi, "remote desktop"),
        status: String(s.status || "pending"),
      }));
    }

    return [
      {
        id: "prepare-ws",
        label: "Preparing workstation",
        status: allocated ? "done" : "active",
      },
      {
        id: "alloc",
        label: "Workstation allocated",
        status: allocated ? "done" : "pending",
      },
      {
        id: "software",
        label: "Software verified",
        status: allocated ? "done" : "pending",
      },
      {
        id: "session",
        label: "Starting analysis session",
        status: connecting ? "done" : allocated ? "active" : "pending",
      },
      {
        id: "connect",
        label: "Connecting remote desktop",
        status: loadingEnv ? "done" : connecting ? "active" : "pending",
      },
      {
        id: "load",
        label: "Loading environment",
        status: loadingEnv ? "done" : connecting ? "active" : "pending",
      },
    ];
  }, [
    prepareSteps,
    desktopUrl,
    desktopReady,
    phase,
    summary?.session,
    sessionExp.status,
  ]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background dark:from-slate-950">
      {/* Fixed chrome during desktop */}
      {phase === "desktop" && (
        <AnalysisWorkspaceChrome
          compact
          equipmentName={equipment}
          bookingLabel={virtualId}
          remainingSeconds={remaining}
          showSessionControls
          canExtend={Boolean(sessionExp.can_extend)}
          extendMinutes={Number(sessionExp.extension_minutes || 15)}
          extendBlockedReason={
            sessionExp.extend_blocked_reason ? String(sessionExp.extend_blocked_reason) : null
          }
          busy={busy}
          onExtend={extendSession}
          onEnd={endAnalysis}
          showEnd
          showReturnToDashboard
          confirmLeaveSession
        />
      )}
      {phase === "desktop" && warn != null ? (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:text-amber-200">
          {warn} minute{warn === 1 ? "" : "s"} remaining
          {sessionExp.extend_blocked_reason ? ` · ${sessionExp.extend_blocked_reason}` : ""}
          {" · Save results to the Output folder"}
        </div>
      ) : null}
      {/* R9: keep Input/Output paths visible during prepare + live desktop (not only after Guacamole paints). */}
      {(phase === "prepare" || phase === "desktop") && (
        <div className="border-b border-slate-200/80 bg-white/95 px-4 py-2 dark:border-border dark:bg-background/95">
          <div className={cn("mx-auto", phase === "prepare" ? "max-w-5xl" : "max-w-[1800px]")}>
            <DataWorkspaceBanner
              compact={phase === "desktop"}
              data={(experience as any)?.data_workspace || null}
            />
          </div>
        </div>
      )}

      {phase === "prepare" && (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col justify-center gap-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
                {equipment} · Booking {virtualId}
              </p>
            </div>
            <BackToDashboardButton
              variant="outline"
              size="sm"
              label="Return to Dashboard"
              confirmMessage="Leave while the Analysis Environment is preparing?\n\nYour session will continue in the background. You can reopen it from your booking."
            />
          </div>

          <Card className="overflow-hidden border-slate-200/80 shadow-lg dark:border-border">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex justify-center">
                <IITRBanner size="sm" />
              </div>
              <AnalysisEnvironmentProgress
                title="Preparing Analysis Environment"
                subtitle="Your Analysis PC opens automatically when ready. Please keep this tab open."
                steps={provisionSteps}
                onCancel={() => navigate(`/analysis-workspace/${bookingPk}`)}
                cancelLabel="Cancel"
              />

              {queue.is_queued ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold">You are in the execution queue</p>
                  <p className="mt-1 text-muted-foreground">
                    Position {queue.position ?? "—"} · Est. wait {queue.estimated_wait_minutes ?? "—"}{" "}
                    min
                  </p>
                </div>
              ) : null}

              {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/analysis-workspace/${bookingPk}`}>Back to workspace</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Input and Output folders are shown above — use them on the Analysis PC once connected.
          </p>
        </div>
      )}

      {phase === "desktop" && (
        <div className="relative flex h-[calc(100vh-9.5rem)] flex-col">
          {!desktopReady && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 backdrop-blur-md">
              <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-card sm:p-7">
                <div className="mb-4 flex justify-center">
                  <IITRBanner size="sm" />
                </div>
                <AnalysisEnvironmentProgress
                  compact
                  title="Connecting Analysis Environment"
                  subtitle="Finalizing your secure Analysis PC connection. This opens automatically."
                  steps={provisionSteps}
                  onCancel={() => navigate(`/analysis-workspace/${bookingPk}`)}
                  cancelLabel="Cancel"
                />
                {error ? <p className="mt-3 text-center text-sm text-rose-600">{error}</p> : null}
              </div>
            </div>
          )}
          {desktopUrl ? (
            <iframe
              ref={iframeRef}
              title="Analysis Environment"
              src={desktopUrl}
              className="h-full w-full border-0 bg-black"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
              Preparing Analysis Environment…
            </div>
          )}
        </div>
      )}

      {phase === "closing" && (
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
          <div className="text-center">
            <Clock3 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 text-2xl font-semibold">Closing Analysis Environment</h1>
            <p className="mt-1 text-muted-foreground">
              Collecting results and cleaning the workspace. Please wait…
            </p>
          </div>
          <Card>
            <CardContent className="space-y-3 p-6">
              {CLOSING_STEPS.map((s, idx) => {
                const done = idx < closingStep;
                const active = idx === closingStep;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    {done ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border" />
                    )}
                    <span className={cn("text-sm", active && "font-semibold")}>{s.label}</span>
                  </div>
                );
              })}
              <Progress value={((closingStep + 1) / CLOSING_STEPS.length) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "results" && (
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-3xl font-semibold">Results Ready</h1>
            <p className="mt-2 text-muted-foreground">
              Your analysis results are available. The Analysis Environment workspace has been cleaned
              for privacy.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Results summary</CardTitle>
              <CardDescription>
                {equipment} · {virtualId}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Input files" value={String((workspace.input as any)?.file_count ?? "—")} />
              <InfoTile
                label="Output files"
                value={String(results.file_count ?? (workspace.output as any)?.file_count ?? "—")}
              />
              <InfoTile
                label="Output size"
                value={formatBytes(results.total_size_bytes ?? (workspace.output as any)?.total_size_bytes)}
              />
              <InfoTile label="Cleanup" value={experience.cleanup?.message || "Workspace cleaned"} />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                Workspace successfully cleaned
              </p>
              <p className="text-muted-foreground">
                Uploaded RAW files, additional uploads, temporary files, and generated files have been
                removed from the Analysis Environment. Only synchronized Portal / cloud copies remain.
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/my-bookings">
                <Download className="mr-2 h-4 w-4" />
                Download Results
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to={`/analysis-workspace/${bookingPk}`}>Return to Workspace</Link>
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate(-1)}>
              Return to Booking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium leading-snug">{value}</p>
    </div>
  );
}
