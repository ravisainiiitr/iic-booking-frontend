import { AlertTriangle, CalendarClock, Clock, Send } from "lucide-react";
import type { GroupActivity, GroupNeedsAttention, GroupUpdateRequest } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { DueLabel, RequestStatusBadge } from "./groupUi";

interface Props {
  data: GroupNeedsAttention;
  onOpenRequest?: (req: GroupUpdateRequest) => void;
  onOpenActivity?: (activity: GroupActivity) => void;
  showGroup?: boolean;
  limit?: number;
}

function Chip({ icon: Icon, label, value, alert }: { icon: typeof Clock; label: string; value: number; alert?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        alert && value > 0 ? "border-rose-200 bg-rose-50 font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" : "bg-background"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden /> {value} {label}
    </span>
  );
}

/** Compact list of what needs a faculty response: overdue, awaiting review, pending and due soon. */
export function ResearchNeedsAttention({ data, onOpenRequest, onOpenActivity, showGroup, limit = 6 }: Props) {
  const total = data.overdue_updates + data.awaiting_review + data.pending_updates + data.activities_due_this_week;
  const requests = [...data.update_requests].sort((a, b) => {
    const rank = (r: GroupUpdateRequest) => (r.status === "OVERDUE" ? 0 : r.status === "SUBMITTED" ? 1 : 2);
    return rank(a) - rank(b);
  });
  const items = requests.slice(0, limit);
  const activities = data.activities_due.slice(0, Math.max(0, limit - items.length));

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4" aria-label="Needs attention">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Needs attention</h3>
        <div className="flex flex-wrap gap-1.5">
          <Chip icon={AlertTriangle} label="overdue" value={data.overdue_updates} alert />
          <Chip icon={Send} label="to review" value={data.awaiting_review} />
          <Chip icon={Clock} label="pending" value={data.pending_updates} />
          <Chip icon={CalendarClock} label="due this week" value={data.activities_due_this_week} />
        </div>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing needs your attention right now.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
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
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => onOpenRequest(r)}>
                    {r.status === "SUBMITTED" ? "Review" : "View"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {activities.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {showGroup ? <span className="text-[11px] text-muted-foreground">{a.group_name}</span> : null}
                  <span className="text-[11px] text-muted-foreground">
                    {a.assignees.map((x) => x.user.name).join(", ") || "Unassigned"}
                  </span>
                  <DueLabel date={a.due_date} overdue={a.is_overdue} />
                </div>
              </div>
              {onOpenActivity ? (
                <Button size="sm" variant="ghost" className="h-8" onClick={() => onOpenActivity(a)}>
                  View
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
