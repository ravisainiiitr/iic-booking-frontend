import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmDownload, pmForm, pmGet, pmPost, type Page, type PmProposal, type PmRecord, type PmRequirement } from "@/lib/procurementApi";
import { EmptyRow, Field, FilePicker, fmtDate, humanize, LoadingRow, money, NativeSelect, qty, ReasonDialog, SectionCard, StatusBadge, todayIso, usePm, useRunner } from "./shared";

const FUNDING = [
  { value: "PLAN", label: "Plan" },
  { value: "NON_PLAN", label: "Non-plan" },
];

function fyOptions(): { value: string; label: string }[] {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [start - 1, start, start + 1].map((y) => {
    const label = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    return { value: label, label };
  });
}

export default function PlanningPage() {
  const { deptId, hasPerm, hasRole } = usePm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const office = hasPerm("consolidate");
  const [fy, setFy] = useState("");
  const [funding, setFunding] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [dlg, setDlg] = useState<"" | "raise" | "proposal" | "start">("");
  const [editing, setEditing] = useState<PmRequirement | null>(null);
  const [removing, setRemoving] = useState<{ r: PmRequirement; action: "remove" | "restore" } | null>(null);
  const [deciding, setDeciding] = useState<PmProposal | null>(null);
  const { busy, run } = useRunner();
  const canRaise = office || hasRole("OIC", "LAB_OPERATOR");

  const reqs = useQuery({
    queryKey: ["procurement", "requirements", deptId, fy, funding, status, page],
    queryFn: () => pmGet<Page<PmRequirement>>("requirements/", { department_id: deptId, financial_year: fy, funding_type: funding, status, page }),
    enabled: !!deptId,
  });
  const proposals = useQuery({
    queryKey: ["procurement", "proposals", deptId, fy, funding],
    queryFn: () => pmGet<Page<PmProposal>>("proposals/", { financial_year: fy, funding_type: funding, page_size: 100 }),
    enabled: !!deptId && (office || hasRole("HOD", "AUDITOR", "MAIN_ADMIN")),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  const rows = reqs.data?.results ?? [];
  const chosen = rows.filter((r) => selected.includes(r.id));
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Tabs defaultValue="requirements">
      <TabsList>
        <TabsTrigger value="requirements">Requirements</TabsTrigger>
        {proposals.data ? <TabsTrigger value="proposals">Proposals ({proposals.data.count})</TabsTrigger> : null}
      </TabsList>
      <div className="my-3 flex flex-wrap gap-2">
        <NativeSelect aria-label="Financial year" className="w-40" value={fy} onChange={(e) => { setPage(1); setFy(e.target.value); }} placeholder="All years" options={fyOptions()} />
        <NativeSelect aria-label="Funding" className="w-40" value={funding} onChange={(e) => { setPage(1); setFunding(e.target.value); }} placeholder="Plan & non-plan" options={FUNDING} />
      </div>
      <TabsContent value="requirements">
        <SectionCard
          title="Plan / non-plan requirements"
          description="Lab staff raise requirements for the year; the office consolidates them. Every office change keeps the original values and a reason."
          actions={
            <>
              {office && chosen.length ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setDlg("proposal")}>Create proposal ({chosen.length})</Button>
                  {hasPerm("procurement") ? <Button size="sm" variant="outline" onClick={() => setDlg("start")}>Start procurement ({chosen.length})</Button> : null}
                </>
              ) : null}
              {canRaise ? <Button size="sm" onClick={() => setDlg("raise")}><Plus className="mr-2 h-4 w-4" />{office ? "Add requirement" : "Raise requirement"}</Button> : null}
            </>
          }
        >
          <div className="mb-3">
            <NativeSelect
              aria-label="Status"
              className="w-56"
              value={status}
              onChange={(e) => { setPage(1); setStatus(e.target.value); }}
              placeholder="All statuses"
              options={["DRAFT", "SUBMITTED", "UNDER_CONSOLIDATION", "CONSOLIDATED", "SENT_FOR_APPROVAL", "APPROVED", "REJECTED", "PROCUREMENT_IN_PROGRESS", "PROCURED", "REMOVED", "MERGED"].map((s) => ({ value: s, label: humanize(s) }))}
            />
          </div>
          {reqs.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(reqs.error)}</p> : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {office ? <TableHead className="w-8" /> : null}
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>FY · funding</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Estimate</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.isLoading ? <LoadingRow colSpan={10} /> : !rows.length ? <EmptyRow colSpan={10} /> : rows.map((r) => (
                  <TableRow key={r.id}>
                    {office ? (
                      <TableCell>
                        <input type="checkbox" aria-label={`Select ${r.number}`} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} disabled={["REMOVED", "MERGED", "DRAFT"].includes(r.status)} />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-mono text-xs">{r.number}{r.added_by_office ? <span className="ml-1 text-muted-foreground">(office)</span> : null}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.financial_year} · {humanize(r.funding_type)}</TableCell>
                    <TableCell>{r.equipment?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{qty(r.quantity)} {r.uom}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.estimated_total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.approved_amount)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.status === "DRAFT" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await pmPost(`requirements/${r.id}/submit/`); refresh(); }, "Requirement submitted.")}>Submit</Button>
                      ) : null}
                      {office && ["SUBMITTED", "UNDER_CONSOLIDATION", "CONSOLIDATED"].includes(r.status) ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRemoving({ r, action: "remove" })}>Remove</Button>
                        </>
                      ) : null}
                      {office && r.status === "REMOVED" ? <Button size="sm" variant="ghost" onClick={() => setRemoving({ r, action: "restore" })}>Restore</Button> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </TabsContent>
      <TabsContent value="proposals">
        <SectionCard title="Consolidated proposals" description="Sent to the HOD for decision in the app, or decided offline with the signed proposal uploaded.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>FY · funding</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.isLoading ? <LoadingRow colSpan={8} /> : !proposals.data?.results.length ? <EmptyRow colSpan={8} /> : proposals.data.results.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.number}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.financial_year} · {humanize(p.funding_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.total_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.approved_amount)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" aria-label="Download PDF" onClick={() => run(() => pmDownload(`proposals/${p.id}/pdf/`, undefined, `${p.number.replace(/\//g, "-")}.pdf`))}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {office && ["DRAFT", "CONSOLIDATED"].includes(p.status) ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await pmPost(`proposals/${p.id}/send/`); refresh(); }, "Proposal sent for approval.")}>Send</Button>
                      ) : null}
                      {p.status === "SENT_FOR_APPROVAL" && (hasRole("HOD") || hasPerm("offline_approval")) ? (
                        <Button size="sm" onClick={() => setDeciding(p)}>Decide</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </TabsContent>

      <RequirementDialog open={dlg === "raise"} onOpenChange={(o) => setDlg(o ? "raise" : "")} office={office} onSaved={refresh} />
      <RequirementDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} office={office} editing={editing} onSaved={refresh} />
      <ReasonDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.action === "remove" ? `Remove ${removing?.r.number}` : `Restore ${removing?.r.number}`}
        description="Removal is a soft delete; the requirement and its history stay visible."
        confirmLabel={removing?.action === "remove" ? "Remove" : "Restore"}
        onConfirm={(reason) => run(async () => { await pmPost(`requirements/${removing!.r.id}/${removing!.action}/`, { reason }); refresh(); }, "Saved.")}
      />
      <TitleDialog
        open={dlg === "proposal"}
        onOpenChange={(o) => setDlg(o ? "proposal" : "")}
        title="Create proposal"
        description={`${chosen.length} requirement(s), ${money(chosen.reduce((a, r) => a + Number(r.estimated_total), 0))}. All must share the same year and funding.`}
        onSave={(title) =>
          run(async () => {
            await pmPost("proposals/", { department_id: deptId, title, financial_year: chosen[0]?.financial_year, funding_type: chosen[0]?.funding_type, requirement_ids: selected });
            setSelected([]);
            refresh();
          }, "Proposal created.")
        }
      />
      <TitleDialog
        open={dlg === "start"}
        onOpenChange={(o) => setDlg(o ? "start" : "")}
        title="Start procurement from requirements"
        description="Only approved requirements can be procured. One record covers all selected requirements."
        onSave={(title) =>
          run(async () => {
            const rec = await pmPost<PmRecord>("records/from-requirements/", { title, requirement_ids: selected });
            setSelected([]);
            refresh();
            navigate(`/procurement/records/${rec.id}`);
          }, "Procurement record opened.")
        }
      />
      <DecideDialog proposal={deciding} onClose={() => setDeciding(null)} hod={hasRole("HOD")} offline={hasPerm("offline_approval")} onSaved={refresh} />
    </Tabs>
  );
}

function TitleDialog({ open, onOpenChange, title, description, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; onSave: (title: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field label="Title"><Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !value.trim()} onClick={async () => { setBusy(true); const ok = await onSave(value.trim()); setBusy(false); if (ok) { setValue(""); onOpenChange(false); } }}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDialog({ open, onOpenChange, office, editing, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; office: boolean; editing?: PmRequirement | null; onSaved: () => void }) {
  const { boot, deptId } = usePm();
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const blank = { equipment_id: "", funding_type: "PLAN", financial_year: "", description: "", quantity: "1", uom: "Nos", estimated_unit_cost: "", priority: "NORMAL", justification: "", reason: "" };
  const [f, setF] = useState(blank);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  if (editing && loadedFor !== editing.id) {
    setLoadedFor(editing.id);
    setF({ ...blank, description: editing.description, quantity: String(Number(editing.quantity)), uom: editing.uom, estimated_unit_cost: editing.estimated_unit_cost, priority: editing.priority });
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  const ok = f.description.trim() && Number(f.quantity) > 0 && f.estimated_unit_cost !== "" && (!editing || f.reason.trim()) && (!!editing || office || f.equipment_id);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setLoadedFor(null); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Office edit · ${editing.number}` : office ? "Add requirement" : "Raise requirement"}</DialogTitle>
          <DialogDescription>{editing ? "Original values are kept; the change and its reason are logged." : "Raised while the department's plan window is open."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!editing ? (
            <>
              <Field label={office ? "Equipment (optional)" : "Equipment"}>
                <NativeSelect value={f.equipment_id} onChange={set("equipment_id")} placeholder={office ? "Department-level" : "Choose"} options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
              </Field>
              <Field label="Funding"><NativeSelect value={f.funding_type} onChange={set("funding_type")} options={FUNDING} /></Field>
              <Field label="Financial year"><NativeSelect value={f.financial_year} onChange={set("financial_year")} placeholder="Current planning year" options={fyOptions()} /></Field>
            </>
          ) : null}
          <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={set("description")} /></Field>
          <Field label="Quantity"><Input inputMode="decimal" value={f.quantity} onChange={set("quantity")} /></Field>
          <Field label="Unit"><Input value={f.uom} onChange={set("uom")} /></Field>
          <Field label="Estimated unit cost (₹)"><Input inputMode="decimal" value={f.estimated_unit_cost} onChange={set("estimated_unit_cost")} /></Field>
          <Field label="Priority"><NativeSelect value={f.priority} onChange={set("priority")} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ value: p, label: humanize(p) }))} /></Field>
        </div>
        {!editing ? <Field label="Justification (optional)"><Textarea rows={2} value={f.justification} onChange={set("justification")} /></Field> : null}
        {editing || office ? <Field label={editing ? "Reason for change (required)" : "Reason (required for office additions)"}><Textarea rows={2} value={f.reason} onChange={set("reason")} /></Field> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !ok || (office && !editing && !f.reason.trim())}
            onClick={async () => {
              const done = await run(async () => {
                if (editing) {
                  const changes: Record<string, string> = {};
                  if (f.description !== editing.description) changes.description = f.description;
                  if (Number(f.quantity) !== Number(editing.quantity)) changes.quantity = f.quantity;
                  if (f.uom !== editing.uom) changes.uom = f.uom;
                  if (Number(f.estimated_unit_cost) !== Number(editing.estimated_unit_cost)) changes.estimated_unit_cost = f.estimated_unit_cost;
                  if (f.priority !== editing.priority) changes.priority = f.priority;
                  await pmPost(`requirements/${editing.id}/office-edit/`, { changes, reason: f.reason.trim() });
                } else {
                  await pmPost("requirements/", {
                    ...f,
                    department_id: f.equipment_id ? undefined : deptId,
                    equipment_id: f.equipment_id ? Number(f.equipment_id) : null,
                    financial_year: f.financial_year || undefined,
                    reason: f.reason || undefined,
                  });
                }
                onSaved();
              }, editing ? "Requirement updated." : "Requirement saved as draft.");
              if (done) {
                setF(blank);
                setLoadedFor(null);
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

function DecideDialog({ proposal, onClose, hod, offline, onSaved }: { proposal: PmProposal | null; onClose: () => void; hod: boolean; offline: boolean; onSaved: () => void }) {
  const detail = useQuery({
    queryKey: ["procurement", "proposal", proposal?.id],
    queryFn: () => pmGet<PmProposal>(`proposals/${proposal!.id}/`),
    enabled: !!proposal,
  });
  const [decision, setDecision] = useState("APPROVE");
  const [comments, setComments] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [isOffline, setIsOffline] = useState(!hod);
  const [approver, setApprover] = useState({ name: "", designation: "Head of Department", date: todayIso(), reference: "" });
  const [files, setFiles] = useState<File[]>([]);
  const { busy, run } = useRunner();
  const ok = (decision === "APPROVE" || comments.trim()) && (!isOffline || (approver.name.trim() && approver.designation.trim() && files.length === 1));
  return (
    <Dialog open={!!proposal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Decide {proposal?.number}</DialogTitle>
          <DialogDescription>Approve all, approve partial amounts per requirement, or reject with a reason.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Decision">
            <NativeSelect value={decision} onChange={(e) => setDecision(e.target.value)} options={[{ value: "APPROVE", label: "Approve" }, { value: "REJECT", label: "Reject" }]} />
          </Field>
          {hod && offline ? (
            <Field label="Mode">
              <NativeSelect value={isOffline ? "1" : ""} onChange={(e) => setIsOffline(!!e.target.value)} options={[{ value: "", label: "My decision (in app)" }, { value: "1", label: "Record an offline decision" }]} />
            </Field>
          ) : null}
        </div>
        {decision === "APPROVE" && detail.data?.requirements?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead className="text-right">Estimate</TableHead>
                <TableHead className="w-40">Approved (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.data.requirements.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><span className="font-mono text-xs">{r.number}</span> {r.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.estimated_total)}</TableCell>
                  <TableCell><Input inputMode="decimal" aria-label={`Approved ${r.number}`} placeholder={r.estimated_total} value={amounts[r.id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {isOffline ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Approver name"><Input value={approver.name} onChange={(e) => setApprover({ ...approver, name: e.target.value })} /></Field>
            <Field label="Designation"><Input value={approver.designation} onChange={(e) => setApprover({ ...approver, designation: e.target.value })} /></Field>
            <Field label="Decision date"><Input type="date" max={todayIso()} value={approver.date} onChange={(e) => setApprover({ ...approver, date: e.target.value })} /></Field>
            <Field label="Reference (optional)"><Input value={approver.reference} onChange={(e) => setApprover({ ...approver, reference: e.target.value })} /></Field>
            <Field label="Signed proposal" className="sm:col-span-2"><FilePicker files={files} onChange={setFiles} multiple={false} label="Choose signed copy" /></Field>
          </div>
        ) : null}
        <Field label={decision === "REJECT" ? "Reason (required)" : "Comments (optional)"}><Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || !ok}
            onClick={async () => {
              const form = new FormData();
              form.append("decision", decision);
              form.append("comments", comments);
              const filled = Object.fromEntries(Object.entries(amounts).filter(([, v]) => v !== ""));
              if (Object.keys(filled).length) form.append("amounts", JSON.stringify(filled));
              if (isOffline) {
                form.append("offline", "true");
                form.append("approver_name", approver.name.trim());
                form.append("approver_designation", approver.designation.trim());
                form.append("approval_date", approver.date);
                form.append("reference", approver.reference);
                form.append("file", files[0]);
              }
              const done = await run(async () => { await pmForm(`proposals/${proposal!.id}/decide/`, form); onSaved(); }, "Decision recorded.");
              if (done) onClose();
            }}
          >
            Record decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
