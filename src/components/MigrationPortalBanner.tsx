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

function normalizeNoticeText(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Collapse multi-paragraph lock notices into a short 2–3 line blurb. */
function compactNoticeBody(text: string): string {
  const lines = normalizeNoticeText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // Drop redundant title lines already covered by "Important Notice"
    .filter((l, i, arr) => {
      if (/^important\s+notice\b/i.test(l)) return false;
      if (i === 0 && /^notice\b/i.test(l) && arr.length > 1) return false;
      if (/^institute instrumentation centre\b/i.test(l)) return false;
      if (/^iit\s+roorkee\s*$/i.test(l)) return false;
      return true;
    });
  return lines.slice(0, 2).join("\n");
}

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
        const lockMessage = normalizeNoticeText(String(res.data.message || ""));
        const legacyDisabled = Boolean(res.data.legacy_portal_new_booking_disabled);
        const legacyText = normalizeNoticeText(
          String(res.data.legacy_portal_migration_banner || "")
        );
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

  const compact = compactNoticeBody(banner);

  if (variant === "bar") {
    return (
      <div className={`border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-950 ${className}`}>
        <div className="mx-auto flex max-w-5xl flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-snug whitespace-pre-line line-clamp-2">{compact || banner}</p>
          {url ? (
            <Button asChild variant="default" size="sm" className="h-8 shrink-0">
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
      className={`dashboard-notice-card dashboard-notice-warning mb-2 border-amber-400/70 bg-amber-50 text-amber-950 shadow-none dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50 ${className}`}
    >
      <CardContent className="px-3 py-1.5">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
            <AlertTriangle className="h-3 w-3" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold leading-tight text-amber-950 dark:text-amber-50">
              Important Notice
            </p>
            <p className="text-sm leading-snug whitespace-pre-line text-amber-900/90 dark:text-amber-100/90 line-clamp-2">
              {compact || banner}
            </p>
          </div>
          {url ? (
            <Button asChild variant="default" size="sm" className="h-7 shrink-0 self-center px-2.5 text-xs">
              <a href={url} target="_blank" rel="noreferrer">
                Open new portal
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
