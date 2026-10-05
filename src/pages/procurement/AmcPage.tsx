import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, payloadForm, pmForm, pmGet, pmPost, type Page, type PmAmc } from "@/lib/procurementApi";
import { useVendors } from "./InvoiceForm";
import { EmptyRow, Field, FilePicker, fmtDate, humanize, LoadingRow, money, NativeSelect, Pager, ReasonDialog, SectionCard, StatusBadge, usePm, useRunner } from "./shared";

const CONTRACT_TYPES = ["AMC", "CMC", "WARRANTY", "SERVICE", "CALIBRATION", "REPAIR"];

export default function AmcPage() {
  const { deptId, hasPerm } = usePm();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [renewing, setRenewing] = useState<PmAmc | null>(null);
  const [cancelling, setCancelling] = useState<PmAmc | null>(null);
  const { run } = useRunner();
  const canManage = hasPerm("amc");
  const q = useQuery({
    queryKey: ["procurement", "amc", deptId, page, filter],
    queryFn: () =>
      pmGet<Page<PmAmc>>("amc/", {
        department_id: deptId,
        page,
        expiring_within: filter === "expiring" ? 60 : undefined,
        status: filter && filter !== "expiring" ? filter : undefined,
      }),
    enabled: !!deptId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <SectionCard
      title="AMC / service contracts"
      description="OICs and the office are reminded before a contract expires (reminder window set per department)."
      actions={canManage ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />New contract</Button> : undefined}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect
          aria-label="Filter"
          className="w-56"
          value={filter}
          onChange={(e) => { setPage(1); setFilter(e.target.value); }}
          options={[
            { value: "", label: "All contracts" },
            { value: "expiring", label: "Expiring in 60 days" },
            { value: "ACTIVE", label: "Active" },
            { value: "EXPIRED", label: "Expired" },
            { value: "RENEWED", label: "Renewed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </div>
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={8} /> : !q.data?.results.length ? <EmptyRow colSpan={8} /> : q.data.results.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.number}</TableCell>
                <TableCell>{a.equipment.name}</TableCell>
                <TableCell>{a.contract_type}{a.contract_reference ? ` · ${a.contract_reference}` : ""}</TableCell>
                <TableCell>{a.vendor?.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {fmtDate(a.start_date)} – {fmtDate(a.end_date)}
                  {a.status === "ACTIVE" ? (
                    <span className={`ml-2 ${a.days_left <= 30 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                      {a.days_left >= 0 ? `${a.days_left} days left` : "lapsed"}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(a.total_value)}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                {canManage ? (
                  <TableCell className="whitespace-nowrap">
                    {["ACTIVE", "EXPIRED"].includes(a.status) ? <Button size="sm" variant="outline" onClick={() => setRenewing(a)}>Renew</Button> : null}{" "}
                    {a.status === "ACTIVE" ? <Button size="sm" variant="ghost" onClick={() => setCancelling(a)}>Cancel</Button> : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      <ContractDialog open={creating} onOpenChange={setCreating} onSaved={refresh} />
      <ContractDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(null)} renew={renewing} onSaved={refresh} />
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel ${cancelling?.number ?? "contract"}`}
        destructive
        confirmLabel="Cancel contract"
        onConfirm={(reason) => run(async () => { await pmPost(`amc/${cancelling!.id}/cancel/`, { reason }); refresh(); }, "Contract cancelled.")}
      />
    </SectionCard>
  );
}

function ContractDialog({ open, onOpenChange, renew, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; renew?: PmAmc | null; onSaved: () => void }) {
  const { boot, deptId } = usePm();
  const vendors = useVendors(open ? deptId : null).data?.results ?? [];
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const [f, setF] = useState({ equipment_id: "", vendor_id: "", contract_type: "AMC", contract_reference: "", start_date: "", end_date: "", contract_value: "", gst_amount: "", coverage: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [files, setFiles] = useState<File[]>([]);
  const { busy, run } = useRunner();
  const ok = (renew || f.equipment_id) && f.start_date && f.end_date && f.end_date >= f.start_date && f.contract_value !== "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{renew ? `Renew ${renew.number}` : "New AMC / service contract"}</DialogTitle>
          <DialogDescription>{renew ? `${renew.equipment.name} · current period ends ${fmtDate(renew.end_date)}.` : "The department is taken from the equipment."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!renew ? (
            <Field label="Equipment">
              <NativeSelect value={f.equipment_id} onChange={set("equipment_id")} placeholder="Choose" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
            </Field>
          ) : null}
          <Field label="Contract type">
            <NativeSelect value={f.contract_type} onChange={set("contract_type")} options={CONTRACT_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
          </Field>
          <Field label="Vendor">
            <NativeSelect value={f.vendor_id} onChange={set("vendor_id")} placeholder="—" options={vendors.map((v) => ({ value: String(v.id), label: v.name }))} />
          </Field>
          <Field label="Contract reference"><Input value={f.contract_reference} onChange={set("contract_reference")} /></Field>
          <Field label="Start date"><Input type="date" value={f.start_date} onChange={set("start_date")} /></Field>
          <Field label="End date"><Input type="date" value={f.end_date} onChange={set("end_date")} /></Field>
          <Field label="Contract value (₹)"><Input inputMode="decimal" value={f.contract_value} onChange={set("contract_value")} /></Field>
          <Field label="GST (₹)"><Input inputMode="decimal" value={f.gst_amount} onChange={set("gst_amount")} /></Field>
        </div>
        <Field label="Coverage (optional)"><Textarea rows={2} value={f.coverage} onChange={set("coverage")} /></Field>
        <FilePicker files={files} onChange={setFiles} label="Attach contract" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !ok}
            onClick={async () => {
              const payload = {
                ...f,
                equipment_id: renew ? undefined : Number(f.equipment_id),
                vendor_id: f.vendor_id ? Number(f.vendor_id) : null,
                gst_amount: f.gst_amount || null,
              };
              const done = await run(async () => {
                await pmForm(renew ? `amc/${renew.id}/renew/` : "amc/", payloadForm(payload, files));
                onSaved();
              }, renew ? "Contract renewed." : "Contract recorded.");
              if (done) {
                setFiles([]);
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
