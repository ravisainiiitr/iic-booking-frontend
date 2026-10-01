import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ClipboardList, MessageSquareText } from "lucide-react";
import type { GroupMyWork } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { ActivityStatusBadge, DueLabel, ProgressLine, RequestStatusBadge, SectionHeading } from "./groupUi";
import { groupPath } from "./groupLabels";

/**
 * Student "To do": the member's own open tasks and progress update requests across groups.
 * Renders nothing when empty unless an `action` (e.g. "Send update") is given.
 */
export function MyActivitiesUpdates({ work, action }: { work: GroupMyWork; action?: ReactNode }) {
  const navigate = useNavigate();
  const requests = [...work.update_requests].sort((a, b) => Number(b.status === "OVERDUE") - Number(a.status === "OVERDUE"));
  const empty = work.activities.length === 0 && requests.length === 0;
  if (empty && !action) return null;

  if (empty) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm" aria-label="To do">
        <span className="flex items-center gap-2 text-muted-foreground">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden />
          Nothing to do right now. You can still send your supervisor an update.
        </span>
        {action}
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label="To do">
      <SectionHeading icon={ClipboardCheck} title="To do" count={requests.length + work.activities.length} action={action} />
      <div className={`grid gap-3 ${requests.length && work.activities.length ? "lg:grid-cols-2" : ""}`}>
        {requests.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <h3 className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-primary" aria-hidden /> Progress updates asked for ({requests.length})
            </h3>
            <ul className="divide-y">
              {requests.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1 basis-52">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[11px] text-muted-foreground">{r.group_name}</span>
                      <DueLabel date={r.due_date} overdue={r.status === "OVERDUE"} daysOverdue={r.days_overdue} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RequestStatusBadge status={r.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 sm:h-8"
                      onClick={() => navigate(groupPath(r.group_id, "updates", { request: r.id }))}
                    >
                      Send update
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {work.activities.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <h3 className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> My tasks ({work.activities.length})
            </h3>
            <ul className="divide-y">
              {work.activities.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full space-y-1 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => navigate(groupPath(a.group_id, "activities", { activity: a.id }))}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                      <ActivityStatusBadge
                        status={a.my_assignment?.status ?? a.status}
                        label={a.my_assignment?.status_label ?? a.status_label}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[11px] text-muted-foreground">{a.group_name}</span>
                      <DueLabel date={a.due_date} overdue={a.is_overdue} />
                    </div>
                    <ProgressLine value={a.my_assignment?.progress_percent ?? 0} label={`My progress on ${a.title}`} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
