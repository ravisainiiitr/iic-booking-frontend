import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Landmark, ListOrdered, RotateCcw, Search, ShieldAlert, Users, Wallet } from "lucide-react";

import { ExportMenu } from "@/components/ExportMenu";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import TransactionsPanel from "@/components/walletLedger/TransactionsPanel";
import { balanceTone, FilterSelect, LedgerPagination, SortHeader, SummaryStat } from "@/components/walletLedger/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveSearchTerm } from "@/hooks/use-live-search";
import { useRowsPerPage } from "@/hooks/use-rows-per-page";
import { apiClient, type LedgerOption, type LedgerOptions, type LedgerOwnersResponse } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import { countActive, EMPTY_OWNER_FILTERS, formatLedgerAmount, ownerFilterParams, type OwnerFilters } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

const BALANCE_STATES: LedgerOption[] = [
  { value: "positive", label: "Above ₹0" },
  { value: "zero", label: "Exactly ₹0" },
  { value: "negative", label: "Negative" },
  { value: "zero_or_negative", label: "₹0 or negative" },
];

const STATUS_OPTIONS: LedgerOption[] = [
  { value: "active", label: "Active account" },
  { value: "inactive", label: "Inactive account" },
];

export function MainAdminOnlyNotice() {
  return (
    <Card className="mx-auto mt-8 max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">Main Administrator only</h2>
        <p className="text-sm text-muted-foreground">Wallet ledgers, credits and debits are available to the Main Administrator.</p>
      </CardContent>
    </Card>
  );
}

function OwnersPanel({ options }: { options: LedgerOptions | null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState<OwnerFilters>(EMPTY_OWNER_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useLiveSearchTerm(searchDraft);
  const [ordering, setOrdering] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useRowsPerPage("wallet-owners", user?.id, 25);
  const [data, setData] = useState<LedgerOwnersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const effective = useMemo(() => ({ ...filters, search: searchTerm }), [filters, searchTerm]);
  const params = useMemo(() => ownerFilterParams(effective, ordering), [effective, ordering]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.getWalletLedgerOwners({ ...params, page, page_size: pageSize }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load wallet owners.");
        return;
      }
      setError(null);
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [params, page, pageSize, retry]);

  const update = useCallback((patch: Partial<OwnerFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const reset = () => {
    setSearchDraft("");
    setSearchTerm("");
    setFilters(EMPTY_OWNER_FILTERS);
    setPage(1);
  };

  const onSort = (key: string) => {
    setOrdering((o) => (o === key ? `-${key}` : o === `-${key}` ? key : key === "name" || key === "department" ? key : `-${key}`));
    setPage(1);
  };

  const open = (ownerId: number) => navigate(`/admin/wallet-ledger/${ownerId}`);
  const active = countActive(effective, EMPTY_OWNER_FILTERS);
  const summary = data?.summary;
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;

  return (
    <div className="space-y-4">
      <section aria-label="Wallet owner summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat
          label="Wallet owners"
          value={summary ? summary.owners.toLocaleString("en-IN") : "—"}
          hint="Matching the filters"
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <SummaryStat
          label="Total balance"
          value={summary ? formatLedgerAmount(summary.total_balance) : "—"}
          tone={balanceTone(summary?.total_balance)}
          hint="Across all sub-wallets"
          icon={<Landmark className="h-4 w-4" aria-hidden />}
        />
        <button type="button" className="text-left" onClick={() => update({ balance_state: "zero" })} aria-label="Show owners with zero balance">
          <SummaryStat label="Zero balance" value={summary ? summary.zero_owners.toLocaleString("en-IN") : "—"} hint="Tap to filter" />
        </button>
        <button type="button" className="text-left" onClick={() => update({ balance_state: "negative" })} aria-label="Show owners with negative balance">
          <SummaryStat
            label="Negative balance"
            value={summary ? summary.negative_owners.toLocaleString("en-IN") : "—"}
            tone={summary && summary.negative_owners > 0 ? "text-red-600 dark:text-red-400" : undefined}
            hint="Tap to filter"
          />
        </button>
      </section>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wl-owner-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="wl-owner-search"
                  placeholder="Name, email or employee ID"
                  className="h-9 pl-8"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                />
              </div>
            </div>
            <FilterSelect
              id="wl-owner-dept"
              label="Department"
              value={filters.department}
              onChange={(v) => update({ department: v })}
              options={options?.departments ?? []}
              allLabel="All departments"
            />
            <FilterSelect
              id="wl-owner-type"
              label="Owner category"
              value={filters.owner_type}
              onChange={(v) => update({ owner_type: v })}
              options={options?.owner_types ?? []}
              allLabel="All categories"
            />
            <FilterSelect
              id="wl-owner-subwallet"
              label="Has sub-wallet"
              value={filters.sub_wallet_department}
              onChange={(v) => update({ sub_wallet_department: v })}
              options={options?.sub_wallet_departments ?? []}
              allLabel="Any sub-wallet"
            />
            <FilterSelect
              id="wl-owner-balance"
              label="Balance"
              value={filters.balance_state}
              onChange={(v) => update({ balance_state: v })}
              options={BALANCE_STATES}
              allLabel="Any balance"
            />
            <div className="space-y-1.5">
              <Label htmlFor="wl-owner-bmin" className="text-xs">
                Balance from (₹)
              </Label>
              <Input
                id="wl-owner-bmin"
                inputMode="decimal"
                className="h-9 tabular-nums"
                value={filters.balance_min}
                onChange={(e) => update({ balance_min: e.target.value.replace(/[^\d.-]/g, "") })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-owner-bmax" className="text-xs">
                Balance up to (₹)
              </Label>
              <Input
                id="wl-owner-bmax"
                inputMode="decimal"
                className="h-9 tabular-nums"
                value={filters.balance_max}
                onChange={(e) => update({ balance_max: e.target.value.replace(/[^\d.-]/g, "") })}
              />
            </div>
            <FilterSelect
              id="wl-owner-status"
              label="Account status"
              value={filters.status}
              onChange={(v) => update({ status: v })}
              options={STATUS_OPTIONS}
              allLabel="Any status"
            />
            <div className="space-y-1.5">
              <Label htmlFor="wl-owner-afrom" className="text-xs">
                Transactions from
              </Label>
              <DateInput id="wl-owner-afrom" value={filters.activity_from} onChange={(e) => update({ activity_from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-owner-ato" className="text-xs">
                Transactions to
              </Label>
              <DateInput id="wl-owner-ato" value={filters.activity_to} onChange={(e) => update({ activity_to: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Search starts after two letters. Dates show owners with at least one transaction in the range.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {active > 0 ? (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Clear filters ({active})
                </Button>
              ) : null}
              <ExportMenu
                report="admin-wallet-owners"
                getParams={() => params}
                description="All wallet owners matching the filters"
                noun="owners"
                disabled={total === 0}
              />
            </div>
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
              <Table className={cn("min-w-[1100px] text-sm", loading && "opacity-60")} aria-busy={loading}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S.No</TableHead>
                    <SortHeader label="Wallet owner" sortKey="name" ordering={ordering} onSort={onSort} />
                    <TableHead>Category</TableHead>
                    <SortHeader label="Department" sortKey="department" ordering={ordering} onSort={onSort} />
                    <TableHead>Sub-wallets</TableHead>
                    <SortHeader label="Total balance" sortKey="balance" ordering={ordering} onSort={onSort} className="text-right" />
                    <SortHeader label="Students" sortKey="students" ordering={ordering} onSort={onSort} className="text-right" />
                    <TableHead>Status</TableHead>
                    <SortHeader label="Last transaction" sortKey="last_activity" ordering={ordering} onSort={onSort} />
                    <TableHead className="w-8">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        Loading wallet owners…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        {active > 0 ? "No wallet owners match these filters." : "No wallets yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((o) => (
                      <TableRow
                        key={o.owner_id}
                        tabIndex={0}
                        className="cursor-pointer align-top hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        onClick={() => open(o.owner_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open(o.owner_id);
                          }
                        }}
                        aria-label={`Open wallet of ${o.name}`}
                      >
                        <TableCell className="tabular-nums text-muted-foreground">{o.s_no}</TableCell>
                        <TableCell>
                          <div className="font-medium">{o.name}</div>
                          <div className="text-xs text-muted-foreground">{o.email}</div>
                          {o.employee_id ? <div className="text-xs text-muted-foreground">ID: {o.employee_id}</div> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{o.user_type_label}</TableCell>
                        <TableCell>{o.department_name || "—"}</TableCell>
                        <TableCell>
                          {o.sub_wallets.length === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <div className="flex max-w-[320px] flex-wrap gap-1">
                              {o.sub_wallets.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
                                  title={s.department_name}
                                >
                                  <span className="font-medium">{s.department_code || s.department_name}</span>
                                  <span className={cn("tabular-nums", balanceTone(s.balance))}>{formatLedgerAmount(s.balance)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap text-right font-semibold tabular-nums", balanceTone(o.total_balance))}>
                          {formatLedgerAmount(o.total_balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{o.linked_students}</TableCell>
                        <TableCell>
                          <Badge variant={o.status === "active" ? "secondary" : "outline"} className={cn(o.status !== "active" && "text-muted-foreground")}>
                            {o.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {o.last_transaction_at ? formatDMYTime(o.last_transaction_at) : <span className="text-muted-foreground">No transactions</span>}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
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
            noun="owners"
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

export default function AdminWalletLedger() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [options, setOptions] = useState<LedgerOptions | null>(null);
  const tab = searchParams.get("tab") === "transactions" ? "transactions" : "owners";

  useEffect(() => {
    if (!isAdmin) return;
    apiClient.getWalletLedgerOptions().then((res) => {
      if (res.data) setOptions(res.data);
    });
  }, [isAdmin]);

  const changeTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "owners") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  if (authLoading) return null;

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Wallet className="h-5 w-5" />}
            title="Wallet ledger"
            description="Every wallet owner, their sub-wallet balances and transactions, with manual credit and debit."
          />
        </StandaloneOnly>
        {!isAdmin ? (
          <MainAdminOnlyNotice />
        ) : (
          <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
            <TabsList className="h-auto gap-1 p-1">
              <TabsTrigger value="owners" className="gap-2 px-3 py-1.5">
                <Users className="h-4 w-4" aria-hidden />
                Wallet owners
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2 px-3 py-1.5">
                <ListOrdered className="h-4 w-4" aria-hidden />
                All transactions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="owners" className="mt-0">
              <OwnersPanel options={options} />
            </TabsContent>
            <TabsContent value="transactions" className="mt-0">
              <TransactionsPanel options={options} onOpenOwner={(id) => navigate(`/admin/wallet-ledger/${id}`)} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </PageShell>
  );
}
