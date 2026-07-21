import { useEffect, useRef } from "react";

type UseVisibilityPollingOptions = {
  /** Polling interval in ms (default 12s). */
  intervalMs?: number;
  /** When false, polling is paused. */
  enabled?: boolean;
  /** Called on each tick while the document is visible. */
  onPoll: () => void | Promise<void>;
};

/**
 * Lightweight visibility-aware polling for live UI updates
 * (sample / equipment lifecycle) without a full page reload.
 */
export function useVisibilityPolling({
  intervalMs = 12000,
  enabled = true,
  onPoll,
}: UseVisibilityPollingOptions): void {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void onPollRef.current();
    };

    const id = window.setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
