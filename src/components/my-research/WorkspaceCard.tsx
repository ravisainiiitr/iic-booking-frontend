import { ArrowRight, FlaskConical } from "lucide-react";
import type { ResearchWorkspaceCard } from "@/lib/myResearchTypes";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "./researchUtils";
import { MetaList, ResearchCard, StatusBadge } from "./researchUi";

/** Workspace summary used by My Workspaces and Shared With Me. */
export function WorkspaceCard({ ws, onOpen }: { ws: ResearchWorkspaceCard; onOpen: () => void }) {
  const archived = ws.status === "ARCHIVED";
  const isOwner = ws.role === "OWNER";
  const people = (ws.stats.viewers ?? 0) + 1;
  return (
    <ResearchCard muted={archived}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20 dark:text-sky-300"
          aria-hidden
        >
          <FlaskConical className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{ws.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {isOwner ? "Owner: You" : `Owner: ${ws.owner.name}`}
            {ws.owner.department ? ` · ${ws.owner.department}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {isOwner ? <StatusBadge status="owner" /> : <StatusBadge status="readonly" />}
            {isOwner && ws.stats.viewers > 0 ? <StatusBadge status="shared" /> : null}
            {archived ? <StatusBadge status="archived" /> : null}
          </div>
        </div>
      </div>
      {ws.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{ws.description}</p> : null}
      <MetaList
        className="mt-3"
        items={[
          { label: "Files", value: ws.stats.files },
          { label: "Bookings", value: ws.stats.bookings },
          { label: "Publications", value: ws.stats.publications },
          { label: "Members", value: people },
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Last activity {formatDate(ws.last_activity_at)}
        {ws.stats.storage_bytes > 0 ? ` · ${formatBytes(ws.stats.storage_bytes)} used` : ""}
      </p>
      <div className="mt-auto pt-3">
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onOpen} aria-label={`Open workspace ${ws.name}`}>
          Open Workspace <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </ResearchCard>
  );
}
