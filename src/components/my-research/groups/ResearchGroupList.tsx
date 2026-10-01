import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Plus, UsersRound } from "lucide-react";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "../researchUi";
import { ResearchGroupCard } from "./ResearchGroupCard";

const INITIAL_VISIBLE = 3;

interface Props {
  title: string;
  description?: string;
  groups: ResearchGroupCardData[];
  emptyText: string;
  canCreate?: boolean;
  onCreate?: () => void;
  children?: ReactNode;
}

/** Compact grid of the most recent group cards with "View all"; a single line when there are none. */
export function ResearchGroupList({ title, description, groups, emptyText, canCreate, onCreate, children }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? groups : groups.slice(0, INITIAL_VISIBLE);

  return (
    <section className="space-y-3" aria-labelledby="research-groups-heading">
      <SectionHeader
        id="research-groups-heading"
        icon={UsersRound}
        title={title}
        description={groups.length ? description : undefined}
        count={groups.length || undefined}
        action={
          groups.length > INITIAL_VISIBLE ? (
            <Button variant="ghost" size="sm" className="h-10 text-primary dark:text-sky-300 sm:h-8" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `View all (${groups.length})`}
            </Button>
          ) : null
        }
      />
      {children}
      {groups.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">
          <span>{emptyText}</span>
          {canCreate ? (
            <Button size="sm" variant="outline" className="h-10 gap-1.5 sm:h-8" onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden /> New group
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((g) => (
              <ResearchGroupCard key={g.id} group={g} onOpen={() => navigate(`/my-research/groups/${g.id}`)} />
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            Being in a group does not give access to anyone's projects.
          </p>
        </>
      )}
    </section>
  );
}
