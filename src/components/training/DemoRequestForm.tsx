import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINRWithPaise } from "@/lib/money";
import { trainingApi } from "@/lib/trainingApi";
import type { DemoPurpose, DemoRequest, FacultyStudentTrainings, TrainingEquipmentDetail, TrainingEquipmentRef } from "@/lib/trainingTypes";
import { EquipmentPicker } from "./EquipmentPicker";
import { PURPOSE_OPTIONS, estimateCharge, formatDuration, isChargeable } from "./trainingHelpers";
import { WindowsEditor, windowsToIso, type LocalWindow } from "./WindowsEditor";

const DURATION_PRESETS = [60, 90, 120, 180, 240];

/** Faculty: request a demonstration on an instrument for a class or research group. */
export function DemoRequestForm({ onCreated }: { onCreated: (request: DemoRequest) => void }) {
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void trainingApi.facultyStudents().then((res) => {
      if (alive) setStudents(res.data?.results ?? []);
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
  const maxMinutes = detail?.demo_max_minutes ?? null;
  const chargeable = Boolean(detail) && isChargeable(purpose, detail?.demo_rate_per_hour);
  const estimate = useMemo(() => estimateCharge(detail?.demo_rate_per_hour, durationNum), [detail, durationNum]);

  useEffect(() => {
    setChargeAck(false);
  }, [purpose, equipment, duration]);

  const toggleStudent = (id: number, on: boolean) =>
    setSelectedStudents((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));

  const submit = async () => {
    if (!equipment) return toast.error("Choose the equipment.");
    if (purpose === "COURSE" && !courseCode.trim()) return toast.error("Enter the course code for a course demonstration.");
    if (!Number.isInteger(participantsNum) || participantsNum <= 0) return toast.error("Enter the number of participants.");
    if (!Number.isInteger(durationNum) || durationNum <= 0) return toast.error("Enter the duration in minutes.");
    if (maxMinutes && durationNum > maxMinutes) return toast.error(`This equipment allows at most ${formatDuration(maxMinutes)} per demonstration.`);
    const { windows: iso, error } = windowsToIso(windows);
    if (error) return toast.error(error);
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

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Equipment <span className="text-destructive">*</span>
        </Label>
        <EquipmentPicker value={equipment} onChange={setEquipment} />
        {detail ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <IndianRupee className="h-3 w-3" aria-hidden />
              {Number(detail.demo_rate_per_hour) > 0 ? `${formatINRWithPaise(detail.demo_rate_per_hour)} per hour (non-course)` : "No demonstration charge"}
            </span>
            {maxMinutes ? <span>Max {formatDuration(maxMinutes)} per demonstration</span> : null}
            {detail.demo_refund_full_days != null ? (
              <span>
                Full refund if cancelled ≥ {detail.demo_refund_full_days} day(s) ahead
                {detail.demo_refund_half_days != null ? `, half refund ≥ ${detail.demo_refund_half_days} day(s)` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
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
            <Info className="h-3 w-3" aria-hidden /> Course/curricular demonstrations are free.
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
          <Input id="demo-duration" type="number" min={15} step={15} max={maxMinutes ?? undefined} value={duration} onChange={(e) => setDuration(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.filter((m) => !maxMinutes || m <= maxMinutes).map((m) => (
              <Button key={m} type="button" size="sm" variant={durationNum === m ? "secondary" : "ghost"} className="h-6 px-2 text-xs" onClick={() => setDuration(String(m))}>
                {formatDuration(m)}
              </Button>
            ))}
          </div>
        </div>
      </div>

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

      {chargeable ? (
        <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <Checkbox checked={chargeAck} onCheckedChange={(v) => setChargeAck(v === true)} className="mt-0.5" />
          <span>
            I understand this demonstration is chargeable at {formatINRWithPaise(detail?.demo_rate_per_hour)} per hour (about{" "}
            <strong>{formatINRWithPaise(estimate)}</strong> for {formatDuration(durationNum)}), debited from my wallet once approved. The OIC may waive
            the charge.
          </span>
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Submit request
        </Button>
      </div>
    </div>
  );
}
