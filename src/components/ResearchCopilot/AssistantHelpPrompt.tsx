import { LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { helpPromptText, type AssistantHelpDetail } from "@/lib/assistantHelp";
import { panelBottomFor, useAssistantFabPosition } from "./assistantFabStore";

type Props = {
  detail: AssistantHelpDetail;
  onAccept: () => void;
  onDismiss: () => void;
};

/** Small dismissible card above the assistant button, shown after a booking or charge error. */
export function AssistantHelpPrompt({ detail, onAccept, onDismiss }: Props) {
  const { position, vw, vh } = useAssistantFabPosition();
  return (
    <div
      role="status"
      aria-live="polite"
      data-fab-side={position.side}
      style={{ "--panel-bottom": `${panelBottomFor(position, vw, vh)}px` } as React.CSSProperties}
      className="assistant-panel floating-launcher fixed z-[9999] w-[min(340px,calc(100vw-1.5rem))] rounded-xl border bg-card p-3 text-card-foreground shadow-xl"
    >
      <div className="flex items-start gap-2">
        <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Need help?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{helpPromptText(detail.code)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onAccept}>
              Ask the Booking Assistant
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onDismiss}>
              No thanks
            </Button>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="-mr-1 -mt-1 h-7 w-7"
          aria-label="Dismiss help offer"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
