import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export type AutomationFeatures = { instrument_finder: boolean; smart_slots: boolean };

let cached: AutomationFeatures | null = null;
let pending: Promise<AutomationFeatures | null> | null = null;

function load(): Promise<AutomationFeatures | null> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => apiClient.automationFeatures())
      .then((res) => {
        pending = null;
        if (res?.data) cached = res.data;
        return res?.data ?? null;
      })
      .catch(() => {
        pending = null;
        return null;
      });
  }
  return pending;
}

/** Read-only AI features the admin has switched on (null while loading or when the server is older). */
export function useAutomationFeatures(): AutomationFeatures | null {
  const [features, setFeatures] = useState<AutomationFeatures | null>(cached);
  useEffect(() => {
    let alive = true;
    void load().then((f) => {
      if (alive) setFeatures(f);
    });
    return () => {
      alive = false;
    };
  }, []);
  return features;
}

export function resetAutomationFeaturesCache() {
  cached = null;
  pending = null;
}
