import { useCallback, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClearFilters, DebouncedSearch, FilterSelect, LoadError, Pager } from "@/components/admin-insights/InsightParts";
import UserBookingRows from "@/components/admin-insights/UserBookingRows";
import { useInsights } from "@/components/admin-insights/useInsights";
import {
  EMPTY_WALLET_BOOKING_FILTERS,
  insightParams,
  type WalletBookingFilters,
} from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatINRAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

function money(value: number) {
  return formatINRAmount(Math.round(value));
}

/** Every booking by the wallet owner and the users linked to their wallet, with totals per linked user. */
export default function WalletLinkedBookings({ ownerId }: { ownerId: number }) {
  const [filters, setFilters] = useState<WalletBookingFilters>(EMPTY_WALLET_BOOKING_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filterParams = useMemo(() => insightParams(filters), [filters]);
  const params = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);
  const { data, options, loading, error, reload } = useInsights(
    (p) => apiClient.getAdminWalletBookings(ownerId, p),
    params,
    "Could not load bookings by linked users.",
  );

  const update = useCallback((patch: Partial<WalletBookingFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);
  const onSearch = useCallback((search: string) => update({ search }), [update]);
  const summary = data?.summary;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_WALLET_BOOKING_FILTERS);

  return (
    <section aria-label="Bookings by linked users" className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          Bookings by linked users
          {summary ? (
            <span className="font-normal text-muted-foreground">
              · {summary.linked_users} users · {summary.bookings} bookings · {money(summary.charged)} charged
            </span>
          ) : null}
        </h3>
        <ExportMenu
          report="admin-wallet-linked-bookings"
          getParams={() => ({ ...filterParams, owner: ownerId })}
          description="Bookings by every user linked to this wallet, with totals per user"
          noun="bookings"
          disabled={!data || data.count === 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect
          id="wl-member"
          label="Linked user"
          value={filters.member}
          onChange={(v) => update({ member: v })}
          options={(options?.members ?? []).map((m) => ({
            value: String(m.id),
            label: m.is_owner ? `${m.name} (wallet owner)` : m.name,
          }))}
          allLabel="Everyone"
        />
        <FilterSelect
          id="wl-equipment"
          label="Equipment"
          value={filters.equipment}
          onChange={(v) => update({ equipment: v })}
          options={(options?.equipment ?? []).map((e) => ({
            value: String(e.id),
            label: e.code ? `${e.name} (${e.code})` : e.name,
          }))}
          allLabel="All equipment"
        />
        <FilterSelect
          id="wl-status"
          label="Status"
          value={filters.status}
          onChange={(v) => update({ status: v })}
          options={options?.statuses ?? []}
          allLabel="All statuses"
        />
        <div className="space-y-1.5">
          <Label htmlFor="wl-from" className="text-xs">
            Booked from
          </Label>
          <DateInput id="wl-from" value={filters.date_from} onValueChange={(v) => update({ date_from: v })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-to" className="text-xs">
            Booked to
          </Label>
          <DateInput id="wl-to" value={filters.date_to} onValueChange={(v) => update({ date_to: v })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DebouncedSearch value={filters.search} onChange={onSearch} label="Search bookings" placeholder="Booking ID or equipment…" />
        {filtersActive ? <ClearFilters onClick={() => update(EMPTY_WALLET_BOOKING_FILTERS)} /> : null}
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <>
          {summary && summary.by_member.length > 0 ? (
            <Table className="text-sm" containerProps={{ role: "region", "aria-label": "Totals per linked user" }}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Linked user</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Cancelled / refunded</TableHead>
                  <TableHead>Charged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.by_member.map((m) => (
                  <TableRow
                    key={m.id}
                    className={cn("cursor-pointer hover:bg-muted/50", filters.member === String(m.id) && "bg-primary/5")}
                    onClick={() => update({ member: filters.member === String(m.id) ? "" : String(m.id) })}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {m.name}
                        {m.is_owner ? <span className="ml-1 text-xs text-muted-foreground">(wallet owner)</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell className="tabular-nums">{m.bookings}</TableCell>
                    <TableCell className="tabular-nums">{m.cancelled}</TableCell>
                    <TableCell className="tabular-nums">{money(m.charged)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          <Table
            className={cn("text-sm", loading && "opacity-60")}
            aria-busy={loading}
            containerProps={{ role: "region", "aria-label": "Linked users' bookings" }}
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Booking ID</TableHead>
                <TableHead>Booked by</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Charge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.results.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    {filtersActive ? "No bookings match these filters." : "No bookings yet."}
                  </TableCell>
                </TableRow>
              ) : (
                <UserBookingRows rows={data?.results ?? []} showUser />
              )}
            </TableBody>
          </Table>
          <Pager
            page={page}
            pageSize={pageSize}
            total={data?.count ?? 0}
            loading={loading}
            noun="bookings"
            onPage={setPage}
            onPageSize={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
        </>
      )}
    </section>
  );
}
