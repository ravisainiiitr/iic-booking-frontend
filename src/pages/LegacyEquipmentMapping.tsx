import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown, Download, Link2Off, RefreshCw, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type EquipmentRow = {
  old_equipment_id: number;
  old_equipment_name?: string;
  legacy_booking_count?: number;
  mapping_id?: number | null;
  new_equipment_id?: number | null;
  new_equipment_code?: string;
  new_equipment_name?: string;
  mapping_status?: string;
  conflict_count?: number;
  last_updated?: string | null;
};

type NewEquipmentOption = {
  equipment_id: number;
  code?: string;
  name?: string;
};

function optionLabel(o: NewEquipmentOption) {
  return `${o.code || o.equipment_id} — ${o.name || "Equipment"}`;
}

function statusBadge(status?: string) {
  const s = (status || "UNMAPPED").toUpperCase();
  if (s === "ACTIVE") return <Badge className="bg-emerald-600">Mapped</Badge>;
  if (s === "CONFLICT") return <Badge variant="destructive">Conflict</Badge>;
  if (s === "RETIRED") return <Badge variant="secondary">Not required</Badge>;
  if (s === "DISABLED") return <Badge variant="secondary">Disabled</Badge>;
  return <Badge variant="outline">Unmapped</Badge>;
}

/** Searchable new-equipment picker for quick explicit mapping. */
function NewEquipmentCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: NewEquipmentOption[];
  value: number | "";
  onChange: (next: number | "") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => (value === "" ? undefined : options.find((o) => o.equipment_id === Number(value))),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.equipment_id} ${o.code || ""} ${o.name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full min-w-[220px] justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected ? optionLabel(selected) : "Search new equipment…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,var(--radix-popover-trigger-width))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by code, name, or ID…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{options.length === 0 ? "No equipment loaded." : "No match."}</CommandEmpty>
            <CommandGroup>
              {value !== "" ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              ) : null}
              {filtered.map((o) => (
                <CommandItem
                  key={o.equipment_id}
                  value={String(o.equipment_id)}
                  onSelect={() => {
                    onChange(o.equipment_id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      Number(value) === o.equipment_id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{optionLabel(o)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function LegacyEquipmentMapping() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [options, setOptions] = useState<NewEquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [mappedFilter, setMappedFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<number, number | "">>({});
  const [windowStats, setWindowStats] = useState<Record<string, number>>({});
  const [datetimeContract, setDatetimeContract] = useState<Record<string, unknown> | null>(null);
  const [schemaPending, setSchemaPending] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaPending(null);
    try {
      const params: Record<string, string> = {};
      if (mappedFilter === "mapped") params.mapped = "mapped";
      if (mappedFilter === "unmapped") params.mapped = "unmapped";
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.getLegacyEquipmentMappings(params);
      const body = (res.data || {}) as Record<string, unknown>;
      if (res.errorCode === "SCHEMA_PENDING" || body.code === "SCHEMA_PENDING" || res.status === 503) {
        setSchemaPending(body.code ? body : { code: "SCHEMA_PENDING", message: res.error, ...(body || {}) });
        setRows([]);
        setOptions([]);
        setWindowStats({});
        setDatetimeContract(null);
        return;
      }
      if (res.error) throw new Error(res.error);
      const table = (body.table || []) as EquipmentRow[];
      setRows(table);
      setOptions((body.new_equipment_options || []) as NewEquipmentOption[]);
      setWindowStats((body.equipment_window_stats || {}) as Record<string, number>);
      setDatetimeContract((body.datetime_contract || null) as Record<string, unknown> | null);
      const nextDrafts: Record<number, number | ""> = {};
      table.forEach((r) => {
        nextDrafts[r.old_equipment_id] = r.new_equipment_id ?? "";
      });
      setDrafts(nextDrafts);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load equipment mappings");
    } finally {
      setLoading(false);
    }
  }, [mappedFilter, search]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const bc = (b.legacy_booking_count || 0) - (a.legacy_booking_count || 0);
      if (bc !== 0) return bc;
      return a.old_equipment_id - b.old_equipment_id;
    });
  }, [rows]);

  const saveMapping = async (row: EquipmentRow) => {
    const newId = drafts[row.old_equipment_id];
    if (!newId) {
      toast.error("Select new equipment before saving");
      return;
    }
    setBusy(true);
    try {
      if (row.mapping_id) {
        const res = await apiClient.patchLegacyEquipmentMapping(row.mapping_id, {
          new_equipment_id: Number(newId),
          status: "ACTIVE",
          old_equipment_name: row.old_equipment_name || "",
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await apiClient.createLegacyEquipmentMapping({
          old_equipment_id: row.old_equipment_id,
          old_equipment_name: row.old_equipment_name || "",
          new_equipment_id: Number(newId),
          status: "ACTIVE",
        });
        if (res.error) throw new Error(res.error);
      }
      toast.success(`Mapped legacy ${row.old_equipment_id} → new equipment ${newId}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const unmapRow = async (row: EquipmentRow) => {
    const status = String(row.mapping_status || "UNMAPPED").toUpperCase();
    if (!row.mapping_id && status === "UNMAPPED" && !drafts[row.old_equipment_id]) {
      toast.message("Already unmapped");
      return;
    }
    if (
      !window.confirm(
        `Unmap legacy equipment ${row.old_equipment_id}? This clears the new-portal link (status → UNMAPPED).`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      if (row.mapping_id) {
        const res = await apiClient.patchLegacyEquipmentMapping(row.mapping_id, {
          status: "UNMAPPED",
          new_equipment_id: null,
          old_equipment_name: row.old_equipment_name || "",
          mapping_reason: "Unmapped by administrator",
        });
        if (res.error) throw new Error(res.error);
      }
      setDrafts((d) => ({ ...d, [row.old_equipment_id]: "" }));
      toast.success(`Unmapped legacy ${row.old_equipment_id}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unmap failed");
    } finally {
      setBusy(false);
    }
  };

  /** Mark legacy equipment as not required in the new portal (RETIRED). */
  const markNotRequired = async (row: EquipmentRow) => {
    if (
      !window.confirm(
        `Mark legacy equipment ${row.old_equipment_id} (${row.old_equipment_name || "unnamed"}) as not required?\n\n` +
          "Use this when the instrument no longer exists / will not be mapped in the new portal. " +
          "Status becomes RETIRED (Not required).",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const reason = "Not required — legacy equipment no longer exists / not in new portal";
      if (row.mapping_id) {
        const res = await apiClient.patchLegacyEquipmentMapping(row.mapping_id, {
          status: "RETIRED",
          new_equipment_id: null,
          old_equipment_name: row.old_equipment_name || "",
          mapping_reason: reason,
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await apiClient.createLegacyEquipmentMapping({
          old_equipment_id: row.old_equipment_id,
          old_equipment_name: row.old_equipment_name || "",
          status: "RETIRED",
          mapping_reason: reason,
        });
        if (res.error) throw new Error(res.error);
      }
      setDrafts((d) => ({ ...d, [row.old_equipment_id]: "" }));
      toast.success(`Legacy ${row.old_equipment_id} marked not required`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  /** Hard-delete the mapping DB row (row may reappear as Unmapped from inventory). */
  const deleteMappingRecord = async (row: EquipmentRow) => {
    if (!row.mapping_id) {
      toast.message("No mapping record to delete — use Not required to exclude inventory rows.");
      return;
    }
    if (
      !window.confirm(
        `Permanently delete mapping record #${row.mapping_id} for legacy ${row.old_equipment_id}?\n\n` +
          "If the legacy ID is still in inventory/discovery, it will show again as Unmapped.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.deleteLegacyEquipmentMapping(row.mapping_id);
      if (res.error) throw new Error(res.error);
      toast.success(`Deleted mapping record for legacy ${row.old_equipment_id}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const exportReport = async () => {
    setBusy(true);
    try {
      const res = await apiClient.exportLegacyEquipmentMappings();
      if (res.error) throw new Error(res.error);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "legacy-equipment-mapping-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Main Administrator access required.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/portal-migration")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Equipment Mapping</h1>
            <p className="text-sm text-muted-foreground">
              Explicit legacy → new equipment mapping. No fuzzy auto-mapping.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void exportReport()} disabled={busy}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {schemaPending ? (
        <Card className="border-amber-400 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">SCHEMA_PENDING — equipment mapping unavailable</CardTitle>
            <CardDescription>
              HTTP 503 is expected until production schema migrations <strong>users.0101–0104</strong> are
              applied. This is <strong>not</strong> the datetime-contract approval gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {String(
                schemaPending.message ||
                  (schemaPending.schema as Record<string, unknown> | undefined)?.detail ||
                  "Mapping tables / migration_start_at are not on the database yet.",
              )}
            </p>
            <p>
              Pending:{" "}
              <code>
                {JSON.stringify(
                  (schemaPending.schema as Record<string, unknown> | undefined)?.pending_migrations ||
                    ["0101", "0102", "0103", "0104"],
                )}
              </code>
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Approve datetime on{" "}
                <Link className="underline" to="/admin/portal-migration">
                  Portal Migration
                </Link>{" "}
                (works now; does not unlock this page).
              </li>
              <li>
                Authorize <strong>Migrate Production</strong> for 0101–0104 (
                <code>confirm_migrate=MIGRATE</code>) — separate from T0.
              </li>
              <li>Then set migration window dates and use equipment mapping / discovery.</li>
            </ol>
            <Button asChild variant="secondary">
              <Link to="/admin/portal-migration">Back to Portal Migration</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {datetimeContract && !schemaPending ? (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-base">Booking datetime contract</CardTitle>
            <CardDescription>
              Status: <strong>{String(datetimeContract.approval_status || "OPERATOR_REQUIRED")}</strong>
              {datetimeContract.blocks_t0 ? " — blocks T0 until operator approval" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Start source:</span>{" "}
              {String(datetimeContract.booking_datetime_source)}
            </p>
            <p>
              <span className="text-muted-foreground">Duration source:</span>{" "}
              {String(datetimeContract.duration_source)} ({String(datetimeContract.duration_unit)})
            </p>
            <p>
              <span className="text-muted-foreground">Derived end:</span> {String(datetimeContract.derived_end)}
            </p>
            <p>
              <span className="text-muted-foreground">Strategy:</span> {String(datetimeContract.datetime_strategy)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {windowStats && Object.keys(windowStats).length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Total legacy equipment", windowStats.total_legacy_equipment],
            ["Used in window", windowStats.used_in_migration_window],
            ["Mapped (in window)", windowStats.mapped_in_window],
            ["Unmapped (in window)", windowStats.unmapped_in_window],
          ].map(([label, val]) => (
            <Card key={String(label)}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-xl">{String(val ?? "—")}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label>Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Legacy ID or name" />
          </div>
          <div className="w-48 space-y-2">
            <Label>Mapping</Label>
            <Select value={mappedFilter} onValueChange={setMappedFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="mapped">Mapped</SelectItem>
                <SelectItem value="unmapped">Unmapped</SelectItem>
                <SelectItem value="not_required">Not required</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => void load()} disabled={loading}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy equipment</CardTitle>
          <CardDescription>
            Confirm each mapping explicitly. Use the searchable New equipment picker (code, name, or
            ID). <strong>Unmap</strong> clears a link; <strong>Not required</strong> marks legacy gear
            that no longer exists; <strong>Delete record</strong> removes the DB mapping row.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Legacy ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>New equipment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conflicts</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading…</TableCell>
                </TableRow>
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No legacy equipment discovered yet.</TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow key={row.old_equipment_id}>
                    <TableCell className="font-mono">{row.old_equipment_id}</TableCell>
                    <TableCell>{row.old_equipment_name || "—"}</TableCell>
                    <TableCell>{row.legacy_booking_count ?? 0}</TableCell>
                    <TableCell className="min-w-[260px]">
                      <NewEquipmentCombobox
                        options={options}
                        value={drafts[row.old_equipment_id] ?? ""}
                        disabled={busy}
                        onChange={(next) =>
                          setDrafts((d) => ({ ...d, [row.old_equipment_id]: next }))
                        }
                      />
                    </TableCell>
                    <TableCell>{statusBadge(row.mapping_status)}</TableCell>
                    <TableCell>{row.conflict_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_updated ? new Date(row.last_updated).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" disabled={busy} onClick={() => void saveMapping(row)}>
                          <Save className="mr-1 h-3 w-3" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          title="Clear new-equipment link (UNMAPPED)"
                          onClick={() => void unmapRow(row)}
                        >
                          <Link2Off className="mr-1 h-3 w-3" />
                          Unmap
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || String(row.mapping_status || "").toUpperCase() === "RETIRED"}
                          title="Legacy equipment no longer exists / not needed in new portal"
                          onClick={() => void markNotRequired(row)}
                        >
                          Not required
                        </Button>
                        {row.mapping_id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            title="Permanently delete the mapping DB row"
                            onClick={() => void deleteMappingRecord(row)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Link to="/admin/portal-migration/legacy-bookings" className="underline">
          Legacy booking mapping
        </Link>{" "}
        — slot occupancy does not require new-portal user resolution.
      </p>
    </div>
  );
}
