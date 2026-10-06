import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

/**
 * Weekly slot-opening rule (weekday + time in server time) for an equipment, or the global rule
 * when no equipment is given. One request per equipment per page session, shared by every
 * calendar that shows the countdown; the countdown itself ticks locally.
 */
export type SlotWindowSchedule = { weekday: number; time: string };

const TTL_MS = 10 * 60 * 1000;

type Entry = { at: number; value: SlotWindowSchedule | null };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<SlotWindowSchedule | null>>();

function keyFor(equipmentId: number | string | null | undefined): string {
  return equipmentId == null || equipmentId === "" ? "global" : String(equipmentId);
}

function cachedValue(key: string): SlotWindowSchedule | null | undefined {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < TTL_MS ? hit.value : undefined;
}

export async function loadSlotWindowSchedule(
  equipmentId: number | string | null | undefined,
): Promise<SlotWindowSchedule | null> {
  const key = keyFor(equipmentId);
  const hit = cachedValue(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await apiClient.getSlotWindowOpening(key === "global" ? null : key);
      const d = res.data;
      const value =
        d && d.applies && typeof d.weekday === "number" && typeof d.time === "string"
          ? { weekday: d.weekday, time: d.time }
          : null;
      if (!res.error) cache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** `undefined` while loading, `null` when no opening rule applies. */
export function useSlotWindowSchedule(
  equipmentId: number | string | null | undefined,
  enabled = true,
): SlotWindowSchedule | null | undefined {
  const key = keyFor(equipmentId);
  const [state, setState] = useState<{ key: string; value: SlotWindowSchedule | null | undefined }>(() => ({
    key,
    value: cachedValue(key),
  }));

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const hit = cachedValue(key);
    if (hit !== undefined) {
      setState({ key, value: hit });
      return;
    }
    setState({ key, value: undefined });
    void loadSlotWindowSchedule(key === "global" ? null : key).then((value) => {
      if (alive) setState({ key, value });
    });
    return () => {
      alive = false;
    };
  }, [key, enabled]);

  return state.key === key ? state.value : undefined;
}

/** Test hook. */
export function __resetSlotWindowScheduleCache(): void {
  cache.clear();
  inflight.clear();
}
