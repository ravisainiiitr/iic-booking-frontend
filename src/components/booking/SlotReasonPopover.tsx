import { useMemo, type RefObject } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";

import { Popover, PopoverContent } from "@/components/ui/popover";

export type SlotReasonTarget = {
  anchor: HTMLElement;
  /** e.g. "Wed 7 Oct, 10:00–11:30" */
  title: string;
  reason: string;
};

type Props = {
  target: SlotReasonTarget | null;
  onClose: () => void;
};

/**
 * One popover shared by every cell of the slot grid: tapping a greyed-out slot opens it next to that
 * cell with the reason (booked, maintenance, holiday, over quota…).
 */
export function SlotReasonPopover({ target, onClose }: Props) {
  const anchorRef = useMemo(() => ({ current: target?.anchor ?? null }), [target?.anchor]);
  return (
    <Popover open={!!target} onOpenChange={(open) => !open && onClose()}>
      {target && <PopoverPrimitive.Anchor virtualRef={anchorRef as RefObject<HTMLElement>} />}
      <PopoverContent
        side="top"
        align="center"
        className="w-64 p-3 text-sm"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          target?.anchor.focus({ preventScroll: true });
        }}
        data-testid="slot-reason-popover"
      >
        {target && (
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-semibold">{target.title}</p>
              <p className="mt-0.5 text-muted-foreground">{target.reason}</p>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default SlotReasonPopover;
