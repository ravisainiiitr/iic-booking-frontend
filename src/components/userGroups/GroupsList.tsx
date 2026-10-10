import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Plus, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { facilityGroupsApi, type FacilityGroup, type GroupKind, type Option } from "@/lib/facilityGroupsApi";
import { formatDate } from "./format";

const KIND_TONE: Record<GroupKind, string> = {
  all: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  lab: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  category: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200",
  equipment_group: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  equipment: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  custom: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
};

export function KindBadge({ kind, label }: { kind: GroupKind; label: string }) {
  return (
    <Badge variant="outline" className={`border-0 text-[11px] font-medium ${KIND_TONE[kind] ?? ""}`}>
      {label}
    </Badge>
  );
}

function CreateGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (g: FacilityGroup) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError("");
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const group = await facilityGroupsApi.create({ name: name.trim(), description: description.trim() });
      toast.success(`Created ${group.name}. Add people from the group page.`);
      onCreated(group);
    } catch (err) {
      setError((err as Error).message || "Could not create the group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v && !saving ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New custom group</DialogTitle>
          <DialogDescription>
            Custom groups are lists you manage: add people one by one, by department / user type, or from other groups.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fg-new-name">Name</Label>
            <Input id="fg-new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fg-new-desc">Description (optional)</Label>
            <Textarea id="fg-new-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupsList({ onOpen, onEmail }: { onOpen: (groupId: number) => void; onEmail: (groupIds: number[]) => void }) {
  const [groups, setGroups] = useState<FacilityGroup[] | null>(null);
  const [kinds, setKinds] = useState<Option[]>([]);
  const [kind, setKind] = useState<string>("all_kinds");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await facilityGroupsApi.list({ include_archived: includeArchived });
      setGroups(res.results);
      setKinds(res.kinds);
    } catch (err) {
      setError((err as Error).message || "Could not load the groups.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (groups ?? []).filter(
      (g) =>
        (kind === "all_kinds" || g.kind === kind) &&
        (!q || g.name.toLowerCase().includes(q) || (g.scope.code ?? "").toLowerCase().includes(q)),
    );
  }, [groups, kind, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        People join the automatic groups when they book: the equipment, its category (e.g. Electron Microscopy), its equipment
        group and the lab / centre hosting it, plus <strong className="text-foreground">All booking users</strong>. Internal and
        external users are both included. Faculty whose students or project staff booked are kept as supervisors and shown
        when you tick <em>Include supervising faculty</em>. Pending-payment holds are not counted until paid.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search groups" className="w-64 pl-8" aria-label="Search groups" />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-56" aria-label="Group kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_kinds">All kinds</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="fg-archived" checked={includeArchived} onCheckedChange={(v) => setIncludeArchived(v === true)} />
          <Label htmlFor="fg-archived" className="text-sm font-normal">
            Show archived
          </Label>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={selected.size === 0} onClick={() => onEmail(Array.from(selected))}>
            <Mail className="mr-1.5 h-4 w-4" />
            Email selected{selected.size ? ` (${selected.size})` : ""}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New custom group
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "mr-1.5 h-4 w-4 animate-spin" : "mr-1.5 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
      ) : loading && !groups ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Supervisors</TableHead>
              <TableHead>Last booked</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-sm text-muted-foreground">
                  {groups?.length
                    ? "No groups match."
                    : "No groups yet. They appear as people book; the Main Administrator can also run the backfill to build them from past bookings."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((g) => (
                <TableRow key={g.id} className={g.is_archived ? "opacity-60" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)} aria-label={`Select ${g.name}`} />
                  </TableCell>
                  <TableCell>
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => onOpen(g.id)}>
                      {g.name}
                    </button>
                    {g.is_archived ? <span className="ml-2 text-xs text-muted-foreground">(archived)</span> : null}
                    {g.description ? <div className="text-xs text-muted-foreground">{g.description}</div> : null}
                  </TableCell>
                  <TableCell>
                    <KindBadge kind={g.kind} label={g.kind_label} />
                  </TableCell>
                  <TableCell className="tabular-nums">{g.member_count ?? 0}</TableCell>
                  <TableCell className="tabular-nums">{g.supervisor_count ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatDate(g.last_booked_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(g.id)} aria-label={`Open ${g.name}`}>
                        <Users className="mr-1 h-4 w-4" />
                        Members
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => onEmail([g.id])} aria-label={`Email ${g.name}`}>
                        <Mail className="mr-1 h-4 w-4" />
                        Email
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(g) => {
          setCreating(false);
          void load();
          onOpen(g.id);
        }}
      />
    </div>
  );
}
