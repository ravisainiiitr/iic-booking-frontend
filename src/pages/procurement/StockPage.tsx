import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmGet, pmPost, type Page, type PmItem, type PmStockBalance, type PmStockTx } from "@/lib/procurementApi";
import { EmptyRow, Field, fmtDate, humanize, LoadingRow, NativeSelect, Pager, SectionCard, StatusBadge, todayIso, usePm, useRunner } from "./shared";

const TX_TYPES = ["OPENING", "RECEIPT", "ISSUE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RETURN"];
const REASON_REQUIRED = new Set(["ISSUE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RETURN"]);

export default function StockPage() {
  const { deptId, hasPerm, wide } = usePm();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [low, setLow] = useState(false);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [entry, setEntry] = useState(false);
  const [levelsFor, setLevelsFor] = useState<PmStockBalance | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const canManage = hasPerm("stock");

  const balances = useQuery({
    queryKey: ["procurement", "stock-balances", deptId, page, low, search],
    queryFn: () => pmGet<Page<PmStockBalance>>("stock/balances/", { department_id: deptId, page, low: low ? 1 : undefined, q: search }),
    enabled: !!deptId,
  });
  const ledger = useQuery({
    queryKey: ["procurement", "stock-ledger", deptId, ledgerPage],
    queryFn: () => pmGet<Page<PmStockTx>>("stock/transactions/", { department_id: deptId, page: ledgerPage }),
    enabled: !!deptId && wide,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });

  return (
    <Tabs defaultValue="balances">
      <TabsList>
        <TabsTrigger value="balances">Stock balances</TabsTrigger>
        {wide ? <TabsTrigger value="ledger">Ledger</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="balances">
        <SectionCard
          title="Consumable stock"
          description="Balances change only through the ledger: opening, receipts from bills, issues, adjustments and returns."
          actions={canManage ? <Button size="sm" onClick={() => setEntry(true)}><Plus className="mr-2 h-4 w-4" />Stock entry</Button> : undefined}
        >
          <form className="mb-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(term.trim()); }}>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Item name or code" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={low} onChange={(e) => { setPage(1); setLow(e.target.checked); }} />
              Only below minimum / reorder level
            </label>
          </form>
          {balances.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(balances.error)}</p> : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Reorder at</TableHead>
                  <TableHead />
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.isLoading ? <LoadingRow colSpan={7} /> : !balances.data?.results.length ? <EmptyRow colSpan={7} text="No stock recorded yet. Start with an opening balance." /> : balances.data.results.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{b.item.code}</span> {b.item.name}</TableCell>
                    <TableCell>{b.laboratory?.name ?? "Central store"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{Number(b.quantity)} {b.item.uom}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(b.min_level) || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(b.reorder_level) || "—"}</TableCell>
                    <TableCell>{b.below_min ? <StatusBadge status="REJECTED" label="Below minimum" /> : b.reorder_due ? <StatusBadge status="PENDING" label="Reorder" /> : null}</TableCell>
                    {canManage ? <TableCell><Button size="sm" variant="ghost" onClick={() => setLevelsFor(b)}>Levels</Button></TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {balances.data ? <Pager page={balances.data.page} count={balances.data.count} pageSize={balances.data.page_size} onPage={setPage} /> : null}
        </SectionCard>
      </TabsContent>
      {wide ? (
        <TabsContent value="ledger">
          <SectionCard title="Stock ledger" description="Append-only. Corrections are made with adjustment entries.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.isLoading ? <LoadingRow colSpan={8} /> : !ledger.data?.results.length ? <EmptyRow colSpan={8} /> : ledger.data.results.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDate(t.transaction_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{t.number}</TableCell>
                      <TableCell>{t.item.name}</TableCell>
                      <TableCell>{humanize(t.tx_type)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${Number(t.signed_quantity) < 0 ? "text-destructive" : "text-emerald-700"}`}>{Number(t.signed_quantity) > 0 ? "+" : ""}{Number(t.signed_quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(t.balance_after)}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{[t.reference_type, t.reference_number, t.remarks].filter(Boolean).join(" · ")}</TableCell>
                      <TableCell className="text-xs">{t.performed_by?.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {ledger.data ? <Pager page={ledger.data.page} count={ledger.data.count} pageSize={ledger.data.page_size} onPage={setLedgerPage} /> : null}
          </SectionCard>
        </TabsContent>
      ) : null}
      <StockEntryDialog open={entry} onOpenChange={setEntry} onSaved={refresh} />
      <LevelsDialog balance={levelsFor} onClose={() => setLevelsFor(null)} onSaved={refresh} />
    </Tabs>
  );
}

function StockEntryDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { deptId } = usePm();
  const items = useQuery({
    queryKey: ["procurement", "items-all", deptId],
    queryFn: () => pmGet<Page<PmItem>>("items/", { department_id: deptId, page_size: 200 }),
    enabled: open && !!deptId,
  }).data?.results ?? [];
  const [f, setF] = useState({ item_id: "", tx_type: "OPENING", quantity: "", unit_cost: "", transaction_date: todayIso(), reference_number: "", remarks: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  const needsReason = REASON_REQUIRED.has(f.tx_type);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Stock entry</DialogTitle>
          <DialogDescription>Central store. The opening balance must be the first entry for an item; issues cannot take stock below zero.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item" className="sm:col-span-2">
            <NativeSelect value={f.item_id} onChange={set("item_id")} placeholder="Choose item" options={items.map((i) => ({ value: String(i.id), label: `${i.code} · ${i.name} (${i.uom})` }))} />
          </Field>
          <Field label="Entry type">
            <NativeSelect value={f.tx_type} onChange={set("tx_type")} options={TX_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
          </Field>
          <Field label="Quantity"><Input inputMode="decimal" value={f.quantity} onChange={set("quantity")} /></Field>
          <Field label="Unit cost (₹, optional)"><Input inputMode="decimal" value={f.unit_cost} onChange={set("unit_cost")} /></Field>
          <Field label="Date"><DateInput max={todayIso()} value={f.transaction_date} onChange={set("transaction_date")} /></Field>
          <Field label="Reference (optional)" className="sm:col-span-2"><Input value={f.reference_number} onChange={set("reference_number")} /></Field>
        </div>
        <Field label={needsReason ? "Remarks (required)" : "Remarks (optional)"}><Textarea rows={2} value={f.remarks} onChange={set("remarks")} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !f.item_id || !(Number(f.quantity) > 0) || (needsReason && !f.remarks.trim())}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost("stock/transactions/", { ...f, department_id: deptId, item_id: Number(f.item_id), unit_cost: f.unit_cost || null });
                onSaved();
              }, "Stock entry recorded.");
              if (ok) {
                setF({ ...f, quantity: "", unit_cost: "", reference_number: "", remarks: "" });
                onOpenChange(false);
              }
            }}
          >
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LevelsDialog({ balance, onClose, onSaved }: { balance: PmStockBalance | null; onClose: () => void; onSaved: () => void }) {
  const { deptId } = usePm();
  const [min, setMin] = useState("");
  const [reorder, setReorder] = useState("");
  const { busy, run } = useRunner();
  return (
    <Dialog open={!!balance} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock levels · {balance?.item.name}</DialogTitle>
          <DialogDescription>Items below the minimum or at the reorder level are highlighted on the dashboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum level"><Input inputMode="decimal" placeholder={balance ? String(Number(balance.min_level)) : ""} value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Reorder level"><Input inputMode="decimal" placeholder={balance ? String(Number(balance.reorder_level)) : ""} value={reorder} onChange={(e) => setReorder(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || (!min && !reorder)}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost("stock/levels/", { department_id: deptId, item_id: balance!.item.id, laboratory_id: balance!.laboratory?.id ?? null, min_level: min || null, reorder_level: reorder || null });
                onSaved();
              }, "Levels saved.");
              if (ok) {
                setMin("");
                setReorder("");
                onClose();
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
