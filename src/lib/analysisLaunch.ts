import { apiClient } from "@/lib/api";

export interface AnalysisLaunchPayload {
  launch_url?: unknown;
  launcher_url?: unknown;
  booking_id?: unknown;
  session_id?: unknown;
}

/**
 * Prefer the React Analysis Launch experience (same-origin SPA).
 * Falls back to legacy backend HTML launcher only when booking id is unknown.
 */
export function resolveAnalysisLaunchHref(
  bookingId: number | string | null | undefined,
  payload?: AnalysisLaunchPayload | null,
): string | null {
  const fromPayload = Number(payload?.booking_id);
  const id = Number.isFinite(Number(bookingId))
    ? Number(bookingId)
    : Number.isFinite(fromPayload)
      ? fromPayload
      : NaN;
  if (Number.isFinite(id) && id > 0) {
    const qs = new URLSearchParams();
    if (typeof payload?.session_id === "string" && payload.session_id) {
      qs.set("session", payload.session_id);
    }
    const q = qs.toString();
    return `/analysis-launch/${id}${q ? `?${q}` : ""}`;
  }

  // Legacy fallback (token handshake on backend HTML)
  const launcher = typeof payload?.launcher_url === "string" ? payload.launcher_url : "";
  const direct = typeof payload?.launch_url === "string" ? payload.launch_url : "";
  const raw = launcher || direct;
  if (!raw) return null;
  try {
    const target = new URL(apiClient.resolveBackendUrl(raw), window.location.origin);
    const backendOrigin = new URL(apiClient.resolveBackendUrl("/api/"), window.location.origin).origin;
    if (target.origin === backendOrigin) {
      const token = apiClient.getToken();
      if (token) {
        target.searchParams.set("view", "html");
        target.searchParams.set("token", token);
      }
    }
    return target.toString();
  } catch {
    return null;
  }
}

/** Open blank tab synchronously inside click handlers (before await). */
export function openAnalysisLaunchPlaceholder(): Window | null {
  return window.open("about:blank", "_blank");
}

export function openAnalysisLaunchUrl(
  payload: AnalysisLaunchPayload | null | undefined,
  existingWindow?: Window | null,
  bookingId?: number | string | null,
): boolean {
  const href = resolveAnalysisLaunchHref(
    bookingId ?? (payload?.booking_id as string | number | null | undefined),
    payload,
  );
  if (!href) {
    try {
      existingWindow?.close();
    } catch {
      /* ignore */
    }
    return false;
  }

  if (existingWindow && !existingWindow.closed) {
    try {
      existingWindow.location.replace(href);
      existingWindow.focus();
      return true;
    } catch {
      /* fall through */
    }
  }

  const opened = window.open(href, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

/** Same-tab navigation into the launch experience. */
export function navigateToAnalysisLaunch(
  navigate: (to: string) => void,
  bookingId: number | string,
  payload?: AnalysisLaunchPayload | null,
) {
  const href = resolveAnalysisLaunchHref(bookingId, payload);
  if (href) navigate(href);
}
