import { useCallback, useEffect, useState } from "react";

import { courierTrackingApi, type Courier } from "@/lib/courierTrackingApi";

// One list per page session, shared by every selector (the built-in list rarely changes).
// A failed load is not cached, so Retry asks again.
let couriersCache: Courier[] | null = null;
let couriersInFlight: Promise<Courier[]> | null = null;

export function loadCouriers(): Promise<Courier[]> {
  if (couriersCache) return Promise.resolve(couriersCache);
  if (!couriersInFlight) {
    couriersInFlight = courierTrackingApi
      .couriers()
      .then((res) => {
        couriersCache = res.couriers;
        return res.couriers;
      })
      .finally(() => {
        couriersInFlight = null;
      });
  }
  return couriersInFlight;
}

/** Test helper: forget the cached list. */
export function resetCouriersCache(): void {
  couriersCache = null;
  couriersInFlight = null;
}

/** The courier list for selectors; ``enabled: false`` makes no request (e.g. manual delivery only). */
export function useCouriers(
  enabled = true,
): { couriers: Courier[] | undefined; loading: boolean; error: boolean; retry: () => void } {
  const [couriers, setCouriers] = useState<Courier[] | undefined>(couriersCache ?? undefined);
  const [loading, setLoading] = useState(enabled && !couriersCache);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (couriersCache) {
      setCouriers(couriersCache);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    loadCouriers()
      .then((list) => {
        if (alive) setCouriers(list);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt, enabled]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { couriers, loading, error, retry };
}

/**
 * Case-insensitive partial match on the display name and the API slug, best matches first: name starts with the
 * text, then a word of the name starts with it, then anywhere in the name, then the slug.
 */
export function filterCouriers(couriers: Courier[], query: string): Courier[] {
  const q = query.trim().toLowerCase();
  if (!q) return couriers;
  const compact = q.replace(/[\s-]+/g, "");
  const scored: { courier: Courier; score: number }[] = [];
  for (const courier of couriers) {
    const name = courier.name.toLowerCase();
    const slug = courier.slug.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.split(/[\s\-/()]+/).some((word) => word.startsWith(q))) score = 1;
    else if (name.includes(q)) score = 2;
    else if (slug.startsWith(compact) || slug.includes(compact) || name.replace(/[\s-]+/g, "").includes(compact)) score = 3;
    if (score >= 0) scored.push({ courier, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.courier.name.localeCompare(b.courier.name)).map((s) => s.courier);
}

// India Post family: 2 letters, 9 digits, 2 letters (documented by the provider). Spaces and case are normalised.
const POSTAL_SLUGS = new Set(["indiapost", "speedpost", "registeredpost", "indiapostinternational"]);
const POSTAL_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export function normaliseTrackingNumber(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function trackingNumberProblem(slug: string, raw: string): string {
  const value = normaliseTrackingNumber(raw);
  if (!value) return "Enter the tracking (AWB) number.";
  if (POSTAL_SLUGS.has(slug) && !POSTAL_RE.test(value)) {
    return "India Post, Speed Post, Registered Post and India Post International numbers have 13 characters: 2 letters, 9 digits, then 2 letters (for example EE123456789IN).";
  }
  if (value.length < 5 || value.length > 50) return "Tracking numbers use 5 to 50 letters or digits.";
  return "";
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
