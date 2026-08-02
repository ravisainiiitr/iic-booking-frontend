import { Clock3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import IITRBanner from "@/components/IITRBanner";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import { cn } from "@/lib/utils";

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

type Props = {
  equipmentName?: string;
  bookingLabel?: string;
  remainingSeconds?: number | null;
  showSessionControls?: boolean;
  canExtend?: boolean;
  extendMinutes?: number;
  extendBlockedReason?: string | null;
  busy?: boolean;
  onExtend?: () => void;
  onEnd?: () => void;
  showEnd?: boolean;
  rightSlot?: ReactNode;
  compact?: boolean;
  /** Show portal Return to Dashboard control (does not end the analysis session). */
  showReturnToDashboard?: boolean;
  /** When true, confirm before leaving if a session may still be running. */
  confirmLeaveSession?: boolean;
};

export function AnalysisWorkspaceChrome({
  equipmentName,
  bookingLabel,
  remainingSeconds,
  showSessionControls = false,
  canExtend = false,
  extendMinutes = 15,
  extendBlockedReason,
  busy,
  onExtend,
  onEnd,
  showEnd = false,
  rightSlot,
  compact = false,
  showReturnToDashboard = true,
  confirmLeaveSession = false,
}: Props) {
  const [remaining, setRemaining] = useState<number | null>(
    typeof remainingSeconds === "number" ? remainingSeconds : null
  );

  useEffect(() => {
    setRemaining(typeof remainingSeconds === "number" ? remainingSeconds : null);
  }, [remainingSeconds]);

  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    const id = window.setInterval(
      () => setRemaining((r) => (r == null ? r : Math.max(0, r - 1))),
      1000
    );
    return () => window.clearInterval(id);
  }, [remaining == null]);

  // Extend only in the final 2 minutes, and only when the backend allows it.
  const withinExtendWindow = remaining != null && remaining > 0 && remaining <= 120;
  const extendEnabled = Boolean(canExtend && withinExtendWindow);
  const extendDisabledReason = !canExtend
    ? String(extendBlockedReason || "Extension unavailable while others are waiting")
    : remaining == null || remaining <= 0
      ? "Session has ended"
      : !withinExtendWindow
        ? "Extend becomes available when 2 minutes or less remain"
        : undefined;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur dark:border-border dark:bg-background/95">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-4 px-4 sm:px-6 xl:px-8 2xl:px-10",
          compact ? "py-2.5" : "py-3.5"
        )}
      >
        <div className="min-w-0 flex-[1.1]">
          <IITRBanner size={compact ? "sm" : "md"} />
        </div>

        {(equipmentName || bookingLabel) && (
          <div className="hidden min-w-0 flex-[1.4] text-right lg:block">
            {equipmentName ? (
              <p className="truncate text-sm font-semibold tracking-tight text-slate-800 dark:text-foreground sm:text-base">
                {equipmentName}
              </p>
            ) : null}
            {bookingLabel ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-muted-foreground sm:text-sm">
                <span className="font-medium text-slate-600 dark:text-muted-foreground">Booking:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-foreground">{bookingLabel}</span>
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {showReturnToDashboard ? (
            <BackToDashboardButton
              variant="outline"
              size="sm"
              label="Return to Dashboard"
              confirmMessage={
                confirmLeaveSession
                  ? "Leave the Analysis Workspace and return to the Dashboard?\n\nYour analysis session will keep running in the background until it expires or you end it from this workspace."
                  : null
              }
            />
          ) : null}
          {showSessionControls ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-right dark:border-border dark:bg-muted/40">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Session expires in
                </p>
                <p
                  className={cn(
                    "font-mono text-base font-semibold tabular-nums tracking-tight sm:text-lg",
                    remaining != null && remaining <= 300 && "text-amber-600",
                    remaining === 0 && "text-rose-600"
                  )}
                >
                  {remaining != null ? formatHMS(remaining) : "—:—:—"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-50"
                disabled={busy || !extendEnabled}
                title={extendDisabledReason}
                onClick={onExtend}
              >
                <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                Extend (+{extendMinutes} min)
              </Button>
              {showEnd ? (
                <Button size="sm" variant="destructive" disabled={busy} onClick={onEnd}>
                  End Analysis
                </Button>
              ) : null}
            </>
          ) : null}
          {rightSlot}
        </div>
      </div>

      {(equipmentName || bookingLabel) && (
        <div className="mx-auto w-full max-w-[1800px] border-t border-slate-100 px-4 py-2 sm:px-6 lg:hidden xl:px-8 2xl:px-10 dark:border-border">
          {equipmentName ? (
            <p className="truncate text-sm font-semibold">{equipmentName}</p>
          ) : null}
          {bookingLabel ? (
            <p className="truncate text-xs text-muted-foreground">Booking: {bookingLabel}</p>
          ) : null}
        </div>
      )}

      {showSessionControls &&
      ((!canExtend && extendBlockedReason) ||
        (withinExtendWindow && !canExtend) ||
        (remaining != null && remaining > 0 && remaining <= 120 && !extendEnabled)) ? (
        <div className="bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200">
          {extendDisabledReason}
        </div>
      ) : null}
    </header>
  );
}
