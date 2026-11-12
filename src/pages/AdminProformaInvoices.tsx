import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient, type SavedProformaInvoice } from "@/lib/api";
import { downloadSavedProforma, PROFORMA_STATE_FILTERS, rupees, saveBlob } from "@/lib/savedProformas";
import { ProformaDetails, ProformaStateBadge } from "@/components/proforma/SavedProformaParts";

const ROLE_SCOPE: Record<string, string> = {
  main_admin: "You see the proformas of every department.",
  dept_admin: "You see your department's proformas.",
  accounts: "You see your department's proformas. Approve and reconcile their offline payments under Offline payment recharges.",
};

/** Main Administrator, Department Administrator and Accounts In Charge: every saved proforma in scope, with what
 * has been paid against it and the references needed to reconcile it, and a CSV for the accounts. */
export default function AdminProformaInvoices() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SavedProformaInvoice[] | null>(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const res = await apiClient.getStaffProformaInvoices({ state, q: query.trim() });
    if (res.error || !res.data) {
      setError(res.error || "Could not load proforma invoices.");
      return;
    }
    setError(null);
    setRole(res.data.role);
    setRows(res.data.results);
  }, [state, query]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  const exportCsv = async () => {
    setExporting(true);
    const qs = new URLSearchParams({ export: "csv" });
    if (state) qs.set("state", state);
    if (query.trim()) qs.set("q", query.trim());
    const res = await apiClient.downloadProformaFile(`/admin/proforma-invoices/?${qs}`);
    setExporting(false);
    if (res.error || !res.blob) {
      toast.error(res.error || "Could not export.");
      return;
    }
    saveBlob(res.blob, `proforma_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Proforma Invoices"
            description="Every proforma issued, what has been paid against it online or offline, and the references to reconcile it."
            icon={<FileText className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {role ? <p className="text-sm text-muted-foreground">{ROLE_SCOPE[role]}</p> : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Proforma state">
            {PROFORMA_STATE_FILTERS.map((f) => (
              <Button key={f.key || "all"} role="tab" aria-selected={state === f.key} size="sm"
                variant={state === f.key ? "default" : "outline"} onClick={() => setState(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Number, buyer or email" value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Search proforma invoices" />
            </div>
            <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              CSV
            </Button>
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : rows === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing here.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((pi) => {
              const open = openId === pi.id;
              return (
                <Card key={pi.id} data-testid="staff-pi-row">
                  <CardContent className="space-y-2 p-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{pi.number}</span>
                          <ProformaStateBadge pi={pi} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pi.department.name || "—"} · {new Date(pi.issued_at).toLocaleDateString("en-IN")}
                          {pi.amount_source === "CLIENT" ? " · estimate figures" : ""}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{pi.buyer.name || "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{pi.buyer.email}</p>
                      </div>
                      <div><span className="text-xs text-muted-foreground sm:hidden">Total </span><span className="tabular-nums">{rupees(pi.total)}</span></div>
                      <div><span className="text-xs text-muted-foreground">Credited </span><span className="tabular-nums">{rupees(pi.state.credited)}</span></div>
                      <div><span className="text-xs text-muted-foreground">Pending </span><span className="tabular-nums">{rupees(pi.state.pending)}</span></div>
                      <div><span className="text-xs text-muted-foreground">Reconciled </span><span className="tabular-nums">{rupees(pi.state.reconciled)}</span></div>
                      <div className="flex gap-1 sm:justify-end">
                        <Button size="icon" variant="ghost" aria-label={`Download ${pi.number}`} onClick={() => void downloadSavedProforma(pi)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-expanded={open} aria-label="Details" onClick={() => setOpenId(open ? null : pi.id)}>
                          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    {open ? <ProformaDetails pi={pi} /> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </PageShell>
  );
}
