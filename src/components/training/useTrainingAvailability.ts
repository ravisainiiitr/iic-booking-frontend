import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingBootstrap, TrainingMenuKey } from "@/lib/trainingTypes";

let cached: { token: string | null; data: TrainingBootstrap | null } | null = null;
let inflight: Promise<TrainingBootstrap | null> | null = null;

/** Cached per sign-in token; null when signed out or the bootstrap call fails. */
export async function loadTrainingBootstrap(): Promise<TrainingBootstrap | null> {
  const token = apiClient.getToken();
  if (!token) return null;
  if (cached && cached.token === token) return cached.data;
  if (!inflight) {
    inflight = trainingApi
      .bootstrap()
      .then((res) => {
        const data = res.error ? null : (res.data ?? null);
        cached = { token, data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cached bootstrap so the next load reflects changed module settings. */
export function resetTrainingBootstrap(): void {
  cached = null;
}

function cachedForCurrentToken(): TrainingBootstrap | null | undefined {
  if (!cached) return undefined;
  return cached.token === apiClient.getToken() ? cached.data : undefined;
}

/** Training & Certification module state and the menus the signed-in user may see. */
export function useTrainingAvailability(enabled = true) {
  const initial = cachedForCurrentToken();
  const [data, setData] = useState<TrainingBootstrap | null>(initial ?? null);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadTrainingBootstrap().then((result) => {
      if (!alive) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  const menu = (key: TrainingMenuKey) => Boolean(data?.menus?.[key]);
  return { loading, bootstrap: data, enabled: Boolean(data?.enabled), menu };
}
