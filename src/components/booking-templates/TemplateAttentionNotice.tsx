import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { apiClient, type BookingTemplateAttention } from "@/lib/api";
import { BOOKING_TEMPLATES_PATH } from "@/lib/bookingTemplates";
import { fixTemplateUrl } from "@/lib/templateHealth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "template_attention_dismissed";
const MAX_LISTED = 3;

/** Dashboard notice: saved booking templates that would fail at booking time for a reason the user can fix. */
export function TemplateAttentionNotice({ userId, className }: { userId: number | string | null | undefined; className?: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<BookingTemplateAttention | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    void apiClient.getBookingTemplateAttention().then((res) => {
      if (cancelled || !res.data?.needs_attention) return;
      const key = `${DISMISS_KEY}_${userId}`;
      const signature = res.data.templates.map((t) => `${t.id}:${t.error_count}`).join(",");
      if (sessionStorage.getItem(key) === signature) return;
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data || dismissed) return null;
  const n = data.needs_attention;
  const dismiss = () => {
    sessionStorage.setItem(`${DISMISS_KEY}_${userId}`, data.templates.map((t) => `${t.id}:${t.error_count}`).join(","));
    setDismissed(true);
  };

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10",
        className
      )}
      aria-label="Booking templates that need attention"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 font-medium text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {n} of your {data.total} booking template{data.total === 1 ? "" : "s"} need{n === 1 ? "s" : ""} attention before
          booking opens.
        </p>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-7 w-7 shrink-0" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <ul className="mt-2 space-y-1.5 pl-6">
        {data.templates.slice(0, MAX_LISTED).map((t) => (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-amber-900/90 dark:text-amber-100/90">
            <span className="font-medium">
              {t.name}
              {t.equipment_name ? ` (${t.equipment_name})` : ""}:
            </span>
            <span className="min-w-0">{t.issue}</span>
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:no-underline"
              onClick={() => navigate(fixTemplateUrl(t, { field: t.field }, BOOKING_TEMPLATES_PATH))}
            >
              Fix
            </button>
          </li>
        ))}
      </ul>
      {n > MAX_LISTED ? (
        <button
          type="button"
          className="mt-1.5 pl-6 text-xs font-medium text-amber-900 underline underline-offset-2 hover:no-underline dark:text-amber-200"
          onClick={() => navigate(BOOKING_TEMPLATES_PATH)}
        >
          See all {n} in Booking templates
        </button>
      ) : null}
    </section>
  );
}
