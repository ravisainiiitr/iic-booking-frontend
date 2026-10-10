import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Repeat, Scale, Send, SquareMousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type { DutyAllocation, DutyCalendar, DutyMode, DutyPlan, FairnessRow } from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  FAIRNESS_FACTOR_LABELS,
  dutyFormProblem,
  formatHours,
  groupSlotsByDay,
  nextInRotation,
  planPayload,
  shareLabel,
  slotSelectable,
  type DutyFormState,
} from "../dutyHelpers";
import { EquipmentPicker } from "../EquipmentPicker";
import { formatDate, formatDateTime, formatWindow, fromLocalInputValue, toDateInputValue } from "../trainingHelpers";
import { EmptyState, LoadingBlock, SectionCard, runTrainingAction } from "../trainingUi";

const MODES: Array<{ value: DutyMode; label: string; icon: typeof CalendarRange; help: string }> = [
  { value: "slots", label: "Pick slots", icon: SquareMousePointer, help: "Choose individual calendar slots; neighbouring slots become one shift." },
  { value: "range", label: "Date range", icon: CalendarRange, help: "Same daily hours on every chosen weekday between two dates." },
  { value: "recurring", label: "Weekly pattern", icon: Repeat, help: "Recurring weekdays (e.g. every Mon and Wed afternoon) for a period." },
];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function SlotPicker({
  equipment,
  selected,
  onToggle,
}: {
  equipment: TrainingEquipmentRef;
  selected: Set<number>;
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [cal, setCal] = useState<DutyCalendar | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.dutyCalendar(equipment.equipment_id, toDateInputValue(weekStart), toDateInputValue(addDays(weekStart, 6)));
    setLoading(false);
    setCal(res.data ?? null);
  }, [equipment.equipment_id, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => groupSlotsByDay(cal?.slots ?? []), [cal]);
  const shiftsByDay = useMemo(() => groupSlotsByDay(cal?.shifts ?? []), [cal]);
  const now = new Date();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} disabled={weekStart <= new Date(new Date().setHours(0, 0, 0, 0))}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <p className="text-sm font-medium">
          {formatDate(weekStart.toISOString())} – {formatDate(addDays(weekStart, 6).toISOString())}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {loading && !cal ? (
        <LoadingBlock />
      ) : !days.length ? (
        <EmptyState title="No calendar slots this week" description="Slots appear once the equipment's calendar is generated. Use Date range or Weekly pattern to plan further ahead." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map(({ day, slots }) => {
            const dayShifts = shiftsByDay.find((d) => d.day === day)?.slots ?? [];
            const selectable = slots.filter((s) => slotSelectable(s, now));
            const allOn = selectable.length > 0 && selectable.every((s) => selected.has(s.id));
            return (
              <div key={day} className="rounded-lg border border-border/70 bg-card p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold">{new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</p>
                  {selectable.length ? (
                    <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => onToggle(selectable.map((s) => s.id), !allOn)}>
                      {allOn ? "Clear" : "All day"}
                    </button>
                  ) : null}
                </div>
                {dayShifts.length ? (
                  <ul className="mb-1.5 space-y-0.5">
                    {dayShifts.map((s) => (
                      <li key={s.id} className="truncate rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" title={`${s.operator.name} ${formatWindow(s.start_at, s.end_at)}`}>
                        {s.operator.name} · {new Date(s.start_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="grid grid-cols-2 gap-1">
                  {slots.map((s) => {
                    const can = slotSelectable(s, now);
                    const on = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!can}
                        onClick={() => onToggle([s.id], !on)}
                        aria-pressed={on}
                        title={!can ? (s.status === "AVAILABLE" ? "In the past" : s.status.replace(/_/g, " ").toLowerCase()) : s.booked ? "Booked by a user (operator support needed)" : "Free"}
                        className={cn(
                          "rounded border px-1 py-1 text-[11px] tabular-nums transition-colors",
                          on && "border-primary bg-primary text-primary-foreground",
                          !on && can && "border-border hover:border-primary/60 hover:bg-primary/5",
                          !can && "cursor-not-allowed border-dashed border-border/60 text-muted-foreground/60 line-through",
                          s.booked && !on && can && "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40",
                        )}
                      >
                        {new Date(s.start_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Blue slots are booked by users (an operator is most useful there). Purple tags are duty already allocated. Struck-through slots are past or under maintenance.
      </p>
    </div>
  );
}

function CandidateCard({ row, active, onPick }: { row: FairnessRow; active: boolean; onPick: () => void }) {
  const disabled = row.hard_blocked.length > 0;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/70 hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {row.rank ? <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{row.rank}</span> : null}
            {row.name}
          </p>
          <p className="text-xs text-muted-foreground">{[row.faculty_name && `Group of ${row.faculty_name}`, row.department_name].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold tabular-nums">{formatHours(row.metrics.term_hours ?? 0)}</p>
          <p className="text-muted-foreground">this term</p>
        </div>
      </div>
      {row.hard_blocked.length ? (
        <p className="mt-1.5 text-xs text-rose-700 dark:text-rose-300">Not eligible: {row.hard_blocked.join("; ")}</p>
      ) : null}
      {row.blocked.length ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {row.blocked.join("; ")} — needs a reason
        </p>
      ) : null}
      {row.reasons.length && !disabled ? <p className="mt-1.5 text-xs text-muted-foreground">{row.reasons.join(" · ")}</p> : null}
      {!disabled ? (
        <details className="mt-1.5 text-[11px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer select-none">Score {row.priority ?? "—"} — how it is worked out</summary>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(row.breakdown).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span>{FAIRNESS_FACTOR_LABELS[k] ?? k}</span>
                <span className="tabular-nums">{v > 0 ? `+${v}` : v}</span>
              </li>
            ))}
            {row.metrics.faculty_hours_share != null ? <li>Faculty group: {shareLabel(row.metrics.faculty_hours_share, row.metrics.faculty_member_share)}</li> : null}
            {row.metrics.department_hours_share != null ? <li>Department: {shareLabel(row.metrics.department_hours_share, row.metrics.department_member_share)}</li> : null}
          </ul>
        </details>
      ) : null}
    </button>
  );
}

const EMPTY_FORM = (): DutyFormState => {
  const tomorrow = addDays(new Date(), 1);
  return {
    mode: "slots",
    slotIds: [],
    dateFrom: toDateInputValue(tomorrow),
    dateTo: toDateInputValue(addDays(tomorrow, 4)),
    timeFrom: "09:30",
    timeTo: "13:00",
    weekdays: [0, 1, 2, 3, 4],
  };
};

export function AllocatePanel({ onCreated }: { onCreated: (a: DutyAllocation) => void }) {
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [form, setForm] = useState<DutyFormState>(EMPTY_FORM);
  const [plan, setPlan] = useState<DutyPlan | null>(null);
  const [operatorPlan, setOperatorPlan] = useState<DutyPlan | null>(null);
  const [operatorId, setOperatorId] = useState<number | null>(null);
  const [busy, setBusy] = useState<"plan" | "pick" | "create" | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(true);
  const [confirmBy, setConfirmBy] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const selected = useMemo(() => new Set(form.slotIds), [form.slotIds]);
  const problem = equipment ? dutyFormProblem(form) : "Choose the equipment first.";

  const reset = () => {
    setPlan(null);
    setOperatorPlan(null);
    setOperatorId(null);
    setReason("");
  };

  const patchForm = (patch: Partial<DutyFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    reset();
  };

  const findCandidates = async () => {
    if (!equipment || problem) return;
    setBusy("plan");
    const res = await runTrainingAction(trainingApi.planDuty(planPayload(equipment.equipment_id, form)));
    setBusy(null);
    if (res.data) {
      setPlan(res.data);
      setOperatorPlan(null);
      setOperatorId(null);
      setRequiresConfirmation(res.data.requires_confirmation_default);
    }
  };

  const pick = async (row: FairnessRow) => {
    if (!equipment) return;
    setOperatorId(row.user_id);
    setBusy("pick");
    const res = await runTrainingAction(trainingApi.planDuty(planPayload(equipment.equipment_id, form, row.user_id)));
    setBusy(null);
    setOperatorPlan(res.data ?? null);
  };

  const create = async () => {
    if (!equipment || !operatorId) return;
    setBusy("create");
    const res = await runTrainingAction(
      trainingApi.createDuty({
        ...planPayload(equipment.equipment_id, form, operatorId),
        operator_id: operatorId,
        requires_confirmation: requiresConfirmation,
        confirm_by: requiresConfirmation && confirmBy ? fromLocalInputValue(confirmBy) : null,
        override_reason: reason.trim() || undefined,
        title: title.trim() || undefined,
        note: note.trim() || undefined,
      }),
      requiresConfirmation ? "Duty allocated — the operator has been asked to confirm" : "Duty allocated",
    );
    setBusy(null);
    if (res.data) {
      onCreated(res.data);
      setForm(EMPTY_FORM());
      reset();
      setTitle("");
      setNote("");
      setConfirmBy("");
    }
  };

  const needsReason = operatorPlan?.needs_reason ?? [];
  const blocking = operatorPlan?.blocking ?? [];
  const step = !plan ? 1 : !operatorPlan ? 2 : 3;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-xs">
        {["When", "Who (fair rotation)", "Confirm & notify"].map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1",
              step === i + 1 ? "border-primary bg-primary/10 font-medium text-primary" : step > i + 1 ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground",
            )}
          >
            {step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}.</span>} {label}
          </li>
        ))}
      </ol>

      <SectionCard title="1. When" description="Equipment and the time to staff." icon={<CalendarRange className="h-4 w-4" />}>
        <div className="space-y-3">
          <EquipmentPicker
            managed
            value={equipment}
            onChange={(e) => {
              setEquipment(e);
              setForm(EMPTY_FORM());
              reset();
            }}
            placeholder="Equipment you manage"
          />
          {equipment ? (
            <>
              <div className="flex flex-wrap gap-2" role="tablist">
                {MODES.map((m) => (
                  <Button key={m.value} type="button" size="sm" variant={form.mode === m.value ? "default" : "outline"} onClick={() => patchForm({ mode: m.value })} role="tab" aria-selected={form.mode === m.value}>
                    <m.icon className="mr-1.5 h-4 w-4" /> {m.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{MODES.find((m) => m.value === form.mode)?.help}</p>
              {form.mode === "slots" ? (
                <SlotPicker
                  equipment={equipment}
                  selected={selected}
                  onToggle={(ids, on) => {
                    const next = new Set(form.slotIds);
                    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
                    patchForm({ slotIds: [...next] });
                  }}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="duty-from">From</Label>
                    <Input id="duty-from" type="date" value={form.dateFrom} min={toDateInputValue(new Date())} onChange={(e) => patchForm({ dateFrom: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duty-to">To</Label>
                    <Input id="duty-to" type="date" value={form.dateTo} min={form.dateFrom} onChange={(e) => patchForm({ dateTo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duty-time-from">Daily from</Label>
                    <Input id="duty-time-from" type="time" value={form.timeFrom} onChange={(e) => patchForm({ timeFrom: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duty-time-to">Daily to</Label>
                    <Input id="duty-time-to" type="time" value={form.timeTo} onChange={(e) => patchForm({ timeTo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-4">
                    <Label>Weekdays</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const on = form.weekdays.includes(d.value);
                        return (
                          <Button
                            key={d.value}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            className="h-8 w-12"
                            aria-pressed={on}
                            title={d.label}
                            onClick={() => patchForm({ weekdays: on ? form.weekdays.filter((x) => x !== d.value) : [...form.weekdays, d.value].sort() })}
                          >
                            {d.short}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Institute holidays are skipped automatically.</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void findCandidates()} disabled={Boolean(problem) || busy === "plan"}>
                  {busy === "plan" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scale className="mr-1.5 h-4 w-4" />}
                  Show fair candidates
                </Button>
                {problem ? <span className="text-xs text-muted-foreground">{problem}</span> : null}
                {form.mode === "slots" && form.slotIds.length ? <span className="text-xs text-muted-foreground">{form.slotIds.length} slot(s) selected</span> : null}
              </div>
            </>
          ) : null}
        </div>
      </SectionCard>

      {plan ? (
        <SectionCard
          title="2. Who"
          description={`${plan.shifts.length} shift(s), ${formatHours(plan.total_hours)} in ${plan.term.label}. Caps: ${plan.policy.max_hours_week} h/week, ${plan.policy.max_hours_term} h/term; ${plan.policy.cooling_days}-day cooling between duty blocks.`}
          icon={<Scale className="h-4 w-4" />}
        >
          {plan.skipped.length ? (
            <p className="mb-2 text-xs text-muted-foreground">Skipped: {plan.skipped.map((s) => `${formatDate(s.date)} (${s.reason})`).join(", ")}</p>
          ) : null}
          {plan.ranking.length === 0 ? (
            <EmptyState title="No operators on this equipment's roster" description="Certified operators and approved TA nominees are added automatically; add others from the Roster tab." />
          ) : (
            <>
              <p className="mb-2 rounded-md bg-muted/40 px-3 py-2 text-sm">{nextInRotation(plan.ranking)}</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {plan.ranking.map((r) => (
                  <CandidateCard key={r.user_id} row={r} active={operatorId === r.user_id} onPick={() => void pick(r)} />
                ))}
              </div>
            </>
          )}
        </SectionCard>
      ) : null}

      {busy === "pick" ? <LoadingBlock label="Checking conflicts…" /> : null}

      {operatorPlan && operatorPlan.chosen ? (
        <SectionCard title="3. Confirm & notify" description={`${operatorPlan.chosen.name} · ${formatHours(operatorPlan.total_hours)}`} icon={<Send className="h-4 w-4" />}>
          <div className="space-y-4">
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {operatorPlan.shifts.map((s) => (
                <li key={s.start} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                  <span className="whitespace-nowrap">{formatWindow(s.start, s.end)}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {s.conflicts.length === 0 ? <span className="text-xs text-emerald-700 dark:text-emerald-300">No conflicts</span> : null}
                    {s.conflicts.map((c) => (
                      <span
                        key={c.code}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          c.severity === "block" ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
                        )}
                      >
                        {c.message}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {blocking.length ? (
              <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                Remove the clashing times or choose someone else — red items cannot be overridden.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Ask the operator to confirm</p>
                  <p className="text-xs text-muted-foreground">
                    They get an email with one-click Confirm / Decline and a portal task. Unconfirmed duty is released at the deadline and you are told who is next.
                  </p>
                </div>
                <Switch checked={requiresConfirmation} onCheckedChange={setRequiresConfirmation} aria-label="Ask the operator to confirm" />
              </div>
              {requiresConfirmation ? (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-by">Confirm by (optional)</Label>
                  <Input id="confirm-by" type="datetime-local" value={confirmBy} onChange={(e) => setConfirmBy(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Default from policy; never later than the first shift.</p>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="duty-title">Title (optional)</Label>
                <Input id="duty-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Evening EDS support" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="duty-note">Note to the operator (optional)</Label>
                <Textarea id="duty-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {needsReason.length ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="override-reason">Reason for this choice *</Label>
                  <p className="text-xs text-amber-700 dark:text-amber-300">{needsReason.join("; ")}. Your reason is recorded with the allocation.</p>
                  <Textarea id="override-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Only operator trained on the cryo stage" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void create()} disabled={busy === "create" || blocking.length > 0 || (needsReason.length > 0 && !reason.trim())}>
                {busy === "create" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Allocate duty
              </Button>
              {requiresConfirmation && confirmBy ? <span className="text-xs text-muted-foreground">Confirm by {formatDateTime(fromLocalInputValue(confirmBy))}</span> : null}
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
