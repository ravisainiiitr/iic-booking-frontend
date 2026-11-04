import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Landmark, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingBlock, SectionCard, TrainingPageFrame } from "@/components/training/trainingUi";
import { useAuth } from "@/contexts/AuthContext";
import { impactApi, type FunderReport, type FundingInput, type FundingLine, type ReportQuery } from "@/lib/impactApi";

const ALL = "__all__";

/** Indian financial year that contains today: 1 April to 31 March. */
export function currentFinancialYear(today = new Date()): { from: string; to: string } {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

const inr = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function FundingDialog({
  open,
  onOpenChange,
  equipment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment: Array<{ equipment_id: number; name: string; code: string }>;
  onSaved: () => void;
}) {
  const empty = { equipment_id: "", funder: "", scheme: "", sanction_reference: "", sanction_date: "", amount: "", acknowledgement_phrase: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = async () => {
    setBusy(true);
    const input: FundingInput = {
      equipment_id: Number(form.equipment_id),
      funder: form.funder.trim(),
      scheme: form.scheme.trim(),
      sanction_reference: form.sanction_reference.trim(),
      acknowledgement_phrase: form.acknowledgement_phrase.trim(),
      ...(form.sanction_date ? { sanction_date: form.sanction_date } : {}),
      ...(form.amount ? { amount: form.amount } : {}),
    };
    const res = await impactApi.addFunding(input);
    setBusy(false);
    if (res.error) return void toast.error(res.error);
    toast.success("Funding line added");
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add funding line</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fund-eq">Equipment</Label>
            <Select value={form.equipment_id} onValueChange={(v) => setForm((f) => ({ ...f, equipment_id: v }))}>
              <SelectTrigger id="fund-eq">
                <SelectValue placeholder="Choose equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((e) => (
                  <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                    {e.code} · {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fund-funder">Funder</Label>
              <Input id="fund-funder" placeholder="e.g. DST" value={form.funder} onChange={(e) => setForm((f) => ({ ...f, funder: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fund-scheme">Scheme</Label>
              <Input id="fund-scheme" placeholder="e.g. FIST" value={form.scheme} onChange={(e) => setForm((f) => ({ ...f, scheme: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fund-ref">Sanction reference</Label>
              <Input id="fund-ref" value={form.sanction_reference} onChange={(e) => setForm((f) => ({ ...f, sanction_reference: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fund-date">Sanction date</Label>
              <Input id="fund-date" type="date" value={form.sanction_date} onChange={(e) => setForm((f) => ({ ...f, sanction_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fund-amount">Amount (INR)</Label>
              <Input id="fund-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fund-ack">Words the funder expects in a paper's acknowledgement (alternatives separated by |)</Label>
            <Input id="fund-ack" placeholder="e.g. DST-FIST|FIST programme" value={form.acknowledgement_phrase} onChange={(e) => setForm((f) => ({ ...f, acknowledgement_phrase: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !form.equipment_id || !form.funder.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyEditor() {
  const [wording, setWording] = useState("");
  const [phrases, setPhrases] = useState("");
  const [withName, setWithName] = useState(false);
  useEffect(() => {
    void impactApi.policy().then((r) => {
      setWording(r.data?.wording ?? "");
      setPhrases((r.data?.required_phrases ?? []).join("\n"));
      setWithName(Boolean(r.data?.include_equipment_name));
    });
  }, []);
  return (
    <SectionCard title="Acknowledgement wording (Main Admin)">
      <div className="grid gap-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="pol-wording">Suggested acknowledgement shown to users</Label>
          <Textarea id="pol-wording" rows={2} value={wording} onChange={(e) => setWording(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pol-phrases">Required words, one per line (alternatives separated by |)</Label>
          <Textarea id="pol-phrases" rows={3} value={phrases} onChange={(e) => setPhrases(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={withName} onCheckedChange={(v) => setWithName(v === true)} />
          Also require the name or code of an instrument used
        </label>
        <div>
          <Button
            type="button"
            onClick={async () => {
              const res = await impactApi.savePolicy({
                wording,
                required_phrases: phrases.split("\n").map((p) => p.trim()).filter(Boolean),
                include_equipment_name: withName,
              });
              if (res.error) toast.error(res.error);
              else toast.success("Saved");
            }}
          >
            Save wording
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

export default function FunderImpactReport() {
  const { user } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const fy = useMemo(() => currentFinancialYear(), []);
  const [query, setQuery] = useState<ReportQuery>({ date_from: fy.from, date_to: fy.to });
  const [report, setReport] = useState<FunderReport | null>(null);
  const [lines, setLines] = useState<FundingLine[]>([]);
  const [funders, setFunders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [rep, fund] = await Promise.all([impactApi.report(query), impactApi.funding()]);
    setLoading(false);
    if (rep.error) {
      setError(rep.error);
      setReport(null);
    } else {
      setError("");
      setReport(rep.data ?? null);
    }
    setLines(fund.data?.results ?? []);
    setFunders([...new Set((fund.data?.funders ?? []).map((f) => f.funder))]);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const equipment = useMemo(() => {
    const seen = new Map<number, { equipment_id: number; name: string; code: string }>();
    for (const g of report?.groups ?? []) for (const e of g.equipment) seen.set(e.equipment_id, { equipment_id: e.equipment_id, name: e.name, code: e.code });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [report]);

  return (
    <TrainingPageFrame
      title="Funder impact report"
      description="Use, users, samples, revenue, unique publications and people trained, grouped by funding agency and scheme."
      icon={<Landmark className="h-6 w-6" />}
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="rep-from">From</Label>
          <Input id="rep-from" type="date" value={query.date_from ?? ""} onChange={(e) => setQuery((q) => ({ ...q, date_from: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rep-to">To</Label>
          <Input id="rep-to" type="date" value={query.date_to ?? ""} onChange={(e) => setQuery((q) => ({ ...q, date_to: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rep-funder">Funder</Label>
          <Select value={query.funder || ALL} onValueChange={(v) => setQuery((q) => ({ ...q, funder: v === ALL ? "" : v }))}>
            <SelectTrigger id="rep-funder" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All funders</SelectItem>
              {funders.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" className="gap-1.5" onClick={async () => {
          const err = await impactApi.downloadReport(query, "xlsx");
          if (err) toast.error(err);
        }}>
          <Download className="h-4 w-4" aria-hidden />
          Excel
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={async () => {
          const err = await impactApi.downloadReport(query, "csv");
          if (err) toast.error(err);
        }}>
          <Download className="h-4 w-4" aria-hidden />
          CSV
        </Button>
      </div>

      {error ? (
        <EmptyState title="Not available" description={error} />
      ) : !report ? (
        <LoadingBlock />
      ) : !report.groups.length ? (
        <EmptyState title="Nothing to report" description="No equipment matches this period and funder." />
      ) : (
        <div className="space-y-4">
          {report.groups.map((g) => (
            <SectionCard
              key={`${g.funder}|${g.scheme}`}
              title={`${g.funder}${g.scheme ? ` · ${g.scheme}` : ""}`}
              description={`${g.totals.equipment} instrument(s) · ${g.totals.bookings} bookings · ${g.totals.publications_unique} unique publications${g.totals.sanctioned_amount ? ` · sanctioned ₹${inr(g.totals.sanctioned_amount)}` : ""}`}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Users (int / ext)</TableHead>
                      <TableHead className="text-right">Samples</TableHead>
                      <TableHead className="text-right">Revenue ₹</TableHead>
                      <TableHead className="text-right">Papers</TableHead>
                      <TableHead className="text-right">IF sum</TableHead>
                      <TableHead className="text-right">Authorised</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.equipment.map((e) => (
                      <TableRow key={e.equipment_id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">{e.code}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{e.bookings}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.booking_hours}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.users_internal} / {e.users_external}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{e.samples}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(e.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.publications}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.impact_factor_sum}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.people_authorised}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium" data-testid="group-total">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.bookings}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.booking_hours}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.totals.users_internal} / {g.totals.users_external}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.samples}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(g.totals.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.publications_unique}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.impact_factor_sum}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.totals.people_authorised}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          ))}
          {report.notes?.length ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <SectionCard
        className="mt-4"
        title="Funding lines"
        actions={
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setAdding(true)} disabled={!equipment.length}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        }
      >
        {lines.length ? (
          <ul className="divide-y text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-medium">
                    {l.funder}
                    {l.scheme ? ` · ${l.scheme}` : ""}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {l.equipment.code} · {l.sanction_reference || "no reference"}
                    {l.amount !== null ? ` · ₹${inr(l.amount)}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await impactApi.updateFunding(l.id, { is_active: false });
                    if (res.error) toast.error(res.error);
                    else void load();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">No funding recorded yet. Instruments without one are listed under “Not recorded”.</p>
        )}
      </SectionCard>

      {isAdmin ? <div className="mt-4"><PolicyEditor /></div> : null}

      <FundingDialog open={adding} onOpenChange={setAdding} equipment={equipment} onSaved={() => void load()} />
    </TrainingPageFrame>
  );
}
