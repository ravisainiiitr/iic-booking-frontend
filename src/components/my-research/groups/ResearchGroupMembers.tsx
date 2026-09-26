import { useMemo, useState } from "react";
import { Crown, Search, Shield, UserPlus } from "lucide-react";
import type { GroupCategory, GroupMember, GroupPublicUser } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "../researchUtils";
import { AddGroupMemberDialog } from "./AddGroupMemberDialog";
import { GroupMemberDetailDialog } from "./GroupMemberDetailDialog";
import { EmptyHint } from "./groupUi";

interface Props {
  groupId: string;
  groupName: string;
  owner: GroupPublicUser;
  members: GroupMember[];
  categories: GroupCategory[];
  canManage: boolean;
  isManager: boolean;
  isOwner: boolean;
  onChanged: () => void;
}

export function ResearchGroupMembers({ groupId, groupName, owner, members, categories, canManage, isManager, isOwner, onChanged }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (category === "all" || (category === "none" ? !m.category : String(m.category?.id) === category)) &&
        (!q || m.user.name.toLowerCase().includes(q) || (m.user.email ?? "").toLowerCase().includes(q)),
    );
  }, [members, query, category]);

  const categoryOptions = categories.filter((c) => c.active || members.some((m) => m.category?.id === c.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" aria-label="Search members" />
        </div>
        {categoryOptions.length > 0 ? (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="none">No category</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {canManage ? (
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> Add Member
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <Crown className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span className="min-w-0 truncate">
          <span className="font-medium">{owner.name}</span>
          <span className="text-muted-foreground"> · Group lead{owner.department ? ` · ${owner.department}` : ""}</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint>{members.length === 0 ? "No members yet." : "No members match your filter."}</EmptyHint>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Group members">
          {filtered.map((m) => {
            const content = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{m.user.name}</span>
                    {m.role === "MANAGER" ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Shield className="h-3 w-3" aria-hidden /> Co-manager
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.member_type_label}
                    {m.category ? ` · ${m.category.name}` : ""}
                    {m.user.department ? ` · ${m.user.department}` : ""}
                  </p>
                </div>
                {isManager ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{m.active_activities ?? 0} active</span>
                    <span>{m.open_update_requests ?? 0} updates open</span>
                    <span className="hidden sm:inline">Joined {formatDate(m.joined_at)}</span>
                  </div>
                ) : null}
              </>
            );
            return (
              <li key={m.id}>
                {isManager ? (
                  <button
                    type="button"
                    onClick={() => setDetailId(m.id)}
                    className="flex min-h-[52px] w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    aria-label={`View ${m.user.name}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex min-h-[52px] flex-wrap items-center gap-2 px-3 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <AddGroupMemberDialog
          groupId={groupId}
          groupName={groupName}
          open={addOpen}
          onOpenChange={setAddOpen}
          categories={categories}
          existingUserIds={[owner.id, ...members.map((m) => m.user.id)]}
          canAddManagers={isOwner}
          onAdded={onChanged}
        />
      ) : null}
      {isManager ? (
        <GroupMemberDetailDialog
          groupId={groupId}
          memberId={detailId}
          onOpenChange={(open) => !open && setDetailId(null)}
          categories={categories}
          canManage={canManage}
          isOwner={isOwner}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}
