import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GraduationCap, Loader2, Megaphone, Presentation, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { heroButtonClass } from "@/components/PageShell";
import { NominationCard } from "@/components/training/NominationCard";
import { TrainingBadgeChips } from "@/components/training/TrainingBadgeChips";
import { NEED_CATEGORY_OPTIONS, deadlineCountdown, formatDate, formatDateTime } from "@/components/training/trainingHelpers";
import { EmptyState, LoadingBlock, ModuleUnavailable, StatusChip, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { FacultyStudentTrainings, NeedCategory, Nomination, NominationCall } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";

const TABS = ["open", "mine", "students"] as const;
type Tab = (typeof TABS)[number];
const MIN_JUSTIFICATION = 20;

function NominateDialog({
  call,
  students,
  onClose,
  onDone,
}: {
  call: NominationCall | null;
  students: FacultyStudentTrainings[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [need, setNeed] = useState<NeedCategory>("THESIS_CRITICAL");
  const [justification, setJustification] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!call) return;
    setStudentId("");
    setNeed("THESIS_CRITICAL");
    setJustification("");
    setHours("");
  }, [call]);

  const certifiedOnThis = (row: FacultyStudentTrainings) =>
    Boolean(call && row.certifications.some((c) => c.equipment?.equipment_id === call.equipment.equipment_id && c.status === "ACTIVE"));

  const submit = async () => {
    if (!call) return;
    if (!studentId) return toast.error("Choose a student.");
    if (justification.trim().length < MIN_JUSTIFICATION) return toast.error(`Justification needs at least ${MIN_JUSTIFICATION} characters.`);
    setBusy(true);
    const res = await trainingApi.createNomination({
      call_id: call.id,
      student_id: Number(studentId),
      need_category: need,
      justification: justification.trim(),
      expected_hours_month: hours ? Number(hours) : undefined,
    });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Nomination submitted. The student is asked to confirm interest.");
    onDone();
    onClose();
  };

  return (
    <Dialog open={Boolean(call)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nominate a student</DialogTitle>
          <DialogDescription>
            {call?.reference} · {call?.equipment.name} — {call?.seats} seats
            {call?.caps?.per_faculty_cap ? ` · up to ${call.caps.per_faculty_cap} nominations per faculty` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>
              Student <span className="text-destructive">*</span>
            </Label>
            {students.length ? (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose from your group" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((row) => (
                    <SelectItem key={row.student.id} value={String(row.student.id)} disabled={certifiedOnThis(row)}>
                      {row.student.name}
                      {certifiedOnThis(row) ? " (already trained)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">No students are linked to you yet. Students join your group from their Wallet.</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Research need</Label>
              <Select value={need} onValueChange={(v) => setNeed(v as NeedCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEED_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nominate-hours">Expected use (hours/month)</Label>
              <Input id="nominate-hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nominate-justification">
              Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="nominate-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why does this student need hands-on access to this instrument?"
            />
            <p className={cn("text-xs", justification.trim().length >= MIN_JUSTIFICATION ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
              {justification.trim().length}/{MIN_JUSTIFICATION} characters minimum
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !students.length}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Submit nomination
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TrainingNominations() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("training_events");
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "open";

  const [calls, setCalls] = useState<NominationCall[] | null>(null);
  const [nominations, setNominations] = useState<Nomination[] | null>(null);
  const [students, setStudents] = useState<FacultyStudentTrainings[] | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [nominateFor, setNominateFor] = useState<NominationCall | null>(null);

  const loadCalls = useCallback(async () => {
    const res = await trainingApi.calls({ scope: "open" });
    if (res.error) toast.error(res.error);
    setCalls(res.data?.results ?? []);
  }, []);
  const loadNominations = useCallback(async () => {
    const res = await trainingApi.nominations({ active: activeOnly });
    if (res.error) toast.error(res.error);
    setNominations(res.data?.results ?? []);
  }, [activeOnly]);
  const loadStudents = useCallback(async () => {
    const res = await trainingApi.facultyStudents();
    if (res.error) toast.error(res.error);
    setStudents(res.data?.results ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCalls(), loadNominations(), loadStudents()]);
    setLoading(false);
  }, [loadCalls, loadNominations, loadStudents]);

  useEffect(() => {
    if (allowed) void loadAll();
  }, [allowed, loadAll]);

  const studentRows = useMemo(() => students ?? [], [students]);

  return (
    <TrainingPageFrame
      title="Training & nominations"
      description="Nominate students from your group for hands-on instrument training and track the results."
      icon={<GraduationCap className="h-5 w-5" />}
      onRefresh={allowed ? () => void loadAll() : undefined}
      refreshing={loading}
      actions={(onHero) =>
        allowed ? (
          <Button asChild size="sm" variant="outline" className={cn("h-9", onHero && heroButtonClass.secondary)}>
            <Link to="/training/demo-requests">
              <Presentation className="mr-1.5 h-4 w-4" /> Demonstration requests
            </Link>
          </Button>
        ) : null
      }
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = new URLSearchParams(params);
            if (v === "open") next.delete("tab");
            else next.set("tab", v);
            setParams(next, { replace: true });
          }}
        >
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="open">Open calls{calls?.length ? ` (${calls.length})` : ""}</TabsTrigger>
            <TabsTrigger value="mine">My nominations</TabsTrigger>
            <TabsTrigger value="students">My students’ trainings</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-3">
            {calls === null ? (
              <LoadingBlock />
            ) : !calls.length ? (
              <EmptyState
                icon={<Megaphone className="h-8 w-8" />}
                title="No open calls right now"
                description="OICs open nomination calls for hands-on training. You will be notified when one opens."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/training/demo-requests">Request a demonstration instead</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {calls.map((c) => (
                  <li key={c.id} className="flex flex-col rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">{c.reference}</p>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.equipment.name} ({c.equipment.code}){c.equipment.department ? ` · ${c.equipment.department}` : ""}
                        </p>
                      </div>
                      <StatusChip kind="call" status={c.status} label={c.status_label} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{c.seats} seats</span>
                      <span>Deadline {formatDateTime(c.deadline)}</span>
                      <span className="font-medium text-foreground">{deadlineCountdown(c.deadline)}</span>
                    </div>
                    {c.notes ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.notes}</p> : null}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <span className="text-xs text-muted-foreground">
                        You nominated {c.my_nominations_count}
                        {c.caps?.per_faculty_cap ? ` of ${c.caps.per_faculty_cap}` : ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!c.accepting || (c.caps?.per_faculty_cap != null && c.my_nominations_count >= c.caps.per_faculty_cap)}
                        onClick={() => setNominateFor(c)}
                      >
                        Nominate student
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)} />
              Active only
            </label>
            {nominations === null ? (
              <LoadingBlock />
            ) : !nominations.length ? (
              <EmptyState title="No nominations" description="Nominate students from an open call." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {nominations.map((n) => (
                  <NominationCard key={n.id} nomination={n} viewer="faculty" onChanged={() => void loadAll()} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="mt-3">
            {students === null ? (
              <LoadingBlock />
            ) : !studentRows.length ? (
              <EmptyState icon={<Users className="h-8 w-8" />} title="No students linked to you" description="Students in your group appear here with their trainings." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Badges</TableHead>
                      <TableHead>Certifications</TableHead>
                      <TableHead>Nominations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentRows.map((row) => (
                      <TableRow key={row.student.id}>
                        <TableCell className="align-top">
                          <p className="font-medium">{row.student.name}</p>
                          <p className="text-xs text-muted-foreground">{row.student.email}</p>
                          {row.student.department ? <p className="text-xs text-muted-foreground">{row.student.department}</p> : null}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.badges.length ? <TrainingBadgeChips badges={row.badges} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.certifications.length ? (
                            <ul className="space-y-0.5 text-xs">
                              {row.certifications.map((c) => (
                                <li key={c.id}>
                                  <span className="font-medium">{c.equipment?.code}</span> · {c.level_name}
                                  <span className="text-muted-foreground">{c.valid_until ? ` · until ${formatDate(c.valid_until)}` : ""}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.nominations.length ? (
                            <ul className="space-y-1 text-xs">
                              {row.nominations.map((n) => (
                                <li key={n.id} className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium">{n.equipment?.code ?? n.call_title}</span>
                                  <StatusChip kind="nomination" status={n.status} label={n.status_label} />
                                  {!n.mine ? <span className="text-muted-foreground">(other faculty)</span> : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <NominateDialog call={nominateFor} students={studentRows} onClose={() => setNominateFor(null)} onDone={() => void loadAll()} />
    </TrainingPageFrame>
  );
}
