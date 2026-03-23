import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, X, AlertCircle, Info, Calendar, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotifications, Notification } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/** Same-origin absolute URLs from the API become in-app paths so React Router can navigate. */
function toInAppPath(link: string): string {
  try {
    const u = new URL(link, typeof window !== "undefined" ? window.location.origin : undefined);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* ignore */
  }
  return link;
}

const NotificationPanel = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification, refreshNotifications } = useNotifications();
  const [open, setOpen] = useState(false);

  // Refresh notifications when panel opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      refreshNotifications();
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "booking":
        return <Calendar className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "system":
        return <AlertCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "booking":
        return "text-blue-500";
      case "warning":
        return "text-yellow-500";
      case "system":
        return "text-red-500";
      case "info":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(toInAppPath(notification.link));
      setOpen(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0" hideCloseButton>
        <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0 shrink">
              <SheetTitle className="truncate text-base">Notifications</SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshNotifications();
                }}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs shrink-0 inline-flex items-center gap-1.5"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="h-4 w-4 shrink-0" />
                  <span>Mark all read</span>
                </Button>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="mt-1.5">
            {notifications.length === 0
              ? "You're all caught up!"
              : `${notifications.length} notification${notifications.length !== 1 ? "s" : ""}`}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-140px)]">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <RefreshCw className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <Bell className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-2">
                You'll see notifications here when you have updates
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-accent/50 transition-colors cursor-pointer relative group",
                    !notification.read && "bg-accent/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 shrink-0", getNotificationColor(notification.type))}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold leading-tight">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-3">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.createdAt)}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false);
              }}
            >
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default NotificationPanel;

