import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, History, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, type OicRequestAuditPage } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";

const ALL = "__all__";

const ACTION_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
  RAISED: "default",
  REFUSED: "destructive",
  EVENT: "outline",
};

/** Every attempt on, and every change to, requests for OIC-only equipment. The server decides whose rows are returned. */
export default function OicRequestAudit() {
  const [searchParams] = useSearchParams();
  const equipmentId = searchParams.get("equipment_id") || undefined;
  const [action, setAction] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OicRequestAuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const params = useCallback(
    () => ({
      equipment_id: equipmentId,
      action: action === ALL ? undefined : action,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: q.trim() || undefined,
    }),
    [equipmentId, action, dateFrom, dateTo, q],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiClient.getOicRequestAudit({ ...params(), page, page_size: 25 }).then((res) => {
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
    const res = await apiClient.downloadOicRequestAuditCsv(params());
    setExporting(false);
    if (res.error) setError(res.error);
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <History className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">OIC Request Audit</h1>
              <p className="text-sm text-muted-foreground">
                Every request raised, every refused attempt and every later change, with who, in which role, when and from
                where. Entries cannot be changed or deleted.
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
            <Label htmlFor="audit-q">Search</Label>
            <Input id="audit-q" value={q} onChange={(e) => changed(setQ)(e.target.value)} placeholder="Equipment, booking, person, reason" />
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={changed(setAction)}>
              <SelectTrigger aria-label="Action"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {(data?.actions ?? []).map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" value={dateFrom} onChange={(e) => changed(setDateFrom)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" value={dateTo} onChange={(e) => changed(setDateTo)(e.target.value)} />
          </div>
        </div>

        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["When", "Action", "Equipment", "Booking", "Status", "By", "Detail", "From"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.results ?? []).map((r) => (
                <tr key={r.id} data-testid="audit-row" className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDMYTime(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={ACTION_VARIANT[r.action] ?? "outline"}>{r.action_display}</Badge>
                    {r.event_type && r.action === "EVENT" ? <div className="mt-1 text-xs text-muted-foreground">{r.event_type}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    {r.equipment_name}
                    <div className="text-xs text-muted-foreground">{r.department_name}</div>
                  </td>
                  <td className="px-3 py-2">{r.booking_reference || "—"}</td>
                  <td className="px-3 py-2">{r.new_status ? `${r.previous_status ? `${r.previous_status} → ` : ""}${r.new_status}` : "—"}</td>
                  <td className="px-3 py-2">
                    {r.actor_label || "Unknown"}
                    <div className="text-xs text-muted-foreground">{[r.actor_role, r.actor_department].filter(Boolean).join(" · ")}</div>
                    {r.actor_email ? <div className="text-xs text-muted-foreground">{r.actor_email}</div> : null}
                  </td>
                  <td className="max-w-xs px-3 py-2 break-words">{r.detail || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.source}
                    {r.ip_address ? <div>{r.ip_address}</div> : null}
                  </td>
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
