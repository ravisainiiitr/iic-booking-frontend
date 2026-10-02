import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, IndianRupee, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CATALOG_DEPARTMENT_NAME } from "@/lib/catalogCache";
import { formatINRAmount } from "@/lib/money";
import { trainingApi } from "@/lib/trainingApi";
import type {
  DemoPurpose,
  DemoQuote,
  DemoRequest,
  DemoTerms,
  FacultyStudentTrainings,
  TrainingEquipmentDepartment,
  TrainingEquipmentDetail,
  TrainingEquipmentRef,
} from "@/lib/trainingTypes";
import { EquipmentPicker } from "./EquipmentPicker";
import { PURPOSE_OPTIONS, coursePurposeHint, demoTermsParts, durationPresets, formatDuration } from "./trainingHelpers";
import { WindowsEditor, windowsToIso, type LocalWindow } from "./WindowsEditor";

/** Faculty: request a demonstration on an instrument for a class or research group. */
export function DemoRequestForm({ onCreated }: { onCreated: (request: DemoRequest) => void }) {
  const [department, setDepartment] = useState<DepartmentFilterValue>("all");
  const [departmentReady, setDepartmentReady] = useState(false);
  const [trainingDepartments, setTrainingDepartments] = useState<TrainingEquipmentDepartment[] | null>(null);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [defaultTerms, setDefaultTerms] = useState<DemoTerms | null>(null);
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [detail, setDetail] = useState<TrainingEquipmentDetail | null>(null);
  const [purpose, setPurpose] = useState<DemoPurpose>("COURSE");
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [participants, setParticipants] = useState("10");
  const [duration, setDuration] = useState("120");
  const [windows, setWindows] = useState<LocalWindow[]>([{ start: "", end: "" }]);
  const [notes, setNotes] = useState("");
  const [students, setStudents] = useState<FacultyStudentTrainings[] | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [participantText, setParticipantText] = useState("");
  const [chargeAck, setChargeAck] = useState(false);
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void trainingApi.facultyStudents().then((res) => {
      if (alive) setStudents(res.data?.results ?? []);
    });
    void trainingApi.equipment({}).then((res) => {
      if (!alive) return;
      setTrainingDepartments(res.data?.departments ?? null);
      setDefaultTerms(res.data?.demo_terms ?? null);
      setDepartmentsLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setDetail(null);
    if (!equipment) return;
    let alive = true;
    void trainingApi.equipmentDetail(equipment.equipment_id).then((res) => {
      if (!alive) return;
      if (res.error) toast.error(res.error);
      setDetail(res.data ?? null);
    });
    return () => {
      alive = false;
    };
  }, [equipment]);

  const durationNum = Number(duration);
  const participantsNum = Number(participants);
  const terms: DemoTerms | null = detail ?? defaultTerms;
  const maxMinutes = terms?.demo_max_minutes ?? null;
  const presets = durationPresets(maxMinutes);
  const overMax = Boolean(maxMinutes && durationNum > maxMinutes);
  const durationValid = Number.isInteger(durationNum) && durationNum >= 15 && !overMax;

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!equipment || !durationValid) return;
    let alive = true;
    setQuoteLoading(true);
    const handle = window.setTimeout(() => {
      void trainingApi.demoQuote(equipment.equipment_id, { purpose, minutes: durationNum }).then((res) => {
        if (!alive) return;
        setQuoteLoading(false);
        setQuote(res.data ?? null);
        setQuoteError(res.data ? null : res.error || "Could not work out the charge.");
      });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(handle);
      setQuoteLoading(false);
    };
  }, [equipment, purpose, durationNum, durationValid]);

  useEffect(() => {
    setChargeAck(false);
  }, [purpose, equipment, duration]);

  const changeDepartment = (next: DepartmentFilterValue) => {
    setDepartment(next);
    if (!equipment || next === "all") return;
    const name = trainingDepartments?.find((d) => d.id === next)?.name;
    if (!name || equipment.department !== name) setEquipment(null);
  };

  const allowedDepartmentIds = useMemo(() => trainingDepartments?.map((d) => d.id), [trainingDepartments]);
  const trainingCounts = useMemo(
    () => Object.fromEntries((trainingDepartments ?? []).map((d) => [d.id, d.equipment_count])) as Record<number, number>,
    [trainingDepartments],
  );
  const noTrainingEquipment = Boolean(trainingDepartments && !trainingDepartments.length);

  const chargeable = Boolean(quote?.chargeable);
  const balanceError = quote?.balance_error ?? null;

  const toggleStudent = (id: number, on: boolean) =>
    setSelectedStudents((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));

  const submit = async () => {
    if (!equipment) return toast.error("Choose the equipment.");
    if (purpose === "COURSE" && !courseCode.trim()) return toast.error("Enter the course code for a course demonstration.");
    if (!Number.isInteger(participantsNum) || participantsNum <= 0) return toast.error("Enter the number of participants.");
    if (!Number.isInteger(durationNum) || durationNum <= 0) return toast.error("Enter the duration in minutes.");
    if (overMax && maxMinutes) return toast.error(`This equipment allows at most ${formatDuration(maxMinutes)} per demonstration.`);
    const { windows: iso, error } = windowsToIso(windows);
    if (error) return toast.error(error);
    if (balanceError) return toast.error(balanceError);
    if (chargeable && !chargeAck) return toast.error("Please acknowledge the demonstration charge.");

    setBusy(true);
    const res = await trainingApi.createDemoRequest({
      equipment_id: equipment.equipment_id,
      purpose,
      course_code: courseCode.trim(),
      course_name: courseName.trim(),
      participants_requested: participantsNum,
      requested_duration_minutes: durationNum,
      preferred_windows: iso,
      notes: notes.trim(),
      participant_user_ids: selectedStudents.length ? selectedStudents : undefined,
      participant_list_text: participantText.trim() || undefined,
      charge_acknowledged: chargeable ? chargeAck : undefined,
    });
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not submit the request.");
      if (res.code === "charge_ack_required") setChargeAck(false);
      return;
    }
    toast.success(`Request ${res.data.reference} submitted. The OIC will review it.`);
    setEquipment(null);
    setCourseCode("");
    setCourseName("");
    setWindows([{ start: "", end: "" }]);
    setNotes("");
    setSelectedStudents([]);
    setParticipantText("");
    onCreated(res.data);
  };

  const amountText = quote?.amount ? formatINRAmount(quote.amount) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid="demo-terms">
        {demoTermsParts(terms).map((part, i) => (
          <span key={part} className="inline-flex items-center gap-1">
            {i === 0 ? <IndianRupee className="h-3 w-3" aria-hidden /> : null}
            {part}
          </span>
        ))}
      </div>

      {!departmentsLoaded ? (
        <div className="flex h-11 max-w-xl items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading departments…
        </div>
      ) : noTrainingEquipment ? (
        <p className="flex items-start gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          No equipment is open for demonstration requests yet.
        </p>
      ) : (
        <DepartmentFilter
          value={department}
          onChange={changeDepartment}
          defaultDepartmentName={DEFAULT_CATALOG_DEPARTMENT_NAME}
          allowedDepartmentIds={allowedDepartmentIds}
          showAllOption={!allowedDepartmentIds}
          equipmentCounts={allowedDepartmentIds ? trainingCounts : undefined}
          onResolved={() => setDepartmentReady(true)}
          className="max-w-xl"
          triggerClassName="max-w-md"
        />
      )}

      <div className="space-y-1.5">
        <Label>
          Equipment <span className="text-destructive">*</span>
        </Label>
        <EquipmentPicker
          value={equipment}
          onChange={setEquipment}
          departmentId={department}
          disabled={!departmentReady}
          emptyText={department === "all" ? "No matching equipment." : "No matching equipment in this department."}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Purpose</Label>
          <Select value={purpose} onValueChange={(v) => setPurpose(v as DemoPurpose)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" aria-hidden /> {coursePurposeHint(terms?.course_demos_free)}
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
          <div className="space-y-1">
            <Label htmlFor="demo-course-code">
              Course code{purpose === "COURSE" ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input id="demo-course-code" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CYN-512" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="demo-course-name">Course name</Label>
            <Input id="demo-course-name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="demo-participants">
            Participants <span className="text-destructive">*</span>
          </Label>
          <Input id="demo-participants" type="number" min={1} value={participants} onChange={(e) => setParticipants(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="demo-duration">
            Duration (minutes) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="demo-duration"
            type="number"
            min={15}
            step={15}
            max={maxMinutes ?? undefined}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={overMax || undefined}
          />
          <div className="flex flex-wrap gap-1">
            {presets.map((m) => (
              <Button key={m} type="button" size="sm" variant={durationNum === m ? "secondary" : "ghost"} className="h-6 px-2 text-xs" onClick={() => setDuration(String(m))}>
                {formatDuration(m)}
              </Button>
            ))}
          </div>
          {overMax && maxMinutes ? (
            <p className="text-xs text-destructive">At most {formatDuration(maxMinutes)} per demonstration.</p>
          ) : null}
        </div>
      </div>

      {equipment ? (
        <div className="rounded-md border border-border/70 px-3 py-2 text-sm" aria-live="polite" data-testid="demo-estimate">
          {quoteError ? (
            <span className="text-destructive">{quoteError}</span>
          ) : quoteLoading || (!quote && durationValid) ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the charge…
            </span>
          ) : !quote ? (
            <span className="text-muted-foreground">Enter a valid duration to see the charge.</span>
          ) : !quote.chargeable && quote.rate_available ? (
            <span className="text-muted-foreground">
              {quote.purpose === "COURSE" && quote.course_demos_free ? "Course/curricular demonstrations are free." : "No charge for this demonstration."}
            </span>
          ) : !quote.rate_available ? (
            <span className="text-muted-foreground">
              Charged at the internal IITR rate; the OIC confirms the amount when approving. {quote.basis}
            </span>
          ) : (
            <div className="space-y-0.5">
              <p>
                <span className="font-medium">Estimated charge: {amountText}</span>{" "}
                <span className="text-muted-foreground">
                  (internal IITR rate {formatINRAmount(quote.rate_per_hour)}/h, {formatDuration(quote.minutes)})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Deducted from your {quote.wallet_label} when the OIC approves
                {quote.wallet_balance != null ? ` · Balance ${formatINRAmount(quote.wallet_balance)}` : ""}
              </p>
            </div>
          )}
          {balanceError ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{balanceError} Recharge your wallet before submitting.</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {students?.length ? (
        <div className="space-y-1.5">
          <Label>Students from your group (optional)</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border/70 p-2">
            <ul className="grid gap-1 sm:grid-cols-2">
              {students.map((row) => (
                <li key={row.student.id}>
                  <label className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50">
                    <Checkbox checked={selectedStudents.includes(row.student.id)} onCheckedChange={(v) => toggleStudent(row.student.id, v === true)} />
                    <span className="truncate">{row.student.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {selectedStudents.length ? <p className="text-xs text-muted-foreground">{selectedStudents.length} selected</p> : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="demo-participant-list">Other participants (optional)</Label>
        <Textarea
          id="demo-participant-list"
          rows={2}
          value={participantText}
          onChange={(e) => setParticipantText(e.target.value)}
          placeholder="Names / enrolment numbers, one per line"
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Preferred time windows <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">Give 1–3 windows. Use the calendar button to find free instrument time.</p>
        <WindowsEditor value={windows} onChange={setWindows} equipmentId={equipment?.equipment_id} durationMinutes={durationNum} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="demo-notes">Notes for the OIC</Label>
        <Textarea id="demo-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Samples, topics to cover, special requirements…" />
      </div>

      {chargeable && !balanceError ? (
        <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <Checkbox checked={chargeAck} onCheckedChange={(v) => setChargeAck(v === true)} className="mt-0.5" />
          <span>
            {quote?.amount ? (
              <>
                I agree that <strong>{amountText}</strong> (internal IITR rate for {formatDuration(durationNum)}) will be deducted from my{" "}
                {quote.wallet_label} when the OIC approves this demonstration. A shorter approved duration costs less; cancellations are refunded
                as per the policy above.
              </>
            ) : (
              <>
                I agree that this demonstration is charged at the equipment's internal IITR rate, confirmed by the OIC, and deducted from my
                wallet when approved.
              </>
            )}
          </span>
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={() => void submit()} disabled={busy || Boolean(balanceError)}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Submit request
        </Button>
      </div>
    </div>
  );
}
