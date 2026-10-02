import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

/**
 * Server clock offset from a single /api/server-time/ call per page session, shared by every
 * countdown on the page. After that, time is the local clock plus this offset (no polling).
 */
export type ServerClockOffset = {
  /** serverNow = Date.now() + offsetMs */
  offsetMs: number;
  utcOffsetMinutes: number;
  synced: boolean;
};

const IST_OFFSET_MINUTES = 330;
const RESYNC_AFTER_MS = 60 * 60 * 1000;

let cached: (ServerClockOffset & { at: number }) | null = null;
let inflight: Promise<ServerClockOffset> | null = null;

export async function syncServerClockOffset(): Promise<ServerClockOffset> {
  if (cached && Date.now() - cached.at < RESYNC_AFTER_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const sentAt = Date.now();
    try {
      const res = await apiClient.getServerTime();
      const receivedAt = Date.now();
      const epoch = res.data?.epoch_ms;
      if (typeof epoch === "number" && Number.isFinite(epoch)) {
        const value = {
          offsetMs: epoch - (sentAt + receivedAt) / 2,
          utcOffsetMinutes:
            typeof res.data?.utc_offset_minutes === "number" ? res.data.utc_offset_minutes : IST_OFFSET_MINUTES,
          synced: true,
        };
        cached = { ...value, at: receivedAt };
        return value;
      }
    } catch {
      // fall through to the local clock
    }
    return { offsetMs: 0, utcOffsetMinutes: IST_OFFSET_MINUTES, synced: false };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useServerClockOffset(): ServerClockOffset {
  const [state, setState] = useState<ServerClockOffset>(() =>
    cached ? cached : { offsetMs: 0, utcOffsetMinutes: IST_OFFSET_MINUTES, synced: false },
  );
  useEffect(() => {
    let alive = true;
    void syncServerClockOffset().then((v) => {
      if (alive) setState(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Test hook. */
export function __resetServerClockOffsetCache(): void {
  cached = null;
  inflight = null;
}
