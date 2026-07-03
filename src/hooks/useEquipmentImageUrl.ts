import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

/** In-memory blob URLs keyed by equipmentId + auth token (survives re-renders). */
const blobCache = new Map<string, string>();

function cacheKey(equipmentId: number, token: string | null): string {
  return `${equipmentId}:${token || "anon"}`;
}

function revokeCacheEntry(key: string): void {
  const blobUrl = blobCache.get(key);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobCache.delete(key);
  }
}

/**
 * Fetches equipment image with Authorization and returns a stable blob URL.
 * Browser <img> cannot send auth headers; we fetch once and cache the blob so
 * re-renders and Cache-Control: no-store on the proxy do not clear the image.
 */
export function useEquipmentImageUrl(
  equipmentId: number | null | undefined,
  enabled: boolean,
  authKey?: string | number | null
): string | null {
  const token = apiClient.getToken();
  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    if (equipmentId == null) return null;
    return blobCache.get(cacheKey(equipmentId, token)) ?? null;
  });

  useEffect(() => {
    if (equipmentId == null) {
      setBlobUrl(null);
      return;
    }

    const key = cacheKey(equipmentId, token);
    const cached = blobCache.get(key);
    if (cached) {
      setBlobUrl(cached);
      if (!enabled) return;
    } else if (!enabled) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    const url = apiClient.getEquipmentImageProxyPath(equipmentId);
    const headers: HeadersInit = token ? { Authorization: `Token ${token}` } : {};

    fetch(url, { headers, credentials: "same-origin" })
      .then((res) => {
        if (cancelled || !res.ok) return null;
        return res.blob();
      })
      .then((blob) => {
        if (cancelled || !blob) return;
        for (const existingKey of blobCache.keys()) {
          if (existingKey.startsWith(`${equipmentId}:`) && existingKey !== key) {
            revokeCacheEntry(existingKey);
          }
        }
        const next = URL.createObjectURL(blob);
        blobCache.set(key, next);
        setBlobUrl(next);
      })
      .catch(() => {
        /* keep last cached blob on transient errors */
      });

    return () => {
      cancelled = true;
    };
  }, [equipmentId, enabled, token, authKey]);

  return blobUrl;
}
