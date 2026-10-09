import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, Check, Loader2, RefreshCw, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { ExportMenu } from "@/components/ExportMenu";
import { SricStatusBadge, SricTestBadge } from "@/components/wallet/SricRechargePanel";
import { formatDateTime } from "@/components/walletModes/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type SricAdminListResponse,
  type SricRechargeRow,
  type SricRechargeSettings,
  type SricRechargeStatus,
  type SricUserOption,
} from "@/lib/api";
import { formatMoney } from "@/lib/walletRecharge";

const STATUS_FILTERS: { value: SricRechargeStatus; label: string }[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "awaiting_credit", label: "Ready to credit" },
  { value: "credited", label: "Credited" },
  { value: "failed", label: "Failed" },
  { value: "duplicate", label: "Duplicate" },
  { value: "rejected", label: "Rejected" },
];

const ADMIN_STATUS_LABEL: Record<SricRechargeStatus, string> = {
  credited: "Credited",
  awaiting_credit: "Ready to credit",
  needs_review: "Needs review",
  duplicate: "Duplicate",
  failed: "Failed",
  rejected: "Rejected",
};

const PAGE_SIZE = 25;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Filters = {
  status: string;
  financial_year: string;
  receiver: string;
  verified: string;
  date_from: string;
  date_to: string;
  search: string;
  /** "" lists test entries (with a TEST badge); "hide" leaves them out. */
  test: "" | "hide";
};

const EMPTY_FILTERS: Filters = {
  status: "",
  financial_year: "",
  receiver: "",
  verified: "",
  date_from: "",
  date_to: "",
  search: "",
  test: "",
};

function amountText(row: SricRechargeRow) {
  return row.amount != null ? formatMoney(row.amount) : row.amount_raw || "—";
}

/** Main Administrator: SRIC Wallet_Recharge.csv rows — review, credit, reject, verify fund receipt, settings. */
export default function AdminSricRecharges() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SricAdminListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkCrediting, setBulkCrediting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [creditRow, setCreditRow] = useState<SricRechargeRow | null>(null);
  const [rejectRow, setRejectRow] = useState<SricRechargeRow | null>(null);
  const [verifyRow, setVerifyRow] = useState<SricRechargeRow | null>(null);

  const params = useMemo(
    () => ({ ...filters, page, page_size: PAGE_SIZE }),
    [filters, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getAdminSricRecharges(params);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load SRIC recharges.");
      return;
    }
    setData(res.data);
    setSelected((prev) => prev.filter((id) => res.data!.results.some((r) => r.id === id && r.status === "awaiting_credit")));
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => (f.search === searchText.trim() ? f : { ...f, search: searchText.trim() }));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const refresh = async () => {
    setRefreshing(true);
    const res = await apiClient.refreshAdminSricRecharges();
    setRefreshing(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not read the mailbox.");
      return;
    }
    const scan = res.data.scan as { status?: string; rows_new?: number; messages_read?: number } | undefined;
    if (scan?.status && scan.status !== "ok") toast.message(res.data.message);
    else
      toast.success(
        res.data.debounced
          ? "The mailbox was read a few seconds ago; list updated."
          : `Mailbox read: ${scan?.messages_read ?? 0} new email(s), ${scan?.rows_new ?? 0} row(s).`,
      );
    void load();
  };

  const creditSelected = async () => {
    if (!selected.length) return;
    setBulkCrediting(true);
    const res = await apiClient.creditReadySricRecharges(selected);
    setBulkCrediting(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not credit the selected rows.");
      return;
    }
    toast.success(`${res.data.credited} row(s) credited.`);
    if (res.data.errors.length) toast.error(res.data.errors.map((e) => e.error).slice(0, 3).join("\n"));
    setSelected([]);
    void load();
  };

  const rows = data?.results ?? [];
  const readyIds = rows.filter((r) => r.status === "awaiting_credit").map((r) => r.id);
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const counts = data?.status_counts ?? {};

  return (
    <div className="space-y-4" data-testid="admin-sric-recharges">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>SRIC wallet recharges</CardTitle>
              <CardDescription>
                Rows from the Wallet_Recharge.csv emailed by SRIC (rnd.iitr.ac.in &gt; Ledger &gt; New Wallet Recharge).
                One credit per Ledger ID and financial year. Verify each credit against the fund receipt.
              </CardDescription>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Mailbox scan: {data?.scan_enabled ? "on (every 5 min)" : "off"}</Badge>
                <Badge variant="outline">Auto-credit: {data?.auto_credit_enabled ? "on" : "off"}</Badge>
                <Badge variant="outline">
                  Last read: {data?.last_scan_at ? formatDateTime(data.last_scan_at) : "never"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
              <ExportMenu report="sric-wallet-recharges" getParams={() => ({ ...filters })} noun="rows" />
              <Button type="button" variant="outline" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Status counts">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setFilter("status", filters.status === s.value ? "" : s.value)}
                className={`rounded-full border px-3 py-1 text-xs ${filters.status === s.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {s.label}: {counts[s.value] ?? 0}
              </button>
            ))}
            <span className="self-center text-xs text-muted-foreground">
              Credited total (filtered): {formatMoney(data?.credited_total ?? 0)}
              {data?.test_count ? " · test entries are not counted in totals or exports" : ""}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="sric-filter-status">Status</Label>
              <select id="sric-filter-status" className={selectClass} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                <option value="">All status</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-filter-fy">Financial year</Label>
              <select id="sric-filter-fy" className={selectClass} value={filters.financial_year} onChange={(e) => setFilter("financial_year", e.target.value)}>
                <option value="">All years</option>
                {(data?.financial_years ?? []).map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-filter-receiver">Receiver</Label>
              <select id="sric-filter-receiver" className={selectClass} value={filters.receiver} onChange={(e) => setFilter("receiver", e.target.value)}>
                <option value="">All receivers</option>
                {(data?.receivers ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-filter-verified">Fund receipt</Label>
              <select id="sric-filter-verified" className={selectClass} value={filters.verified} onChange={(e) => setFilter("verified", e.target.value)}>
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="not_verified">Not verified</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <DateInput aria-label="From" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <DateInput aria-label="To" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="sric-filter-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sric-filter-search"
                  className="pl-9"
                  placeholder="Ledger ID, project, Employee ID, PI name or email"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            {data?.test_count ? (
              <div className="flex items-end gap-2 pb-2">
                <Switch
                  id="sric-filter-test"
                  checked={filters.test !== "hide"}
                  onCheckedChange={(c) => setFilter("test", c ? "" : "hide")}
                />
                <Label htmlFor="sric-filter-test">Show test entries ({data.test_count})</Label>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {readyIds.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
              <span className="text-muted-foreground">
                {selected.length} of {readyIds.length} ready row(s) selected
              </span>
              <Button size="sm" onClick={() => void creditSelected()} disabled={!selected.length || bulkCrediting}>
                {bulkCrediting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Credit selected
              </Button>
            </div>
          ) : null}

          {loading && !data ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No SRIC recharges match the filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        aria-label="Select all ready rows"
                        checked={readyIds.length > 0 && readyIds.every((id) => selected.includes(id))}
                        onCheckedChange={(c) => setSelected(c === true ? readyIds : [])}
                        disabled={!readyIds.length}
                      />
                    </TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Ledger ID / FY</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>PI / Employee ID</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fund receipt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} data-testid={`sric-row-${row.id}`}>
                      <TableCell>
                        {row.status === "awaiting_credit" ? (
                          <Checkbox
                            aria-label={`Select ${row.reference}`}
                            checked={selected.includes(row.id)}
                            onCheckedChange={(c) =>
                              setSelected((prev) => (c === true ? [...prev, row.id] : prev.filter((id) => id !== row.id)))
                            }
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <span className="block font-mono">{row.reference}</span>
                        {formatDateTime(row.email_date || row.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono">{row.ledger_id}</span>
                        <span className="block text-xs text-muted-foreground">FY {row.financial_year}</span>
                      </TableCell>
                      <TableCell className="text-xs">{row.project_number || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <span className="block">{row.pi_name || "—"}</span>
                        <span className="font-mono text-muted-foreground">{row.employee_id || "—"}</span>
                        {row.matched_user ? (
                          <span className="block text-muted-foreground">→ {row.matched_user.name}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{row.receiver_code || "—"}</span>
                        <span className="block text-muted-foreground">{row.department_name || row.receiver_label || "Not mapped"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{amountText(row)}</TableCell>
                      <TableCell className="max-w-[16rem] text-xs">
                        <div className="flex flex-wrap gap-1">
                          {row.is_test ? <SricTestBadge /> : null}
                          <SricStatusBadge status={row.status} label={ADMIN_STATUS_LABEL[row.status]} reversed={row.reversed} />
                        </div>
                        {row.reversed ? (
                          <span className="mt-1 block text-muted-foreground">
                            Debited back by{" "}
                            {row.matched_user && row.reversal_ref ? (
                              <a className="font-mono text-primary underline-offset-2 hover:underline" href={`/admin/wallet-ledger/${row.matched_user.id}`}>
                                {row.reversal_ref}
                              </a>
                            ) : (
                              <span className="font-mono">{row.reversal_ref || "a ledger adjustment"}</span>
                            )}
                            {row.reversed_at ? ` on ${formatDateTime(row.reversed_at)}` : ""}
                            {row.reversed_by_name ? ` by ${row.reversed_by_name}` : ""}
                          </span>
                        ) : null}
                        {row.review_message && row.status !== "credited" ? (
                          <span className="mt-1 block text-muted-foreground">{row.review_message}</span>
                        ) : null}
                        {row.status === "duplicate" && row.duplicate_of_reference ? (
                          <span className="mt-1 block text-muted-foreground">Same as {row.duplicate_of_reference}</span>
                        ) : null}
                        {row.status === "rejected" && row.rejection_reason ? (
                          <span className="mt-1 block text-muted-foreground">{row.rejection_reason}</span>
                        ) : null}
                        {row.origin_verified === false ? (
                          <span className="mt-1 block text-amber-700 dark:text-amber-400">Email origin not verified</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.reversed ? (
                          <span className="text-muted-foreground">Not applicable (reversed)</span>
                        ) : row.status === "credited" ? (
                          row.fund_receipt_verified ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Verified
                              {row.fund_receipt_verified_by_name ? ` by ${row.fund_receipt_verified_by_name}` : ""}
                              {row.fund_receipt_verified_at ? (
                                <span className="block text-muted-foreground">{formatDateTime(row.fund_receipt_verified_at)}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Not verified</span>
                          )
                        ) : (
                          "—"
                        )}
                        {row.fund_receipt_verification_remarks ? (
                          <span className="block text-muted-foreground">{row.fund_receipt_verification_remarks}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {row.can_credit ? (
                            <Button size="sm" onClick={() => setCreditRow(row)}>
                              Credit
                            </Button>
                          ) : null}
                          {row.can_reject ? (
                            <Button size="sm" variant="outline" onClick={() => setRejectRow(row)}>
                              <Ban className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          ) : null}
                          {row.can_verify ? (
                            <Button size="sm" variant="outline" onClick={() => setVerifyRow(row)}>
                              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                              Verify
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.count > PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showSettings ? <SricSettingsCard onSaved={() => void load()} /> : null}

      {creditRow ? (
        <CreditDialog
          row={creditRow}
          receivers={data?.receivers ?? []}
          onClose={() => setCreditRow(null)}
          onDone={() => {
            setCreditRow(null);
            void load();
          }}
        />
      ) : null}
      {rejectRow ? (
        <RejectDialog
          row={rejectRow}
          onClose={() => setRejectRow(null)}
          onDone={() => {
            setRejectRow(null);
            void load();
          }}
        />
      ) : null}
      {verifyRow ? (
        <VerifyDialog
          row={verifyRow}
          onClose={() => setVerifyRow(null)}
          onDone={() => {
            setVerifyRow(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function RowSummary({ row }: { row: SricRechargeRow }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
      <dt className="text-muted-foreground">Ledger ID</dt>
      <dd className="font-mono">
        {row.ledger_id} (FY {row.financial_year})
      </dd>
      <dt className="text-muted-foreground">Amount</dt>
      <dd className="font-medium tabular-nums">{amountText(row)}</dd>
      <dt className="text-muted-foreground">Project</dt>
      <dd>{row.project_number || "—"}</dd>
      <dt className="text-muted-foreground">PI / Employee ID</dt>
      <dd>
        {row.pi_name || "—"} · <span className="font-mono">{row.employee_id || "—"}</span>
      </dd>
      <dt className="text-muted-foreground">Receiver</dt>
      <dd>
        <span className="font-mono">{row.receiver_code || "—"}</span>
        {row.department_name ? ` → ${row.department_name}` : ""}
      </dd>
    </dl>
  );
}

function CreditDialog({
  row,
  receivers,
  onClose,
  onDone,
}: {
  row: SricRechargeRow;
  receivers: { code: string; label: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState(row.employee_id || "");
  const [options, setOptions] = useState<SricUserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [userId, setUserId] = useState<number | null>(row.matched_user?.id ?? null);
  const [receiver, setReceiver] = useState(row.department_id ? "" : row.receiver_code);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    const res = await apiClient.lookupSricRechargeUser(query.trim());
    setSearching(false);
    setOptions(res.data?.results ?? []);
  };

  const submit = async () => {
    setSaving(true);
    const payload: { user_id?: number; receiver_code?: string; note?: string } = { note };
    if (userId && userId !== row.matched_user?.id) payload.user_id = userId;
    if (!row.matched_user && userId) payload.user_id = userId;
    if (receiver && receiver !== row.receiver_code) payload.receiver_code = receiver;
    if (!row.department_id && receiver) payload.receiver_code = receiver;
    const res = await apiClient.creditSricRecharge(row.id, payload);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not credit this row.");
      if (res.status === 409) onDone();
      return;
    }
    toast.success(res.data.message);
    onDone();
  };

  const needsUser = !row.matched_user && !userId;
  const needsReceiver = !row.department_id && !receiver;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credit {row.reference}</DialogTitle>
          <DialogDescription>
            The amount is added to the faculty member&apos;s department sub-wallet and a confirmation email is sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RowSummary row={row} />
          {row.review_message ? <p className="text-sm text-amber-700 dark:text-amber-400">{row.review_message}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="sric-credit-user">Faculty member</Label>
            {row.matched_user ? (
              <p className="text-sm">
                Matched: {row.matched_user.name} ({row.matched_user.emp_id || row.matched_user.email})
              </p>
            ) : null}
            <div className="flex gap-2">
              <Input
                id="sric-credit-user"
                placeholder="Employee ID, name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search();
                }}
              />
              <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </Button>
            </div>
            {options.length ? (
              <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm" role="listbox" aria-label="Users">
                {options.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={userId === u.id}
                      className={`w-full px-3 py-2 text-left hover:bg-muted ${userId === u.id ? "bg-primary/10" : ""}`}
                      onClick={() => setUserId(u.id)}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {u.emp_id || "—"} · {u.email} · {u.is_faculty ? "Faculty" : u.user_type}
                        {u.department_name ? ` · ${u.department_name}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sric-credit-receiver">Credit to (receiver)</Label>
            <select id="sric-credit-receiver" className={selectClass} value={receiver} onChange={(e) => setReceiver(e.target.value)}>
              <option value="">{row.department_name ? `As mapped (${row.department_name})` : "Select receiver"}</option>
              {receivers.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sric-credit-note">Note (optional)</Label>
            <Textarea id="sric-credit-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || needsUser || needsReceiver}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Credit {amountText(row)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ row, onClose, onDone }: { row: SricRechargeRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    const res = await apiClient.rejectSricRecharge(row.id, reason.trim());
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Row rejected.");
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject {row.reference}</DialogTitle>
          <DialogDescription>The row is not credited. The reason is kept for the record.</DialogDescription>
        </DialogHeader>
        <RowSummary row={row} />
        <div className="space-y-1.5">
          <Label htmlFor="sric-reject-reason">Reason</Label>
          <Textarea id="sric-reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={saving || reason.trim().length < 3}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDialog({ row, onClose, onDone }: { row: SricRechargeRow; onClose: () => void; onDone: () => void }) {
  const [verified, setVerified] = useState<boolean>(true);
  const [remarks, setRemarks] = useState(row.fund_receipt_verification_remarks || "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    const res = await apiClient.verifySricRecharge(row.id, verified, remarks.trim());
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    toast.success(res.data.message);
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fund receipt — {row.reference}</DialogTitle>
          <DialogDescription>Match the credit with the physical receipt / SRIC ledger entry.</DialogDescription>
        </DialogHeader>
        <RowSummary row={row} />
        <div className="flex gap-2" role="radiogroup" aria-label="Fund receipt">
          <Button type="button" variant={verified ? "default" : "outline"} onClick={() => setVerified(true)} role="radio" aria-checked={verified}>
            Verified
          </Button>
          <Button type="button" variant={!verified ? "default" : "outline"} onClick={() => setVerified(false)} role="radio" aria-checked={!verified}>
            Not verified
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sric-verify-remarks">Remarks</Label>
          <Textarea id="sric-verify-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SettingsDraft = Pick<
  SricRechargeSettings,
  | "scan_enabled"
  | "auto_credit_enabled"
  | "sender_email"
  | "attachment_name"
  | "auto_credit_max_amount"
  | "trusted_authserv_ids"
  | "require_internal_relay"
  | "trusted_relay_ranges"
  | "gateway_marker_header"
  | "gateway_marker_value"
  | "confirmation_cc_emails"
  | "review_alert_emails"
  | "quiet_window_enabled"
  | "quiet_window_weekday"
  | "quiet_window_start"
  | "quiet_window_end"
>;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function SricSettingsCard({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<SricRechargeSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDept, setNewDept] = useState("");

  const apply = (data: SricRechargeSettings) => {
    setSettings(data);
    setDraft({
      scan_enabled: data.scan_enabled,
      auto_credit_enabled: data.auto_credit_enabled,
      sender_email: data.sender_email,
      attachment_name: data.attachment_name,
      auto_credit_max_amount: data.auto_credit_max_amount,
      trusted_authserv_ids: data.trusted_authserv_ids,
      require_internal_relay: data.require_internal_relay,
      trusted_relay_ranges: data.trusted_relay_ranges,
      gateway_marker_header: data.gateway_marker_header,
      gateway_marker_value: data.gateway_marker_value,
      confirmation_cc_emails: data.confirmation_cc_emails,
      review_alert_emails: data.review_alert_emails,
      quiet_window_enabled: data.quiet_window_enabled ?? true,
      quiet_window_weekday: data.quiet_window_weekday ?? 2,
      quiet_window_start: data.quiet_window_start || "20:55",
      quiet_window_end: data.quiet_window_end || "21:15",
    });
  };

  useEffect(() => {
    void apiClient.getSricRechargeSettings().then((res) => {
      if (res.data) apply(res.data);
      else toast.error(res.error || "Could not load settings.");
    });
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await apiClient.updateSricRechargeSettings({ ...draft, auto_credit_max_amount: draft.auto_credit_max_amount || null });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save settings.");
      return;
    }
    apply(res.data);
    toast.success("Settings saved.");
    onSaved();
  };

  const saveMapping = async (payload: Parameters<typeof apiClient.saveSricReceiverMapping>[0]) => {
    const res = await apiClient.saveSricReceiverMapping(payload);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the mapping.");
      return false;
    }
    apply(res.data);
    toast.success("Mapping saved.");
    onSaved();
    return true;
  };

  if (!settings || !draft) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </CardContent>
      </Card>
    );
  }

  const text = (key: keyof SettingsDraft, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`sric-setting-${key}`}>{label}</Label>
      <Input
        id={`sric-setting-${key}`}
        value={String(draft[key] ?? "")}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  const toggle = (
    key: "scan_enabled" | "auto_credit_enabled" | "require_internal_relay" | "quiet_window_enabled",
    label: string,
    hint: string,
  ) => (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div>
        <Label htmlFor={`sric-setting-${key}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={`sric-setting-${key}`} checked={draft[key]} onCheckedChange={(c) => setDraft({ ...draft, [key]: c })} />
    </div>
  );

  return (
    <Card data-testid="sric-settings">
      <CardHeader>
        <CardTitle className="text-base">SRIC recharge settings</CardTitle>
        <CardDescription>Only the Main Administrator can change these.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          {toggle("scan_enabled", "Read SRIC emails", "Check the portal mailbox every 5 minutes and on Refresh.")}
          {toggle(
            "auto_credit_enabled",
            "Auto-credit SRIC recharges",
            "Off: matched rows wait as “Ready to credit” until you credit them.",
          )}
          {toggle(
            "require_internal_relay",
            "Require internal relay",
            "Without a trusted Authentication-Results, only accept emails relayed inside the campus network.",
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {text("auto_credit_max_amount", "Auto-credit limit (₹, optional)", "Rows above this go to review.")}
          {text("sender_email", "Sender address")}
          {text("attachment_name", "Attachment name")}
          {text("review_alert_emails", "Review alert emails", "Comma-separated; empty = all Main Administrators.")}
          {text("confirmation_cc_emails", "CC on confirmation emails", "Comma-separated, optional.")}
          {text("trusted_authserv_ids", "Trusted Authentication-Results servers", "Comma-separated authserv-ids.")}
          {text("trusted_relay_ranges", "Extra trusted relay ranges", "Comma-separated CIDRs.")}
          {text("gateway_marker_header", "Gateway marker header")}
          {text("gateway_marker_value", "Gateway marker value")}
        </div>
        <div className="space-y-3 rounded-md border p-3" data-testid="sric-quiet-window">
          {toggle(
            "quiet_window_enabled",
            "Mailbox checks pause during peak booking time",
            "No 5-minute check or faculty Refresh in this weekly window (IST); the first check after it reads everything that arrived. Your Refresh here still works.",
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="sric-setting-quiet_window_weekday">Pause on</Label>
              <select
                id="sric-setting-quiet_window_weekday"
                className={selectClass}
                value={draft.quiet_window_weekday}
                disabled={!draft.quiet_window_enabled}
                onChange={(e) => setDraft({ ...draft, quiet_window_weekday: Number(e.target.value) })}
              >
                {WEEKDAYS.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-setting-quiet_window_start">From (IST)</Label>
              <Input
                id="sric-setting-quiet_window_start"
                type="time"
                value={draft.quiet_window_start}
                disabled={!draft.quiet_window_enabled}
                onChange={(e) => setDraft({ ...draft, quiet_window_start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-setting-quiet_window_end">Until (IST)</Label>
              <Input
                id="sric-setting-quiet_window_end"
                type="time"
                value={draft.quiet_window_end}
                disabled={!draft.quiet_window_enabled}
                onChange={(e) => setDraft({ ...draft, quiet_window_end: e.target.value })}
              />
            </div>
          </div>
          {settings.quiet_window_label ? (
            <p className="text-xs text-muted-foreground">
              Saved: {settings.quiet_window_enabled ? settings.quiet_window_label : "off"}
              {settings.quiet_window_active ? " · paused now" : ""}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Receiver Project mapping</h4>
          <p className="text-xs text-muted-foreground">
            The CSV&apos;s Receiver Project code decides which department sub-wallet is credited. Unknown codes go to review.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Receiver type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono">{m.code}</TableCell>
                    <TableCell>{m.label}</TableCell>
                    <TableCell>
                      <select
                        aria-label={`Department for ${m.code}`}
                        className={selectClass}
                        value={m.department_id ?? ""}
                        onChange={(e) => void saveMapping({ id: m.id, department_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Not set</option>
                        {settings.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Active ${m.code}`}
                        checked={m.is_active}
                        onCheckedChange={(c) => void saveMapping({ id: m.id, is_active: c })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="sric-new-code">New code</Label>
              <Input id="sric-new-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-new-label">Receiver type</Label>
              <Input id="sric-new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sric-new-dept">Department</Label>
              <select id="sric-new-dept" className={selectClass} value={newDept} onChange={(e) => setNewDept(e.target.value)}>
                <option value="">Not set</option>
                {settings.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!newCode.trim() || !newLabel.trim()}
              onClick={async () => {
                const ok = await saveMapping({
                  code: newCode.trim(),
                  label: newLabel.trim(),
                  department_id: newDept ? Number(newDept) : null,
                });
                if (ok) {
                  setNewCode("");
                  setNewLabel("");
                  setNewDept("");
                }
              }}
            >
              Add mapping
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Recent SRIC emails</h4>
          {settings.recent_messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SRIC emails read yet.</p>
          ) : (
            <ul className="divide-y rounded-md border text-xs">
              {settings.recent_messages.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                  <span>{formatDateTime(m.received_at || m.processed_at)}</span>
                  <span className="flex items-center gap-1">
                    {m.is_test ? <SricTestBadge /> : null}
                    {m.status_display}
                  </span>
                  <span>{m.row_count} row(s)</span>
                  <span className={m.authenticated ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                    {m.authenticated ? "Origin verified" : "Origin not verified"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
