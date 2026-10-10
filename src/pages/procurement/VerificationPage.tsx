import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pmGet, pmPost, type Page, type PmAsset, type PmCampaign, type PmVerification } from "@/lib/procurementApi";
import { useRegisters, VERIFY_RESULTS } from "./inventory";
import {
  EmptyRow,
  ExportButtons,
  Field,
  fmtDate,
  LoadingRow,
  NativeSelect,
  pageSerialStart,
  Pager,
  ReasonDialog,
  SectionCard,
  Stat,
  StatusBadge,
  todayIso,
  usePm,
  useRunner,
} from "./shared";

export default function VerificationPage() {
  const { id } = useParams();
  return id ? <CampaignDetail id={id} /> : <CampaignList />;
}

function percent(c: PmCampaign) {
  const total = c.stats.total ?? 0;
  return total ? Math.round(((c.stats.verified ?? 0) / total) * 100) : 0;
}

function CampaignList() {
  const { deptId, hasPerm } = usePm();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["procurement", "campaigns", deptId, page],
    queryFn: () => pmGet<Page<PmCampaign>>("verification/campaigns/", { department_id: deptId, page }),
    enabled: !!deptId,
  });
  return (
    <div className="space-y-4">
      <SectionCard
        title="Physical verification"
        description="GFR Rule 213: every asset is physically verified at least once a year and discrepancies are reported. Open a drive for the whole department, one register or one laboratory; staff then scan labels or verify from the asset page."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to="/procurement/scan"><ScanLine className="mr-2 h-4 w-4" />Scan & verify</Link>
            </Button>
            {hasPerm("assets") ? (
              <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />New verification drive</Button>
            ) : null}
          </>
        }
      >
        {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
        <div className="overflow-x-auto">
          <Table serialStart={pageSerialStart(q.data)}>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>FY</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Discrepancies</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? <LoadingRow colSpan={9} /> : !q.data?.results.length ? <EmptyRow colSpan={9} text="No verification drives yet." /> : q.data.results.map((c) => {
                const bad = Object.entries(c.stats.by_result ?? {}).filter(([k]) => k !== "FOUND").reduce((n, [, v]) => n + v, 0);
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/procurement/verification/${c.id}`)}>
                    <TableCell className="font-mono text-xs">
                      <Link className="text-primary underline" to={`/procurement/verification/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.number}</Link>
                    </TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.financial_year}</TableCell>
                    <TableCell>{[c.register?.code, c.laboratory?.name].filter(Boolean).join(" · ") || "Whole department"}</TableCell>
                    <TableCell className="min-w-[10rem]">
                      <div className="flex items-center gap-2">
                        <Progress value={percent(c)} className="h-2" />
                        <span className="whitespace-nowrap text-xs tabular-nums">{c.stats.verified ?? 0}/{c.stats.total ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{bad || "—"}</TableCell>
                    <TableCell>{fmtDate(c.started_on)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      </SectionCard>
      {creating ? <NewCampaignDialog onOpenChange={setCreating} /> : null}
    </div>
  );
}

function NewCampaignDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { deptId } = usePm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const registers = useRegisters(deptId).data?.results ?? [];
  const { busy, run } = useRunner();
  const [f, setF] = useState({ title: "", register_id: "", started_on: todayIso(), committee: "", remarks: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New verification drive</DialogTitle>
          <DialogDescription>Leave the register empty to cover every asset of the department.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><Input value={f.title} onChange={set("title")} placeholder="Annual physical verification" /></Field>
          <Field label="Register (optional)">
            <NativeSelect value={f.register_id} onChange={set("register_id")} placeholder="All registers" options={registers.map((r) => ({ value: String(r.id), label: `${r.code} · ${r.name}` }))} />
          </Field>
          <Field label="Starts on"><DateInput value={f.started_on} onChange={set("started_on")} /></Field>
          <Field label="Verification committee" className="sm:col-span-2"><Textarea rows={2} value={f.committee} onChange={set("committee")} placeholder="Names / office order" /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Textarea rows={2} value={f.remarks} onChange={set("remarks")} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              let id = 0;
              const ok = await run(async () => {
                const c = await pmPost<PmCampaign>("verification/campaigns/", {
                  department_id: deptId,
                  title: f.title,
                  register_id: f.register_id ? Number(f.register_id) : null,
                  started_on: f.started_on || null,
                  committee: f.committee,
                  remarks: f.remarks,
                });
                id = c.id;
                qc.invalidateQueries({ queryKey: ["procurement"] });
              }, "Verification drive opened.");
              if (ok) {
                onOpenChange(false);
                navigate(`/procurement/verification/${id}`);
              }
            }}
          >
            Open drive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPerm } = usePm();
  const { run } = useRunner();
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState("pending");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(1);
  const c = useQuery({ queryKey: ["procurement", "campaign", id], queryFn: () => pmGet<PmCampaign>(`verification/campaigns/${id}/`) });
  const pending = useQuery({
    queryKey: ["procurement", "campaign-assets", id, "pending", page],
    queryFn: () => pmGet<Page<PmAsset>>(`verification/campaigns/${id}/assets/`, { state: "pending", page }),
    enabled: tab === "pending",
  });
  const done = useQuery({
    queryKey: ["procurement", "campaign-assets", id, "done", result, page],
    queryFn: () => pmGet<Page<PmVerification>>(`verification/campaigns/${id}/assets/`, { state: "done", result, page }),
    enabled: tab === "done",
  });
  if (c.isLoading) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (c.error || !c.data) return <p className="text-sm text-destructive">{errorMessage(c.error)}</p>;
  const cmp = c.data;
  const canExport = hasPerm("reports") || hasPerm("assets");
  const by = cmp.stats.by_result ?? {};
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/procurement/verification")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        All drives
      </Button>
      <SectionCard
        title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{cmp.number}</span>{cmp.title}<StatusBadge status={cmp.status} /></span>}
        description={`FY ${cmp.financial_year} · ${[cmp.register?.code, cmp.laboratory?.name].filter(Boolean).join(" · ") || "whole department"} · started ${fmtDate(cmp.started_on)}${cmp.closed_on ? ` · closed ${fmtDate(cmp.closed_on)}` : ""}`}
        actions={
          <>
            {cmp.status === "OPEN" ? <Button size="sm" variant="outline" asChild><Link to="/procurement/scan"><ScanLine className="mr-2 h-4 w-4" />Scan & verify</Link></Button> : null}
            {cmp.status === "OPEN" && hasPerm("assets") ? <Button size="sm" variant="outline" onClick={() => setClosing(true)}>Close drive</Button> : null}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="Assets in scope" value={cmp.stats.total ?? 0} />
          <Stat label="Verified" value={`${cmp.stats.verified ?? 0} (${percent(cmp)}%)`} />
          <Stat label="Not yet seen" value={cmp.stats.pending ?? 0} tone={cmp.stats.pending ? "warn" : undefined} />
          <Stat label="Damaged / short" value={(by.FOUND_DAMAGED ?? 0) + (by.SHORTAGE ?? 0)} tone={(by.FOUND_DAMAGED ?? 0) + (by.SHORTAGE ?? 0) ? "warn" : undefined} />
          <Stat label="Not found" value={by.NOT_FOUND ?? 0} tone={by.NOT_FOUND ? "bad" : undefined} />
        </div>
        {cmp.committee ? <p className="mt-3 text-sm"><span className="text-muted-foreground">Committee:</span> {cmp.committee}</p> : null}
      </SectionCard>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="pending">Not yet verified</TabsTrigger>
          <TabsTrigger value="done">Verified</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <SectionCard title="Not yet verified" actions={canExport ? <ExportButtons path={`verification/campaigns/${id}/assets/`} query={{ state: "pending" }} name={`${cmp.number}-pending`} /> : null}>
            <div className="overflow-x-auto">
              <Table serialStart={pageSerialStart(pending.data)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Register · page · serial</TableHead>
                    <TableHead>Asset tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Equipment / location</TableHead>
                    <TableHead>Last verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.isLoading ? <LoadingRow colSpan={6} /> : !pending.data?.results.length ? <EmptyRow colSpan={6} text="Everything in scope has been verified." /> : pending.data.results.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{a.register_ref || "—"}</TableCell>
                      <TableCell className="font-mono text-xs"><Link className="text-primary underline" to={`/procurement/assets/${a.id}`}>{a.asset_tag || a.number}</Link></TableCell>
                      <TableCell className="max-w-xs truncate">{a.description}</TableCell>
                      <TableCell>{a.equipment?.name ?? a.location ?? "—"}</TableCell>
                      <TableCell>{a.last_verified_on ? fmtDate(a.last_verified_on) : "Never"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pending.data ? <Pager page={pending.data.page} count={pending.data.count} pageSize={pending.data.page_size} onPage={setPage} /> : null}
          </SectionCard>
        </TabsContent>
        <TabsContent value="done">
          <SectionCard
            title="Verified"
            actions={
              <>
                <NativeSelect aria-label="Result" className="h-9 w-56" value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} placeholder="All results" options={VERIFY_RESULTS} />
                {canExport ? <ExportButtons path={`verification/campaigns/${id}/assets/`} query={{ state: "done", result }} name={`${cmp.number}-verified`} /> : null}
              </>
            }
          >
            <div className="overflow-x-auto">
              <Table serialStart={pageSerialStart(done.data)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Register · page · serial</TableHead>
                    <TableHead>Asset tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Location seen</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {done.isLoading ? <LoadingRow colSpan={8} /> : !done.data?.results.length ? <EmptyRow colSpan={8} text="Nothing verified yet." /> : done.data.results.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{v.asset?.register_ref || "—"}</TableCell>
                      <TableCell className="font-mono text-xs"><Link className="text-primary underline" to={`/procurement/assets/${v.asset_id}`}>{v.asset?.asset_tag || v.asset?.number}</Link></TableCell>
                      <TableCell className="max-w-xs truncate">{v.asset?.description}</TableCell>
                      <TableCell><StatusBadge status={v.result === "FOUND" ? "COMPLETED" : "FLAGGED"} label={v.result_label} /></TableCell>
                      <TableCell>{v.location_seen || "—"}</TableCell>
                      <TableCell>{fmtDate(v.verified_on)} · {v.verified_by?.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{v.remarks || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {done.data ? <Pager page={done.data.page} count={done.data.count} pageSize={done.data.page_size} onPage={setPage} /> : null}
          </SectionCard>
        </TabsContent>
      </Tabs>
      <ReasonDialog
        open={closing}
        onOpenChange={setClosing}
        title="Close verification drive"
        description="Assets still pending stay unverified for the year. Closing is recorded in the audit trail."
        label="Closing remarks"
        required={false}
        confirmLabel="Close drive"
        onConfirm={(text) => run(async () => { await pmPost(`verification/campaigns/${id}/close/`, { remarks: text }); qc.invalidateQueries({ queryKey: ["procurement"] }); }, "Drive closed.")}
      />
    </div>
  );
}
