import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

/**
 * Shows portal cutover / booking-lock notice for the current user.
 * Uses booking-status locked_for_this_user (all roles before booking_opens_at).
 * Also surfaces legacy-portal migration banner fields when present.
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
        const locked = Boolean(res.data.locked_for_this_user);
        const lockMessage = String(res.data.message || "").trim();
        const legacyDisabled = Boolean(res.data.legacy_portal_new_booking_disabled);
        const legacyText = String(res.data.legacy_portal_migration_banner || "").trim();
        const link = String(res.data.new_portal_url || "");

        if (locked && lockMessage) {
          setShow(true);
          setBanner(lockMessage);
          setUrl("");
          return;
        }
        setShow(legacyDisabled && Boolean(legacyText));
        setBanner(legacyText);
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
        <p className="text-sm leading-relaxed whitespace-pre-line">{banner}</p>
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
