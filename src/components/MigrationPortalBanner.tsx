import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

type MigrationPortalBannerProps = {
  /** `notice` = Important notice card (dashboard). `bar` = full-width top strip. */
  variant?: "notice" | "bar";
  className?: string;
};

/**
 * Shows portal cutover / booking-lock notice for the current user.
 * Uses booking-status locked_for_this_user (all roles before booking_opens_at).
 * Also surfaces legacy-portal migration banner fields when present.
 */
export function MigrationPortalBanner({
  variant = "notice",
  className = "",
}: MigrationPortalBannerProps) {
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

  if (variant === "bar") {
    return (
      <div className={`border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 ${className}`}>
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

  return (
    <Card
      className={`dashboard-notice-card dashboard-notice-warning mb-8 border-amber-400/70 bg-amber-50 text-amber-950 shadow-md dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50 ${className}`}
    >
      <CardContent className="py-5 px-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-950 dark:text-amber-50">Important notice</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90 whitespace-pre-line">
              {banner}
            </p>
          </div>
          {url ? (
            <Button asChild variant="default" size="sm" className="shrink-0">
              <a href={url} target="_blank" rel="noreferrer">
                Open new portal
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
