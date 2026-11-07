import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, type OperationsAuditPage } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import { formatINRWithPaise } from "@/lib/money";

const ALL = "__all__";
const CATEGORIES = [
  { value: "waitlist", label: "Waitlist" },
  { value: "slot_exchange", label: "Slot exchange" },
  { value: "urgent", label: "Urgent request (Type A and B)" },
  { value: "refund", label: "Refund" },
];

/** Waitlist, slot exchange, urgent requests and refunds in one place, with who did what. The server allows only the Main Administrator. */
export default function AdminOperationsAudit() {
  const [category, setCategory] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OperationsAuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const params = useCallback(
    () => ({
      category: category === ALL ? undefined : category,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: q.trim() || undefined,
    }),
    [category, dateFrom, dateTo, q],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiClient.getOperationsAudit({ ...params(), page, page_size: 25 }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load the audit.");
        return;
      }
      setError("");
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [params, page]);

  const changed = (set: (value: string) => void) => (value: string) => {
    setPage(1);
    set(value);
  };

  const exportCsv = async () => {
    setExporting(true);
    const res = await apiClient.downloadOperationsAuditCsv(params());
    setExporting(false);
    if (res.error) setError(res.error);
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Operations Audit</h1>
              <p className="text-sm text-muted-foreground">
                Waitlist clearing, slot exchanges, Type A and B urgent requests and refunds, with who did it and when. The last 90 days
                show unless you choose dates. Waitlist history starts when this audit went live.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
            Export CSV
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ops-audit-q">Search</Label>
            <Input id="ops-audit-q" value={q} onChange={(e) => changed(setQ)(e.target.value)} placeholder="Person, equipment, booking" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={changed(setCategory)}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ops-audit-from">From</Label>
            <Input id="ops-audit-from" type="date" value={dateFrom} onChange={(e) => changed(setDateFrom)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ops-audit-to">To</Label>
            <Input id="ops-audit-to" type="date" value={dateTo} onChange={(e) => changed(setDateTo)(e.target.value)} />
          </div>
        </div>

        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["When", "Category", "Action", "Done by", "Equipment", "User affected", "Booking", "Amount", "Details"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.results ?? []).map((r, index) => (
                <tr key={`${r.at}-${index}`} data-testid="ops-audit-row" className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDMYTime(r.at)}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.category_label}</Badge></td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">
                    {r.actor_name || "Not recorded"}
                    {r.actor_role ? <div className="text-xs text-muted-foreground">{r.actor_role}</div> : null}
                  </td>
                  <td className="px-3 py-2">{r.equipment || "—"}</td>
                  <td className="px-3 py-2">{r.affected_user || "—"}</td>
                  <td className="px-3 py-2">{r.booking_ref || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.amount ? formatINRWithPaise(r.amount) : "—"}</td>
                  <td className="max-w-xs px-3 py-2 break-words">{r.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </p>
          ) : !data?.results.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No entries.</p>
          ) : null}
        </div>

        {data && data.num_pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">Page {data.page} of {data.num_pages} ({data.count} entries)</span>
            <Button variant="outline" size="icon" aria-label="Previous page" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next page" disabled={data.page >= data.num_pages} onClick={() => setPage(data.page + 1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </main>
    </PageShell>
  );
}
