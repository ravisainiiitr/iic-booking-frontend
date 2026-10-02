/** Bridge between the API client and the peak-window gate (kept dependency-free to avoid import cycles). */

export const PEAK_EXTERNAL_PAUSED_CODE = "peak_window_external_paused";
export const PEAK_EXTERNAL_PAUSED_EVENT = "iic:peak-external-paused";

export type PeakPausedPayload = {
  message?: string;
  detail?: string;
  peak_window?: { starts_at?: string; ends_at?: string; opening_at?: string } | null;
};

export function isPeakPausedBody(body: unknown): body is PeakPausedPayload & { code: string } {
  return Boolean(body && typeof body === "object" && (body as { code?: unknown }).code === PEAK_EXTERNAL_PAUSED_CODE);
}

export function notifyPeakExternalPaused(payload: PeakPausedPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PeakPausedPayload>(PEAK_EXTERNAL_PAUSED_EVENT, { detail: payload }));
}
