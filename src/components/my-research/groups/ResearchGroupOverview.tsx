import { Archive, MessageSquarePlus, MoreHorizontal, Pencil, RefreshCw, Tags, UserPlus, UsersRound } from "lucide-react";
import type { ResearchGroupDetail } from "@/lib/researchGroupTypes";
import { PageHero, heroButtonClass } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "../researchUtils";
import { HeroBadge, StatStrip, type StatItem } from "../researchUi";
import { leadName } from "./groupLabels";

interface Props {
  group: ResearchGroupDetail;
  onEdit: () => void;
  onManageCategories: () => void;
  onArchive: () => void;
  onAddMember: () => void;
  onAskUpdate: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

/** Metrics only appear once there is something to count; zero-only strips are noise. */
function groupSummaryStats(group: ResearchGroupDetail): StatItem[] {
  const c = group.counts;
  const manager = group.permissions.can_manage || group.my_role !== "MEMBER";
  const metrics: StatItem[] = manager
    ? [
        { label: "Open tasks", value: c.active_activities ?? 0 },
        { label: "Updates not sent", value: c.pending_updates ?? 0, tone: (c.pending_updates ?? 0) > 0 ? "attention" : "neutral" },
        { label: "Overdue", value: c.overdue_updates ?? 0, tone: (c.overdue_updates ?? 0) > 0 ? "danger" : "neutral" },
        { label: "To review", value: c.awaiting_review ?? 0, tone: (c.awaiting_review ?? 0) > 0 ? "attention" : "neutral" },
      ]
    : [
        { label: "My tasks", value: c.my_active_activities ?? 0 },
        { label: "Updates due", value: c.my_open_requests ?? 0, tone: (c.my_open_requests ?? 0) > 0 ? "attention" : "neutral" },
      ];
  if (metrics.every((m) => m.value === 0)) return [];
  return [{ label: "Members", value: c.members }, ...metrics];
}

/** Group header: identity, lead, and faculty-only management actions. */
export function ResearchGroupOverview({ group, onEdit, onManageCategories, onArchive, onAddMember, onAskUpdate, onRefresh, refreshing }: Props) {
  const perms = group.permissions;
  const archived = group.status === "ARCHIVED";
  const stats = groupSummaryStats(group);
  const canAsk = perms.can_manage && !archived && group.counts.members > 0;
  return (
    <div className="space-y-3">
      <PageHero
        compact
        title={group.name}
        icon={<UsersRound className="h-5 w-5" />}
        badges={
          <>
            {group.short_code ? <HeroBadge>{group.short_code}</HeroBadge> : null}
            {archived ? <HeroBadge icon={Archive}>Archived {formatDate(group.archived_at)}</HeroBadge> : null}
          </>
        }
        description={group.description || undefined}
        meta={
          <>
            <span>Research group</span>
            <span>
              {perms.can_manage ? "Led by" : "Supervisor:"} {perms.is_owner ? "you" : leadName(group.owner_details.name)}
            </span>
            {group.owner_details.department ? <span>Department: {group.owner_details.department}</span> : null}
            {stats.length === 0 ? <span>{group.counts.members} member{group.counts.members === 1 ? "" : "s"}</span> : null}
            {!perms.can_manage && group.my_membership ? <span>You: {group.my_membership.member_type_label}</span> : null}
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh group"
              title="Refresh"
              className={`h-10 w-10 md:h-9 md:w-9 ${heroButtonClass.icon}`}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            </Button>
            {canAsk ? (
              <Button size="sm" className={`gap-1.5 ${heroButtonClass.primary}`} onClick={onAskUpdate}>
                <MessageSquarePlus className="h-4 w-4" aria-hidden /> Ask for an update
              </Button>
            ) : null}
            {perms.can_manage && !archived ? (
              <Button
                size="sm"
                variant={canAsk ? "outline" : "default"}
                className={`gap-1.5 ${canAsk ? heroButtonClass.secondary : heroButtonClass.primary}`}
                onClick={onAddMember}
              >
                <UserPlus className="h-4 w-4" aria-hidden /> Add member
              </Button>
            ) : null}
            {perms.can_manage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className={`gap-1.5 ${heroButtonClass.secondary}`} aria-label="Manage group">
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
          </>
        }
      />
      <StatStrip items={stats} />
    </div>
  );
}
