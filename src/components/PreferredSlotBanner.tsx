import { CalendarCheck, CalendarClock, Loader2, RefreshCw, X } from "lucide-react";
import type { TemplatePreferredSlotResolution, TemplateSlotAlternative } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Outcome of loading a template's preferred slot on the booking page, with clickable nearby alternatives. */
export function PreferredSlotBanner({
  resolution,
  loading,
  onPick,
  onRefresh,
  onDismiss,
}: {
  resolution: TemplatePreferredSlotResolution | null;
  loading: boolean;
  onPick: (alternative: TemplateSlotAlternative) => void;
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  if (!loading && (!resolution || !resolution.has_preference || !resolution.message)) return null;
  const ok = resolution?.status === "available";
  const alternatives = (resolution?.alternatives ?? []).filter(
    (a) => a.slot_ids.join(",") !== (resolution?.auto_next?.slot_ids ?? []).join(",")
  );

  return (
    <div
      role="status"
      className={cn(
        "mb-4 rounded-lg border p-3 text-sm",
        ok
          ? "border-emerald-300/70 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-50"
          : "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-50"
      )}
    >
      <div className="flex items-start gap-2.5">
        {loading ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : ok ? (
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="leading-relaxed">{loading ? "Finding your preferred slot…" : resolution?.message}</p>
          {!loading && alternatives.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Nearest free slots of the same length:</p>
              <div className="flex flex-wrap gap-1.5">
                {alternatives.map((a) => (
                  <Button
                    key={a.slot_ids.join("-")}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 bg-background px-2 text-xs"
                    onClick={() => onPick(a)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        {!loading && (
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} aria-label="Check the preferred slot again">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDismiss} aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreferredSlotBanner;
