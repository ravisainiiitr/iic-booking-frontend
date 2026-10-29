import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, PackageSearch, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { CourierCombobox } from "@/components/courier/CourierCombobox";
import { formatWhen, useCouriers } from "@/components/courier/courierHelpers";
import { ShipmentStatus, StatusBadge } from "@/components/courier/ShipmentStatus";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { courierTrackingApi, type Arrival, type ShipmentFilters } from "@/lib/courierTrackingApi";

const STAFF_TYPES = new Set(["admin", "manager", "dept_admin", "operator", "finance"]);
const STATUS_OPTIONS: [string, string][] = [
  ["", "Any status"],
  ["REGISTERED,PENDING,INFO_RECEIVED", "Not yet moving"],
  ["IN_TRANSIT", "In transit"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERY_REPORTED", "Delivery reported"],
  ["ATTEMPT_FAILED,EXCEPTION,TRACKING_PROBLEM", "Needs attention"],
  ["RETURNED,CANCELLED,EXPIRED", "Returned / cancelled / expired"],
];

export default function CourierTracking() {
  const { user } = useAuth();
  const isStaff = STAFF_TYPES.has(String(user?.user_type ?? "").toLowerCase());
  const [params] = useSearchParams();
  const [view, setView] = useState<"mine" | "staff">(isStaff ? "staff" : "mine");
  const [filters, setFilters] = useState<ShipmentFilters>({ q: params.get("booking") ?? "" });
  const [rows, setRows] = useState<Arrival[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Arrival | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const couriers = useCouriers(view === "staff");

  const query = useMemo<ShipmentFilters>(
    () => ({ ...filters, view: view === "staff" ? "staff" : undefined, page: String(page) }),
    [filters, view, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await courierTrackingApi.shipments(query);
      setRows(res.results);
      setCount(res.count);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    try {
      setDetail(await courierTrackingApi.shipment(id));
    } catch {
      toast.error("The shipment could not be loaded.");
    }
  };

  const refresh = async (id: number) => {
    setRefreshing(true);
    try {
      const res = await courierTrackingApi.refresh(id);
      setDetail(res.arrival);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...res.arrival, checkpoints: null } : r)));
      if (res.checked) toast.success(res.message);
      else toast.info(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The shipment could not be checked.");
    } finally {
      setRefreshing(false);
    }
  };

  const setFilter = (key: keyof ShipmentFilters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };
  const pages = Math.max(1, Math.ceil(count / 25));

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="Courier tracking"
            description="How samples are reaching the lab: courier shipments with their latest status, and manual deliveries. A delivery reported by the courier is not confirmation that the lab has the sample."
          />
        </StandaloneOnly>

        <div className="mt-4 space-y-4">
          {isStaff ? (
            <Tabs value={view} onValueChange={(v) => { setPage(1); setView(v as "mine" | "staff"); }}>
              <TabsList>
                <TabsTrigger value="staff">Shipments for my equipment</TabsTrigger>
                <TabsTrigger value="mine">My shipments</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          {view === "staff" ? (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filter shipments">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ct-q">Search</Label>
                <Input
                  id="ct-q"
                  placeholder="Booking, equipment, department, user, sample or tracking number"
                  value={filters.q ?? ""}
                  onChange={(e) => setFilter("q", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label id="ct-status-label">Status</Label>
                <Select value={filters.status ?? ""} onValueChange={(v) => setFilter("status", v === "any" ? "" : v)}>
                  <SelectTrigger aria-labelledby="ct-status-label"><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={label} value={value || "any"}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label id="ct-mode-label">Arrival method</Label>
                <Select value={filters.arrival_mode ?? "any"} onValueChange={(v) => setFilter("arrival_mode", v === "any" ? "" : v)}>
                  <SelectTrigger aria-labelledby="ct-mode-label"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Courier and manual</SelectItem>
                    <SelectItem value="COURIER">Courier</SelectItem>
                    <SelectItem value="MANUAL">Manual delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label id="ct-courier-label" htmlFor="ct-courier">Courier</Label>
                <CourierCombobox
                  id="ct-courier"
                  labelId="ct-courier-label"
                  value={filters.courier ?? ""}
                  onChange={(slug) => setFilter("courier", slug)}
                  couriers={couriers.couriers}
                  loading={couriers.loading}
                  error={couriers.error}
                  onRetry={couriers.retry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct-from">Expected from</Label>
                <Input id="ct-from" type="date" value={filters.expected_from ?? ""} onChange={(e) => setFilter("expected_from", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct-to">Expected to</Label>
                <Input id="ct-to" type="date" value={filters.expected_to ?? ""} onChange={(e) => setFilter("expected_to", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct-synced">Not checked since</Label>
                <Input id="ct-synced" type="date" value={filters.synced_before ?? ""} onChange={(e) => setFilter("synced_before", e.target.value)} />
              </div>
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={filters.overdue === "true"} onCheckedChange={(v) => setFilter("overdue", v === true ? "true" : "")} />
                  Overdue (expected date passed)
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.include_inactive === "true"}
                    onCheckedChange={(v) => setFilter("include_inactive", v === true ? "true" : "")}
                  />
                  Include replaced declarations
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span aria-live="polite">{loading ? "Loading…" : `${count} record${count === 1 ? "" : "s"}`}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" /> Reload list
            </Button>
          </div>

          {failed ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border p-4 text-sm">
              The shipments could not be loaded.
              <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading shipments…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center text-sm text-muted-foreground">
              <PackageSearch className="h-6 w-6" aria-hidden="true" />
              {view === "mine"
                ? "No sample arrivals yet. Open a booking to tell the lab how your sample will arrive."
                : "No shipments match these filters."}
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => void open(row.id)}
                    aria-expanded={openId === row.id}
                    className="flex w-full flex-col gap-1 p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Booking {row.booking_reference}</span>
                      <StatusBadge arrival={row} />
                      {!row.is_active ? <span className="text-xs text-muted-foreground">(replaced)</span> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                      <span>{row.equipment.name}</span>
                      {row.department ? <span>{row.department.name}</span> : null}
                      {row.arrival_mode === "COURIER" ? (
                        <span>
                          {row.courier?.name} <span className="font-mono">{row.tracking_number}</span>
                        </span>
                      ) : null}
                      {view === "staff" && row.submitted_by ? <span>{row.submitted_by.name || row.submitted_by.email}</span> : null}
                      <span>Checked {formatWhen(row.last_synced_at)}</span>
                    </span>
                  </button>
                  {openId === row.id ? (
                    <div className="border-t p-3">
                      {detail && detail.id === row.id ? (
                        <ShipmentStatus
                          arrival={detail}
                          onRefresh={() => void refresh(row.id)}
                          refreshing={refreshing}
                          showSubmitter={view === "staff"}
                        />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading shipment" />
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {pages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="Pages">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm">Page {page} of {pages}</span>
              <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </nav>
          ) : null}
        </div>
      </main>
    </PageShell>
  );
}
