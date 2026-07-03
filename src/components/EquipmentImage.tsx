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
 * Uses <img src> directly (no Authorization header — stale tokens must not block anonymous users).
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

  useEffect(() => {
    if (!enabled || equipmentId == null) {
      setDisplaySrc(fallback);
      return;
    }
    // Public proxy URL; append token only when logged in (restricted equipment fallback).
    const url = user
      ? apiClient.getEquipmentImageUrl(equipmentId)
      : apiClient.getEquipmentImageProxyPath(equipmentId);
    setDisplaySrc(url);
  }, [equipmentId, enabled, user?.id, fallback]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => {
        if (displaySrc !== fallback) setDisplaySrc(fallback);
      }}
    />
  );
}
