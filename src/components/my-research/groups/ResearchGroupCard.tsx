import { ArrowRight, UsersRound } from "lucide-react";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { MetaList, ResearchCard, StatusBadge } from "../researchUi";

export function ResearchGroupCard({ group, onOpen }: { group: ResearchGroupCardData; onOpen: () => void }) {
  const c = group.counts;
  const manager = group.my_role === "OWNER" || group.my_role === "MANAGER";
  const archived = group.status === "ARCHIVED";
  const lead =
    group.my_role === "OWNER"
      ? "Led by you"
      : `Led by ${group.owner.name}${group.my_role === "MANAGER" ? " · Co-manager" : ""}`;
  const stats = manager
    ? [
        { label: "Members", value: c.members },
        { label: "Active activities", value: c.active_activities ?? 0 },
        { label: "Pending updates", value: c.pending_updates ?? 0 },
        {
          label: "Overdue",
          value: (
            <span className={(c.overdue_updates ?? 0) > 0 ? "text-rose-700 dark:text-rose-300" : undefined}>{c.overdue_updates ?? 0}</span>
          ),
        },
      ]
    : [
        { label: "Members", value: c.members },
        { label: "My activities", value: c.my_active_activities ?? 0 },
        { label: "Updates due", value: c.my_open_requests ?? 0 },
      ];

  return (
    <ResearchCard muted={archived}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20 dark:text-sky-300"
          aria-hidden
        >
          <UsersRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{group.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {lead}
            {group.owner.department && group.my_role !== "OWNER" ? ` · ${group.owner.department}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {group.short_code ? (
              <span className="rounded border px-1.5 text-[11px] font-medium text-muted-foreground">{group.short_code}</span>
            ) : null}
            {!manager && group.my_membership ? <StatusBadge status="viewer" label={group.my_membership.member_type_label} /> : null}
            {archived ? <StatusBadge status="archived" /> : null}
          </div>
        </div>
      </div>
      {group.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{group.description}</p> : null}
      <MetaList items={stats} className="mt-3" />
      {manager && c.awaiting_review ? (
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          {c.awaiting_review} update{c.awaiting_review === 1 ? "" : "s"} to review
        </p>
      ) : null}
      <div className="mt-auto pt-3">
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onOpen} aria-label={`Open group ${group.name}`}>
          Open Group <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </ResearchCard>
  );
}
