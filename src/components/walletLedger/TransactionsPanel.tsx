import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Receipt, RotateCcw, Scale, Search, SlidersHorizontal, UserRound, X } from "lucide-react";

import { ExportMenu } from "@/components/ExportMenu";
import { TestAccountBadge } from "@/components/wallet/TestAccountBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import { useRowsPerPage } from "@/hooks/use-rows-per-page";
import {
  apiClient,
  type LedgerOption,
  type LedgerOptions,
  type LedgerSubWallet,
  type LedgerTransactionsResponse,
} from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import {
  countActive,
  DATE_PRESETS,
  EMPTY_TRANSACTION_FILTERS,
  formatLedgerAmount,
  TEST_ACCOUNT_FILTER_OPTIONS,
  transactionFilterParams,
  type DatePreset,
  type TransactionFilters,
} from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

import { CategoryBadge, FilterSelect, LedgerPagination, SignedAmount, SortHeader, SummaryStat, TypeBadge } from "./shared";

const TYPE_OPTIONS: LedgerOption[] = [
  { value: "credit", label: "Credits" },
  { value: "debit", label: "Debits" },
];

export default function TransactionsPanel({
  ownerId,
  subWallets,
  options,
  reloadKey = 0,
  onOpenOwner,
  relatedUser = null,
  onClearRelatedUser,
}: {
  /** Set on an owner's page; empty for All transactions. */
  ownerId?: number | null;
  subWallets?: LedgerSubWallet[];
  options: LedgerOptions | null;
  reloadKey?: number;
  onOpenOwner?: (ownerId: number) => void;
  /** Limits the list to transactions naming this user as the booking user. */
  relatedUser?: { id: number; name: string } | null;
  onClearRelatedUser?: () => void;
}) {
  const { user } = useAuth();
  const global = !ownerId;
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [bookingDraft, setBookingDraft] = useState("");
  const [searchTerm, setSearchTerm] = useLiveSearchTerm(searchDraft);
  const [bookingTerm, setBookingTerm] = useLiveSearchTerm(bookingDraft);
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useRowsPerPage("wallet-transactions", user?.id, 25);
  const [data, setData] = useState<LedgerTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [showMore, setShowMore] = useState(false);

  const effective = useMemo(
    () => ({ ...filters, search: searchTerm, booking: bookingTerm }),
    [filters, searchTerm, bookingTerm],
  );
  const relatedUserId = relatedUser?.id ?? null;
  const params = useMemo(
    () => transactionFilterParams(effective, ordering, ownerId, undefined, relatedUserId),
    [effective, ordering, ownerId, relatedUserId],
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, bookingTerm, relatedUserId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.getWalletLedgerTransactions({ ...params, page, page_size: pageSize }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load transactions.");
        return;
      }
      setError(null);
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [params, page, pageSize, reloadKey, retry]);

  const update = useCallback((patch: Partial<TransactionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const reset = () => {
    setSearchDraft("");
    setBookingDraft("");
    setSearchTerm("");
    setBookingTerm("");
    setFilters(EMPTY_TRANSACTION_FILTERS);
    setPage(1);
  };

  const onSort = (key: string) => {
    setOrdering((o) => (o === `-${key}` ? key : `-${key}`));
    setPage(1);
  };

  const active = countActive(effective, EMPTY_TRANSACTION_FILTERS, ["date_from", "date_to"]);
  const summary = data?.summary;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const categories = data?.categories ?? options?.categories ?? [];
  const performers = data?.performers ?? options?.performers ?? [];
  const subWalletOptions: LedgerOption[] = (subWallets ?? []).map((s) => ({ value: String(s.id), label: s.department_name }));
  const net = Number(summary?.net ?? 0);
  const colSpan = global ? 12 : 11;

  return (
    <div className="space-y-4">
      <section aria-label="Transaction summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat
          label="Transactions"
          value={summary ? summary.transactions.toLocaleString("en-IN") : "—"}
          hint="Matching the filters"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
        />
        <SummaryStat
          label="Total credits"
          value={summary ? formatLedgerAmount(summary.total_credits) : "—"}
          tone="text-emerald-700 dark:text-emerald-400"
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
        />
        <SummaryStat
          label="Total debits"
          value={summary ? formatLedgerAmount(summary.total_debits) : "—"}
          tone="text-red-600 dark:text-red-400"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
        />
        <SummaryStat
          label="Net"
          value={summary ? formatLedgerAmount(summary.net) : "—"}
          tone={net < 0 ? "text-red-600 dark:text-red-400" : net > 0 ? "text-emerald-700 dark:text-emerald-400" : undefined}
          icon={<Scale className="h-4 w-4" aria-hidden />}
        />
      </section>

      <Card>
        <CardContent className="space-y-3 p-4">
          {relatedUser ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
              <UserRound className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
              <span>
                Showing transactions for bookings by <span className="font-medium">{relatedUser.name}</span>
              </span>
              {onClearRelatedUser ? (
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClearRelatedUser}>
                  <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Show all
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-tx-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="wl-tx-search"
                  placeholder={global ? "Owner, transaction ID, description, reference…" : "Transaction ID, description, reference…"}
                  className="h-9 pl-8"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-tx-booking" className="text-xs">
                Booking ID
              </Label>
              <Input
                id="wl-tx-booking"
                placeholder="e.g. IIC-XRD-0001"
                className="h-9"
                value={bookingDraft}
                onChange={(e) => setBookingDraft(e.target.value)}
              />
            </div>
            <FilterSelect
              id="wl-tx-dates"
              label="Date"
              value={filters.date_preset === "all" ? "" : filters.date_preset}
              onChange={(v) => update({ date_preset: (v || "all") as DatePreset })}
              options={DATE_PRESETS.filter((p) => p.value !== "all")}
              allLabel="All dates"
            />
            <FilterSelect id="wl-tx-type" label="Type" value={filters.type} onChange={(v) => update({ type: v })} options={TYPE_OPTIONS} allLabel="Credits and debits" />
            <FilterSelect
              id="wl-tx-category"
              label="Source"
              value={filters.category}
              onChange={(v) => update({ category: v })}
              options={categories}
              allLabel="All sources"
            />
            {filters.date_preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-tx-from" className="text-xs">
                    From
                  </Label>
                  <DateInput id="wl-tx-from" value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-tx-to" className="text-xs">
                    To
                  </Label>
                  <DateInput id="wl-tx-to" value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} />
                </div>
              </>
            ) : null}
            {showMore ? (
              <>
                <FilterSelect
                  id="wl-tx-performer"
                  label="Performed by"
                  value={filters.performer}
                  onChange={(v) => update({ performer: v })}
                  options={performers}
                  allLabel="Anyone"
                />
                {global ? (
                  <>
                    <FilterSelect
                      id="wl-tx-owner-dept"
                      label="Owner department"
                      value={filters.owner_department}
                      onChange={(v) => update({ owner_department: v })}
                      options={options?.departments ?? []}
                      allLabel="All departments"
                    />
                    <FilterSelect
                      id="wl-tx-owner-type"
                      label="Owner category"
                      value={filters.owner_type}
                      onChange={(v) => update({ owner_type: v })}
                      options={options?.owner_types ?? []}
                      allLabel="All categories"
                    />
                    <FilterSelect
                      id="wl-tx-subdept"
                      label="Sub-wallet"
                      value={filters.sub_wallet_department}
                      onChange={(v) => update({ sub_wallet_department: v })}
                      options={options?.sub_wallet_departments ?? []}
                      allLabel="All sub-wallets"
                    />
                    <FilterSelect
                      id="wl-tx-test"
                      label="Test accounts"
                      value={filters.test}
                      onChange={(v) => update({ test: v })}
                      options={TEST_ACCOUNT_FILTER_OPTIONS}
                      allLabel="Show (badged)"
                    />
                  </>
                ) : (
                  <FilterSelect
                    id="wl-tx-subwallet"
                    label="Sub-wallet"
                    value={filters.sub_wallet}
                    onChange={(v) => update({ sub_wallet: v })}
                    options={subWalletOptions}
                    allLabel="All sub-wallets"
                  />
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="wl-tx-min" className="text-xs">
                    Amount from (₹)
                  </Label>
                  <Input
                    id="wl-tx-min"
                    inputMode="decimal"
                    className="h-9 tabular-nums"
                    value={filters.amount_min}
                    onChange={(e) => update({ amount_min: e.target.value.replace(/[^\d.]/g, "") })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-tx-max" className="text-xs">
                    Amount up to (₹)
                  </Label>
                  <Input
                    id="wl-tx-max"
                    inputMode="decimal"
                    className="h-9 tabular-nums"
                    value={filters.amount_max}
                    onChange={(e) => update({ amount_max: e.target.value.replace(/[^\d.]/g, "") })}
                  />
                </div>
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {showMore ? "Fewer filters" : "More filters"}
              </Button>
              {active > 0 ? (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Clear filters ({active})
                </Button>
              ) : null}
            </div>
            <ExportMenu
              report="admin-wallet-transactions"
              getParams={() => params}
              description="All transactions matching the filters"
              noun="transactions"
              disabled={total === 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-sm" role="alert">
              <p className="text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => setRetry((k) => k + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table serial={false} className={cn("min-w-[1250px] text-sm", loading && "opacity-60")} aria-busy={loading}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S.No.</TableHead>
                    <SortHeader label="Date & time" sortKey="created_at" ordering={ordering} onSort={onSort} />
                    <TableHead>Txn ID</TableHead>
                    {global ? <SortHeader label="Wallet owner" sortKey="owner" ordering={ordering} onSort={onSort} /> : null}
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Sub-wallet</TableHead>
                    <SortHeader label="Amount" sortKey="amount" ordering={ordering} onSort={onSort} className="text-right" />
                    <TableHead className="text-right">Balance after</TableHead>
                    <TableHead>Performed by</TableHead>
                    <TableHead className="min-w-[260px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                        Loading transactions…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                        {active > 0 ? "No transactions match these filters." : "No transactions yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((t) => (
                      <TableRow key={t.id} className="align-top">
                        <TableCell className="text-center tabular-nums text-muted-foreground">{t.s_no}</TableCell>
                        <TableCell className="whitespace-nowrap text-center">{formatDMYTime(t.created_at) || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-center font-mono text-xs">TXN-{t.id}</TableCell>
                        {global ? (
                          <TableCell>
                            {onOpenOwner ? (
                              <button
                                type="button"
                                className="text-left font-medium text-primary hover:underline dark:text-sky-300"
                                onClick={() => onOpenOwner(t.owner_id)}
                              >
                                {t.owner_name}
                              </button>
                            ) : (
                              <span className="font-medium">{t.owner_name}</span>
                            )}
                            {t.owner_department ? <div className="text-xs text-muted-foreground">{t.owner_department}</div> : null}
                            {t.is_test_account ? <TestAccountBadge className="mt-1" /> : null}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-center">
                          <TypeBadge type={t.transaction_type} />
                          {!global && t.is_test_account ? <TestAccountBadge className="mt-1" /> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <CategoryBadge category={t.category} label={t.category_label} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          {t.booking_code ? (
                            <Link
                              to={`/booking-management?expand=${encodeURIComponent(t.booking_code)}`}
                              className="font-mono text-xs text-primary hover:underline dark:text-sky-300"
                              title="Open booking details"
                            >
                              {t.booking_code}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{t.department_name}</TableCell>
                        <TableCell className="tabular-nums">
                          <SignedAmount type={t.transaction_type} amount={t.amount} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {t.balance_after != null ? formatLedgerAmount(t.balance_after) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div>{t.performed_by || "—"}</div>
                          <div className="text-xs capitalize text-muted-foreground">{t.performer}</div>
                        </TableCell>
                        <TableCell className="cell-text-left">
                          {t.reference ? <div className="font-mono text-xs text-muted-foreground">{t.reference}</div> : null}
                          <div className="line-clamp-2 break-words" title={t.description}>
                            {t.description || "—"}
                          </div>
                          {t.remarks ? <div className="mt-0.5 text-xs text-muted-foreground">{t.remarks}</div> : null}
                          {t.related_user_name && !relatedUser ? (
                            <div className="text-xs text-muted-foreground">User: {t.related_user_name}</div>
                          ) : null}
                          {t.external_reference ? (
                            <div className="text-xs text-muted-foreground">Reference no.: {t.external_reference}</div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <LedgerPagination
            page={page}
            pageSize={pageSize}
            total={total}
            noun="transactions"
            loading={loading}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
