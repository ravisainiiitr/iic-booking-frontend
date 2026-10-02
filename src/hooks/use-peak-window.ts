import { useSyncExternalStore } from "react";
import { getPeakSnapshot, subscribePeakWindow, type PeakSnapshot } from "@/lib/peakWindow";

/** Live peak-window state (shared single poller; flips exactly at window boundaries). */
export function usePeakWindow(): PeakSnapshot {
  return useSyncExternalStore(subscribePeakWindow, getPeakSnapshot, getPeakSnapshot);
}
