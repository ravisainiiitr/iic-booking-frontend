import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FAB_DRAG_THRESHOLD,
  hideAssistantFab,
  showAssistantFab,
  snapFabPosition,
  useAssistantFabHidden,
  useAssistantFabPosition,
} from "./assistantFabStore";
import { useModalOpen } from "./floatingLayout";

const LONG_PRESS_MS = 550;
const REVEAL_MS = 4000;

type Props = {
  /** Accessible name, e.g. "Open Booking Assistant". */
  label: string;
  icon: ReactNode;
  onActivate?: () => void;
  /** Warm up the panel bundle on hover / focus. */
  onPreload?: () => void;
  disabled?: boolean;
  /** The chat panel is open: the button closes it and cannot be hidden. */
  expanded?: boolean;
};

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** Bars / home-indicator space added below the saved bottom offset when the drag started. */
  extra: number;
  moved: boolean;
  longPressed: boolean;
};

/**
 * Round floating Booking Assistant button. Drag it (mouse or touch) to either side edge; the spot is
 * remembered per user on this device. A tap opens the assistant; hover / long-press shows a hide control.
 * Steps aside while a modal dialog or drawer is open.
 */
export function AssistantFab({ label, icon, onActivate, onPreload, disabled = false, expanded = false }: Props) {
  const { position, setPosition } = useAssistantFabPosition();
  const userHidden = useAssistantFabHidden();
  const modalOpen = useModalOpen();
  const wrapRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const dragPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [revealHide, setRevealHide] = useState(false);

  useEffect(() => {
    if (!revealHide) return;
    const t = window.setTimeout(() => setRevealHide(false), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [revealHide]);

  useEffect(
    () => () => {
      detach.current?.();
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    },
    [],
  );

  if (userHidden) return null;

  const clearLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    detach.current?.();
    const rect = wrap.getBoundingClientRect();
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      extra: Math.max(0, window.innerHeight - rect.bottom - position.bottom),
      moved: false,
      longPressed: false,
    };
    if (e.pointerType !== "mouse" && !expanded) {
      longPressTimer.current = window.setTimeout(() => {
        if (gesture.current && !gesture.current.moved) {
          gesture.current.longPressed = true;
          setRevealHide(true);
        }
      }, LONG_PRESS_MS);
    }

    const onMove = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g || ev.pointerId !== g.pointerId) return;
      if (!g.moved && Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY) < FAB_DRAG_THRESHOLD) return;
      g.moved = true;
      clearLongPress();
      const x = Math.min(Math.max(0, ev.clientX - g.offsetX), Math.max(0, window.innerWidth - g.width));
      const y = Math.min(Math.max(0, ev.clientY - g.offsetY), Math.max(0, window.innerHeight - g.height));
      dragPoint.current = { x, y };
      setDrag({ x, y });
    };
    const finish = (ev: PointerEvent, cancelled: boolean) => {
      const g = gesture.current;
      if (!g || ev.pointerId !== g.pointerId) return;
      clearLongPress();
      const p = dragPoint.current;
      if (g.moved && p && !cancelled) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setPosition(snapFabPosition(p.x + g.width / 2, vh - (p.y + g.height) - g.extra, vw, vh));
      }
      if (g.moved || g.longPressed) {
        // The click that follows this pointerup belongs to the drag / long-press, not to "open".
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }
      gesture.current = null;
      dragPoint.current = null;
      setDrag(null);
      detach.current?.();
    };
    const onUp = (ev: PointerEvent) => finish(ev, false);
    const onCancel = (ev: PointerEvent) => finish(ev, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    detach.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      detach.current = null;
    };
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onActivate?.();
  };

  const hide = () => {
    setRevealHide(false);
    hideAssistantFab();
    toast("Booking Assistant hidden", {
      description: "It comes back when you reload the page.",
      action: { label: "Undo", onClick: () => showAssistantFab() },
    });
  };

  const style = (drag ? { left: drag.x, top: drag.y } : { "--fab-bottom": `${position.bottom}px` }) as CSSProperties;

  return (
    <div
      ref={wrapRef}
      className="assistant-fab floating-launcher fixed z-[45] print:hidden"
      data-fab-side={position.side}
      data-dragging={drag ? "" : undefined}
      data-reveal={revealHide ? "" : undefined}
      hidden={modalOpen}
      style={style}
    >
      <TooltipProvider delayDuration={400}>
        <Tooltip open={drag ? false : undefined}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-expanded={expanded}
              disabled={disabled}
              onClick={onClick}
              onPointerDown={onPointerDown}
              onPointerEnter={onPreload}
              onFocus={onPreload}
              onContextMenu={(e) => {
                if (gesture.current) e.preventDefault();
              }}
              className={cn(
                "assistant-fab-button inline-flex h-11 w-11 select-none items-center justify-center rounded-full shadow-lg transition-[transform,background-color] sm:h-12 sm:w-12",
                "bg-slate-900 text-amber-100 hover:bg-slate-800 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-amber-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-wait disabled:opacity-80",
                drag ? "cursor-grabbing scale-105 shadow-xl" : "cursor-pointer",
              )}
            >
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side={position.side === "right" ? "left" : "right"}>
            Booking Assistant
            <span className="block text-xs text-muted-foreground">Drag to move</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {!expanded && !disabled ? (
        <button
          type="button"
          aria-label="Hide Booking Assistant"
          title="Hide until the page is reloaded"
          onClick={hide}
          className="assistant-fab-hide absolute -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
