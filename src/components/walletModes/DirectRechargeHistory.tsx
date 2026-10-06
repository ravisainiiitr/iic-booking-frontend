import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Paperclip, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, type WalletDirectRechargeRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

import { formatDate, formatDateTime, formatInr, SectionTitle } from "./shared";

const PAGE_SIZE = 25;
const ALL = "all";

export default function DirectRechargeHistory({
  isAdmin,
  departments,
  modes,
  refreshKey,
}: {
  isAdmin: boolean;
  departments: Array<{ id: number; name: string }>;
  modes: Array<{ value: string; label: string }>;
  refreshKey: number;
}) {
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [mode, setMode] = useState(ALL);
  const [performedBy, setPerformedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<WalletDirectRechargeRecord[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getWalletDirectRechargeHistory({
      q: q.trim(),
      department_id: departmentId === ALL ? null : Number(departmentId),
      mode: mode === ALL ? "" : mode,
      performed_by: isAdmin ? performedBy.trim() : "",
      date_from: dateFrom,
      date_to: dateTo,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the recharge history.");
      return;
    }
    setRows(res.data.results);
    setCount(res.data.count);
  }, [q, departmentId, mode, performedBy, dateFrom, dateTo, page, isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  useEffect(() => setPage(0), [q, departmentId, mode, performedBy, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>
              <SectionTitle icon={<History className="h-4 w-4" />}>Direct recharge history</SectionTitle>
            </CardTitle>
            <CardDescription className="mt-1.5">
              {isAdmin ? "Every direct recharge, newest first." : "Recharges you have made, newest first."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, wallet owner, remarks"
              className="pl-9"
              aria-label="Search recharges"
            />
          </div>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger aria-label="Mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All modes</SelectItem>
              {modes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="drh-from" className="sr-only">
              From date
            </Label>
            <DateInput id="drh-from" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="drh-to" className="sr-only">
              To date
            </Label>
            <DateInput id="drh-to" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
          </div>
          {isAdmin ? (
            <Input
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="Recharged by (email)"
              aria-label="Recharged by"
              className="sm:col-span-2"
            />
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead>Recharged by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No direct recharges found.
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {r.reference}
                    {r.attachment_url ? (
                      <a
                        href={r.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1.5 inline-flex align-middle text-primary hover:underline"
                        aria-label={`Attachment for ${r.reference}`}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm font-medium">{r.owner.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.owner.email}</span>
                  </TableCell>
                  <TableCell className="text-sm">{r.department_name}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatInr(r.amount)}</TableCell>
                  <TableCell className="text-xs">
                    <span className="block">{r.mode_label}</span>
                    <span className="block text-muted-foreground">
                      {r.reference_number || "—"} · {formatDate(r.transaction_date)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatInr(r.balance_after)}</TableCell>
                  <TableCell className="text-xs">
                    <span className="block">{r.performed_by.email}</span>
                    <span className="block text-muted-foreground">
                      {r.performed_as === "main_admin" ? "Main Administrator" : "Designated person"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {count === 0 ? "0 recharges" : `${page * PAGE_SIZE + 1}–${Math.min(count, (page + 1) * PAGE_SIZE)} of ${count}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
