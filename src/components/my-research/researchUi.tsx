import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Archive, CheckCircle2, Crown, Eye, RefreshCw, Share2, type LucideIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; to?: string };

/** Dashboard → My Research → page. The last crumb is the current page. */
export function ResearchBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs sm:text-sm">
        {items.map((c, i) => (
          <BreadcrumbItem key={`${c.label}-${i}`} className="min-w-0">
            {i > 0 ? <BreadcrumbSeparator className="mr-1.5" /> : null}
            {c.to && i < items.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link to={c.to}>{c.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  count,
  action,
  id,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden /> : null}
          {title}
          {count != null ? <span className="text-sm font-normal text-muted-foreground">({count})</span> : null}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** One consistent, compact empty state: small icon, title, one line, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card px-4 py-3.5 sm:flex-row sm:items-center", className)}>
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type StatTone = "neutral" | "attention" | "danger" | "success";

const STAT_TONE: Record<StatTone, string> = {
  neutral: "text-foreground",
  attention: "text-amber-700 dark:text-amber-300",
  danger: "text-rose-700 dark:text-rose-300",
  success: "text-emerald-700 dark:text-emerald-300",
};

export type StatItem = { label: string; value: ReactNode; tone?: StatTone; icon?: LucideIcon };

/** Compact neutral summary strip; two columns on phones. */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-border overflow-hidden rounded-lg border bg-card sm:flex sm:divide-x",
        className,
      )}
    >
      {items.map((s) => (
        <div
          key={s.label}
          className="min-w-0 border-b px-4 py-2.5 odd:border-r sm:flex-1 sm:border-b-0 sm:odd:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"
        >
          <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {s.icon ? <s.icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            {s.label}
          </dt>
          <dd className={cn("text-lg font-semibold tabular-nums leading-tight", STAT_TONE[s.tone ?? "neutral"])}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type ResearchStatus = "active" | "archived" | "shared" | "owner" | "viewer" | "readonly";

const STATUS_BADGE: Record<ResearchStatus, { label: string; icon: LucideIcon | null; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "border-emerald-200 text-emerald-800 dark:border-emerald-900 dark:text-emerald-300" },
  archived: { label: "Archived", icon: Archive, className: "border-slate-300 text-slate-600 dark:text-slate-300" },
  shared: { label: "Shared", icon: Share2, className: "border-sky-200 text-sky-800 dark:border-sky-900 dark:text-sky-300" },
  owner: { label: "Owner", icon: Crown, className: "border-primary/25 text-primary dark:text-sky-300" },
  viewer: { label: "Viewer", icon: Eye, className: "border-slate-300 text-slate-700 dark:text-slate-300" },
  readonly: { label: "Read only", icon: Eye, className: "border-slate-300 text-slate-700 dark:text-slate-300" },
};

/** Subtle outline badge; status is carried by icon and text, never by colour alone. */
export function StatusBadge({ status, label, className }: { status: ResearchStatus; label?: string; className?: string }) {
  const s = STATUS_BADGE[status];
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap bg-background px-1.5 py-0 text-[11px] font-medium", s.className, className)}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label ?? s.label}
    </Badge>
  );
}

/** Badge variant for use on the navy header. */
export function HeroBadge({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <Badge variant="outline" className="gap-1 border-white/30 bg-white/10 px-1.5 py-0 text-[11px] font-medium text-white">
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </Badge>
  );
}

export function ResearchCard({ children, muted, className }: { children: ReactNode; muted?: boolean; className?: string }) {
  return (
    <article
      className={cn(
        "flex h-full min-w-0 flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/30",
        muted && "bg-muted/30 opacity-90",
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Label/value pairs such as "Files 28". */
export function MetaList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1 text-xs", className)}>
      {items.map((m) => (
        <div key={m.label} className="flex min-w-0 items-baseline justify-between gap-2">
          <dt className="truncate text-muted-foreground">{m.label}</dt>
          <dd className="shrink-0 font-medium tabular-nums text-foreground">{m.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Recoverable failure: one line plus Retry, never a full-page error. */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry ? (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 bg-background" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export type FeedItem = {
  key: string;
  at: string;
  dateLabel: string;
  timeLabel: string;
  text: ReactNode;
  where?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Date-led activity feed built from existing activity records. */
export function ActivityFeed({ items, emptyText = "No recent activity." }: { items: FeedItem[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="divide-y rounded-lg border bg-card">
      {items.map((t) => (
        <li key={t.key} className="flex items-start gap-3 px-3 py-2.5">
          <time dateTime={t.at} className="w-12 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground" title={t.timeLabel}>
            {t.dateLabel}
          </time>
          <div className="min-w-0 flex-1 text-sm">
            <p className="break-words leading-snug">{t.text}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t.where ? `${t.where} · ` : ""}
              {t.timeLabel}
            </p>
          </div>
          {t.onAction ? (
            <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-primary dark:text-sky-300" onClick={t.onAction}>
              {t.actionLabel ?? "Open"}
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Compact chip-style filter; exposes pressed state to assistive tech. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {o.label}
            {o.count != null ? <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontally scrollable tab list classes shared by workspace and group pages. */
export const RESEARCH_TABS_LIST_CLASS =
  "h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:thin]";
export const RESEARCH_TAB_TRIGGER_CLASS =
  "shrink-0 rounded-md px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none";
