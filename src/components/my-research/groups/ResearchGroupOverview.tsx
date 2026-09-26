import { Archive, Lock, MoreHorizontal, Pencil, Tags } from "lucide-react";
import type { ResearchGroupDetail } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RESEARCH_GRADIENT, formatDate } from "../researchUtils";

interface Props {
  group: ResearchGroupDetail;
  onEdit: () => void;
  onManageCategories: () => void;
  onArchive: () => void;
}

function Count({ label, value, alert }: { label: string; value: number | undefined; alert?: boolean }) {
  if (value == null) return null;
  return (
    <div className="min-w-[88px] rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20">
      <p className={`text-lg font-semibold tabular-nums ${alert && value > 0 ? "text-amber-200" : ""}`}>{value}</p>
      <p className="text-[11px] text-white/80">{label}</p>
    </div>
  );
}

/** Group header: identity, factual counts and faculty actions. */
export function ResearchGroupOverview({ group, onEdit, onManageCategories, onArchive }: Props) {
  const c = group.counts;
  const perms = group.permissions;
  return (
    <div className={`overflow-hidden rounded-xl bg-gradient-to-r ${RESEARCH_GRADIENT} px-4 py-5 text-white shadow-lg sm:px-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-bold sm:text-2xl">{group.name}</h1>
            {group.short_code ? (
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/20">
                {group.short_code}
              </Badge>
            ) : null}
            {group.status === "ARCHIVED" ? (
              <Badge variant="secondary" className="gap-1 bg-white/20 text-white hover:bg-white/20">
                <Archive className="h-3 w-3" aria-hidden /> Archived {formatDate(group.archived_at)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-white/85">
            Led by {group.owner_details.name}
            {group.owner_details.department ? ` · ${group.owner_details.department}` : ""}
            {!perms.can_manage && group.my_membership ? ` · You: ${group.my_membership.member_type_label}` : ""}
          </p>
          {group.description ? <p className="mt-2 line-clamp-3 max-w-3xl text-sm text-white/85">{group.description}</p> : null}
        </div>
        {perms.can_manage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1.5" aria-label="Group actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden /> Manage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageCategories}>
                <Tags className="mr-2 h-4 w-4" aria-hidden /> Manage categories
              </DropdownMenuItem>
              {perms.can_archive ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onArchive} className="text-destructive focus:text-destructive">
                    <Archive className="mr-2 h-4 w-4" aria-hidden /> Archive group
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Count label="Members" value={c.members} />
        {perms.can_manage || group.my_role !== "MEMBER" ? (
          <>
            <Count label="Active activities" value={c.active_activities} />
            <Count label="Pending updates" value={c.pending_updates} />
            <Count label="Overdue" value={c.overdue_updates} alert />
            <Count label="To review" value={c.awaiting_review} />
          </>
        ) : null}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/80">
        <Lock className="h-3 w-3" aria-hidden /> Group membership does not give access to anyone's research workspaces.
      </p>
    </div>
  );
}
