import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/** Wait before a slot's hover card opens, so sweeping the mouse across the grid doesn't flash cards. */
export const SLOT_HOVER_OPEN_DELAY_MS = 180;

/**
 * Placement for slot hover cards. The card is portalled to <body>, so the grid's scroll box and
 * sticky headers can't clip it; it flips top/bottom and slides sideways to stay inside the viewport.
 */
export const SLOT_HOVER_CONTENT_PROPS = {
  sideOffset: 6,
  avoidCollisions: true,
  collisionPadding: 8,
  sticky: "always",
  hideWhenDetached: true,
} as const satisfies Partial<ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>;

export const SLOT_HOVER_CONTENT_CLASS =
  "z-[120] w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-snug text-popover-foreground shadow-lg [overflow-wrap:anywhere] whitespace-normal animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

export function SlotHoverLines({ lines, boldFirst = false }: { lines: string[]; boldFirst?: boolean }) {
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => (
        <div key={i} className={boldFirst && i === 0 ? "font-semibold" : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}

interface SlotHoverCardProps {
  /** The slot cell; must be focusable (a button) so keyboard users get the card too. */
  children: ReactElement;
  /** Card body; use `lines` for the usual one-fact-per-line card. */
  content?: ReactNode;
  lines?: string[];
  /** Bold the first line (e.g. a status heading). */
  boldFirst?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/** Hover / focus card for a slot calendar cell that is never cut off by the grid's edges. */
export function SlotHoverCard({ children, content, lines, boldFirst, side = "top", className }: SlotHoverCardProps) {
  const body = content ?? (lines && lines.length > 0 ? <SlotHoverLines lines={lines} boldFirst={boldFirst} /> : null);
  if (body == null) return children;
  return (
    <TooltipPrimitive.Provider delayDuration={SLOT_HOVER_OPEN_DELAY_MS} skipDelayDuration={0} disableHoverableContent>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            {...SLOT_HOVER_CONTENT_PROPS}
            data-slot-hover-card=""
            className={cn(SLOT_HOVER_CONTENT_CLASS, className)}
          >
            {body}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
