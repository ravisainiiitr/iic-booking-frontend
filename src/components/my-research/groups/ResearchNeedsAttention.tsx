import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Send } from "lucide-react";
import type { GroupActivity, GroupNeedsAttention, GroupUpdateRequest } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DueLabel, RequestStatusBadge } from "./groupUi";

interface Props {
  data: GroupNeedsAttention;
  onOpenRequest?: (req: GroupUpdateRequest) => void;
  onOpenActivity?: (activity: GroupActivity) => void;
  onViewAll?: () => void;
  showGroup?: boolean;
  limit?: number;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Compact task area: only non-zero counts, the top items, and a way to see the rest. */
export function ResearchNeedsAttention({ data, onOpenRequest, onOpenActivity, onViewAll, showGroup, limit = 4 }: Props) {
  const total = data.overdue_updates + data.awaiting_review + data.pending_updates + data.activities_due_this_week;

  if (total === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground" aria-label="Needs attention">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> Nothing needs your attention.
      </p>
    );
  }

  const summary = [
    { n: data.overdue_updates, text: plural(data.overdue_updates, "overdue update", "overdue updates"), icon: AlertTriangle, tone: "danger" },
    { n: data.awaiting_review, text: plural(data.awaiting_review, "update to review", "updates to review"), icon: Send, tone: "attention" },
    { n: data.pending_updates, text: plural(data.pending_updates, "pending update", "pending updates"), icon: Clock, tone: "neutral" },
    {
      n: data.activities_due_this_week,
      text: plural(data.activities_due_this_week, "activity due this week", "activities due this week"),
      icon: CalendarClock,
      tone: "neutral",
    },
  ].filter((s) => s.n > 0);

  const requests = [...data.update_requests].sort((a, b) => {
    const rank = (r: GroupUpdateRequest) => (r.status === "OVERDUE" ? 0 : r.status === "SUBMITTED" ? 1 : 2);
    return rank(a) - rank(b);
  });
  const items = requests.slice(0, limit);
  const activities = data.activities_due.slice(0, Math.max(0, limit - items.length));
  const hidden = requests.length + data.activities_due.length - items.length - activities.length;

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="needs-attention-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h3 id="needs-attention-heading" className="text-sm font-semibold">
            Needs attention
          </h3>
          <ul className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {summary.map((s) => (
              <li
                key={s.text}
                className={cn(
                  "inline-flex items-center gap-1",
                  s.tone === "danger" && "font-medium text-rose-700 dark:text-rose-300",
                  s.tone === "attention" && "font-medium text-amber-700 dark:text-amber-300",
                  s.tone === "neutral" && "text-muted-foreground",
                )}
              >
                <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.text}
              </li>
            ))}
          </ul>
        </div>
        {onViewAll ? (
          <Button size="sm" variant="ghost" className="h-8 text-primary dark:text-sky-300" onClick={onViewAll}>
            View all
          </Button>
        ) : null}
      </div>
      <ul className="divide-y">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <div className="min-w-0 flex-1 basis-52">
              <p className="truncate text-sm font-medium">
                {r.assigned_to.name} · {r.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {showGroup ? <span className="text-[11px] text-muted-foreground">{r.group_name}</span> : null}
                <DueLabel date={r.due_date} overdue={r.status === "OVERDUE"} daysOverdue={r.days_overdue} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RequestStatusBadge status={r.status} />
              {onOpenRequest ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-primary dark:text-sky-300" onClick={() => onOpenRequest(r)}>
                  {r.status === "SUBMITTED" ? "Review" : "View"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {activities.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <div className="min-w-0 flex-1 basis-52">
              <p className="truncate text-sm font-medium">{a.title}</p>
              <div className="flex flex-wrap items-center gap-2">
                {showGroup ? <span className="text-[11px] text-muted-foreground">{a.group_name}</span> : null}
                <span className="text-[11px] text-muted-foreground">{a.assignees.map((x) => x.user.name).join(", ") || "Unassigned"}</span>
                <DueLabel date={a.due_date} overdue={a.is_overdue} />
              </div>
            </div>
            {onOpenActivity ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-primary dark:text-sky-300" onClick={() => onOpenActivity(a)}>
                View
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {hidden > 0 && !onViewAll ? <p className="border-t px-4 py-2 text-xs text-muted-foreground">+{hidden} more</p> : null}
    </section>
  );
}
