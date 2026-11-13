import { useEffect, useRef, type RefObject } from "react";
import { apiClient } from "@/lib/api";

export const KEEPALIVE_EVERY_MS = 60_000;
/** Input this recent counts as "working". */
export const ACTIVE_WINDOW_MS = 3 * 60_000;

/**
 * Tell the portal the user is still working in the remote desktop.
 *
 * The portal ends a session after its idle timeout, measured from the last activity it heard about. The
 * Analysis PC agent runs as a Windows service and cannot see the remote user's keyboard, so without this
 * keepalive a session was "idle" from the moment it connected. Input inside the desktop counts while the
 * desktop frame has focus (keystrokes and clicks go to it); input on the page itself counts too.
 */
export function useSessionKeepalive(
  sessionId: string | null,
  enabled: boolean,
  frame?: RefObject<HTMLIFrameElement | null>,
  /** Bump when the frame (re)loads so its document gets listeners. */
  frameKey?: unknown,
) {
  const lastInput = useRef(Date.now());
  /** True when the desktop frame's own input events cannot be read (cross-origin), so focus is the best signal. */
  const opaqueFrame = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const mark = () => {
      lastInput.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "pointermove"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    let frameDoc: Document | null = null;
    try {
      frameDoc = frame?.current?.contentDocument ?? null;
      events.forEach((e) => frameDoc?.addEventListener(e, mark, { passive: true, capture: true }));
    } catch {
      frameDoc = null;
    }
    opaqueFrame.current = frameDoc == null;
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
      events.forEach((e) => frameDoc?.removeEventListener(e, mark, { capture: true }));
    };
  }, [enabled, frame, frameKey]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    const beat = () => {
      const frameFocused =
        opaqueFrame.current && Boolean(frame?.current && document.activeElement === frame.current && document.hasFocus());
      if (frameFocused) lastInput.current = Date.now();
      if (Date.now() - lastInput.current > ACTIVE_WINDOW_MS) return;
      void apiClient.postRemoteAnalysisSessionActivity(sessionId);
    };
    beat();
    const id = window.setInterval(beat, KEEPALIVE_EVERY_MS);
    return () => window.clearInterval(id);
  }, [enabled, sessionId, frame]);

  /** For an explicit "I'm still here". */
  return () => {
    lastInput.current = Date.now();
    if (sessionId) void apiClient.postRemoteAnalysisSessionActivity(sessionId);
  };
}
