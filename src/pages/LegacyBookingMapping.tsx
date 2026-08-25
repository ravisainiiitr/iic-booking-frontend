import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";

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

type LegacyBookingRow = {
  legacy_booking_id?: number;
  old_equipment_id?: number;
  new_equipment_id?: number | null;
  start_at?: string;
  end_at?: string;
  duration_minutes?: number | null;
  status?: string;
  legacy_user_id?: number | null;
  legacy_employee_id_display?: string;
  user_mapping_status?: string;
  slot_status?: string;
  slot_action?: string;
  display_eligibility?: string;
  migration_status?: string;
  conflict?: boolean;
};

function badgeFor(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ELIGIBLE" || s === "READY" || s === "BLOCKED") {
    return <Badge className="bg-emerald-700">{status}</Badge>;
  }
  if (s === "UNRESOLVED") return <Badge variant="outline">Unresolved</Badge>;
  if (s === "RESOLVED_CHANNEL_I") return <Badge className="bg-blue-700">Resolved</Badge>;
  if (s.includes("CONFLICT")) return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="secondary">{status || "—"}</Badge>;
}

export default function LegacyBookingMapping() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";
  const isStaff = isAdmin || ["manager", "operator"].includes(String(user?.user_type || "").toLowerCase());

  const [rows, setRows] = useState<LegacyBookingRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState("all");
  const [userMap, setUserMap] = useState("all");
  const [search, setSearch] = useState("");
  const [previewJson, setPreviewJson] = useState("");
  const [conflictCount, setConflictCount] = useState(0);
  const [schemaPending, setSchemaPending] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaPending(null);
    try {
      const params: Record<string, string> = {};
      if (eligibility !== "all") params.eligibility = eligibility;
      if (userMap !== "all") params.user_mapping_status = userMap;
      if (search.trim()) params.search = search.trim();

      let legacyRows: unknown[] | undefined;
      if (previewJson.trim()) {
        try {
          legacyRows = JSON.parse(previewJson) as unknown[];
        } catch {
          throw new Error("Preview JSON is invalid");
        }
      }

      const res = await apiClient.getLegacyBookings(params, legacyRows);
      const body = (res.data || {}) as Record<string, unknown>;
      if (res.errorCode === "SCHEMA_PENDING" || body.code === "SCHEMA_PENDING" || res.status === 503) {
        setSchemaPending(body.code ? body : { code: "SCHEMA_PENDING", message: res.error, ...(body || {}) });
        setRows([]);
        setCounts({});
        setConflictCount(0);
        return;
      }
      if (res.error) throw new Error(res.error);
      setRows((body.results || []) as LegacyBookingRow[]);
      setCounts((body.discovery_counts || {}) as Record<string, number>);
      setConflictCount(Number((body.conflict_report as Record<string, unknown>)?.conflict_count || 0));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load legacy bookings");
    } finally {
      setLoading(false);
    }
  }, [eligibility, userMap, search, previewJson]);

  useEffect(() => {
    if (!isStaff) return;
    void load();
  }, [isStaff, load]);

  if (!isStaff) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Administrator or OIC access required.</p>
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
            <h1 className="text-2xl font-semibold">Legacy Booking Mapping</h1>
            <p className="text-sm text-muted-foreground">
              Legacy booking → new equipment → slot occupancy. User mapping is secondary.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {schemaPending ? (
        <Card className="border-amber-400 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">SCHEMA_PENDING — legacy bookings unavailable</CardTitle>
            <CardDescription>
              HTTP 503 is expected until <strong>users.0101–0104</strong> are applied on production. Approving
              the datetime contract alone does <strong>not</strong> unlock this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {String(
                schemaPending.message ||
                  (schemaPending.schema as Record<string, unknown> | undefined)?.detail ||
                  "Discovery/mapping tables and migration_start_at are not on the database yet.",
              )}
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Optional now: approve datetime on{" "}
                <Link className="underline" to="/admin/portal-migration">
                  Portal Migration
                </Link>
                .
              </li>
              <li>
                Required for this page: authorize <strong>Migrate Production</strong> 0101–0104 (not T0).
              </li>
              <li>Set migration window dates → then discovery / booking list will load.</li>
            </ol>
            <Button asChild variant="secondary">
              <Link to="/admin/portal-migration">Back to Portal Migration</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(counts).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <CardDescription>{k}</CardDescription>
              <CardTitle className="text-xl">{v}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>conflicts</CardDescription>
            <CardTitle className="text-xl text-red-700">{conflictCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Unresolved user mapping does not block slot readiness. PII masked unless Main Admin enables
            include_pii on API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-48 space-y-2">
              <Label>Migration status</Label>
              <Select value={eligibility} onValueChange={setEligibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="unmapped">Unmapped equipment</SelectItem>
                  <SelectItem value="conflicting">Conflicts</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48 space-y-2">
              <Label>User mapping</Label>
              <Select value={userMap} onValueChange={setUserMap}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                  <SelectItem value="RESOLVED_CHANNEL_I">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label>Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Booking or equipment ID" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void load()} disabled={loading}>
                Apply
              </Button>
            </div>
          </div>
          {isAdmin ? (
            <div className="space-y-2">
              <Label>Preview fixture rows (JSON array — dry-run only, no production blocks)</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background p-2 font-mono text-xs"
                value={previewJson}
                onChange={(e) => setPreviewJson(e.target.value)}
                placeholder='[{"legacy_booking_id":1,"old_equipment_id":101,...}]'
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Legacy Eq</TableHead>
                <TableHead>New Eq</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Legacy status</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>User map</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Conflict</TableHead>
                <TableHead>Slot action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12}>Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>
                    No rows. Load preview fixture JSON or configure MySQL discovery after operator datetime
                    approval.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.legacy_booking_id} className={r.conflict ? "bg-red-50/50" : undefined}>
                    <TableCell className="font-mono">
                      <Link
                        to={`/admin/portal-migration/legacy-bookings/${r.legacy_booking_id}`}
                        className="underline"
                      >
                        {r.legacy_booking_id}
                      </Link>
                    </TableCell>
                    <TableCell>{r.old_equipment_id}</TableCell>
                    <TableCell>{r.new_equipment_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.start_at ? new Date(r.start_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs">{r.end_at ? new Date(r.end_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>{r.duration_minutes ?? "—"}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="font-mono">{r.legacy_employee_id_display || "—"}</TableCell>
                    <TableCell>{badgeFor(r.user_mapping_status)}</TableCell>
                    <TableCell>{badgeFor(r.display_eligibility || r.slot_status)}</TableCell>
                    <TableCell>{r.conflict ? badgeFor("CONFLICT") : "—"}</TableCell>
                    <TableCell className="max-w-[200px] text-xs">{r.slot_action || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
