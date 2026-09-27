import { useMemo, useState } from "react";
import { Crown, Search, Shield, UserPlus } from "lucide-react";
import type { GroupCategory, GroupMember, GroupPublicUser } from "@/lib/researchGroupTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate } from "../researchUtils";
import { FilterChips } from "../researchUi";
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
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}

export function ResearchGroupMembers({
  groupId,
  groupName,
  owner,
  members,
  categories,
  canManage,
  isManager,
  isOwner,
  onChanged,
  addOpen: addOpenProp,
  onAddOpenChange,
}: Props) {
  const [addOpenLocal, setAddOpenLocal] = useState(false);
  const addOpen = addOpenProp ?? addOpenLocal;
  const setAddOpen = onAddOpenChange ?? setAddOpenLocal;
  const [detailId, setDetailId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [memberType, setMemberType] = useState("all");

  const typeOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const m of members) {
      const entry = counts.get(m.member_type) ?? { label: m.member_type_label, count: 0 };
      entry.count += 1;
      counts.set(m.member_type, entry);
    }
    return [
      { value: "all", label: "All", count: members.length },
      ...[...counts.entries()].map(([value, v]) => ({ value, label: v.label, count: v.count })),
    ];
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (memberType === "all" || m.member_type === memberType) &&
        (category === "all" || (category === "none" ? !m.category : String(m.category?.id) === category)) &&
        (!q ||
          m.user.name.toLowerCase().includes(q) ||
          (m.user.email ?? "").toLowerCase().includes(q) ||
          (m.user.department ?? "").toLowerCase().includes(q)),
    );
  }, [members, query, category, memberType]);

  const categoryOptions = categories.filter((c) => c.active || members.some((m) => m.category?.id === c.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="h-9 bg-card pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            aria-label="Search members"
          />
        </div>
        {categoryOptions.length > 0 ? (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full bg-card sm:w-48" aria-label="Filter by category">
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
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> Add Member
          </Button>
        ) : null}
      </div>

      {typeOptions.length > 2 ? <FilterChips label="Filter by member type" value={memberType} onChange={setMemberType} options={typeOptions} /> : null}

      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
        <Crown className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span className="min-w-0 truncate">
          <span className="font-medium">{owner.name}</span>
          <span className="text-muted-foreground"> · Group lead{owner.department ? ` · ${owner.department}` : ""}</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint>{members.length === 0 ? "No members yet." : "No members match your filter."}</EmptyHint>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div
            className={cn(
              "hidden gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid",
              isManager ? "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_5.5rem]" : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]",
            )}
            aria-hidden
          >
            <span>Name</span>
            <span>Category</span>
            <span>Department</span>
            {isManager ? <span className="text-right">Active</span> : null}
            {isManager ? <span className="text-right">Updates</span> : null}
          </div>
          <ul className="divide-y" aria-label="Group members">
            {filtered.map((m) => {
              const content = (
                <>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{m.user.name}</span>
                      {m.role === "MANAGER" ? (
                        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                          <Shield className="h-3 w-3" aria-hidden /> Co-manager
                        </Badge>
                      ) : null}
                    </p>
                    {m.user.email ? <p className="truncate text-xs text-muted-foreground">{m.user.email}</p> : null}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-medium">
                      {m.member_type_label}
                    </Badge>
                    {m.category ? <span className="truncate text-xs text-muted-foreground">{m.category.name}</span> : null}
                  </div>
                  <span className="min-w-0 truncate text-xs text-muted-foreground md:text-sm">{m.user.department ?? "—"}</span>
                  {isManager ? (
                    <>
                      <span className="text-xs text-muted-foreground md:text-right md:text-sm md:text-foreground">
                        <span className="md:hidden">Active activities: </span>
                        {m.active_activities ?? 0}
                      </span>
                      <span
                        className={cn(
                          "text-xs md:text-right md:text-sm",
                          (m.open_update_requests ?? 0) > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground md:text-foreground",
                        )}
                      >
                        <span className="md:hidden">Pending updates: </span>
                        {m.open_update_requests ?? 0}
                      </span>
                    </>
                  ) : null}
                </>
              );
              const rowClass = cn(
                "grid w-full gap-x-3 gap-y-1 px-3 py-2 text-left",
                isManager
                  ? "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_5.5rem] md:items-center"
                  : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center",
              );
              return (
                <li key={m.id}>
                  {isManager ? (
                    <button
                      type="button"
                      onClick={() => setDetailId(m.id)}
                      className={cn(rowClass, "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none")}
                      aria-label={`View ${m.user.name}`}
                      title={`Joined ${formatDate(m.joined_at)}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
