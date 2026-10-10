import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, Download, Loader2, Mail, Plus, RefreshCw, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EMPTY_FILTERS,
  facilityGroupsApi,
  type AudienceFilters,
  type DepartmentBreakdown,
  type GroupsOptions,
  type MemberOrdering,
  type MembersPage,
} from "@/lib/facilityGroupsApi";
import { AddMembersDialog } from "./AddMembersDialog";
import { AudienceFiltersBar } from "./AudienceFiltersBar";
import { KindBadge } from "./GroupsList";
import { formatDate, plural } from "./format";

const PAGE_SIZE = 50;

const ORDERINGS: { value: MemberOrdering; label: string }[] = [
  { value: "-last_booked", label: "Last booked (newest)" },
  { value: "last_booked", label: "Last booked (oldest)" },
  { value: "-bookings", label: "Most bookings" },
  { value: "name", label: "Name A–Z" },
  { value: "department", label: "Department A–Z" },
];

function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "supervisor") return <Badge variant="outline" className="text-[11px]">Supervisor</Badge>;
  if (role === "manual") return <Badge variant="outline" className="text-[11px]">Added by hand</Badge>;
  return null;
}

export function GroupDetail({
  groupId,
  options,
  onBack,
  onEmail,
}: {
  groupId: number;
  options: GroupsOptions | null;
  onBack: () => void;
  onEmail: (groupIds: number[], filters: AudienceFilters) => void;
}) {
  const [filters, setFilters] = useState<AudienceFilters>({ ...EMPTY_FILTERS });
  const debouncedFilters = useDebounced(filters);
  const [view, setView] = useState<"people" | "departments">("people");
  const [ordering, setOrdering] = useState<MemberOrdering>("-last_booked");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MembersPage | null>(null);
  const [breakdown, setBreakdown] = useState<DepartmentBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "people") {
        setData(await facilityGroupsApi.members(groupId, debouncedFilters, { page, page_size: PAGE_SIZE, ordering }));
      } else {
        const [members, depts] = await Promise.all([
          facilityGroupsApi.members(groupId, debouncedFilters, { page: 1, page_size: 1 }),
          facilityGroupsApi.departments(groupId, debouncedFilters),
        ]);
        setData(members);
        setBreakdown(depts);
      }
    } catch (err) {
      setError((err as Error).message || "Could not load the members.");
    } finally {
      setLoading(false);
    }
  }, [groupId, debouncedFilters, page, ordering, view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [debouncedFilters, ordering, groupId]);

  const group = data?.group;
  const isCustom = group?.kind === "custom";
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const exportCsv = async () => {
    try {
      await facilityGroupsApi.exportMembers(groupId, filters);
    } catch (err) {
      toast.error((err as Error).message || "Export failed.");
    }
  };

  const setArchived = async (archived: boolean) => {
    setBusy(true);
    try {
      await facilityGroupsApi.update(groupId, { is_archived: archived });
      toast.success(archived ? "Group archived." : "Group restored.");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async () => {
    if (!group || !window.confirm(`Delete the custom group "${group.name}"? People stay in the portal; only the list is removed.`)) return;
    setBusy(true);
    try {
      const res = await facilityGroupsApi.remove(groupId);
      toast.success(res?.detail || "Group deleted.");
      onBack();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const res = await facilityGroupsApi.removeMembers(groupId, Array.from(selected));
      toast.success(`Removed ${plural(res.removed, "person", "people")}.`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All groups
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{group?.name ?? "…"}</h2>
            {group ? <KindBadge kind={group.kind} label={group.kind_label} /> : null}
            {group?.is_archived ? <Badge variant="outline">Archived</Badge> : null}
          </div>
          {group?.description ? <p className="text-sm text-muted-foreground">{group.description}</p> : null}
          {data ? (
            <p className="text-sm text-muted-foreground">
              {plural(data.count, "person", "people")} match the filters
              {group?.supervisor_count ? ` · ${plural(group.supervisor_count, "supervising faculty", "supervising faculty")} on record` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onEmail([groupId], filters)} disabled={!data?.count}>
            <Mail className="mr-1.5 h-4 w-4" />
            Email these people
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void exportCsv()} disabled={!data?.count}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          {isCustom ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add people
            </Button>
          ) : null}
          {group ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void setArchived(!group.is_archived)} disabled={busy}>
              {group.is_archived ? <ArchiveRestore className="mr-1.5 h-4 w-4" /> : <Archive className="mr-1.5 h-4 w-4" />}
              {group.is_archived ? "Restore" : "Archive"}
            </Button>
          ) : null}
          {isCustom ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void deleteGroup()} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <AudienceFiltersBar value={filters} onChange={setFilters} options={options} idPrefix={`fg-detail-${groupId}`} />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="departments">By department / organisation</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "people" ? (
          <Select value={ordering} onValueChange={(v) => setOrdering(v as MemberOrdering)}>
            <SelectTrigger className="w-52" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDERINGS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="ml-auto flex gap-2">
          {isCustom && selected.size ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void removeSelected()} disabled={busy}>
              <UserMinus className="mr-1.5 h-4 w-4" />
              Remove {selected.size}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "mr-1.5 h-4 w-4 animate-spin" : "mr-1.5 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
      ) : loading && !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === "departments" ? (
        <div className="space-y-2">
          {breakdown ? (
            <p className="text-sm text-muted-foreground">
              {plural(breakdown.total, "person", "people")}: {breakdown.internal.toLocaleString()} internal ·{" "}
              {breakdown.external.toLocaleString()} external
            </p>
          ) : null}
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>Department / organisation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Internal</TableHead>
                <TableHead>External</TableHead>
                <TableHead>
                  <span className="sr-only">Show</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!breakdown?.departments.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-sm text-muted-foreground">
                    No people match.
                  </TableCell>
                </TableRow>
              ) : (
                breakdown.departments.map((d) => (
                  <TableRow key={d.department_id}>
                    <TableCell className="font-medium">{d.department_name}</TableCell>
                    <TableCell className="text-xs capitalize">{d.department_type || "—"}</TableCell>
                    <TableCell className="tabular-nums">{d.total}</TableCell>
                    <TableCell className="tabular-nums">{d.internal}</TableCell>
                    <TableCell className="tabular-nums">{d.external}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFilters((f) => ({ ...f, department_ids: [d.department_id] }));
                          setView("people");
                        }}
                      >
                        Show people
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          <Table stackOnMobile stickyFirstColumn>
            <TableHeader>
              <TableRow>
                {isCustom ? (
                  <TableHead className="w-10">
                    <span className="sr-only">Select</span>
                  </TableHead>
                ) : null}
                <TableHead>Name</TableHead>
                <TableHead>User type</TableHead>
                <TableHead>Internal / External</TableHead>
                <TableHead>Department / Organisation</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Equipment booked</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Last booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data?.results.length ? (
                <TableRow>
                  <TableCell colSpan={isCustom ? 10 : 9} className="py-8 text-sm text-muted-foreground">
                    {isCustom ? "No people yet. Use Add people." : "No people match."}
                  </TableCell>
                </TableRow>
              ) : (
                data.results.map((m) => (
                  <TableRow key={m.user_id} className={m.is_active ? undefined : "opacity-60"}>
                    {isCustom ? (
                      <TableCell>
                        <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} aria-label={`Select ${m.name}`} />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="flex flex-wrap justify-center gap-1">
                        <RoleBadge role={m.role} />
                        {m.is_active ? null : <Badge variant="outline" className="text-[11px]">Inactive</Badge>}
                        {m.emp_id ? <span className="text-xs text-muted-foreground">{m.emp_id}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{m.user_type_label || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.audience === "external" ? "secondary" : "outline"} className="text-[11px]">
                        {m.audience === "external" ? "External" : "Internal"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.department_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {m.email ? (
                        <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                          {m.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{m.mobile || "—"}</TableCell>
                    <TableCell className="max-w-[16rem] text-xs">
                      {m.equipment.length
                        ? m.equipment.map((e) => `${e.name}${e.count > 1 ? ` (${e.count})` : ""}`).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {m.booking_count}
                      {m.supervised_booking_count ? (
                        <div className="text-[11px] text-muted-foreground">+{m.supervised_booking_count} by students</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(m.last_booked_at ?? m.last_supervised_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data && data.count > PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                Previous
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading}>
                Next
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {isCustom ? (
        <AddMembersDialog
          open={adding}
          groupId={groupId}
          options={options}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
