import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Clock,
  ExternalLink,
  Info,
  Megaphone,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type NoticeKind = "urgent" | "warning" | "info";

interface Notice {
  id: number;
  title: string;
  description: string;
  content: string;
  created_at: string;
  updated_at?: string;
  expiry_date: string | null;
  expiry_unlimited: boolean;
  kind: NoticeKind;
  kindLabel: string;
  priority: number;
  equipmentId: number | null;
  isEquipmentNotice: boolean;
}

const KIND_ORDER: Record<NoticeKind, number> = { urgent: 3, warning: 2, info: 1 };
const NEW_NOTICE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const KIND_STYLES: Record<
  NoticeKind,
  { label: string; icon: typeof Info; accent: string; iconBox: string; pill: string; band: string }
> = {
  urgent: {
    label: "Urgent",
    icon: AlertOctagon,
    accent: "bg-red-500",
    iconBox: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
    band: "from-red-50 to-transparent dark:from-red-500/10",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    accent: "bg-amber-500",
    iconBox: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    pill: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    band: "from-amber-50 to-transparent dark:from-amber-500/10",
  },
  info: {
    label: "Info",
    icon: Info,
    accent: "bg-sky-500",
    iconBox: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    pill: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
    band: "from-sky-50 to-transparent dark:from-sky-500/10",
  },
};

function toKind(raw: unknown): NoticeKind {
  const v = String(raw || "").toLowerCase().trim();
  return v === "urgent" || v === "warning" ? v : "info";
}

function capitalizeFirst(text: string): string {
  const t = (text || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM yyyy");
}

function formatDayTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM yyyy, h:mm a");
}

function isNew(notice: Notice): boolean {
  const t = new Date(notice.created_at).getTime();
  return Number.isFinite(t) && Date.now() - t < NEW_NOTICE_WINDOW_MS;
}

function validityText(notice: Notice): string {
  if (notice.expiry_date) return `Until ${formatDay(notice.expiry_date)}`;
  if (notice.isEquipmentNotice) return "Until back in operation";
  return "";
}

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;
const BULLET_PATTERN = /^\s*(?:[•\-*]|\d+[.)])\s+/;

function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 break-all"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

/** Plain-text notice body → paragraphs and bullet lists (lines starting with •, -, * or 1.). */
function NoticeBody({ text }: { text: string }) {
  const blocks: Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (BULLET_PATTERN.test(line)) {
        const item = capitalizeFirst(line.replace(BULLET_PATTERN, ""));
        const last = blocks[blocks.length - 1];
        if (last?.type === "ul") last.items.push(item);
        else blocks.push({ type: "ul", items: [item] });
      } else {
        blocks.push({ type: "p", text: capitalizeFirst(line) });
      }
    });
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i} className="break-words">
            {linkify(b.text)}
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
            {b.items.map((item, j) => (
              <li key={j} className="break-words">
                {linkify(item)}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function KindPill({ notice, className }: { notice: Notice; className?: string }) {
  const style = KIND_STYLES[notice.kind];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        style.pill,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {notice.kindLabel}
    </span>
  );
}

type Filter = "all" | NoticeKind;

const NoticeBoard = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchNotices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.getPublicNotices();
      if (response.error || !Array.isArray(response.data?.notices)) {
        if (!silent) {
          setFailed(true);
          setNotices([]);
        }
        return;
      }
      const now = Date.now();
      const rows: Notice[] = response.data.notices
        .filter((n) => {
          if (n.is_active === false) return false;
          if (n.expiry_date && new Date(n.expiry_date).getTime() < now) return false;
          return true;
        })
        .map((n) => {
          const kind = toKind(n.notice_type);
          const isEquipmentNotice = n.source === "EQUIPMENT_UNAVAILABLE";
          return {
            id: n.notice_id,
            title: capitalizeFirst(n.title || ""),
            description: n.description || "",
            content: n.content || "",
            created_at: n.created_at,
            updated_at: n.updated_at,
            expiry_date: n.expiry_date || null,
            expiry_unlimited: n.expiry_unlimited === true,
            kind,
            kindLabel: capitalizeFirst(n.notice_type_display || KIND_STYLES[kind].label),
            priority: Number(n.priority) || 0,
            equipmentId: typeof n.equipment === "number" ? n.equipment : null,
            isEquipmentNotice,
          };
        })
        .sort((a, b) => {
          if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[b.kind] - KIND_ORDER[a.kind];
          if (a.priority !== b.priority) return b.priority - a.priority;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      setNotices(rows);
      setFailed(false);
    } catch {
      if (!silent) {
        setFailed(true);
        setNotices([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotices();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNotices(true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchNotices]);

  const counts = useMemo(() => {
    const c: Record<NoticeKind, number> = { urgent: 0, warning: 0, info: 0 };
    notices.forEach((n) => {
      c[n.kind] += 1;
    });
    return c;
  }, [notices]);

  const kindsPresent = (Object.keys(counts) as NoticeKind[]).filter((k) => counts[k] > 0);
  const showFilters = notices.length > 2 && kindsPresent.length > 1;
  const activeFilter: Filter = filter !== "all" && counts[filter] === 0 ? "all" : filter;
  const visible = activeFilter === "all" ? notices : notices.filter((n) => n.kind === activeFilter);

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader className="flex-shrink-0 space-y-3 border-b border-slate-100 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent pb-4 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-base font-semibold leading-tight text-foreground sm:text-lg">Notice Board</h2>
              {!loading && notices.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {notices.length} active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Latest updates and announcements</p>
          </div>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter notices by type">
            {(["all", ...kindsPresent] as Filter[]).map((f) => {
              const selected = activeFilter === f;
              const label = f === "all" ? "All" : KIND_STYLES[f].label;
              const count = f === "all" ? notices.length : counts[f];
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-background text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  {label}
                  <span className={cn("tabular-nums", selected ? "opacity-90" : "text-slate-400")}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        <ScrollArea className="max-h-[min(70vh,38rem)] flex-1">
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border bg-card p-4">
                    <Skeleton className="mb-3 h-4 w-20 rounded-full" />
                    <Skeleton className="mb-2 h-4 w-4/5" />
                    <Skeleton className="mb-1.5 h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : failed ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <Bell className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-sm text-muted-foreground">Notices could not be loaded.</p>
                <Button size="sm" variant="outline" onClick={() => void fetchNotices()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Try again
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <Bell className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">You're all caught up</p>
                <p className="text-xs text-muted-foreground">New announcements will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((notice) => {
                  const style = KIND_STYLES[notice.kind];
                  const validity = validityText(notice);
                  return (
                    <li key={notice.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedNotice(notice)}
                        className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-card py-3.5 pl-4 pr-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-800 dark:hover:border-slate-700"
                      >
                        <span className={cn("absolute inset-y-0 left-0 w-1", style.accent)} aria-hidden />
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <KindPill notice={notice} />
                          {notice.isEquipmentNotice && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Wrench className="h-3 w-3" aria-hidden />
                              Under maintenance
                            </span>
                          )}
                          {isNew(notice) && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="line-clamp-3 break-words text-sm font-semibold leading-snug text-foreground">
                          {notice.title}
                        </h3>
                        {notice.description && (
                          <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                            {capitalizeFirst(notice.description)}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {formatDay(notice.created_at)}
                          </span>
                          {validity && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {validity}
                            </span>
                          )}
                        </div>
                        <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          Read more
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <Dialog open={selectedNotice != null} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-y-auto p-0">
          {selectedNotice && (
            <>
              <DialogHeader
                className={cn(
                  "space-y-3 border-b bg-gradient-to-b px-6 pb-5 pt-6 text-left",
                  KIND_STYLES[selectedNotice.kind].band
                )}
              >
                <div className="flex items-start gap-3 pr-6">
                  {(() => {
                    const style = KIND_STYLES[selectedNotice.kind];
                    const Icon = selectedNotice.isEquipmentNotice ? Wrench : style.icon;
                    return (
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconBox)}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                    );
                  })()}
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <KindPill notice={selectedNotice} />
                      {isNew(selectedNotice) && (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          New
                        </span>
                      )}
                    </div>
                    <DialogTitle className="break-words text-lg font-semibold leading-snug sm:text-xl">
                      {selectedNotice.title}
                    </DialogTitle>
                  </div>
                </div>
                <DialogDescription asChild>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Posted {formatDayTime(selectedNotice.created_at)}
                    </span>
                    {validityText(selectedNotice) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {selectedNotice.expiry_date
                          ? `Valid until ${formatDayTime(selectedNotice.expiry_date)}`
                          : "Valid until the equipment is back in operation"}
                      </span>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 px-6 py-5">
                {selectedNotice.description && <NoticeBody text={selectedNotice.description} />}
                {selectedNotice.content && selectedNotice.content !== selectedNotice.description && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Details</p>
                    <NoticeBody text={selectedNotice.content} />
                  </div>
                )}
                {(selectedNotice.equipmentId != null ||
                  (selectedNotice.updated_at && selectedNotice.updated_at !== selectedNotice.created_at)) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      {selectedNotice.updated_at && selectedNotice.updated_at !== selectedNotice.created_at
                        ? `Last updated ${formatDayTime(selectedNotice.updated_at)}`
                        : ""}
                    </p>
                    {selectedNotice.equipmentId != null && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/equipment/${selectedNotice.equipmentId}`} onClick={() => setSelectedNotice(null)}>
                          View equipment
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default NoticeBoard;
