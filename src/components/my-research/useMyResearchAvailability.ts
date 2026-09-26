import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import type { MyResearchBootstrap } from "@/lib/myResearchTypes";

let cached: { token: string | null; data: MyResearchBootstrap | null } | null = null;
let inflight: Promise<MyResearchBootstrap | null> | null = null;

async function loadBootstrap(): Promise<MyResearchBootstrap | null> {
  const token = apiClient.getToken();
  if (!token) return null;
  if (cached && cached.token === token) return cached.data;
  if (!inflight) {
    inflight = apiClient
      .myResearchBootstrap()
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

/** Whether My Research is enabled and the signed-in user is an eligible IIT Roorkee student or faculty member. */
export function useMyResearchAvailability(enabled = true) {
  const [data, setData] = useState<MyResearchBootstrap | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadBootstrap().then((result) => {
      if (!alive) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { loading, bootstrap: data, available: Boolean(data?.available) };
}
