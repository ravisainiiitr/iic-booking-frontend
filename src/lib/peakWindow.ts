import { API_BASE_URL } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";

export { PEAK_EXTERNAL_PAUSED_CODE, PEAK_EXTERNAL_PAUSED_EVENT } from "@/lib/peakWindowEvents";

/** Shape of GET /api/peak-window/status/ (public, cached a few seconds server-side). */
export type PeakWindowRange = { opening_at: string; starts_at: string; ends_at: string };

export type PeakWindowStatus = {
  enabled: boolean;
  peak_window_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  opening_at: string | null;
  next_window: PeakWindowRange | null;
  block_external_users?: boolean;
  external_access_paused: boolean;
  external_notice_active: boolean;
  external_notice_starts_at: string | null;
  external_paused_message?: string;
  lead_minutes?: number;
  trail_minutes?: number;
  server_time: string;
};

export type PeakSnapshot = {
  loaded: boolean;
  active: boolean;
  externalPaused: boolean;
  externalNotice: boolean;
  /** Window currently in progress, else the next one. */
  window: PeakWindowRange | null;
  message: string;
};

const OFF_PEAK_REFRESH_MS = 10 * 60_000;
const NEAR_PEAK_REFRESH_MS = 60_000;
const REFRESH_JITTER_MS = 20_000;
const FETCH_TIMEOUT_MS = 8_000;
/** Background polls (session check, notifications, live widgets) slow to this during a window. */
export const PEAK_BACKGROUND_POLL_MS = 60_000;

const EMPTY: PeakSnapshot = {
  loaded: false,
  active: false,
  externalPaused: false,
  externalNotice: false,
  window: null,
  message: "",
};

let status: PeakWindowStatus | null = null;
let serverOffsetMs = 0;
let snapshot: PeakSnapshot = EMPTY;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let lastFetchAt = 0;
let started = false;
const listeners = new Set<() => void>();

const ts = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
};

export function peakNow(): number {
  return Date.now() + serverOffsetMs;
}

function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
}

/** Derives the live snapshot from the last server status, using the server clock offset. */
export function derivePeakSnapshot(s: PeakWindowStatus | null, now: number): PeakSnapshot {
  if (!s) return EMPTY;
  if (!s.enabled) return { ...EMPTY, loaded: true };
  const current: PeakWindowRange | null =
    s.starts_at && s.ends_at && s.opening_at
      ? { starts_at: s.starts_at, ends_at: s.ends_at, opening_at: s.opening_at }
      : null;
  const candidates = [current, s.next_window].filter(Boolean) as PeakWindowRange[];
  const inWindow = candidates.find((w) => {
    const a = ts(w.starts_at);
    const b = ts(w.ends_at);
    return a != null && b != null && a <= now && now < b;
  });
  const blocking = s.block_external_users ?? s.external_access_paused;
  if (inWindow) {
    return {
      loaded: true,
      active: true,
      externalPaused: Boolean(blocking),
      externalNotice: false,
      window: inWindow,
      message: s.external_paused_message || "",
    };
  }
  const upcoming = candidates.find((w) => (ts(w.starts_at) ?? 0) > now) ?? null;
  const noticeAt = ts(s.external_notice_starts_at);
  const upcomingStart = upcoming ? ts(upcoming.starts_at) : null;
  const notice =
    Boolean(blocking) && noticeAt != null && upcomingStart != null && noticeAt <= now && now < upcomingStart;
  return {
    loaded: true,
    active: false,
    externalPaused: false,
    externalNotice: notice,
    window: upcoming,
    message: s.external_paused_message || "",
  };
}

function sameSnapshot(a: PeakSnapshot, b: PeakSnapshot): boolean {
  return (
    a.loaded === b.loaded &&
    a.active === b.active &&
    a.externalPaused === b.externalPaused &&
    a.externalNotice === b.externalNotice &&
    a.message === b.message &&
    a.window?.starts_at === b.window?.starts_at &&
    a.window?.ends_at === b.window?.ends_at
  );
}

function publish() {
  const next = derivePeakSnapshot(status, peakNow());
  if (!sameSnapshot(next, snapshot)) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
  scheduleBoundary();
}

/** Re-derive exactly at the next notice/start/end instant so the UI flips without waiting for a poll. */
function scheduleBoundary() {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  boundaryTimer = null;
  if (!status || !status.enabled) return;
  const now = peakNow();
  const points = [
    ts(status.external_notice_starts_at),
    ts(status.starts_at),
    ts(status.ends_at),
    ts(status.next_window?.starts_at),
    ts(status.next_window?.ends_at),
  ].filter((p): p is number => p != null && p > now);
  if (points.length === 0) return;
  const wait = Math.min(...points) - now + 50;
  if (wait > 2_147_000_000) return;
  boundaryTimer = setTimeout(() => {
    publish();
    if (!snapshot.active) scheduleRefresh(jitter(REFRESH_JITTER_MS));
  }, wait);
}

function scheduleRefresh(delayMs?: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const base = snapshot.active || snapshot.externalNotice ? NEAR_PEAK_REFRESH_MS : OFF_PEAK_REFRESH_MS;
  refreshTimer = setTimeout(() => void refreshPeakStatus(), delayMs ?? base + jitter(REFRESH_JITTER_MS));
}

export function setPeakStatusForTesting(next: PeakWindowStatus | null, offsetMs = 0) {
  status = next;
  serverOffsetMs = offsetMs;
  snapshot = derivePeakSnapshot(status, peakNow());
  listeners.forEach((l) => l());
}

export async function refreshPeakStatus(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const abortTimer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
    const sentAt = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/peak-window/status/`, {
        credentials: "omit",
        signal: controller?.signal,
      });
      if (!res.ok) return;
      const body = (await res.json()) as PeakWindowStatus;
      const receivedAt = Date.now();
      const server = ts(body.server_time);
      if (server != null) serverOffsetMs = server - (sentAt + receivedAt) / 2;
      status = body;
      lastFetchAt = receivedAt;
      publish();
    } catch {
      /* keep the last known status; the next poll retries */
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
      inFlight = null;
      if (started) scheduleRefresh();
    }
  })();
  return inFlight;
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  publish();
  if (Date.now() - lastFetchAt > NEAR_PEAK_REFRESH_MS) {
    scheduleRefresh(jitter(3_000));
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", onVisible);
  void refreshPeakStatus();
}

export function subscribePeakWindow(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function getPeakSnapshot(): PeakSnapshot {
  return snapshot;
}

/** Synchronous check for poll loops; false until the first status arrives. */
export function isPeakActiveNow(): boolean {
  return derivePeakSnapshot(status, peakNow()).active;
}

/** External, Industry, R&D and other non-IITR user types (mirrors backend `is_peak_blockable_user`). */
export function isPeakBlockableUserType(userType: string | number | null | undefined): boolean {
  return isExternalBookingUserType(userType);
}

export function formatPeakClock(iso: string | null | undefined): string {
  const n = ts(iso);
  if (n == null) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(n))
    .replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`);
}

let bookingChunkRequested = false;
/** Warm the booking page chunk so the first click during a window does not wait on a download. */
export function prefetchBookingPage(): void {
  if (bookingChunkRequested) return;
  bookingChunkRequested = true;
  void import("@/pages/BookEquipment").catch(() => {
    bookingChunkRequested = false;
  });
}
