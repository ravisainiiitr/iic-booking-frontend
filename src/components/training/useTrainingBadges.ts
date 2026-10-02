import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingBadge } from "@/lib/trainingTypes";
import { useTrainingAvailability } from "./useTrainingAvailability";

const MAX_IDS_PER_REQUEST = 100;

const cache = new Map<number, TrainingBadge[]>();
const pending = new Set<number>();
const listeners = new Set<() => void>();
let cacheToken: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function syncToken() {
  const token = apiClient.getToken();
  if (token !== cacheToken) {
    cache.clear();
    pending.clear();
    cacheToken = token;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

async function flush() {
  flushTimer = null;
  const ids = [...pending];
  pending.clear();
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
    const token = cacheToken;
    const res = await trainingApi.badges(chunk);
    if (token !== cacheToken) return;
    const results = res.data?.results ?? {};
    for (const id of chunk) cache.set(id, Array.isArray(results[String(id)]) ? results[String(id)] : []);
  }
  notify();
}

function requestBadges(ids: number[]) {
  syncToken();
  let added = false;
  for (const id of ids) {
    if (!cache.has(id) && !pending.has(id)) {
      pending.add(id);
      added = true;
    }
  }
  if (added && !flushTimer) flushTimer = setTimeout(() => void flush(), 30);
}

/** Drops cached badges for these users (e.g. after attendance awards a certification). */
export function invalidateTrainingBadges(ids?: number[]) {
  if (!ids) cache.clear();
  else ids.forEach((id) => cache.delete(id));
  notify();
}

/**
 * Training badges for many users, fetched in batches through `badges/?user_ids=`. Components rendering
 * chips for different users in the same tick share one request. Returns an empty map when the module is off.
 */
export function useTrainingBadges(userIds: Array<number | null | undefined>): Record<number, TrainingBadge[]> {
  const { enabled } = useTrainingAvailability();
  const [version, setVersion] = useState(0);
  const key = useMemo(
    () =>
      [...new Set(userIds.filter((id): id is number => typeof id === "number" && id > 0))]
        .sort((a, b) => a - b)
        .join(","),
    [userIds],
  );

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !key) return;
    requestBadges(key.split(",").map(Number));
  }, [enabled, key]);

  return useMemo(() => {
    const out: Record<number, TrainingBadge[]> = {};
    if (!enabled || !key) return out;
    for (const id of key.split(",").map(Number)) {
      const badges = cache.get(id);
      if (badges?.length) out[id] = badges;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, version]);
}
