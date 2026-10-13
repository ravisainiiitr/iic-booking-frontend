import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Bell, BellOff, Check, CheckCheck, Loader2, Lock, Mail, MonitorSmartphone, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly, heroButtonClass } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  apiClient,
  type NotificationInboxItem,
  type NotificationPreferenceCategory,
} from "@/lib/api";
import { desktopAlertsEnabled, desktopAlertsSupported, setDesktopAlerts } from "@/lib/desktopNotifications";
import { categoryMeta, toInAppPath } from "@/components/notifications/notificationCategories";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function dayGroup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return "Earlier";
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function InboxPanel({ onUnreadChange }: { onUnreadChange: (n: number) => void }) {
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();
  const [category, setCategory] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [queryInput]);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      const res = await apiClient.getNotificationInbox({ category, unread: unreadOnly, q: query, page: nextPage, pageSize: PAGE_SIZE });
      setLoading(false);
      if (!res.data) {
        setError(true);
        return;
      }
      setError(false);
      setItems((prev) => (nextPage === 1 ? res.data!.results : [...prev, ...res.data!.results]));
      setPage(nextPage);
      setCount(res.data.count);
      setCounts(res.data.category_counts);
      onUnreadChange(res.data.unread_count);
    },
    [category, unreadOnly, query, onUnreadChange],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const markRead = async (item: NotificationInboxItem) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    await apiClient.markNotificationAsRead(item.id);
    void refreshNotifications();
  };

  const remove = async (item: NotificationInboxItem) => {
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    setCount((c) => Math.max(0, c - 1));
    await apiClient.deleteNotification(item.id);
    void refreshNotifications();
  };

  const open = (item: NotificationInboxItem) => {
    void markRead(item);
    if (item.link) navigate(toInAppPath(item.link));
  };

  const markAll = async () => {
    await apiClient.markAllNotificationsAsRead();
    toast.success("All notifications marked as read");
    void refreshNotifications();
    void load(1);
  };

  const chips = useMemo(() => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [{ key: "all", label: "All", n: total }, ...keys.map((k) => ({ key: k, label: categoryMeta(k).label, n: counts[k] }))];
  }, [counts]);

  const grouped = useMemo(() => {
    const out: Array<{ label: string; rows: NotificationInboxItem[] }> = [];
    for (const item of items) {
      const label = dayGroup(item.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(item);
      else out.push({ label, rows: [item] });
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search notifications…"
            aria-label="Search notifications"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label="Unread only" />
          Unread only
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(1)} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden /> Mark all read
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter by category">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            aria-label={`${c.label} (${c.n})`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === c.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c.label}
            <span className={cn("tabular-nums", category === c.key ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
              {c.n}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading && items.length === 0 ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Notifications could not be loaded.{" "}
            <button type="button" className="font-medium text-primary underline" onClick={() => void load(1)}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <BellOff className="mb-3 h-12 w-12 text-muted-foreground/50" aria-hidden />
            <p className="font-medium">{query || unreadOnly || category !== "all" ? "Nothing matches these filters" : "You're all caught up"}</p>
            <p className="mt-1 text-sm text-muted-foreground">New booking updates, results and messages will appear here.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="border-b bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <ul className="divide-y">
                {group.rows.map((item) => {
                  const meta = categoryMeta(item.category);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={item.id}
                      className={cn("group relative flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40", !item.read && "bg-primary/[0.04]")}
                    >
                      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => open(item)}
                            className={cn(
                              "min-w-0 flex-1 text-left text-sm leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring",
                              item.read ? "font-medium text-foreground/90" : "font-semibold",
                            )}
                          >
                            {item.title}
                            {!item.read && <span className="sr-only"> (unread)</span>}
                          </button>
                          {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.message}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{timeAgo(item.created_at)}</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                            {meta.label}
                          </Badge>
                          <div className="relative z-10 ml-auto flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            {!item.read && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Mark as read" aria-label={`Mark "${item.title}" as read`} onClick={() => void markRead(item)}>
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" aria-label={`Delete "${item.title}"`} onClick={() => void remove(item)}>
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {items.length > 0 && items.length < count ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void load(page + 1)} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Show more ({count - items.length} left)
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SettingsPanel() {
  const [rows, setRows] = useState<NotificationPreferenceCategory[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(desktopAlertsEnabled());

  useEffect(() => {
    apiClient.getNotificationPreferences().then((res) => {
      if (res.data) setRows(res.data.categories);
      else toast.error("Notification settings could not be loaded.");
    });
  }, []);

  const save = async (changes: Array<{ key: string; email?: boolean; in_app?: boolean }>, label: string) => {
    if (!rows) return;
    const before = rows;
    setRows(rows.map((r) => {
      const c = changes.find((x) => x.key === r.key);
      return c && !r.locked ? { ...r, ...c } : r;
    }));
    setSaving(label);
    const res = await apiClient.saveNotificationPreferences(changes);
    setSaving(null);
    if (res.data) {
      setRows(res.data.categories);
      toast.success("Notification settings saved");
    } else {
      setRows(before);
      toast.error(res.error || "Could not save your settings");
    }
  };

  const toggleDesktop = async (on: boolean) => {
    const state = await setDesktopAlerts(on);
    setDesktop(state === "on");
    if (state === "denied") toast.error("Your browser blocked notifications for this site. Allow them in the browser's site settings.");
    else if (state === "on") toast.success("Desktop alerts turned on for this browser");
  };

  const optional = rows?.filter((r) => !r.locked) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">What we send you</h2>
            <p className="text-sm text-muted-foreground">
              Choose how each kind of update reaches you. Essential service messages are always delivered.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!rows || saving != null}
              onClick={() => void save(optional.map((r) => ({ key: r.key, email: false, in_app: true })), "essential")}
            >
              Essential emails only
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!rows || saving != null}
              onClick={() => void save(optional.map((r) => ({ key: r.key, email: true, in_app: true })), "all")}
            >
              Turn everything on
            </Button>
          </div>
        </div>
        {!rows ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="w-24 px-2 py-2 text-center font-medium">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" aria-hidden /> Email</span>
                </th>
                <th className="w-24 px-2 py-2 text-center font-medium">
                  <span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" aria-hidden /> In-app</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const meta = categoryMeta(r.key);
                const Icon = meta.icon;
                return (
                  <tr key={r.key} className={cn(r.locked && "bg-muted/30")}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {r.label}
                            {r.locked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                <Lock className="h-3 w-3" aria-hidden /> Always on
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        </div>
                      </div>
                    </td>
                    {(["email", "in_app"] as const).map((channel) => (
                      <td key={channel} className="px-2 py-3 text-center">
                        <Switch
                          checked={r[channel]}
                          disabled={r.locked || saving != null}
                          onCheckedChange={(v) => void save([{ key: r.key, [channel]: v }], `${r.key}-${channel}`)}
                          aria-label={`${r.label}: ${channel === "email" ? "email" : "in-app"} ${r[channel] ? "on" : "off"}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MonitorSmartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Desktop alerts in this browser</h2>
          <p className="text-sm text-muted-foreground">
            {desktopAlertsSupported()
              ? "Pop up new notifications on your computer while the portal is open in a background tab."
              : "This browser does not support desktop alerts."}
          </p>
        </div>
        <Switch
          checked={desktop}
          disabled={!desktopAlertsSupported()}
          onCheckedChange={(v) => void toggleDesktop(v)}
          aria-label="Desktop alerts"
        />
      </div>
    </div>
  );
}

const Notifications = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "settings" ? "settings" : "inbox";
  const [unread, setUnread] = useState(0);

  return (
    <PageShell>
      <main id="main-content" className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <StandaloneOnly>
          <PageHero
            compact
            className="mb-6"
            title="Notifications"
            description="Booking updates, results, messages and reminders in one place."
            icon={<Bell className="h-5 w-5" aria-hidden />}
            badges={unread > 0 ? <Badge className="bg-white/20 text-white hover:bg-white/20">{unread} unread</Badge> : null}
            actions={
              tab === "inbox" ? (
                <Button size="sm" variant="outline" className={heroButtonClass.secondary} onClick={() => setParams({ tab: "settings" }, { replace: true })}>
                  Notification settings
                </Button>
              ) : null
            }
          />
        </StandaloneOnly>
        <Tabs value={tab} onValueChange={(v) => setParams(v === "settings" ? { tab: "settings" } : {}, { replace: true })}>
          <TabsList className="mb-4">
            <TabsTrigger value="inbox">
              Inbox
              {unread > 0 ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox">
            <InboxPanel onUnreadChange={setUnread} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </PageShell>
  );
};

export default Notifications;
