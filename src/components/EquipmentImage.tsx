import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

/** Thumbnail widths served by the image proxy (`?w=`); keep in sync with the backend allowlist. */
const THUMB_WIDTHS = [320, 480, 640, 960, 1280] as const;

type Props = {
  equipmentId: number | null | undefined;
  enabled?: boolean;
  alt: string;
  className?: string;
  fallback?: string;
  /**
   * CSS `sizes` for the rendered slot. When set, the browser picks a WebP thumbnail from a srcset
   * instead of downloading the full-size original.
   */
  sizes?: string;
  /** Above-the-fold / likely LCP image: load eagerly with high fetch priority. */
  priority?: boolean;
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
  sizes,
  priority = false,
}: Props) {
  const { user } = useAuth();
  const active = enabled && equipmentId != null;
  const [displaySrc, setDisplaySrc] = useState(() =>
    active ? apiClient.getEquipmentImageProxyPath(equipmentId as number) : fallback
  );
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!enabled || equipmentId == null) {
      setDisplaySrc(fallback);
      return;
    }
    // Public proxy — equipment photos are AllowAny; avoid sticking an auth token
    // on the URL (stale tokens caused false “expired image” failures).
    const base = apiClient.getEquipmentImageProxyPath(equipmentId);
    const src = retryTick > 0 ? `${base}${base.includes("?") ? "&" : "?"}t=${Date.now()}` : base;
    setDisplaySrc(src);
  }, [equipmentId, enabled, user?.id, fallback, retryTick]);

  // After an error, retry with the plain original URL (no srcset) so a thumbnail failure
  // never hides the photo.
  const srcSet =
    sizes && active && retryTick === 0 && displaySrc !== fallback
      ? THUMB_WIDTHS.map(
          (w) => `${apiClient.getEquipmentImageProxyPath(equipmentId as number, w)} ${w}w`
        ).join(", ")
      : undefined;

  return (
    <img
      src={displaySrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchpriority: "high" } : {})}
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
