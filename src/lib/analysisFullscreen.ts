import type { AnalysisViewport } from "@/lib/analysisSetupTypes";
import { measureViewport } from "@/lib/analysisSync";

/**
 * Full screen for Remote Analysis sessions.
 *
 * Browsers only allow full screen straight after a click, so it cannot start by itself when the desktop finishes
 * loading. Instead the click that starts or joins a session puts the whole page in full screen (call this first in
 * the handler, before any await). The desktop is then sized for the full screen from its first connection, so no
 * resize is needed. Phones and tablets are skipped (their browsers handle full screen poorly).
 */
export function enterPageFullscreen(): void {
  try {
    if (typeof document === "undefined" || document.fullscreenElement) return;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
    const result = request?.() as Promise<void> | undefined;
    result?.catch?.((err: unknown) => {
      // Refused (no recent click, or not allowed): the session bar has a Full screen button. Logged for support.
      console.warn("[Remote Analysis] full screen refused:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    });
  } catch (err) {
    console.warn("[Remote Analysis] full screen failed:", err);
  }
}

export function isFullscreen(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
}

/**
 * The size the remote desktop is opened at. On a computer this is the whole screen, so entering or leaving full
 * screen never needs a reconnect (each reconnect risked a black view): in a window the desktop is simply shown a
 * little smaller. Phones and tablets get the visible area, as before.
 */
export function sessionViewport(surface: HTMLElement | null, reservedTopPx: number): AnalysisViewport {
  const measured = measureViewport(surface, reservedTopPx);
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const sw = Math.round(Number(window.screen?.width) || 0);
  const sh = Math.round(Number(window.screen?.height) || 0);
  if (coarse || sw < 1024 || sh < 600) return measured;
  return { width: sw, height: sh, dpr: measured.dpr };
}

/** "page": our Full screen button (Fullscreen API). "browser": F11, which the page cannot leave by itself. */
export type FullscreenMode = "page" | "browser" | null;

export function fullscreenMode(): FullscreenMode {
  if (typeof document === "undefined") return null;
  if (document.fullscreenElement) return "page";
  const sw = Number(window.screen?.width) || 0;
  const sh = Number(window.screen?.height) || 0;
  if (sw > 0 && sh > 0 && window.innerWidth >= sw - 1 && window.innerHeight >= sh - 1) return "browser";
  return null;
}
