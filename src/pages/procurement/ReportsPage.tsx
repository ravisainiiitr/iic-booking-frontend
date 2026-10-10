import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, pmGet, pmPost, type Page, type PmBudgetSummary, type PmReport, type UserBrief } from "@/lib/procurementApi";
import { EmptyRow, ExportButtons, Field, fmtDate, humanize, LoadingRow, money, NativeSelect, ReasonDialog, SectionCard, usePm, useRunner } from "./shared";

const REPORT_LABELS: Record<string, string> = {
  requests: "Purchase requests",
  purchases: "Procurement records",
  invoices: "Bills / invoices",
  "vendor-spend": "Vendor-wise spend",
  stock: "Stock balances",
  "stock-ledger": "Stock ledger",
  assets: "Asset register",
  amc: "AMC / service contracts",
  budget: "Budget vs actual",
  audit: "Audit log",
};

const TRAIL_KINDS = ["request", "record", "invoice", "asset", "requirement", "proposal", "amc"];

interface Allocation {
  id: number;
  financial_year: string;
  funding_type: string;
  category: { id: number; name: string } | null;
  amount: string;
  reference: string;
  remarks: string;
  created_by: UserBrief;
  created_at: string;
}

interface AuditRow {
  id: number;
  actor: UserBrief | null;
  action: string;
  object_type: string;
  object_number: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string;
  created_at: string;
}

export default function ReportsPage() {
  const { hasPerm, dept } = usePm();
  const reports = hasPerm("reports");
  const budget = hasPerm("budget") || reports;
  return (
    <Tabs defaultValue={reports ? "reports" : "budget"}>
      <TabsList>
        {reports ? <TabsTrigger value="reports">Reports</TabsTrigger> : null}
        {budget ? <TabsTrigger value="budget">Budget</TabsTrigger> : null}
        {reports ? <TabsTrigger value="trail">Audit trail</TabsTrigger> : null}
      </TabsList>
      {reports ? <TabsContent value="reports"><Reports /></TabsContent> : null}
      {budget ? <TabsContent value="budget"><Budget key={dept?.department.id} /></TabsContent> : null}
      {reports ? <TabsContent value="trail"><Trail /></TabsContent> : null}
    </Tabs>
  );
}

function Reports() {
  const { deptId } = usePm();
  const [name, setName] = useState("requests");
  const [fy, setFy] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = { department_id: deptId ?? undefined, financial_year: fy || undefined, date_from: from || undefined, date_to: to || undefined };
  const q = useQuery({
    queryKey: ["procurement", "report", name, query],
    queryFn: () => pmGet<PmReport>(`reports/${name}/`, query),
    enabled: !!deptId,
  });
  return (
    <SectionCard
      title={q.data?.title ?? REPORT_LABELS[name]}
      description={q.data?.subtitle || "Exports include the same filters. Formula-like cells are neutralised in CSV / XLSX."}
      actions={<ExportButtons path={`reports/${name}/`} query={query} name={`${name}-report`} />}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Field label="Report">
          <NativeSelect value={name} onChange={(e) => setName(e.target.value)} options={Object.entries(REPORT_LABELS).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Financial year">
          <Input placeholder="e.g. 2026-27" value={fy} onChange={(e) => setFy(e.target.value)} />
        </Field>
        <Field label="From"><DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><DateInput value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className="max-h-[60dvh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>{(q.data?.headers ?? []).map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={8} /> : !q.data?.rows.length ? <EmptyRow colSpan={Math.max(1, q.data?.headers.length ?? 1)} text="No rows for these filters." /> : q.data.rows.map((row, i) => (
              <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className="whitespace-nowrap text-xs">{String(cell ?? "")}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {q.data ? <p className="mt-2 text-xs text-muted-foreground">{q.data.count} row(s)</p> : null}
    </SectionCard>
  );
}

function Budget() {
  const { deptId, hasPerm } = usePm();
  const qc = useQueryClient();
  const [fy, setFy] = useState("");
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<Allocation | null>(null);
  const { run } = useRunner();
  const summary = useQuery({
    queryKey: ["procurement", "budget-summary", deptId, fy],
    queryFn: () => pmGet<PmBudgetSummary>("budgets/summary/", { department_id: deptId, financial_year: fy || undefined }),
    enabled: !!deptId,
  });
  const year = summary.data?.financial_year ?? fy;
  const allocations = useQuery({
    queryKey: ["procurement", "budgets", deptId, year],
    queryFn: () => pmGet<Page<Allocation>>("budgets/", { department_id: deptId, financial_year: year, page_size: 200 }),
    enabled: !!deptId && !!year,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <div className="space-y-4">
      <SectionCard
        title={`Budget vs actual${year ? ` · FY ${year}` : ""}`}
        description="Approved: requests that reached purchase approval plus approved plan / non-plan requirements (stores issues excluded). Committed: PO value with no bill yet. Purchased: bills on live records. Balance = Budget − Purchased − Committed."
        actions={<Input aria-label="Financial year" className="h-9 w-32" placeholder={year || "2026-27"} value={fy} onChange={(e) => setFy(e.target.value)} />}
      >
        {summary.error ? <p className="text-sm text-destructive">{errorMessage(summary.error)}</p> : null}
        <div className="overflow-x-auto">
          <Table serial={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Funding</TableHead>
                {["Budget", "Approved", "Committed", "Purchased", "Paid", "Balance", "Used"].map((h) => <TableHead key={h} className="text-right">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.isLoading ? <LoadingRow colSpan={8} /> : summary.data ? [...summary.data.rows, { ...summary.data.total, funding_type: "TOTAL" }].map((r) => (
                <TableRow key={r.funding_type} className={r.funding_type === "TOTAL" ? "font-semibold" : undefined}>
                  <TableCell>{humanize(r.funding_type)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.budget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.approved)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.committed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.purchased)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.paid)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${Number(r.balance) < 0 ? "text-destructive" : ""}`}>{money(r.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.utilisation_percent ? `${r.utilisation_percent}%` : "—"}</TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      <SectionCard
        title="Allocations"
        description="Changes and archiving need a reason and are audited."
        actions={hasPerm("budget") ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add allocation</Button> : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FY</TableHead>
              <TableHead>Funding</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Added</TableHead>
              {hasPerm("budget") ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.isLoading ? <LoadingRow colSpan={7} /> : !allocations.data?.results.length ? <EmptyRow colSpan={7} text="No allocations for this year." /> : allocations.data.results.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.financial_year}</TableCell>
                <TableCell>{humanize(a.funding_type)}</TableCell>
                <TableCell>{a.category?.name ?? "All"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(a.amount)}</TableCell>
                <TableCell>{a.reference || "—"}</TableCell>
                <TableCell className="text-xs">{a.created_by?.name} · {fmtDate(a.created_at)}</TableCell>
                {hasPerm("budget") ? <TableCell><Button size="sm" variant="ghost" onClick={() => setArchiving(a)}>Archive</Button></TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
      <AllocationDialog open={adding} onOpenChange={setAdding} defaultFy={year} onSaved={refresh} />
      <ReasonDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title="Archive allocation"
        destructive
        confirmLabel="Archive"
        onConfirm={(reason) => run(async () => { await pmPost(`budgets/${archiving!.id}/archive/`, { reason }); refresh(); }, "Allocation archived.")}
      />
    </div>
  );
}

function AllocationDialog({ open, onOpenChange, defaultFy, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; defaultFy: string; onSaved: () => void }) {
  const { deptId } = usePm();
  const [f, setF] = useState({ financial_year: "", funding_type: "PLAN", amount: "", reference: "", remarks: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget allocation</DialogTitle>
          <DialogDescription>Amounts are stored exactly (no rounding).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Financial year"><Input placeholder={defaultFy} value={f.financial_year} onChange={set("financial_year")} /></Field>
          <Field label="Funding">
            <NativeSelect value={f.funding_type} onChange={set("funding_type")} options={[{ value: "PLAN", label: "Plan" }, { value: "NON_PLAN", label: "Non-plan" }, { value: "OTHER", label: "Other / departmental" }]} />
          </Field>
          <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
          <Field label="Sanction reference"><Input value={f.reference} onChange={set("reference")} /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Input value={f.remarks} onChange={set("remarks")} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !(Number(f.amount) >= 0) || f.amount === "" || !(f.financial_year || defaultFy)}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost("budgets/", { ...f, financial_year: f.financial_year || defaultFy, department_id: deptId });
                onSaved();
              }, "Allocation added.");
              if (ok) {
                setF({ ...f, amount: "", reference: "", remarks: "" });
                onOpenChange(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Trail() {
  const [kind, setKind] = useState("request");
  const [id, setId] = useState("");
  const [target, setTarget] = useState<{ kind: string; id: string } | null>(null);
  const q = useQuery({
    queryKey: ["procurement", "trail", target],
    queryFn: () => pmGet<{ kind: string; object: { number?: string; title?: string; description?: string }; audit: AuditRow[] }>(`trail/${target!.kind}/${target!.id}/`),
    enabled: !!target,
  });
  return (
    <SectionCard title="Audit trail" description="Every create, change, approval and document action on an object and its linked records, oldest first.">
      <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (id.trim()) setTarget({ kind, id: id.trim() }); }}>
        <Field label="Object"><NativeSelect className="w-44" value={kind} onChange={(e) => setKind(e.target.value)} options={TRAIL_KINDS.map((k) => ({ value: k, label: humanize(k) }))} /></Field>
        <Field label="Internal id"><Input className="w-32" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} /></Field>
        <Button type="submit" disabled={!id}>Show trail</Button>
      </form>
      {q.error ? <p className="text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      {q.data ? (
        <>
          <p className="mb-2 text-sm font-medium">{q.data.object.number} {q.data.object.title ?? q.data.object.description ?? ""}</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!q.data.audit.length ? <EmptyRow colSpan={6} /> : q.data.audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(a.created_at, true)}</TableCell>
                    <TableCell className="text-xs">{a.actor?.name ?? "System"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell className="text-xs">{a.object_number || a.object_type}</TableCell>
                    <TableCell className="max-w-md text-xs">
                      {Object.keys(a.new_value ?? {}).map((k) => (
                        <div key={k}>
                          <span className="text-muted-foreground">{k}:</span> {String((a.old_value ?? {})[k] ?? "—")} → {String((a.new_value ?? {})[k] ?? "—")}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs">{a.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
