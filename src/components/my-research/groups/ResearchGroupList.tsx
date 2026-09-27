import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Plus, UsersRound } from "lucide-react";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader } from "../researchUi";
import { ResearchGroupCard } from "./ResearchGroupCard";

const INITIAL_VISIBLE = 3;

interface Props {
  title: string;
  description?: string;
  groups: ResearchGroupCardData[];
  emptyTitle: string;
  emptyText: string;
  canCreate?: boolean;
  onCreate?: () => void;
  children?: ReactNode;
}

/** Compact grid of the most recent group cards with "View all". */
export function ResearchGroupList({ title, description, groups, emptyTitle, emptyText, canCreate, onCreate, children }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? groups : groups.slice(0, INITIAL_VISIBLE);

  return (
    <section className="space-y-3" aria-labelledby="research-groups-heading">
      <SectionHeader
        id="research-groups-heading"
        icon={UsersRound}
        title={title}
        description={description}
        count={groups.length || undefined}
        action={
          groups.length > INITIAL_VISIBLE ? (
            <Button variant="ghost" size="sm" className="h-8 text-primary dark:text-sky-300" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `View all (${groups.length})`}
            </Button>
          ) : null
        }
      />
      {children}
      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={emptyTitle}
          description={emptyText}
          action={
            canCreate ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onCreate}>
                <Plus className="h-4 w-4" aria-hidden /> New Research Group
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <ResearchGroupCard key={g.id} group={g} onOpen={() => navigate(`/my-research/groups/${g.id}`)} />
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden />
        Group membership does not automatically grant access to research workspaces.
      </p>
    </section>
  );
}
