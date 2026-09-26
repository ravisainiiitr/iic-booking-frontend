import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { GroupActivity, GroupCategory, GroupMember } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityProgressDialog } from "./ActivityProgressDialog";
import { ResearchActivityCard } from "./ResearchActivityCard";
import { ResearchActivityDialog } from "./ResearchActivityDialog";
import { EmptyHint } from "./groupUi";

interface Props {
  groupId: string;
  canManage: boolean;
  isManager: boolean;
  members: GroupMember[];
  categories: GroupCategory[];
  focusActivityId?: string | null;
  onChanged: () => void;
}

export function ResearchActivities({ groupId, canManage, isManager, members, categories, focusActivityId, onChanged }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<GroupActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"open" | "closed">("open");
  const [category, setCategory] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [editing, setEditing] = useState<GroupActivity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [progressFor, setProgressFor] = useState<GroupActivity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.listResearchGroupActivities(groupId, {
      state,
      category: category === "all" ? undefined : Number(category),
      assignee: assignee === "all" ? undefined : Number(assignee),
    });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems(res.data?.results ?? []);
  }, [groupId, state, category, assignee]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusActivityId || loading) return;
    document.getElementById(`activity-${focusActivityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusActivityId, loading]);

  const saved = () => {
    void load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Activity state">
          {(["open", "closed"] as const).map((s) => (
            <Button key={s} size="sm" variant={state === s ? "secondary" : "ghost"} className="h-8" aria-pressed={state === s} onClick={() => setState(s)}>
              {s === "open" ? "Active" : "Completed / cancelled"}
            </Button>
          ))}
        </div>
        {categories.length > 0 ? (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {isManager && members.length > 0 ? (
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by member">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.user.id)}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {canManage ? (
          <Button className="gap-1.5 sm:ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Activity
          </Button>
        ) : null}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <EmptyHint>
          {state === "open"
            ? isManager
              ? "No active activities. Create one and assign it to members."
              : "No activities assigned to you right now."
            : "Nothing completed or cancelled yet."}
        </EmptyHint>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((a) => (
            <ResearchActivityCard
              key={a.id}
              activity={a}
              highlighted={a.id === focusActivityId}
              onEdit={canManage ? () => setEditing(a) : undefined}
              onUpdateProgress={() => setProgressFor(a)}
              onOpenWorkspace={(id) => navigate(`/my-research/${id}`)}
            />
          ))}
        </div>
      )}

      {canManage ? (
        <ResearchActivityDialog
          groupId={groupId}
          open={createOpen || Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          activity={editing}
          members={members}
          categories={categories}
          onSaved={saved}
        />
      ) : null}
      <ActivityProgressDialog activity={progressFor} onOpenChange={(open) => !open && setProgressFor(null)} onSaved={saved} />
    </div>
  );
}
