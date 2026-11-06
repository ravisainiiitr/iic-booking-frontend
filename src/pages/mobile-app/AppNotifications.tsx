import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { categoryMeta, toInAppPath } from "@/components/notifications/notificationCategories";
import { useNotifications, type Notification } from "@/contexts/NotificationContext";
import { callDayLabel } from "./AppCalls";
import { cn } from "@/lib/utils";
import { AppScreen, EmptyState, ListSkeleton } from "./ui";

const IST_TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** Notifications by day; each opens the screen it is about. Settings and test alerts stay on the full page. */
export default function AppNotifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: Notification[] }> = [];
    [...notifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((n) => {
        const day = callDayLabel(n.createdAt);
        const last = out[out.length - 1];
        if (last?.day === day) last.items.push(n);
        else out.push({ day, items: [n] });
      });
    return out;
  }, [notifications]);

  const open = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(toInAppPath(n.link));
  };

  return (
    <AppScreen
      title="Notifications"
      subtitle={unreadCount ? `${unreadCount} unread` : undefined}
      backTo="/app"
      actions={
        unreadCount > 0 ? (
          <button type="button" onClick={markAllAsRead} aria-label="Mark all as read" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground active:bg-muted">
            <CheckCheck className="h-5 w-5" aria-hidden />
          </button>
        ) : undefined
      }
    >
      {loading && notifications.length === 0 ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title="You are all caught up" hint="Booking, payment and laboratory updates show here." />
      ) : (
        <div className="-mx-4 -mt-4">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.day}</h2>
              <ul>
                {g.items.map((n) => {
                  const meta = categoryMeta(n.category ?? n.type);
                  const Icon = meta.icon;
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors active:bg-muted/70", !n.read && "bg-primary/5")}>
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm text-foreground", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.message}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{IST_TIME.format(new Date(n.createdAt))}</span>
                        </span>
                        {!n.read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppScreen>
  );
}
