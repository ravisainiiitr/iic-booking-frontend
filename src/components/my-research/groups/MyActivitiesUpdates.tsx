import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ClipboardList, MessageSquareText } from "lucide-react";
import type { GroupMyWork } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { ActivityStatusBadge, DueLabel, EmptyHint, ProgressLine, RequestStatusBadge, SectionHeading } from "./groupUi";
import { groupPath } from "./groupLabels";

/** Student home section: the member's own open activities and update requests across groups. */
export function MyActivitiesUpdates({ work }: { work: GroupMyWork }) {
  const navigate = useNavigate();
  const requests = [...work.update_requests].sort((a, b) => Number(b.status === "OVERDUE") - Number(a.status === "OVERDUE"));

  return (
    <section className="space-y-3" aria-label="My activities and updates">
      <SectionHeading icon={ClipboardCheck} title="My Activities & Updates" />
      {work.activities.length === 0 && requests.length === 0 ? (
        <EmptyHint>No open activities or update requests. Work your supervisor assigns will appear here.</EmptyHint>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border bg-card">
            <h3 className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-violet-600" aria-hidden /> Updates requested ({requests.length})
            </h3>
            {requests.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No updates requested.</p>
            ) : (
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
                        className="h-8"
                        onClick={() => navigate(groupPath(r.group_id, "updates", { request: r.id }))}
                      >
                        Submit update
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border bg-card">
            <h3 className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-violet-600" aria-hidden /> My activities ({work.activities.length})
            </h3>
            {work.activities.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No open activities.</p>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </section>
  );
}
