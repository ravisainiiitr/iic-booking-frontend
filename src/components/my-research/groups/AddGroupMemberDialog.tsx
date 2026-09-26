import { useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type DataShareUserDetails, type DataShareUserSummary } from "@/lib/api";
import type { GroupCategory, GroupMemberType, GroupRole } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEMBER_TYPE_OPTIONS } from "./groupLabels";

interface Props {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: GroupCategory[];
  existingUserIds: number[];
  canAddManagers: boolean;
  onAdded: () => void;
}

/** Search eligible IITR users (existing data-sharing search), confirm identity, then add with type and category. */
export function AddGroupMemberDialog({
  groupId,
  groupName,
  open,
  onOpenChange,
  categories,
  existingUserIds,
  canAddManagers,
  onAdded,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DataShareUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DataShareUserDetails | null>(null);
  const [memberType, setMemberType] = useState<GroupMemberType>("PHD");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [role, setRole] = useState<GroupRole>("MEMBER");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setMemberType("PHD");
      setCategoryId("none");
      setRole("MEMBER");
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || selected) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await apiClient.searchDataSharingUsers(q);
      if (!alive) return;
      setSearching(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const taken = new Set(existingUserIds);
      setResults((res.data?.results ?? []).filter((u) => !taken.has(u.id)));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, selected, existingUserIds]);

  const choose = async (user: DataShareUserSummary) => {
    const res = await apiClient.getDataSharingUser(user.id);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load this person's details.");
      return;
    }
    setSelected(res.data);
    if (res.data.user_type === "faculty") setMemberType("OTHER");
  };

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await apiClient.addResearchGroupMember(groupId, {
      user_id: selected.id,
      member_type: memberType,
      category_id: categoryId === "none" ? null : Number(categoryId),
      role,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${selected.name} added to ${groupName}`);
    onAdded();
    onOpenChange(false);
  };

  const activeCategories = categories.filter((c) => c.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Add member to “{groupName}”</DialogTitle>
          <DialogDescription>
            Only IIT Roorkee students and faculty can be added. Being a member lets them see their own activities and update
            requests; it does not give access to any research workspace.
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-violet-50/60 p-4 dark:bg-violet-950/20">
              <p className="text-sm font-medium">Confirm the person before adding:</p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{selected.name}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{selected.email}</dd>
                <dt className="text-muted-foreground">Role</dt>
                <dd>{selected.designation || selected.user_type_label}</dd>
                <dt className="text-muted-foreground">Department</dt>
                <dd>{selected.department || "—"}</dd>
                {selected.id_number ? (
                  <>
                    <dt className="text-muted-foreground">ID</dt>
                    <dd>{selected.id_number}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rg-member-type">Member type</Label>
                <Select value={memberType} onValueChange={(v) => setMemberType(v as GroupMemberType)}>
                  <SelectTrigger id="rg-member-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg-member-category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="rg-member-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canAddManagers && selected.user_type === "faculty" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rg-member-role">Group role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as GroupRole)}>
                    <SelectTrigger id="rg-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="MANAGER">Co-manager (can manage members, activities and updates)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="pl-9"
                value={query}
                aria-label="Search IIT Roorkee users"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or enrolment number (min 3 characters)"
              />
            </div>
            {searching ? (
              <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Searching…
              </p>
            ) : null}
            {results.length > 0 ? (
              <ul className="max-h-60 divide-y overflow-y-auto rounded-md border">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      onClick={() => void choose(u)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.department ? ` · ${u.department}` : ""}
                        </span>
                      </span>
                      <UserPlus className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          {selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => void confirm()} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
                Confirm and add
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
