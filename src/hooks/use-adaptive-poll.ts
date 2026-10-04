import { useCallback, useEffect, useRef } from "react";

/** Return a delay in ms for the next run, `false` to stop, or nothing to reuse `fallbackDelayMs`. */
export type AdaptivePollTask = () => Promise<number | false | void> | number | false | void;

type Options = {
  enabled?: boolean;
  fallbackDelayMs?: number;
  /** Run once as soon as the hook is enabled (default true). */
  immediate?: boolean;
};

/**
 * Sequential polling: the next request is scheduled only after the previous one finished,
 * using the delay the task returns (e.g. the server's `poll_after_ms`). Paused while the tab
 * is hidden and resumed with an immediate run when it becomes visible again.
 */
export function useAdaptivePoll(task: AdaptivePollTask, { enabled = true, fallbackDelayMs = 10000, immediate = true }: Options = {}) {
  const taskRef = useRef(task);
  taskRef.current = task;
  const fallbackRef = useRef(fallbackDelayMs);
  fallbackRef.current = fallbackDelayMs;
  const runNowRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let stopped = false;
    let running = false;
    let rerun = false;

    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (stopped || hidden()) return;
      timer = window.setTimeout(() => void run(), ms);
    };

    const run = async () => {
      if (stopped || hidden()) return;
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      window.clearTimeout(timer);
      let next: number | false | void;
      try {
        next = await taskRef.current();
      } catch {
        next = undefined;
      }
      running = false;
      if (stopped) return;
      if (next === false) {
        stopped = true;
        return;
      }
      if (rerun) {
        rerun = false;
        void run();
        return;
      }
      schedule(typeof next === "number" && next > 0 ? next : fallbackRef.current);
    };

    const onVisibility = () => {
      if (!hidden()) void run();
    };

    runNowRef.current = () => void run();
    document.addEventListener("visibilitychange", onVisibility);
    if (immediate) void run();
    else schedule(fallbackRef.current);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      runNowRef.current = () => undefined;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, immediate]);

  return useCallback(() => runNowRef.current(), []);
}
