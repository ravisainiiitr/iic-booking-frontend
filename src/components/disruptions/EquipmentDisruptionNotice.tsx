import { Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECOVERY_UNKNOWN_TEXT, type EquipmentDisruptionNotice as Notice } from "@/lib/disruptions";

/**
 * "Under maintenance · Expected back: …" for equipment that is not operational. `compact` is the one-line
 * card version; the default is the equipment page banner with the public reason.
 */
export function EquipmentDisruptionNotice({
  notice,
  compact = false,
  className,
}: {
  notice: Notice | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!notice) return null;
  const recovery = notice.recovery_text || RECOVERY_UNKNOWN_TEXT;
  const delayed = notice.recovery_status === "DELAYED";
  const tone = delayed
    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    : "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200";

  if (compact) {
    return (
      <p
        className={cn("flex items-start gap-1.5 rounded-md border px-2 py-1 text-xs", tone, className)}
        title={notice.reason || undefined}
        data-testid="equipment-disruption-notice"
      >
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{notice.label || "Under maintenance"}</span> · {recovery}
        </span>
      </p>
    );
  }

  return (
    <div
      role="status"
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", tone, className)}
      data-testid="equipment-disruption-notice"
    >
      <Wrench className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">
          {notice.label || "Under maintenance"} · {recovery}
        </p>
        {notice.reason ? <p className="break-words">{notice.reason}</p> : null}
      </div>
    </div>
  );
}
