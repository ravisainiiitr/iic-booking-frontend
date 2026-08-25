import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Download, RefreshCw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function statusBadge(status?: string) {
  const s = (status || "UNMAPPED").toUpperCase();
  if (s === "ACTIVE") return <Badge className="bg-emerald-600">Mapped</Badge>;
  if (s === "CONFLICT") return <Badge variant="destructive">Conflict</Badge>;
  if (s === "DISABLED" || s === "RETIRED") return <Badge variant="secondary">{s}</Badge>;
  return <Badge variant="outline">Unmapped</Badge>;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (mappedFilter === "mapped") params.mapped = "mapped";
      if (mappedFilter === "unmapped") params.mapped = "unmapped";
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.getLegacyEquipmentMappings(params);
      if (res.error) throw new Error(res.error);
      const table = (res.data?.table || []) as EquipmentRow[];
      setRows(table);
      setOptions((res.data?.new_equipment_options || []) as NewEquipmentOption[]);
      setWindowStats((res.data?.equipment_window_stats || {}) as Record<string, number>);
      setDatetimeContract((res.data?.datetime_contract || null) as Record<string, unknown> | null);
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

      {datetimeContract ? (
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
            Confirm each mapping explicitly. Many-to-one mappings show a server-side warning.
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
                    <TableCell className="min-w-[220px]">
                      <Select
                        value={String(drafts[row.old_equipment_id] ?? "")}
                        onValueChange={(v) =>
                          setDrafts((d) => ({ ...d, [row.old_equipment_id]: v ? Number(v) : "" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select new equipment" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((o) => (
                            <SelectItem key={o.equipment_id} value={String(o.equipment_id)}>
                              {o.code || o.equipment_id} — {o.name || "Equipment"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{statusBadge(row.mapping_status)}</TableCell>
                    <TableCell>{row.conflict_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_updated ? new Date(row.last_updated).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" disabled={busy} onClick={() => void saveMapping(row)}>
                        <Save className="mr-1 h-3 w-3" />
                        Save
                      </Button>
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
