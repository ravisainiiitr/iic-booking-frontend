import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { facilityGroupsApi, type Audience, type FacilityGroup, type GroupsOptions, type UserHit } from "@/lib/facilityGroupsApi";
import { departmentOptions } from "./format";
import { MultiSelect } from "./MultiSelect";

export function AddMembersDialog({
  open,
  groupId,
  options,
  onClose,
  onAdded,
}: {
  open: boolean;
  groupId: number;
  options: GroupsOptions | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"people" | "filters">("people");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [picked, setPicked] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [audience, setAudience] = useState<Audience>("");
  const [sources, setSources] = useState<string[]>([]);
  const [groups, setGroups] = useState<FacilityGroup[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setPicked([]);
    setDepartments([]);
    setUserTypes([]);
    setAudience("");
    setSources([]);
    facilityGroupsApi
      .list()
      .then((res) => setGroups(res.results.filter((g) => g.id !== groupId)))
      .catch(() => setGroups([]));
  }, [open, groupId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      facilityGroupsApi
        .searchUsers(q)
        .then((res) => alive && setHits(res.results))
        .catch(() => alive && setHits([]))
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const hasFilter = departments.length > 0 || userTypes.length > 0 || Boolean(audience) || sources.length > 0;
  const canSave = mode === "people" ? picked.length > 0 : hasFilter;

  const save = async () => {
    setSaving(true);
    try {
      const res =
        mode === "people"
          ? await facilityGroupsApi.addMembers(groupId, { user_ids: picked.map((p) => p.id) })
          : await facilityGroupsApi.addMembers(groupId, {
              filters: {
                department_ids: departments.map(Number),
                user_types: userTypes,
                audience,
              },
              source_group_ids: sources.map(Number),
            });
      toast.success(
        `Added ${res.added.toLocaleString()} ${res.added === 1 ? "person" : "people"}` +
          (res.already_members ? ` (${res.already_members} already in the group)` : "") +
          ".",
      );
      onAdded();
    } catch (err) {
      toast.error((err as Error).message || "Could not add people.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v && !saving ? onClose() : undefined)}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>Pick people by name, or add everyone matching a department, user type or other groups.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList>
            <TabsTrigger value="people">Pick people</TabsTrigger>
            <TabsTrigger value="filters">By department / type / group</TabsTrigger>
          </TabsList>
          <TabsContent value="people" className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, ID or mobile"
                className="pl-8"
                aria-label="Search people"
                autoFocus
              />
            </div>
            {searching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {hits.length ? (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {hits.map((u) => {
                  const already = picked.some((p) => p.id === u.id);
                  return (
                    <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email} · {u.user_type_label || "—"} · {u.department_name || "No department"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={already}
                        onClick={() => setPicked((p) => [...p, u])}
                      >
                        {already ? "Added" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {picked.length ? (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1">
                    {u.name}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      aria-label={`Remove ${u.name}`}
                      onClick={() => setPicked((p) => p.filter((x) => x.id !== u.id))}
                    />
                  </Badge>
                ))}
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="filters" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Departments / organisations</Label>
                <MultiSelect
                  options={departmentOptions(options)}
                  value={departments}
                  onChange={setDepartments}
                  placeholder="Any department"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label>User types</Label>
                <MultiSelect
                  options={(options?.all_user_types ?? []).map((t) => ({ value: t.value, label: t.label }))}
                  value={userTypes}
                  onChange={setUserTypes}
                  placeholder="Any user type"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Internal / external</Label>
                <Select value={audience || "all"} onValueChange={(v) => setAudience(v === "all" ? "" : (v as Audience))}>
                  <SelectTrigger aria-label="Internal or external">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Both</SelectItem>
                    <SelectItem value="internal">Internal (IITR)</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Only people in these groups (optional)</Label>
                <MultiSelect
                  options={groups.map((g) => ({ value: String(g.id), label: g.name, group: g.kind_label }))}
                  value={sources}
                  onChange={setSources}
                  placeholder="Any registered user"
                  searchPlaceholder="Search groups"
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Active, non-test accounts only. Without a source group, every registered user matching the filters is added.
            </p>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {mode === "people" ? `Add ${picked.length || ""}`.trim() : "Add matching people"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
