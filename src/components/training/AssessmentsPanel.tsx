import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ListChecks, Loader2, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type {
  Assessment,
  AssessmentCandidate,
  CertificationLevelInfo,
  ChecklistItem,
  CompetencyChecklist,
} from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { previewGrade, slugKey } from "./assessmentHelpers";
import { EquipmentPicker } from "./EquipmentPicker";
import { formatDate } from "./trainingHelpers";
import { EmptyState, LoadingBlock, SectionCard, StatusChip, runTrainingAction } from "./trainingUi";

function AssessmentDialog({
  equipment,
  candidate,
  checklist,
  levels,
  open,
  onOpenChange,
  onDone,
}: {
  equipment: TrainingEquipmentRef;
  candidate: AssessmentCandidate | null;
  checklist: CompetencyChecklist | null;
  levels: CertificationLevelInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const operatorLevels = levels.filter((l) => l.rank >= 10);
  const [level, setLevel] = useState("CERT_L1");
  const [theory, setTheory] = useState("");
  const [marks, setMarks] = useState<Record<string, boolean | undefined>>({});
  const [scope, setScope] = useState("");
  const [remarks, setRemarks] = useState("");
  const [validity, setValidity] = useState("");
  const [waiver, setWaiver] = useState("");
  const [busy, setBusy] = useState(false);
  const needsWaiver = Boolean(candidate && !candidate.reasons.length);

  useEffect(() => {
    if (!open) return;
    const current = candidate?.current_award?.level_rank ?? 0;
    const next = operatorLevels.find((l) => l.rank > current && l.rank >= 20) ?? operatorLevels.find((l) => l.code === "CERT_L1");
    setLevel(next?.code ?? "CERT_L1");
    setTheory("");
    setMarks({});
    setScope("");
    setRemarks("");
    setValidity("");
    setWaiver("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate]);

  const items = checklist?.items ?? [];
  const theoryPct = theory.trim() === "" ? null : Number(theory);
  const preview = previewGrade(items, marks, theoryPct !== null && Number.isFinite(theoryPct) ? theoryPct : null, {
    theory: checklist?.theory_pass_pct ?? 70,
    practical: checklist?.practical_pass_pct ?? 80,
  });

  const submit = async () => {
    if (!candidate) return;
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.recordAssessment({
        equipment_id: equipment.equipment_id,
        user_id: candidate.user.id,
        target_level: level,
        theory_score_pct: theoryPct,
        practical_items: items.map((i) => ({ key: i.key, passed: Boolean(marks[i.key]) })),
        scope_note: scope.trim() || undefined,
        remarks: remarks.trim() || undefined,
        validity_months: validity ? Number(validity) : null,
        prerequisite_waiver_reason: waiver.trim() || undefined,
      }),
    );
    setBusy(false);
    if (res.error || !res.data) return;
    const a = res.data;
    if (a.result !== "PASS") toast.warning(`${a.result_label}: recorded. The candidate has been told what to work on.`);
    else if (a.award_id) toast.success(`Passed — certificate ${a.certificate_no} issued.`);
    else toast.success("Passed — awaiting the OIC's sign-off before the certificate is issued.");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Competency assessment</DialogTitle>
          <DialogDescription>
            {candidate?.user.name} on {equipment.name}. Mark every checklist item; critical items must all pass.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Certify as</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorLevels.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{operatorLevels.find((l) => l.code === level)?.description}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theory-score">Theory score (%)</Label>
              <Input id="theory-score" type="number" min={0} max={100} value={theory} onChange={(e) => setTheory(e.target.value)} placeholder={`Pass ${checklist?.theory_pass_pct ?? 70}`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Practical checklist</Label>
              <span className="text-xs text-muted-foreground">Pass mark {checklist?.practical_pass_pct ?? 80}%</span>
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {items.map((item) => {
                const mark = marks[item.key];
                return (
                  <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm">
                      {item.label}
                      {item.critical ? <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">Critical</span> : null}
                    </span>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant={mark === true ? "default" : "outline"} className={cn("h-7", mark === true && "bg-emerald-600 hover:bg-emerald-700")} onClick={() => setMarks((m) => ({ ...m, [item.key]: true }))}>
                        Competent
                      </Button>
                      <Button type="button" size="sm" variant={mark === false ? "destructive" : "outline"} className="h-7" onClick={() => setMarks((m) => ({ ...m, [item.key]: false }))}>
                        Not yet
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              preview.result === "PASS" && "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
              preview.result && preview.result !== "PASS" && "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
              !preview.result && "border-border/70 bg-muted/20 text-muted-foreground",
            )}
          >
            {preview.result ? (
              <>
                <p className="font-medium">
                  Result: {preview.result === "PASS" ? "Pass" : preview.result === "RETAKE" ? "Retake needed" : "Not yet competent"} · practical {preview.practicalPct ?? "—"}%
                </p>
                {preview.reasons.map((r) => (
                  <p key={r} className="text-xs">
                    {r}
                  </p>
                ))}
              </>
            ) : (
              <p>{preview.unmarked} item(s) still to mark.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scope-note">Scope (optional)</Label>
              <Textarea id="scope-note" rows={2} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. SE/BSE imaging and EDS; not EBSD" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Textarea id="remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Feedback for the candidate" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validity">Validity (months, optional)</Label>
              <Input id="validity" type="number" min={1} max={60} value={validity} onChange={(e) => setValidity(e.target.value)} placeholder="Level default" />
            </div>
            {needsWaiver ? (
              <div className="space-y-1.5">
                <Label htmlFor="waiver">Why assess without prior training? *</Label>
                <Input id="waiver" value={waiver} onChange={(e) => setWaiver(e.target.value)} placeholder="e.g. trained on the same model elsewhere" />
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !preview.result || (needsWaiver && !waiver.trim())}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
            Record assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistEditor({
  equipment,
  checklist,
  open,
  onOpenChange,
  onSaved,
}: {
  equipment: TrainingEquipmentRef;
  checklist: CompetencyChecklist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (c: CompetencyChecklist) => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [theory, setTheory] = useState("70");
  const [practical, setPractical] = useState("80");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !checklist) return;
    setItems(checklist.items.map((i) => ({ ...i })));
    setTheory(String(checklist.theory_pass_pct));
    setPractical(String(checklist.practical_pass_pct));
    setNewLabel("");
  }, [open, checklist]);

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setItems((list) => [...list, { key: slugKey(label, new Set(list.map((i) => i.key))), label, critical: false }]);
    setNewLabel("");
  };

  const save = async () => {
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.saveChecklist(equipment.equipment_id, { items, theory_pass_pct: Number(theory), practical_pass_pct: Number(practical) }),
      "Checklist saved",
    );
    setBusy(false);
    if (res.data) {
      onSaved(res.data);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Competency checklist — {equipment.name}</DialogTitle>
          <DialogDescription>Items the assessor marks during the practical. Critical items must pass for any certificate.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={item.key} className="flex items-center gap-2">
              <Input
                value={item.label}
                onChange={(e) => setItems((list) => list.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                aria-label={`Checklist item ${idx + 1}`}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs">
                <Checkbox
                  checked={item.critical}
                  onCheckedChange={(v) => setItems((list) => list.map((x, i) => (i === idx ? { ...x, critical: v === true } : x)))}
                />
                Critical
              </label>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setItems((list) => list.filter((_, i) => i !== idx))} aria-label="Remove item">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Add an item, e.g. Vacuum venting procedure" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button type="button" variant="outline" onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="theory-pass">Theory pass mark (%)</Label>
            <Input id="theory-pass" type="number" min={0} max={100} value={theory} onChange={(e) => setTheory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="practical-pass">Practical pass mark (%)</Label>
            <Input id="practical-pass" type="number" min={0} max={100} value={practical} onChange={(e) => setPractical(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !items.some((i) => i.label.trim())}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentTable({ rows, onSignOff }: { rows: Assessment[]; onSignOff?: (a: Assessment) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table className="min-w-[720px]" stackOnMobile>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Scores</TableHead>
            <TableHead>Assessor</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Certificate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <p className="font-medium">{a.user.name}</p>
                <p className="text-xs text-muted-foreground">{a.equipment.name}</p>
              </TableCell>
              <TableCell className="text-sm">{a.target_level_name}</TableCell>
              <TableCell>
                <StatusChip kind="assessment" status={a.result} label={a.result_label} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                Theory {a.theory_score_pct ?? "—"}% · Practical {a.practical_score_pct ?? "—"}%
              </TableCell>
              <TableCell className="text-sm">{a.assessor?.name ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(a.assessed_at)}</TableCell>
              <TableCell>
                {a.certificate_no ? (
                  <span className="font-mono text-xs">{a.certificate_no}</span>
                ) : a.awaiting_sign_off && onSignOff ? (
                  <Button type="button" size="sm" onClick={() => onSignOff(a)}>
                    <ShieldCheck className="mr-1 h-4 w-4" /> Sign off
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{a.awaiting_sign_off ? "Awaiting sign-off" : "—"}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Workspace tab: candidates, assessment form, sign-off queue and recent results for one equipment. */
export function AssessmentsPanel({ onChanged }: { onChanged?: () => void }) {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [levels, setLevels] = useState<CertificationLevelInfo[]>([]);
  const [checklist, setChecklist] = useState<CompetencyChecklist | null>(null);
  const [candidates, setCandidates] = useState<AssessmentCandidate[] | null>(null);
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [pendingAll, setPendingAll] = useState<Assessment[]>([]);
  const [query, setQuery] = useState("");
  const [assessing, setAssessing] = useState<AssessmentCandidate | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void trainingApi.levels().then((res) => setLevels(res.data?.results ?? []));
  }, []);

  const loadPending = useCallback(async () => {
    const res = await trainingApi.assessments({ awaiting_sign_off: true });
    setPendingAll(res.data?.results ?? []);
  }, []);

  const load = useCallback(async () => {
    void loadPending();
    if (!equipment) return;
    setLoading(true);
    const [c, cand, list] = await Promise.all([
      trainingApi.checklist(equipment.equipment_id),
      trainingApi.assessmentCandidates(equipment.equipment_id),
      trainingApi.assessments({ equipment_id: equipment.equipment_id }),
    ]);
    setLoading(false);
    if (c.error || cand.error) toast.error(c.error || cand.error);
    setChecklist(c.data ?? null);
    setCandidates(cand.data?.results ?? []);
    setAssessments(list.data?.results ?? []);
  }, [equipment, loadPending]);

  useEffect(() => {
    void load();
  }, [load]);

  const signOff = async (a: Assessment) => {
    const res = await runTrainingAction(trainingApi.signOffAssessment(a.id), "Signed off — certificate issued");
    if (!res.error) {
      void load();
      onChanged?.();
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (candidates ?? []).filter((c) => !q || [c.user.name, c.user.email].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [candidates, query]);

  return (
    <div className="space-y-4">
      {pendingAll.length ? (
        <SectionCard title="Awaiting your sign-off" description="Passed assessments recorded by a Lab Operator or trainer. Signing off issues the certificate." icon={<ShieldCheck className="h-4 w-4" />} bodyClassName="p-0">
          <AssessmentTable rows={pendingAll} onSignOff={(a) => void signOff(a)} />
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="Choose equipment to assess on" />
        </div>
        {equipment ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)} disabled={!checklist}>
            <ListChecks className="mr-1.5 h-4 w-4" /> Checklist{checklist?.is_default ? " (default)" : ""}
          </Button>
        ) : null}
      </div>

      {!equipment ? (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="Choose equipment"
          description="Assess trained users, TA nominees or current holders against the equipment's competency checklist. A pass signed off by the OIC issues a certificate with a verification QR code."
        />
      ) : loading && !candidates ? (
        <LoadingBlock />
      ) : (
        <>
          <SectionCard
            title="Candidates"
            description="People with training, an approved TA nomination or an existing certification on this equipment."
            actions={
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-8 w-48 pl-8" />
              </div>
            }
            bodyClassName="p-0"
          >
            {filtered.length === 0 ? (
              <EmptyState className="m-4" title="No candidates yet" description="People appear here after they attend training on this equipment or hold an approved TA nomination." />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]" stackOnMobile>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Basis</TableHead>
                      <TableHead>Current level</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.user.id}>
                        <TableCell>
                          <p className="font-medium">{c.user.name}</p>
                          <p className="text-xs text-muted-foreground">{c.user.department || c.user.email}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.reasons.join(" · ")}</TableCell>
                        <TableCell className="text-sm">
                          {c.current_award ? (
                            <div className="flex flex-col items-center gap-1">
                              <span>{c.current_award.level_name}</span>
                              <StatusChip kind="award" status={c.current_award.status} label={c.current_award.status_label} />
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {c.awaiting_sign_off ? (
                            <span className="text-xs text-amber-700 dark:text-amber-300">Awaiting sign-off</span>
                          ) : (
                            <Button type="button" size="sm" onClick={() => setAssessing(c)} disabled={!checklist}>
                              <ClipboardCheck className="mr-1 h-4 w-4" /> Assess
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent assessments" bodyClassName="p-0">
            {assessments?.length ? (
              <AssessmentTable rows={assessments} onSignOff={(a) => void signOff(a)} />
            ) : (
              <EmptyState className="m-4" title="No assessments recorded on this equipment" />
            )}
          </SectionCard>

          <AssessmentDialog
            equipment={equipment}
            candidate={assessing}
            checklist={checklist}
            levels={levels}
            open={Boolean(assessing)}
            onOpenChange={(v) => !v && setAssessing(null)}
            onDone={() => {
              void load();
              onChanged?.();
            }}
          />
          <ChecklistEditor equipment={equipment} checklist={checklist} open={editing} onOpenChange={setEditing} onSaved={setChecklist} />
        </>
      )}
    </div>
  );
}
