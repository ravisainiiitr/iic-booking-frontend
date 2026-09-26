import { AlertTriangle, ArrowRight, ClipboardList, Clock, Send, Users } from "lucide-react";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESEARCH_GRADIENT } from "../researchUtils";

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone?: "alert" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${tone === "alert" && value > 0 ? "font-medium text-rose-700 dark:text-rose-300" : ""}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {value} {label}
    </span>
  );
}

export function ResearchGroupCard({ group, onOpen }: { group: ResearchGroupCardData; onOpen: () => void }) {
  const c = group.counts;
  const manager = group.my_role === "OWNER" || group.my_role === "MANAGER";
  const initials = (group.short_code || group.name).slice(0, 3).toUpperCase();
  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${RESEARCH_GRADIENT} text-xs font-bold text-white`}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="line-clamp-2 font-semibold leading-snug">{group.name}</h3>
            {group.status === "ARCHIVED" ? (
              <Badge variant="outline" className="text-[10px]">
                Archived
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {manager
              ? group.my_role === "OWNER"
                ? "You lead this group"
                : `Co-managed · led by ${group.owner.name}`
              : `${group.owner.name}${group.my_membership ? ` · ${group.my_membership.member_type_label}` : ""}`}
          </p>
        </div>
      </div>
      {group.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{group.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Stat icon={Users} label={c.members === 1 ? "member" : "members"} value={c.members} />
        {manager ? (
          <>
            <Stat icon={ClipboardList} label="active" value={c.active_activities ?? 0} />
            <Stat icon={Clock} label="pending" value={c.pending_updates ?? 0} />
            <Stat icon={AlertTriangle} label="overdue" value={c.overdue_updates ?? 0} tone="alert" />
            {c.awaiting_review ? <Stat icon={Send} label="to review" value={c.awaiting_review} /> : null}
          </>
        ) : (
          <>
            <Stat icon={ClipboardList} label="my activities" value={c.my_active_activities ?? 0} />
            <Stat icon={Clock} label="updates due" value={c.my_open_requests ?? 0} />
          </>
        )}
      </div>
      <div className="mt-auto pt-3">
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onOpen} aria-label={`Open group ${group.name}`}>
          Open Group <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
