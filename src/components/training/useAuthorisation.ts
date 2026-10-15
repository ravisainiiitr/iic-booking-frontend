import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { trainingApi } from "@/lib/trainingApi";
import type { AuthorisationStatus } from "@/lib/trainingAuthTypes";

const GATED_TTL_MS = 5 * 60 * 1000;
const EMPTY = new Set<number>();

let gatedCache: { token: string; ids: Set<number>; at: number } | null = null;
let gatedInflight: Promise<Set<number>> | null = null;

/** Equipment where booking needs authorisation, cached per sign-in for a few minutes. Empty when signed out or off. */
export async function loadGatedEquipmentIds(force = false): Promise<Set<number>> {
  const token = apiClient.getToken();
  if (!token) return EMPTY;
  if (!force && gatedCache && gatedCache.token === token && Date.now() - gatedCache.at < GATED_TTL_MS) return gatedCache.ids;
  if (!gatedInflight) {
    gatedInflight = trainingApi
      .gatedEquipment()
      .then((res) => {
        const ids = new Set(res.error ? [] : (res.data?.equipment_ids ?? []));
        gatedCache = { token, ids, at: Date.now() };
        return ids;
      })
      .finally(() => {
        gatedInflight = null;
      });
  }
  return gatedInflight;
}

export function resetGatedEquipment(): void {
  gatedCache = null;
}

/** IDs of equipment showing the "Training required" badge. */
export function useGatedEquipmentIds(enabled = true): Set<number> {
  const token = apiClient.getToken();
  const [ids, setIds] = useState<Set<number>>(() =>
    gatedCache && gatedCache.token === token ? gatedCache.ids : EMPTY,
  );
  useEffect(() => {
    if (!enabled || !token) return;
    let alive = true;
    void loadGatedEquipmentIds().then((next) => {
      if (alive) setIds(next);
    });
    return () => {
      alive = false;
    };
  }, [enabled, token]);
  return enabled ? ids : EMPTY;
}

/**
 * The signed-in user's authorisation status for one equipment (or ``userId``'s, for staff booking on behalf).
 * ``status`` stays null until loaded, and when the gate does not apply.
 */
export function useAuthorisationStatus(equipmentId: number | null | undefined, opts: { userId?: number | null } = {}) {
  const { userId } = opts;
  const [status, setStatus] = useState<AuthorisationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = Number(equipmentId);
    if (!equipmentId || !Number.isFinite(id) || !apiClient.getToken()) {
      setStatus(null);
      return;
    }
    let alive = true;
    void (async () => {
      const gated = await loadGatedEquipmentIds(tick > 0);
      if (!alive) return;
      if (!gated.has(id)) {
        setStatus(null);
        return;
      }
      setLoading(true);
      const res = await trainingApi.authorisationStatus([id], userId ?? undefined);
      if (!alive) return;
      setLoading(false);
      const row = res.data?.results?.[String(id)] ?? null;
      setStatus(row && row.required ? row : null);
    })();
    return () => {
      alive = false;
    };
  }, [equipmentId, userId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  /** Required and not allowed: booking would be refused. */
  const blocked = Boolean(status && status.required && !status.allowed && !status.staff_bypass);
  return { status, loading, blocked, reload };
}
