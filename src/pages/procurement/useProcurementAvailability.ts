import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { pmGet, type PmBootstrap } from "@/lib/procurementApi";

let cached: { token: string; data: PmBootstrap | null } | null = null;
let inflight: Promise<PmBootstrap | null> | null = null;

async function loadBootstrap(): Promise<PmBootstrap | null> {
  const token = apiClient.getToken();
  if (!token) return null;
  if (cached && cached.token === token) return cached.data;
  if (!inflight) {
    inflight = pmGet<PmBootstrap>("bootstrap/")
      .catch(() => null)
      .then((data) => {
        cached = { token, data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Forget the cached answer, e.g. after the Main Administrator switches the module on or off. */
export function resetProcurementAvailability() {
  cached = null;
}

/**
 * Whether to show the Procurement & Assets entry: the module is on in one of the user's departments, or the user is
 * the Main Administrator. Plain fetch (no React Query) because the dashboard has no QueryClientProvider.
 */
export function useProcurementAvailability(enabled = true) {
  const [data, setData] = useState<PmBootstrap | null>(cached?.data ?? null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadBootstrap().then((result) => {
      if (alive) setData(result);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { bootstrap: data, available: Boolean(data && (data.enabled || data.can_configure)) };
}
