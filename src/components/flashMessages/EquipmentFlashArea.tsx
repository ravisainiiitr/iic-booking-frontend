import { Megaphone, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WorkspaceBannerSlot } from "@/components/WorkspaceHeaderActions";
import { cn } from "@/lib/utils";
import type { PublicFlashMessage } from "@/lib/flashMessages";
import { EquipmentFlashBanner } from "./EquipmentFlashBanner";

export const FLASH_MESSAGES_PATH = "/equipment-flash-messages";

export function flashMessagesNewPath(equipmentId: number | string): string {
  return `${FLASH_MESSAGES_PATH}?equipment=${encodeURIComponent(String(equipmentId))}&new=1`;
}

/**
 * Flash messages of one equipment plus, for staff who manage it, a "+ Flash message" shortcut. In the dashboard
 * workspace it fills the strip left of Back; on a page opened on its own it is shown where `fallbackClassName` says.
 */
export function EquipmentFlashArea({
  equipmentId,
  messages,
  canManage = false,
  fallbackClassName,
  inline = false,
}: {
  equipmentId: number | string | null | undefined;
  messages: PublicFlashMessage[] | null | undefined;
  canManage?: boolean;
  fallbackClassName?: string;
  /** Always render in place (booking page header). */
  inline?: boolean;
}) {
  const navigate = useNavigate();
  const hasMessages = Boolean(messages && messages.length);
  if (!hasMessages && !(canManage && equipmentId != null)) return null;

  const content = (
    <div className="flex w-full min-w-0 items-center gap-2" data-testid="equipment-flash-area">
      {hasMessages ? <EquipmentFlashBanner messages={messages} className="min-w-0 flex-1" /> : <div className="flex-1" />}
      {canManage && equipmentId != null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => navigate(flashMessagesNewPath(equipmentId))}
          title="Show a short timed message at the top of this equipment's pages"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <Megaphone className="h-3.5 w-3.5 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Flash message</span>
          <span className="sr-only sm:hidden">Add flash message</span>
        </Button>
      ) : null}
    </div>
  );

  if (inline) return <div className={cn(fallbackClassName)}>{content}</div>;
  return (
    <WorkspaceBannerSlot fallback={(children) => <div className={cn(fallbackClassName)}>{children}</div>}>
      {content}
    </WorkspaceBannerSlot>
  );
}

export default EquipmentFlashArea;
