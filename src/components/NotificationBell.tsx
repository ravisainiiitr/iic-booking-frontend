import { forwardRef, Suspense, useState, type ComponentPropsWithoutRef } from "react";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { lazyPage } from "@/lib/lazyPage";

const loadPanel = () => import("@/components/NotificationPanel");
const NotificationPanel = lazyPage(loadPanel);

const BellButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button"> & { unreadCount: number }>(
  ({ unreadCount, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      title="Notifications"
      {...props}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          aria-hidden
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  ),
);
BellButton.displayName = "BellButton";

/** Header bell with the unread badge; the notification drawer loads on first use. */
export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return (
      <BellButton
        unreadCount={unreadCount}
        onClick={() => setActivated(true)}
        onPointerEnter={() => void loadPanel().catch(() => undefined)}
        onFocus={() => void loadPanel().catch(() => undefined)}
      />
    );
  }
  return (
    <Suspense fallback={<BellButton unreadCount={unreadCount} aria-busy />}>
      <NotificationPanel openOnMount />
    </Suspense>
  );
}

export default NotificationBell;
