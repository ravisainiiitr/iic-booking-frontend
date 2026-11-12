import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { connectApi, type ConnectBootstrap } from "@/lib/connectApi";

let cached: { token: string | null; data: ConnectBootstrap | null } | null = null;
let inflight: Promise<ConnectBootstrap | null> | null = null;

async function loadBootstrap(): Promise<ConnectBootstrap | null> {
  const token = apiClient.getToken();
  if (!token) return null;
  if (cached && cached.token === token) return cached.data;
  if (!inflight) {
    inflight = connectApi
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

/** Test hook: forget the cached bootstrap. */
export function resetConnectBootstrapCache() {
  cached = null;
  inflight = null;
}

/**
 * Whether IITR Connect is switched on for the signed-in user. The server decides; the UI only hides navigation.
 * ``enabled=false`` skips the request (e.g. signed-out pages).
 */
export function useConnectAvailability(enabled = true) {
  const [data, setData] = useState<ConnectBootstrap | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(enabled && !cached);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
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

  return { available: Boolean(data?.enabled), bootstrap: data, loading };
}

/** Private pages: ask search engines not to index them (the API also sends X-Robots-Tag: noindex). */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    meta.setAttribute("data-connect", "1");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
