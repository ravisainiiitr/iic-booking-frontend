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
    result?.catch?.(() => {
      /* refused (no recent click, or not allowed): the session page offers a one-click button */
    });
  } catch {
    /* never block starting a session */
  }
}

export function isFullscreen(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
}
