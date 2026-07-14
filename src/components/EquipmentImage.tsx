import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

type Props = {
  equipmentId: number | null | undefined;
  enabled?: boolean;
  alt: string;
  className?: string;
  fallback?: string;
};

/**
 * Equipment image via the public API proxy. No login required.
 * Uses a stable URL that streams from storage (does not expire).
 * Retries once with a cache-bust on transient errors instead of permanently
 * falling back to placeholder (which looked like "image disappeared").
 */
export default function EquipmentImage({
  equipmentId,
  enabled = true,
  alt,
  className,
  fallback = "/placeholder.svg",
}: Props) {
  const { user } = useAuth();
  const [displaySrc, setDisplaySrc] = useState(fallback);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!enabled || equipmentId == null) {
      setDisplaySrc(fallback);
      return;
    }
    // Public proxy — equipment photos are AllowAny; avoid sticking an auth token
    // on the URL (stale tokens caused false “expired image” failures).
    const base = apiClient.getEquipmentImageProxyPath(equipmentId);
    const src = retryTick > 0 ? `${base}?t=${Date.now()}` : base;
    setDisplaySrc(src);
  }, [equipmentId, enabled, user?.id, fallback, retryTick]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => {
        if (equipmentId == null) {
          setDisplaySrc(fallback);
          return;
        }
        if (retryTick < 2) {
          setRetryTick((n) => n + 1);
          return;
        }
        if (displaySrc !== fallback) setDisplaySrc(fallback);
      }}
    />
  );
}
