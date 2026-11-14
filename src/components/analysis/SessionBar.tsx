import { Clock3, Loader2, Maximize2, Minimize2, MoreHorizontal, RefreshCw, RotateCcw, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import iitrLogo128 from "@/assets/iitr-logo-128.webp";
import iitrLogo256 from "@/assets/iitr-logo-256.webp";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FullscreenMode } from "@/lib/analysisFullscreen";
import { cn } from "@/lib/utils";

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Extend opens with the first time warning. */
export const EXTEND_WINDOW_SECONDS = 15 * 60;

const LEAVE_MESSAGE =
  "Leave the Analysis PC and return to the Dashboard?\n\nYour analysis session keeps running until it expires or you end it.";

export type SessionBarProps = {
  equipmentName: string;
  bookingLabel: string;
  remainingSeconds: number | null;
  canExtend: boolean;
  extendMinutes: number;
  extendBlockedReason?: string | null;
  busy?: boolean;
  onExtend: () => void;
  onEnd: () => void;
  /** Sync now (only when the agent can copy results during the session). */
  sync?: { onSync: () => void; running: boolean; status?: string | null; destination: string } | null;
  onReconnect: () => void;
  fullscreen: FullscreenMode;
  onToggleFullscreen: () => void;
};

/**
 * The one slim bar of a Remote Analysis session: who/what on the left, time in the middle, actions on the right,
 * End Analysis last. Every control is the same height; below 1100 px the secondary actions fold into a ⋯ menu.
 */
export function SessionBar({
  equipmentName,
  bookingLabel,
  remainingSeconds,
  canExtend,
  extendMinutes,
  extendBlockedReason,
  busy,
  onExtend,
  onEnd,
  sync,
  onReconnect,
  fullscreen,
  onToggleFullscreen,
}: SessionBarProps) {
  const navigate = useNavigate();
  const remaining = remainingSeconds;
  // Extend in the final 15 minutes (when the first warning appears), as often as needed, while the server allows it.
  const withinExtendWindow = remaining != null && remaining > 0 && remaining <= EXTEND_WINDOW_SECONDS;
  const extendEnabled = Boolean(canExtend && withinExtendWindow);
  const extendHint = !canExtend
    ? String(extendBlockedReason || "Extension unavailable while others are waiting")
    : remaining == null || remaining <= 0
      ? "Session has ended"
      : !withinExtendWindow
        ? "Extend becomes available in the last 15 minutes"
        : `Add ${extendMinutes} minutes`;

  const leave = () => {
    if (window.confirm(LEAVE_MESSAGE)) navigate("/dashboard");
  };

  const fullscreenControl =
    fullscreen === "browser" ? (
      <span className="hidden h-8 items-center rounded-md border px-2.5 text-xs text-muted-foreground min-[1100px]:inline-flex">
        Press F11 to exit full screen
      </span>
    ) : (
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onToggleFullscreen}>
        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
        {fullscreen ? "Exit full screen" : "Full screen"}
      </Button>
    );

  return (
    <header
      className="flex h-14 w-full items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 shadow-sm backdrop-blur dark:border-border dark:bg-background/95 sm:px-4"
      data-testid="session-bar-inner"
    >
      <img
        src={iitrLogo128}
        srcSet={`${iitrLogo128} 1x, ${iitrLogo256} 2x`}
        width={36}
        height={36}
        alt="IIT Roorkee"
        className="h-9 w-9 shrink-0 object-contain dark:rounded-full dark:bg-white dark:p-[2px]"
      />
      <div className="min-w-0 flex-1 leading-tight" title={`${equipmentName} · Booking ${bookingLabel}`}>
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-foreground">{equipmentName}</p>
        <p className="truncate text-xs text-muted-foreground">
          Booking <span className="font-medium text-foreground/80">{bookingLabel}</span>
        </p>
      </div>

      {/* Time group */}
      <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border" title="Time left in this session">
        <span
          className={cn(
            "flex items-center gap-1.5 bg-slate-50 px-2.5 font-mono text-sm font-semibold tabular-nums dark:bg-muted/40",
            remaining != null && remaining <= 300 && "text-amber-600",
            remaining === 0 && "text-rose-600",
          )}
          data-testid="session-timer"
        >
          <Clock3 className="h-3.5 w-3.5 opacity-70" aria-hidden />
          {remaining != null ? formatHMS(remaining) : "—:—:—"}
        </span>
        <button
          type="button"
          className="border-l px-2.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
          disabled={busy || !extendEnabled}
          title={extendHint}
          onClick={onExtend}
        >
          +{extendMinutes} min
        </button>
      </div>

      {/* Secondary actions: inline on wide screens */}
      <div className="hidden shrink-0 items-center gap-2 min-[1100px]:flex">
        {sync ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={sync.onSync}
            disabled={sync.running}
            title={sync.status || `Copy your results to ${sync.destination} now`}
          >
            {sync.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            {sync.running && sync.status ? sync.status : "Sync now"}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onReconnect} title="Open the view of the Analysis PC again">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reconnect
        </Button>
        {fullscreenControl}
      </div>

      {/* ⋯ menu: everything secondary on narrow screens, plus Dashboard always */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 w-8 shrink-0 p-0" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[10100] w-56">
          {sync ? (
            <DropdownMenuItem className="min-[1100px]:hidden" disabled={sync.running} onSelect={sync.onSync}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              {sync.running && sync.status ? sync.status : "Sync now"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-[1100px]:hidden" onSelect={onReconnect}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            Reconnect
          </DropdownMenuItem>
          {fullscreen === "browser" ? (
            <DropdownMenuItem className="min-[1100px]:hidden" disabled>
              Press F11 to exit full screen
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="min-[1100px]:hidden" onSelect={onToggleFullscreen}>
              {fullscreen ? <Minimize2 className="mr-2 h-4 w-4" aria-hidden /> : <Maximize2 className="mr-2 h-4 w-4" aria-hidden />}
              {fullscreen ? "Exit full screen" : "Full screen"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="min-[1100px]:hidden" />
          <DropdownMenuItem onSelect={leave}>
            <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
            Return to Dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="destructive" className="h-8 shrink-0" disabled={busy} onClick={onEnd}>
        End Analysis
      </Button>
    </header>
  );
}

export default SessionBar;
