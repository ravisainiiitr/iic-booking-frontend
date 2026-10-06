import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { Box, Grid3x3, Layers, Maximize2, Minimize2, RotateCcw, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewPreset } from "./stage";

/** Outer frame: the scene on top, the control bar underneath. */
export const PREVIEW_FRAME_CLASS = "flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card";

/** Studio backdrop that follows the OS theme; the WebGL canvas is transparent on top of it. */
export const PREVIEW_SCENE_CLASS =
  "relative min-h-0 flex-1 bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950";

export const PREVIEW_BUTTON_CLASS =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";
export function PreviewChip({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background/85 px-2 py-1 text-xs text-foreground shadow-sm backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  useEffect(() => {
    if (!supported) return;
    const onChange = () => setActive(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref, supported]);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => undefined);
  }, [ref]);
  return { supported, active, toggle };
}

interface PreviewToolbarProps {
  onView: (preset: ViewPreset) => void;
  wireframe?: boolean;
  onWireframeChange?: (value: boolean) => void;
  dimensions: boolean;
  onDimensionsChange: (value: boolean) => void;
  /** Frame the whole build plate / stock sheet. */
  onShowSheet?: () => void;
  sheetLabel?: string;
  fullscreen?: { supported: boolean; active: boolean; toggle: () => void };
  hint?: string;
  /** Extra controls placed before the camera views. */
  extra?: ReactNode;
}

export function PreviewToolbar({
  onView,
  wireframe,
  onWireframeChange,
  dimensions,
  onDimensionsChange,
  onShowSheet,
  sheetLabel = "Sheet",
  fullscreen,
  hint,
  extra,
}: PreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-border bg-muted/40 p-1.5">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="3D view controls">
        {extra}
        <div className="flex items-center gap-1" role="group" aria-label="Camera views">
          <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => onView("iso")} title="3D view">
            <Box className="h-3.5 w-3.5" aria-hidden />
            <span>3D</span>
          </button>
          <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => onView("front")} title="Front view">
            Front
          </button>
          <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => onView("top")} title="Top view">
            Top
          </button>
          {onShowSheet && (
            <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={onShowSheet} title={`Show the whole ${sheetLabel.toLowerCase()}`}>
              <Layers className="h-3.5 w-3.5" aria-hidden />
              <span>{sheetLabel}</span>
            </button>
          )}
        </div>
        <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => onView("home")} aria-label="Reset view" title="Reset view">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={PREVIEW_BUTTON_CLASS}
          aria-pressed={dimensions}
          aria-label="Show dimensions"
          title="Dimensions"
          onClick={() => onDimensionsChange(!dimensions)}
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden />
        </button>
        {onWireframeChange && (
          <button
            type="button"
            className={PREVIEW_BUTTON_CLASS}
            aria-pressed={!!wireframe}
            aria-label="Wireframe"
            title="Wireframe"
            onClick={() => onWireframeChange(!wireframe)}
          >
            <Grid3x3 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        {fullscreen?.supported && (
          <button
            type="button"
            className={PREVIEW_BUTTON_CLASS}
            aria-pressed={fullscreen.active}
            aria-label={fullscreen.active ? "Exit full screen" : "Full screen"}
            title={fullscreen.active ? "Exit full screen" : "Full screen"}
            onClick={fullscreen.toggle}
          >
            {fullscreen.active ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && <p className="hidden px-1 text-[11px] text-muted-foreground lg:block">{hint}</p>}
    </div>
  );
}

export function PreviewLoading({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4" role="status" aria-live="polite">
      <div className="w-full max-w-xs space-y-2 rounded-lg border border-border bg-background/90 p-3 text-center shadow-sm backdrop-blur">
        <p className="text-xs text-foreground">{label}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-primary transition-[width]", value === null && "w-1/3 animate-pulse")}
            style={value === null ? undefined : { width: `${Math.round(value * 100)}%` }}
          />
        </div>
        {value !== null && <p className="text-[11px] tabular-nums text-muted-foreground">{Math.round(value * 100)}%</p>}
      </div>
    </div>
  );
}

export function PreviewNotice({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="rounded-md border border-warning-border bg-warning-subtle px-2 py-1 text-[11px] text-warning-subtle-foreground"
    >
      {children}
    </p>
  );
}

export function touchHint(): string {
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    return "Drag to rotate · pinch to zoom · two fingers to pan";
  }
  return "Drag to rotate · scroll to zoom · right-drag to pan";
}
