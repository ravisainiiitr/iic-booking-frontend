import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { connectApi, type ConnectNotification, type NotificationPrefs } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { ConnectShell, ConnectUnavailable, EmptyState, SideCard, ThreadListSkeleton } from "@/components/connect/connectUi";
import { timeAgo, useConnectAvailability } from "@/components/connect/useConnect";

/** Connect notifications (only items the user can still open) and how Connect notifies them. */
export default function ConnectNotifications() {
  const { available, loading } = useConnectAvailability();
  const [items, setItems] = useState<ConnectNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!available) return;
    void connectApi.notifications().then((res) => {
      setItems(res.data?.results ?? []);
      setUnread(res.data?.unread_count ?? 0);
    });
    void connectApi.notificationPrefs().then((res) => setPrefs(res.data ?? null));
  }, [available]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;

  const save = async (change: Partial<NotificationPrefs>) => {
    if (!prefs) return;
    setSaving(true);
    const res = await connectApi.saveNotificationPrefs(change);
    setSaving(false);
    if (res.data) {
      setPrefs(res.data);
      toast.success("Notification settings saved.");
    } else toast.error(res.error || "Could not save.");
  };

  const aside = prefs ? (
    <SideCard title="How Connect notifies you" icon={<Settings2 className="h-4 w-4 text-primary" aria-hidden />}>
      <div className="space-y-4">
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Email</legend>
          {prefs.email_modes.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input type="radio" name="email_mode" checked={prefs.email_mode === m.key} disabled={saving} onChange={() => save({ email_mode: m.key as NotificationPrefs["email_mode"] })} />
              {m.label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center justify-between gap-2 text-sm">
          In-app notifications
          <Switch checked={prefs.in_app_enabled} disabled={saving} onCheckedChange={(v) => save({ in_app_enabled: v })} aria-label="In-app notifications" />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Notify me about</legend>
          {prefs.events.map((e) => (
            <label key={e.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!prefs.muted_events.includes(e.key)}
                disabled={saving}
                onChange={(ev) =>
                  save({ muted_events: ev.target.checked ? prefs.muted_events.filter((k) => k !== e.key) : [...prefs.muted_events, e.key] })
                }
              />
              {e.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Follow automatically</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.auto_follow_own_threads} disabled={saving} onChange={(e) => save({ auto_follow_own_threads: e.target.checked })} />
            Discussions I start
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.auto_follow_replied_threads} disabled={saving} onChange={(e) => save({ auto_follow_replied_threads: e.target.checked })} />
            Discussions I reply to
          </label>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Emails contain only the discussion title and a link. You can also switch Connect emails off in the portal&apos;s notification settings.
        </p>
      </div>
    </SideCard>
  ) : null;

  return (
    <ConnectShell
      aside={aside}
      header={
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Bell className="h-6 w-6 text-primary" aria-hidden /> Notifications
            </h1>
            <p className="text-sm text-muted-foreground">{unread} unread</p>
          </div>
          {unread ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                await connectApi.markNotificationsRead("all");
                setUnread(0);
                setItems((list) => (list ?? []).map((n) => ({ ...n, read: true })));
              }}
            >
              <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
            </Button>
          ) : null}
        </div>
      }
    >
      {items === null ? (
        <ThreadListSkeleton />
      ) : items.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                to={n.link}
                onClick={() => {
                  if (!n.read) void connectApi.markNotificationsRead([n.id]);
                }}
                className={cn("flex items-start gap-3 px-4 py-3 hover:bg-muted/40", !n.read && "bg-primary/[0.04]")}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-label={n.read ? undefined : "Unread"} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{n.message}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications yet">
          Replies, mentions, accepted answers and announcements will appear here.
        </EmptyState>
      )}
    </ConnectShell>
  );
}
