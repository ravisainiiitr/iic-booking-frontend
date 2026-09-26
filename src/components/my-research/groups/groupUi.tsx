import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  Eye,
  Hourglass,
  Minus,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  GroupActivityPriority,
  GroupActivityStatus,
  GroupEvent,
  UpdateRequestStatus,
} from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "../researchUtils";
import { REQUEST_STATUS_LABEL, activityStatusLabel, eventSentence } from "./groupLabels";

const ACTIVITY_STATUS_STYLE: Record<GroupActivityStatus, { icon: LucideIcon; className: string }> = {
  NOT_STARTED: { icon: Circle, className: "border-slate-300 text-slate-700 dark:text-slate-300" },
  IN_PROGRESS: { icon: CircleDashed, className: "border-sky-300 text-sky-800 dark:text-sky-300" },
  WAITING: { icon: Hourglass, className: "border-amber-300 text-amber-800 dark:text-amber-300" },
  SUBMITTED: { icon: Send, className: "border-violet-300 text-violet-800 dark:text-violet-300" },
  UNDER_REVIEW: { icon: Eye, className: "border-violet-300 text-violet-800 dark:text-violet-300" },
  COMPLETED: { icon: CheckCircle2, className: "border-emerald-300 text-emerald-800 dark:text-emerald-300" },
  CANCELLED: { icon: XCircle, className: "border-slate-300 text-slate-500" },
};

/** Status is always conveyed by icon + text, never by colour alone. */
export function ActivityStatusBadge({ status, label }: { status: GroupActivityStatus; label?: string }) {
  const style = ACTIVITY_STATUS_STYLE[status] ?? ACTIVITY_STATUS_STYLE.NOT_STARTED;
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap bg-background text-[11px] font-medium", style.className)}>
      <Icon className="h-3 w-3" aria-hidden /> {label ?? activityStatusLabel(status)}
    </Badge>
  );
}

const REQUEST_STATUS_STYLE: Record<UpdateRequestStatus, { icon: LucideIcon; className: string }> = {
  PENDING: { icon: Clock, className: "border-sky-300 text-sky-800 dark:text-sky-300" },
  OVERDUE: { icon: AlertTriangle, className: "border-rose-300 text-rose-800 dark:text-rose-300" },
  SUBMITTED: { icon: Send, className: "border-violet-300 text-violet-800 dark:text-violet-300" },
  REVIEWED: { icon: CheckCircle2, className: "border-emerald-300 text-emerald-800 dark:text-emerald-300" },
  CANCELLED: { icon: XCircle, className: "border-slate-300 text-slate-500" },
};

export function RequestStatusBadge({ status }: { status: UpdateRequestStatus }) {
  const style = REQUEST_STATUS_STYLE[status] ?? REQUEST_STATUS_STYLE.PENDING;
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap bg-background text-[11px] font-medium", style.className)}>
      <Icon className="h-3 w-3" aria-hidden /> {REQUEST_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PriorityLabel({ priority }: { priority: GroupActivityPriority }) {
  if (priority === "NORMAL") return null;
  const high = priority === "HIGH";
  const Icon = high ? ArrowUp : priority === "LOW" ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", high ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
      <Icon className="h-3 w-3" aria-hidden /> {high ? "High priority" : "Low priority"}
    </span>
  );
}

export function ProgressLine({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label ?? "Progress"}
      >
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function DueLabel({ date, overdue, daysOverdue }: { date: string | null; overdue?: boolean; daysOverdue?: number }) {
  if (!date) return <span className="text-[11px] text-muted-foreground">No due date</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px]",
        overdue ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground",
      )}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
      {overdue ? `Overdue${daysOverdue ? ` by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}` : ""} · ` : "Due "}
      {formatDate(date)}
    </span>
  );
}

export function SectionHeading({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
        <Icon className="h-5 w-5 text-violet-600" aria-hidden /> {title}
        {count != null ? <span className="text-sm font-normal text-muted-foreground">({count})</span> : null}
      </h2>
      {action}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{children}</p>
  );
}

export function GroupEventList({ events, showGroup, onOpen }: { events: GroupEvent[]; showGroup?: boolean; onOpen?: (e: GroupEvent) => void }) {
  if (events.length === 0) return <EmptyHint>No activity yet.</EmptyHint>;
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-violet-400" aria-hidden />
          <button
            type="button"
            disabled={!onOpen}
            onClick={() => onOpen?.(e)}
            className="min-w-0 break-words text-left enabled:hover:underline"
          >
            <span className="font-medium">{e.actor?.name ?? "System"}</span>{" "}
            <span className="text-muted-foreground">{eventSentence(e)}</span>
          </button>
          <p className="text-xs text-muted-foreground">
            {showGroup && e.group_name ? `${e.group_name} · ` : ""}
            {timeAgo(e.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
