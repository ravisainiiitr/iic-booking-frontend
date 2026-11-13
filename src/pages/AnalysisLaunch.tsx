import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  PC_FILES_CAPABILITY,
  PC_FOLDERS_CAPABILITY,
  type AnalysisSetup,
  type AnalysisSyncStatus,
  type InputPlacementStatus,
} from "@/lib/analysisSetupTypes";
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
import { chosenItems } from "@/lib/pcFolders";
import { cn } from "@/lib/utils";
import { AnalysisWorkspaceChrome } from "@/components/analysis/AnalysisWorkspaceChrome";
import type { DataWorkspaceInfo } from "@/components/analysis/DataWorkspaceBanner";
import { InputPlacementDialog } from "@/components/analysis/InputPlacementDialog";
import { AnalysisEnvironmentProgress } from "@/components/analysis/AnalysisEnvironmentProgress";
import { SyncProgressPanel } from "@/components/analysis/SyncProgressPanel";
import { EndSessionDialog } from "@/components/analysis/EndSessionDialog";
import { useAnalysisLiveState } from "@/components/analysis/useAnalysisLiveState";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import IITRBanner from "@/components/IITRBanner";
import { useAdaptivePoll } from "@/hooks/use-adaptive-poll";
import { useCountdown } from "@/hooks/use-countdown";
import { useSessionKeepalive } from "@/hooks/use-session-keepalive";
import { announce, useSeatReadyAlert } from "@/hooks/use-seat-ready-alert";
import { DeviceCheckPanel } from "@/components/analysis/DeviceCheckPanel";
import { useDeviceCheck } from "@/hooks/use-device-check";
import { SeatStatusCard, type SeatQueue } from "@/components/analysis/SeatStatusCard";
import { friendlyAnalysisError } from "@/lib/analysisErrors";
import { enterPageFullscreen, fullscreenMode, sessionViewport, type FullscreenMode } from "@/lib/analysisFullscreen";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FolderInput, FolderPlus, Loader2, RefreshCw, WifiOff } from "lucide-react";

type Phase = "prepare" | "desktop" | "closing";

type Experience = {
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  queue?: SeatQueue;
  awaiting_checkin?: boolean;
  checkin?: { required?: boolean; remaining_seconds?: number | null };
  session?: {
    status?: string;
    idle_ends_at?: string | null;
    idle_timeout_minutes?: number | null;
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
/** Sessions in these states are over; the page moves to the finish screen. */
const ENDED = new Set(["COMPLETED", "TERMINATED", "EXPIRED", "FAILED", "DISCONNECTING"]);
/** Show "Are you still there?" this long before the idle timeout. */
const IDLE_PROMPT_SECONDS = 120;

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

/**
 * Whether the remote desktop has drawn a picture: a large canvas with at least one non-black pixel. Returns null
 * when it cannot be checked (cross-origin frame, or the browser blocks reading the canvas).
 */
function desktopPainted(frame: HTMLIFrameElement | null): boolean | null {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return null;
    const canvases = Array.from(doc.querySelectorAll("canvas")).filter((c) => c.width >= 100 && c.height >= 100);
    if (!canvases.length) return false;
    for (const c of canvases) {
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      for (let i = 1; i < 8; i += 1) {
        for (let j = 1; j < 8; j += 1) {
          const [r, g, b] = ctx.getImageData(Math.floor((c.width * i) / 8), Math.floor((c.height * j) / 8), 1, 1).data;
          if (r + g + b > 24) return true;
        }
      }
    }
    return false;
  } catch {
    return null;
  }
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
  const [hintVisible, setHintVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<AnalysisSetup | null>(null);
  const [closingSince, setClosingSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [folderDialog, setFolderDialog] = useState<"end" | "choose" | null>(null);
  const [placementInfo, setPlacementInfo] = useState<InputPlacementStatus | null>(null);
  const [placementOpen, setPlacementOpen] = useState(false);
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
  const deviceCheck = useDeviceCheck();
  const deviceBlocked = deviceCheck.verdict === "block";
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  const [timeUp, setTimeUp] = useState(false);
  /** Page full screen (our button) or browser full screen (F11): either way the desktop gets the whole screen. */
  const [isFullscreen, setIsFullscreen] = useState(() => fullscreenMode() !== null);
  const [fullscreenKind, setFullscreenKind] = useState<FullscreenMode>(() => fullscreenMode());
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  /** In full screen the session bar hides; it slides in when the pointer reaches the top edge. */
  const [barShown, setBarShown] = useState(false);
  const barTimer = useRef<number | undefined>(undefined);
  /** The desktop did not appear even after one automatic retry. */
  const [desktopStuck, setDesktopStuck] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    if (summary) setUpdatedAt(Date.now());
  }, [summary]);

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

  // The Analysis PC (and so its agent capabilities and folder paths) is only known once the desktop opens.
  useEffect(() => {
    if (phase !== "desktop" || !Number.isFinite(bookingPk)) return;
    let alive = true;
    void apiClient.getBookingAnalysisSetup(bookingPk).then((res) => {
      if (alive && !res.error && res.data) setSetup(res.data);
    });
    return () => {
      alive = false;
    };
  }, [phase, bookingPk]);

  const postLaunch = useCallback(async () => {
    lastLaunchAt.current = Date.now();
    const viewport = sessionViewport(desktopSurfaceRef.current, reservedChromePx());
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
    { enabled: phase === "prepare" && Number.isFinite(bookingPk) && !deviceBlocked && !offline, fallbackDelayMs: LAUNCH_POLL_MS },
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

  const focusDesktop = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.focus();
    } catch {
      iframeRef.current?.focus();
    }
  }, []);

  /** Guacamole cancels mousedown, so a click inside the iframe never moves keyboard focus into it on its own. */
  const bindDesktopFocus = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || (doc as Document & { __iicFocusBound?: boolean }).__iicFocusBound) return;
      (doc as Document & { __iicFocusBound?: boolean }).__iicFocusBound = true;
      doc.addEventListener("pointerdown", focusDesktop, true);
      doc.addEventListener("mousedown", focusDesktop, true);
    } catch {
      /* cross-origin remote desktop — rely on the host-page handlers */
    }
  }, [focusDesktop]);

  // Guacamole only receives keystrokes while its iframe has focus; clicks on page controls
  // (Sync now, Fullscreen) leave focus on the host page, so hand it back on the next key press.
  useEffect(() => {
    if (phase !== "desktop" || !desktopReady || folderDialog || placementOpen) return;
    bindDesktopFocus();
    focusDesktop();
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el === iframeRef.current) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      focusDesktop();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [phase, desktopReady, focusDesktop, bindDesktopFocus, folderDialog, placementOpen]);

  // A copy still running when the popup was closed: keep checking and say when it lands.
  const placementPending = placementInfo?.placement?.status === "pending";
  useEffect(() => {
    if (!placementPending || placementOpen || !Number.isFinite(bookingPk)) return;
    let alive = true;
    const id = window.setInterval(() => {
      void apiClient.getInputPlacement(bookingPk).then((res) => {
        const p = res.data?.placement;
        if (!alive || !res.data || !p || p.status === "pending") return;
        setPlacementInfo(res.data);
        if (p.status === "done") toast.success("Your input data is on the Analysis PC", { description: p.display_path });
        else toast.error("Your input data could not be saved", { description: p.detail || "Open Input data to try again." });
      });
    }, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [placementPending, placementOpen, bookingPk]);

  // Once the desktop is up, ask where the input data should go (once per session; "Not now" is remembered).
  useEffect(() => {
    if (phase !== "desktop" || !desktopReady || !Number.isFinite(bookingPk)) return;
    let alive = true;
    void apiClient.getInputPlacement(bookingPk).then((res) => {
      if (!alive || res.error || !res.data) return;
      setPlacementInfo(res.data);
      const sid = sessionIdRef.current || "";
      let dismissed = false;
      try {
        dismissed = window.sessionStorage.getItem(`ra-input-placement:${sid}`) === "dismissed";
      } catch {
        dismissed = false;
      }
      const inputFiles = Number(setup?.input.selected?.file_count ?? 1);
      if (res.data.supported && !res.data.placement && !dismissed && inputFiles > 0) {
        window.setTimeout(() => alive && setPlacementOpen(true), 1200);
      }
    });
    return () => {
      alive = false;
    };
    // setup is read once the desktop is ready; re-asking on every setup refresh would reopen the popup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, desktopReady, bookingPk]);

  useEffect(() => {
    if (phase !== "desktop" || !desktopReady) return;
    setHintVisible(true);
    const t = window.setTimeout(() => setHintVisible(false), HINT_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady]);

  const reconnectDesktop = useCallback(async () => {
    setDesktopStuck(false);
    desktopResolved.current = false;
    lastLaunchAt.current = 0;
    setDesktopUrl(null);
    setDesktopReady(false);
    setPhase("prepare");
    setError("Reconnecting to the Analysis PC…");
    pollLaunchNow();
  }, [pollLaunchNow]);

  // A view that stays black. Signing in to Windows can take a while (a fresh session profile, Explorer
  // starting), so check every 3 s and only speak up when nothing has been drawn 45 s after the view opened. Then
  // offer Reconnect without covering the view: the remote-desktop client reconnects on its own, and a forced
  // reconnect while Windows is still signing in only starts the wait again.
  useEffect(() => {
    setDesktopStuck(false);
    if (phase !== "desktop" || !desktopUrl) return;
    const opened = Date.now();
    const id = window.setInterval(() => {
      const painted = desktopPainted(iframeRef.current);
      if (painted !== false) {
        setDesktopStuck(false);
        window.clearInterval(id);
        return;
      }
      if (Date.now() - opened >= 45000) setDesktopStuck(true);
    }, 3000);
    return () => window.clearInterval(id);
  }, [phase, desktopUrl]);

  // Not in full screen when the desktop appears (the browser refused it at the click, or the page was reopened):
  // offer it once, as a single click.
  useEffect(() => {
    if (phase !== "desktop" || !desktopReady || placementOpen || document.fullscreenElement) {
      setFullscreenPrompt(false);
      return;
    }
    setFullscreenPrompt(true);
    const t = window.setTimeout(() => setFullscreenPrompt(false), 12000);
    return () => window.clearTimeout(t);
  }, [phase, desktopReady, placementOpen]);

  useEffect(() => {
    const onFullscreen = () => {
      const mode = fullscreenMode();
      setFullscreenKind(mode);
      setIsFullscreen(mode !== null);
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("resize", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("resize", onFullscreen);
    };
  }, []);

  // The session view never scrolls: a page scrollbar would take width from the desktop.
  useEffect(() => {
    if (phase !== "desktop") return;
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow, body.style.margin];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.margin = "0";
    return () => {
      [html.style.overflow, body.style.overflow, body.style.margin] = prev;
    };
  }, [phase]);

  const showBar = useCallback(() => {
    window.clearTimeout(barTimer.current);
    setBarShown(true);
  }, []);
  const hideBarSoon = useCallback(() => {
    window.clearTimeout(barTimer.current);
    barTimer.current = window.setTimeout(() => setBarShown(false), 2000);
  }, []);
  // Entering full screen shows the bar for a moment, so people see where the controls went.
  useEffect(() => {
    if (!isFullscreen) {
      window.clearTimeout(barTimer.current);
      setBarShown(false);
      return;
    }
    showBar();
    hideBarSoon();
  }, [isFullscreen, showBar, hideBarSoon]);
  useEffect(() => {
    if (!isFullscreen) return;
    if (placementOpen || folderDialog) showBar();
    else hideBarSoon();
  }, [isFullscreen, placementOpen, folderDialog, showBar, hideBarSoon]);
  useEffect(() => () => window.clearTimeout(barTimer.current), []);

  const requestDesktopFullscreenRef = useRef<(() => Promise<void>) | null>(null);
  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* already left */
      }
      return;
    }
    await requestDesktopFullscreenRef.current?.();
  }, []);

  // The whole page goes full screen (not only the desktop frame), so the session bar and popups stay usable.
  const requestDesktopFullscreen = useCallback(async () => {
    const target = document.documentElement;
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
        focusDesktop();
      }, 250);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fullscreen request was blocked.";
      toast.error(`${msg} Try the browser’s fullscreen (F11), or click Reconnect if the desktop is blank.`);
    }
  }, [focusDesktop]);
  requestDesktopFullscreenRef.current = requestDesktopFullscreen;

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

  // At zero, ask the server before closing: an extension made elsewhere, or the server's own clock, decides.
  useEffect(() => {
    if (phase !== "desktop" || remaining == null || remaining > 0 || timeUp) return;
    setTimeUp(true);
    void refreshSummary();
  }, [remaining, phase, timeUp, refreshSummary]);

  useEffect(() => {
    if (!timeUp) return;
    if (serverRemaining != null && serverRemaining > 0) {
      setTimeUp(false);
      return;
    }
    const t = window.setTimeout(enterClosing, 4000);
    return () => window.clearTimeout(t);
  }, [timeUp, serverRemaining, enterClosing]);

  // The session can also end on the server (idle timeout, End from another tab, staff action, agent lost).
  useEffect(() => {
    if (phase !== "desktop" || !sessionId) return;
    let alive = true;
    const check = async () => {
      const st = await apiClient.getRemoteAnalysisSessionStatus(sessionId);
      const status = String((st.data as { status?: string } | undefined)?.status || "").toUpperCase();
      if (!alive || !ENDED.has(status)) return;
      const why =
        status === "EXPIRED"
          ? "Your session time is over."
          : status === "FAILED"
            ? "The connection to the Analysis PC was lost."
            : "Your session was ended.";
      toast.message(why, { description: "Your results are being saved now." });
      enterClosing();
    };
    const id = window.setInterval(() => void check(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [phase, sessionId, enterClosing]);

  // Network drop: say so at once, then reconnect by itself when the browser is back online.
  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => {
      setOffline(false);
      if (phase === "desktop") {
        toast.success("Back online — reconnecting to your Analysis PC.");
        void reconnectDesktop();
      }
    };
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [phase, reconnectDesktop]);

  const stillHere = useSessionKeepalive(sessionId, phase === "desktop" && desktopReady, iframeRef, desktopUrl);
  const idleSeconds = useCountdown(
    phase === "desktop" && sessionExp.idle_ends_at
      ? Math.max(0, Math.round((new Date(sessionExp.idle_ends_at).getTime() - Date.now()) / 1000))
      : null,
  );
  const idlePrompt = phase === "desktop" && idleSeconds != null && idleSeconds <= IDLE_PROMPT_SECONDS;
  useEffect(() => {
    if (idlePrompt) announce("Are you still working?", "Your Analysis PC session ends soon if there is no activity.", { tag: "iic-ra-idle" });
  }, [idlePrompt]);

  const heldForMe = Boolean(experience.awaiting_checkin || experience.checkin?.required);
  useSeatReadyAlert(heldForMe, `${experience.equipment_name || "Remote Analysis"}`);

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
  useEffect(() => {
    if (phase !== "desktop" || (warn !== 5 && warn !== 1)) return;
    announce(
      `${warn} minute${warn === 1 ? "" : "s"} left on the Analysis PC`,
      sessionExp.can_extend
        ? "Save your work, or extend the session from the bar at the top."
        : "Save your work now. Your results are copied when the session ends.",
      { tag: `iic-ra-warn-${warn}` },
    );
    // Announce once per threshold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warn, phase]);

  const pickerSupported = Boolean(setup?.agent?.capabilities?.includes(PC_FOLDERS_CAPABILITY));
  const filesSupported = Boolean(setup?.agent?.capabilities?.includes(PC_FILES_CAPABILITY));

  const endAnalysis = async () => {
    if (pickerSupported) {
      setFolderDialog("end");
      return;
    }
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
      else toast.success(pickerSupported ? "Copying your results now." : "Copying your Output folder now.");
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
  const inputPath = setup?.input.pc_input_path || experience.data_workspace?.input_path || "";
  const chosenFolders = chosenItems(sync?.extra_folders);
  const myResearchHref = myResearchFolderHref(
    sync?.destination?.workspace_id || link?.workspace_id,
    sync?.destination?.folder_id || link?.processed_folder_id,
  );
  const liveTransfer = syncSupported && sync && isTransferPhase(sync.phase) ? describeSync(sync, targetLabel) : null;

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background dark:from-slate-950",
        // The session covers the whole window: no portal header or menu, just the session bar and the desktop.
        // z-[49] keeps popups (z-50 and up) above it.
        phase === "desktop" && "fixed inset-0 z-[49] h-[100dvh] overflow-hidden bg-black",
      )}
    >
      {phase === "desktop" && isFullscreen && !barShown ? (
        <div
          className="absolute inset-x-0 top-0 z-[70] h-2.5"
          data-testid="session-bar-reveal"
          onMouseEnter={() => {
            showBar();
            hideBarSoon();
          }}
        />
      ) : null}
      {phase === "desktop" && (
        <div
          className={cn(
            isFullscreen && "absolute inset-x-0 top-0 z-[60] transition-transform duration-200",
            isFullscreen && !barShown && "-translate-y-full",
          )}
          data-testid="session-bar"
          data-shown={isFullscreen ? String(barShown) : "true"}
          onMouseEnter={isFullscreen ? showBar : undefined}
          onMouseLeave={isFullscreen ? hideBarSoon : undefined}
        >
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
            (
              <div className="flex items-center gap-2">
                {placementInfo?.supported ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setPlacementOpen(true)}
                    title={
                      placementInfo.placement?.status === "done"
                        ? `Your input data is in ${placementInfo.placement.display_path}`
                        : "Choose where your input data is saved on the Analysis PC"
                    }
                  >
                    <FolderInput className="h-3.5 w-3.5" aria-hidden />
                    Input data
                  </Button>
                ) : null}
                {syncSupported && pickerSupported ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setFolderDialog("choose")}
                    title={
                      filesSupported
                        ? "Choose the folders and files on the Analysis PC where you saved results"
                        : "Choose the folders on the Analysis PC where you save results"
                    }
                  >
                    <FolderPlus className="h-3.5 w-3.5" aria-hidden />
                    {filesSupported ? "Results to save" : "Result folders"}
                    {chosenFolders.length ? ` (${chosenFolders.length})` : ""}
                  </Button>
                ) : null}
                {syncSupported && liveTransfer ? (
                  <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground xl:inline" role="status" aria-live="polite">
                    {liveTransfer.percent != null ? `Syncing ${liveTransfer.percent}%` : liveTransfer.detail || "Syncing…"}
                  </span>
                ) : null}
                {syncSupported ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={syncNow}
                    disabled={syncing || Boolean(liveTransfer)}
                    title={`Copy your results to ${destinationLabel} now`}
                  >
                    {syncing || liveTransfer ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                    Sync now
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void reconnectDesktop()} title="Open the view of the Analysis PC again">
                  Reconnect
                </Button>
                {fullscreenKind === "browser" ? (
                  <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground" title="This full screen was started with F11">
                    Press F11 to exit full screen
                  </span>
                ) : (
                  <Button size="sm" variant={isFullscreen ? "secondary" : "default"} onClick={() => void toggleFullscreen()}>
                    {isFullscreen ? "Exit full screen" : "Full screen"}
                  </Button>
                )}
              </div>
            )
          }
        />
        </div>
      )}
      {phase === "desktop" && warn != null ? (
        <div
          className={cn(
            "bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:text-amber-200",
            // In full screen it floats, so the desktop keeps the whole screen.
            isFullscreen && "absolute left-1/2 top-2 z-[55] -translate-x-1/2 rounded-full bg-amber-100/95 shadow-lg dark:bg-amber-950/95",
          )}
        >
          {warn} minute{warn === 1 ? "" : "s"} remaining
          {sessionExp.extend_blocked_reason ? ` · ${sessionExp.extend_blocked_reason}` : ""}
          {pickerSupported ? " · Save your work now" : " · Save results to the Output folder"}
          {sessionExp.can_extend ? (
            <Button size="sm" variant="outline" className="ml-3 h-6 px-2 text-xs" onClick={extendSession} disabled={busy}>
              Add {Number(sessionExp.extension_minutes || 15)} min
            </Button>
          ) : null}
        </div>
      ) : null}
      {phase === "prepare" && (
        <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col justify-center gap-6 p-6">
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
                subtitle="Usually under a minute. It opens here by itself."
                steps={provisionSteps}
                onCancel={() => navigate(`/analysis-workspace/${bookingPk}`)}
                cancelLabel="Cancel"
              />

              {syncSupported && sync?.direction === "input" ? <SyncProgressPanel status={sync} /> : null}

              {deviceCheck.verdict !== "ok" ? <DeviceCheckPanel check={deviceCheck} compact /> : null}

              {queue.is_queued ? <SeatStatusCard mode="queued" queue={queue} updatedAt={updatedAt} /> : null}

              {offline ? (
                <p className="flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-300" role="status">
                  <WifiOff className="h-4 w-4" aria-hidden /> You are offline. This page continues when your connection is back.
                </p>
              ) : null}

              <ErrorNotice error={error} onRetry={() => void reconnectDesktop()} />

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/analysis-workspace/${bookingPk}`}>Back to Analysis Workspace</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "desktop" && (
        <div ref={desktopSurfaceRef} className="relative min-h-0 flex-1 bg-black">
          {offline || timeUp || idlePrompt ? (
            <div className="absolute inset-0 z-[10060] flex items-center justify-center bg-slate-950/70 p-4" role="alertdialog" aria-live="assertive">
              <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-card">
                {offline ? (
                  <>
                    <WifiOff className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
                    <p className="text-lg font-semibold">Connection lost</p>
                    <p className="text-sm text-muted-foreground">
                      Your session keeps running on the Analysis PC. This page reconnects by itself as soon as your internet is back.
                    </p>
                  </>
                ) : timeUp ? (
                  <>
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
                    <p className="text-lg font-semibold">Time is up</p>
                    <p className="text-sm text-muted-foreground">Ending the session and saving your results…</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
                    <p className="text-lg font-semibold">Are you still working?</p>
                    <p className="text-sm text-muted-foreground">
                      There has been no activity for a while. The session ends in{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {Math.floor((idleSeconds || 0) / 60)}:{String((idleSeconds || 0) % 60).padStart(2, "0")}
                      </span>{" "}
                      and your results are saved.
                    </p>
                    <Button
                      onClick={() => {
                        stillHere();
                        void refreshSummary();
                        focusDesktop();
                      }}
                    >
                      I am still working
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
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
                <ErrorNotice error={error} onRetry={() => void reconnectDesktop()} />
              </div>
            </div>
          )}
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
                onMouseEnter={() => {
                  const el = document.activeElement as HTMLElement | null;
                  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
                  focusDesktop();
                }}
                onLoad={() => {
                  bindDesktopFocus();
                  window.setTimeout(() => {
                    setDesktopReady(true);
                    try {
                      window.dispatchEvent(new Event("resize"));
                      iframeRef.current?.contentWindow?.dispatchEvent(new Event("resize"));
                    } catch {
                      /* cross-origin remote desktop — ignore */
                    }
                    focusDesktop();
                  }, 800);
                }}
              />
              {fullscreenPrompt && !isFullscreen && !desktopStuck ? (
                <div className="absolute left-1/2 top-3 z-[10055] -translate-x-1/2">
                  <Button
                    size="sm"
                    className="shadow-xl"
                    onClick={() => {
                      setFullscreenPrompt(false);
                      enterPageFullscreen();
                    }}
                  >
                    Enter full screen
                  </Button>
                </div>
              ) : null}
              {desktopStuck ? (
                <div className="absolute left-1/2 top-3 z-[10055] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-white px-4 py-2 text-sm shadow-2xl dark:bg-card" role="status">
                  <span>The desktop is taking long to appear. Your session and files are safe.</span>
                  <Button size="sm" onClick={() => void reconnectDesktop()}>
                    Reconnect
                  </Button>
                </div>
              ) : null}
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[10050] flex flex-wrap items-end justify-between gap-2 sm:bottom-4 sm:left-4 sm:right-4">
                {hintVisible ? (
                  <div className="pointer-events-auto max-w-[70%] rounded-md bg-black/80 px-2 py-1 text-[10px] text-amber-50 sm:text-xs" data-testid="desktop-hint">
                    {placementInfo?.placement?.status === "done" ? (
                      <>
                        Input: <span className="font-medium">{placementInfo.placement.display_path}</span> · Save results anywhere; you
                        choose what to keep when you end.
                      </>
                    ) : pickerSupported ? (
                      <>
                        {inputPath && !placementInfo?.supported ? (
                          <>
                            Your input data is in <span className="font-mono">{inputPath}</span>.{" "}
                          </>
                        ) : null}
                        Save results anywhere on this PC — you choose what to keep when you end the session.
                      </>
                    ) : (
                      <>
                        Save results in <span className="font-mono">{outputPath || "the Output folder"}</span> — it is copied to{" "}
                        {destinationLabel} when you end the session.
                      </>
                    )}
                  </div>
                ) : (
                  <span />
                )}
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

      <InputPlacementDialog
        open={placementOpen}
        onOpenChange={(next) => {
          setPlacementOpen(next);
          if (!next) {
            // Closing the popup (Not now, Keep working, Done) is a click too: go straight to the full-screen desktop.
            enterPageFullscreen();
            void apiClient.getInputPlacement(bookingPk).then((res) => res.data && setPlacementInfo(res.data));
            try {
              window.sessionStorage.setItem(`ra-input-placement:${sessionIdRef.current || ""}`, "dismissed");
            } catch {
              /* private mode */
            }
            focusDesktop();
          }
        }}
        bookingId={bookingPk}
        defaultFolderName={placementInfo?.default_folder_name || virtualId}
        fileCount={setup?.input.selected?.file_count ?? null}
        totalBytes={null}
        sourceLabel={setup?.input.selected?.virtual_id ? `booking ${setup.input.selected.virtual_id}` : null}
        canBrowse={pickerSupported}
        onPlaced={(placement) => setPlacementInfo((prev) => (prev ? { ...prev, placement } : prev))}
      />

      <EndSessionDialog
        open={folderDialog != null}
        onOpenChange={(next) => {
          if (!next) setFolderDialog(null);
        }}
        bookingId={bookingPk}
        mode={folderDialog ?? "end"}
        initialFolders={chosenFolders}
        allowFiles={filesSupported}
        destinationLabel={destinationLabel}
        onEnded={enterClosing}
        onSaved={(items) => {
          toast.success(
            items.length
              ? `${items.length} ${filesSupported ? "item(s)" : "result folder(s)"} will be copied when the session ends.`
              : "Nothing extra will be copied.",
          );
          pollNow();
        }}
      />
    </div>
  );
}

function ErrorNotice({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const friendly = friendlyAnalysisError(error);
  if (!friendly) return null;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-left text-sm",
        friendly.transient ? "border-sky-500/30 bg-sky-500/5" : "border-rose-500/30 bg-rose-500/5",
      )}
      role={friendly.transient ? "status" : "alert"}
    >
      <p className="font-semibold">{friendly.title}</p>
      <p className="mt-0.5 text-muted-foreground">{friendly.detail}</p>
      {friendly.action === "retry" || friendly.action === "reconnect" ? (
        <Button size="sm" variant="outline" className="mt-2 h-7" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
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
              Your results are being copied to <strong className="text-foreground">{destinationLabel}</strong>. You can leave this
              page — copying continues in the background.
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
