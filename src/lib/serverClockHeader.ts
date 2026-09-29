import { useEffect, useSyncExternalStore } from "react";

/** Pages ask the dashboard header to show the server clock while they are mounted. */
let requests = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useShowServerClockInHeader(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    requests += 1;
    emit();
    return () => {
      requests -= 1;
      emit();
    };
  }, [enabled]);
}

export function useHeaderServerClockRequested() {
  return useSyncExternalStore(subscribe, () => requests > 0, () => false);
}
