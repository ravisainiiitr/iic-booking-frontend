import { CalendarCheck, FlaskConical, Microscope, Pencil, TrendingUp, Users } from "lucide-react";
import type { GroupActivity } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityStatusBadge, DueLabel, PriorityLabel, ProgressLine } from "./groupUi";

interface Props {
  activity: GroupActivity;
  highlighted?: boolean;
  onEdit?: () => void;
  onUpdateProgress?: () => void;
  onOpenWorkspace?: (workspaceId: string) => void;
}

export function ResearchActivityCard({ activity: a, highlighted, onEdit, onUpdateProgress, onOpenWorkspace }: Props) {
  const mine = a.my_assignment;
  const showAll = a.permissions.can_edit || (!mine && a.assignees.length > 0);
  return (
    <article
      id={`activity-${a.id}`}
      className={`space-y-2 rounded-xl border bg-card p-3 sm:p-4 ${highlighted ? "ring-2 ring-violet-400" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold leading-snug">{a.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {a.category ? (
              <Badge variant="secondary" className="text-[10px]">
                {a.category.name}
              </Badge>
            ) : null}
            <PriorityLabel priority={a.priority} />
            <DueLabel date={a.due_date} overdue={a.is_overdue} />
          </div>
        </div>
        <ActivityStatusBadge status={a.status} label={a.status_label} />
      </div>
      {a.description ? <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{a.description}</p> : null}

      {(a.workspace || a.equipment || a.booking) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {a.workspace ? (
            a.workspace.accessible && onOpenWorkspace ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-violet-700 hover:underline dark:text-violet-300"
                onClick={() => onOpenWorkspace(a.workspace!.id)}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden /> {a.workspace.name}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1" title="Workspace access is shared separately">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden /> {a.workspace.name} (not shared with you)
              </span>
            )
          ) : null}
          {a.equipment ? (
            <span className="inline-flex items-center gap-1">
              <Microscope className="h-3.5 w-3.5" aria-hidden /> {a.equipment.name}
            </span>
          ) : null}
          {a.booking ? (
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> {a.booking.display_id}
              {a.booking.equipment_name ? ` · ${a.booking.equipment_name}` : ""}
            </span>
          ) : null}
        </div>
      )}

      {mine ? (
        <div className="space-y-1 rounded-lg bg-muted/40 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">My progress</span>
            <ActivityStatusBadge status={mine.status} label={mine.status_label} />
          </div>
          <ProgressLine value={mine.progress_percent} label={`My progress on ${a.title}`} />
          {mine.note ? <p className="line-clamp-2 text-xs text-muted-foreground">{mine.note}</p> : null}
        </div>
      ) : null}

      {showAll && a.assignees.length > 0 ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden /> Assigned to {a.assignee_count}
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {a.assignees.map((x) => (
              <li key={x.id} className="min-w-0 rounded-md border px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{x.user.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{x.status_label}</span>
                </div>
                <ProgressLine value={x.progress_percent} label={`${x.user.name}'s progress`} />
              </li>
            ))}
          </ul>
        </div>
      ) : a.permissions.can_edit ? (
        <p className="text-xs text-muted-foreground">Not assigned yet.</p>
      ) : null}

      {(onEdit && a.permissions.can_edit) || (onUpdateProgress && a.permissions.can_update_progress) ? (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {onUpdateProgress && a.permissions.can_update_progress ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onUpdateProgress}>
              <TrendingUp className="h-4 w-4" aria-hidden /> Update my progress
            </Button>
          ) : null}
          {onEdit && a.permissions.can_edit ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
