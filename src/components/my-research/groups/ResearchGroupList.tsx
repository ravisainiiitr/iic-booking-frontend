import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UsersRound } from "lucide-react";
import type { ResearchGroupCardData } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ResearchGroupCard } from "./ResearchGroupCard";
import { EmptyHint, SectionHeading } from "./groupUi";

const INITIAL_VISIBLE = 3;

interface Props {
  title: string;
  groups: ResearchGroupCardData[];
  emptyText: string;
  canCreate?: boolean;
  onCreate?: () => void;
  children?: React.ReactNode;
}

/** Compact grid of group cards with "View all" and an archived toggle. */
export function ResearchGroupList({ title, groups, emptyText, canCreate, onCreate, children }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = groups.filter((g) => g.status === "ARCHIVED").length;
  const visibleGroups = groups.filter((g) => showArchived || g.status === "ACTIVE");
  const shown = showAll ? visibleGroups : visibleGroups.slice(0, INITIAL_VISIBLE);

  return (
    <section className="space-y-3" aria-label={title}>
      <SectionHeading
        icon={UsersRound}
        title={title}
        count={visibleGroups.length || undefined}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {archivedCount > 0 ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived groups" />
                Archived ({archivedCount})
              </label>
            ) : null}
            {visibleGroups.length > INITIAL_VISIBLE ? (
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show less" : `View all (${visibleGroups.length})`}
              </Button>
            ) : null}
          </div>
        }
      />
      {children}
      {visibleGroups.length === 0 ? (
        canCreate ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
            <Button size="sm" className="gap-2" onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden /> New Research Group
            </Button>
          </div>
        ) : (
          <EmptyHint>{emptyText}</EmptyHint>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <ResearchGroupCard key={g.id} group={g} onOpen={() => navigate(`/my-research/groups/${g.id}`)} />
          ))}
        </div>
      )}
    </section>
  );
}
