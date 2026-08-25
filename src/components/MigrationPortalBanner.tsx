import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

/**
 * Shows migration notice when booking_migration_mode indicates freeze/active.
 * NEW_PORTAL_URL is never hard-coded — comes from PortalMigrationState.
 * This app is the new portal; the CTA is still useful if URL points to a public entry.
 */
export function MigrationPortalBanner() {
  const [banner, setBanner] = useState("");
  const [url, setUrl] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getPortalBookingStatus();
        if (cancelled || res.error || !res.data) return;
        const disabled = Boolean(res.data.legacy_portal_new_booking_disabled);
        const text = String(res.data.legacy_portal_migration_banner || "");
        const link = String(res.data.new_portal_url || "");
        setShow(disabled && Boolean(text));
        setBanner(text);
        setUrl(link);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed">{banner}</p>
        {url ? (
          <Button asChild variant="default" size="sm" className="shrink-0">
            <a href={url} target="_blank" rel="noreferrer">
              GO TO NEW BOOKING PORTAL
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
