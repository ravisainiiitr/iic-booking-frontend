import { useEffect, useState } from "react";
import { loadCatalogEquipment, loadDefaultCatalogEquipment, peekCatalogEquipment } from "@/lib/catalogCache";
import type { SamplePolicyEquipment } from "@/lib/samplePolicy";

export type SamplePolicyEquipmentState = {
  rows: SamplePolicyEquipment[];
  status: "loading" | "ready" | "error";
};

/**
 * Equipment with their sample timings from the catalog list. "default" reuses the list the dashboard
 * already prefetches for Browse and Book; "all" covers every department (one cached request).
 */
export function useSamplePolicyEquipment(source: "default" | "all", enabled = true): SamplePolicyEquipmentState {
  const [state, setState] = useState<SamplePolicyEquipmentState>(() => {
    const cached = source === "all" ? peekCatalogEquipment("all", null)?.data : undefined;
    return cached ? { rows: cached, status: "ready" } : { rows: [], status: "loading" };
  });

  useEffect(() => {
    if (!enabled || state.status === "ready") return;
    let cancelled = false;
    const load = source === "all" ? loadCatalogEquipment("all", null) : loadDefaultCatalogEquipment();
    load
      .then((rows) => {
        if (!cancelled) setState({ rows, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setState({ rows: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, enabled]);

  return state;
}
