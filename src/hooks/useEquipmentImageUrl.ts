import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api";

/**
 * Fetches equipment image with auth and returns a blob URL so <img> displays correctly.
 * Browser <img> requests do not send Authorization, so the backend image proxy sees
 * anonymous and returns 404 for non-public equipment. This hook fetches with the
 * token and returns a blob URL that works after login/re-login.
 * Pass authKey (e.g. user id or token) so that when the user logs in again the image refetches.
 */
export function useEquipmentImageUrl(
  equipmentId: number | null | undefined,
  enabled: boolean,
  authKey?: string | number | null
): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const revokedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || equipmentId == null) {
      setBlobUrl(null);
      return;
    }

    const token = apiClient.getToken();
    if (!token) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    const url = apiClient.getEquipmentImageUrl(equipmentId);

    fetch(url, {
      headers: { Authorization: `Token ${token}` },
      credentials: "same-origin",
    })
      .then((res) => {
        if (cancelled || !res.ok) return null;
        return res.blob();
      })
      .then((blob) => {
        if (cancelled || !blob) {
          setBlobUrl(null);
          return;
        }
        const next = URL.createObjectURL(blob);
        setBlobUrl(next);
        if (revokedRef.current) {
          URL.revokeObjectURL(revokedRef.current);
          revokedRef.current = null;
        }
        revokedRef.current = next;
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      setBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
          revokedRef.current = null;
        }
        return null;
      });
    };
  }, [equipmentId, enabled, authKey]);

  return blobUrl;
}
