import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Loader2, Save, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import type { OperatorPolicy, OperatorPolicyFields, OperatorPolicyOverview } from "@/lib/trainingOpsTypes";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { FAIRNESS_FACTOR_LABELS } from "../dutyHelpers";
import { EquipmentPicker } from "../EquipmentPicker";
import { formatDateTime } from "../trainingHelpers";
import { LoadingBlock, SectionCard, runTrainingAction } from "../trainingUi";

type NumKey =
  | "selection_cooldown_days"
  | "group_repeat_penalty"
  | "duty_confirm_hours"
  | "duty_reminder_hours"
  | "duty_max_hours_week"
  | "duty_max_hours_term"
  | "duty_cooling_days"
  | "expiry_reminder_days";

const NUMBER_FIELDS: Array<{ key: NumKey; label: string; help: string; min: number; max: number; group: "selection" | "duty" | "cert" }> = [
  { key: "selection_cooldown_days", label: "Selection cooling period (days)", help: "After being selected for a training, people rank lower for this long. 0 = off.", min: 0, max: 1095, group: "selection" },
  { key: "group_repeat_penalty", label: "Same faculty group penalty (per selection)", help: "Points deducted per earlier selection from the same faculty group in a call.", min: 0, max: 30, group: "selection" },
  { key: "duty_confirm_hours", label: "Time to confirm (hours)", help: "Deadline for the operator to confirm before the duty is released.", min: 1, max: 168, group: "duty" },
  { key: "duty_reminder_hours", label: "Reminder before deadline (hours)", help: "One reminder email/portal alert this long before the deadline. 0 = none.", min: 0, max: 72, group: "duty" },
  { key: "duty_max_hours_week", label: "Max hours per week", help: "Per operator, across all equipment.", min: 1, max: 80, group: "duty" },
  { key: "duty_max_hours_term", label: "Max hours per semester", help: "Per operator, across all equipment.", min: 1, max: 1000, group: "duty" },
  { key: "duty_cooling_days", label: "Cooling period between duty blocks (days)", help: "Rest gap before the same person is asked again. Overriding needs a reason.", min: 0, max: 60, group: "duty" },
  { key: "expiry_reminder_days", label: "Certificate expiry reminder (days before)", help: "Holders and OICs are reminded to recertify.", min: 0, max: 180, group: "cert" },
];

const WEIGHT_KEYS = ["load", "rotation", "rotation_full_days", "faculty_share", "department_share", "repeat"] as const;
const WEIGHT_LABELS: Record<string, string> = { ...FAIRNESS_FACTOR_LABELS, rotation_full_days: "Days of waiting that earn the full rotation weight" };

type FormState = Omit<OperatorPolicyFields, NumKey | "duty_fairness_weights"> &
  Record<NumKey, string> & { duty_fairness_weights: Record<string, string> };

function toForm(p: OperatorPolicy): FormState {
  const weights: Record<string, string> = {};
  for (const k of WEIGHT_KEYS) weights[k] = String(p.duty_fairness_weights?.[k] ?? "");
  const nums = Object.fromEntries(NUMBER_FIELDS.map((f) => [f.key, String(p[f.key] ?? "")])) as Record<NumKey, string>;
  return {
    ...nums,
    selection_cooldown_blocks: p.selection_cooldown_blocks,
    duty_confirmation_required: p.duty_confirmation_required,
    duty_hourly_rate: String(p.duty_hourly_rate ?? "0"),
    notes: "",
    duty_fairness_weights: weights,
  };
}

function formProblem(form: FormState): string {
  for (const f of NUMBER_FIELDS) {
    const raw = form[f.key].trim();
    const v = Number(raw);
    if (raw === "" || !Number.isInteger(v) || v < f.min || v > f.max) return `${f.label}: whole number from ${f.min} to ${f.max}.`;
  }
  for (const k of WEIGHT_KEYS) {
    if (form.duty_fairness_weights[k].trim() === "" || !Number.isFinite(Number(form.duty_fairness_weights[k]))) return `${WEIGHT_LABELS[k] ?? k}: enter a number.`;
  }
  const rate = Number(form.duty_hourly_rate);
  if (!Number.isFinite(rate) || rate < 0) return "Honorarium rate must be zero or more.";
  return "";
}

function scopeLabel(p: OperatorPolicy): string {
  if (p.scope === "EQUIPMENT") return p.equipment?.name ?? "Equipment";
  if (p.scope === "DEPARTMENT") return p.department?.name ?? "Department";
  return "All equipment (global)";
}

/** Fair-use rules for selection cooling, duty caps/rotation and certificate reminders. */
export function OperatorPolicyForm({ allowGlobal = true, defaultScope }: { allowGlobal?: boolean; defaultScope?: "GLOBAL" | "EQUIPMENT" }) {
  const [overview, setOverview] = useState<OperatorPolicyOverview | null>(null);
  const [scope, setScope] = useState<"GLOBAL" | "EQUIPMENT">(defaultScope ?? "GLOBAL");
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<OperatorPolicy[] | null>(null);

  const load = useCallback(async () => {
    const res = await trainingApi.operatorPolicy(scope === "EQUIPMENT" ? equipment?.equipment_id : undefined);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const ov = res.data!;
    setOverview(ov);
    const base =
      scope === "EQUIPMENT"
        ? ov.effective
        : ov.policies.find((p) => p.scope === "GLOBAL") ?? ov.defaults;
    setForm(base ? toForm(base) : null);
  }, [scope, equipment]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (overview && !overview.can_edit_global && scope === "GLOBAL" && !defaultScope) setScope("EQUIPMENT");
  }, [overview, scope, defaultScope]);

  const canEditGlobal = Boolean(overview?.can_edit_global) && allowGlobal;
  const current = useMemo(() => {
    if (!overview) return null;
    if (scope === "GLOBAL") return overview.policies.find((p) => p.scope === "GLOBAL") ?? null;
    return overview.effective;
  }, [overview, scope]);
  const problem = form ? formProblem(form) : "";
  const editable = scope === "GLOBAL" ? canEditGlobal : Boolean(equipment);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const publish = async () => {
    if (!form || problem) return;
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.publishOperatorPolicy({
        scope,
        equipment_id: scope === "EQUIPMENT" ? equipment?.equipment_id : undefined,
        ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f.key, Number(form[f.key])])),
        selection_cooldown_blocks: form.selection_cooldown_blocks,
        duty_confirmation_required: form.duty_confirmation_required,
        duty_hourly_rate: form.duty_hourly_rate,
        duty_fairness_weights: Object.fromEntries(WEIGHT_KEYS.map((k) => [k, Number(form.duty_fairness_weights[k])])),
        notes: form.notes,
      }),
      "Operator rules published",
    );
    setBusy(false);
    if (!res.error) {
      void load();
      setHistory(null);
    }
  };

  const numberInput = (f: (typeof NUMBER_FIELDS)[number]) =>
    form ? (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={`op-${f.key}`}>{f.label}</Label>
        <Input id={`op-${f.key}`} type="number" min={f.min} max={f.max} step={1} value={form[f.key]} disabled={!editable} onChange={(e) => set(f.key, e.target.value)} />
        <p className="text-xs text-muted-foreground">{f.help}</p>
      </div>
    ) : null;

  return (
    <SectionCard
      title="Operator & fair-use rules"
      icon={<Scale className="h-4 w-4" />}
      description="Cooling periods, duty caps, confirmation deadlines and the fair-rotation weights. Every change is a new version; past allocations keep the rules they were made under."
      actions={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (history) {
              setHistory(null);
              return;
            }
            const res = await trainingApi.operatorPolicyHistory();
            if (res.error) toast.error(res.error);
            setHistory(res.data?.results ?? []);
          }}
        >
          <History className="mr-1.5 h-4 w-4" /> {history ? "Hide history" : "History"}
        </Button>
      }
    >
      {!overview ? (
        <LoadingBlock />
      ) : (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {canEditGlobal ? (
            <Button type="button" size="sm" variant={scope === "GLOBAL" ? "default" : "outline"} onClick={() => setScope("GLOBAL")}>
              All equipment
            </Button>
          ) : null}
          <Button type="button" size="sm" variant={scope === "EQUIPMENT" ? "default" : "outline"} onClick={() => setScope("EQUIPMENT")}>
            One equipment
          </Button>
          {scope === "EQUIPMENT" ? (
            <div className="min-w-[16rem] flex-1">
              <EquipmentPicker managed value={equipment} onChange={setEquipment} placeholder="Equipment you manage" />
            </div>
          ) : null}
        </div>
        {current ? (
          <p className="text-xs text-muted-foreground">
            In force: {scopeLabel(current)} · version {current.version || "default"}
            {current.published_at ? ` · published ${formatDateTime(current.published_at)}${current.created_by ? ` by ${current.created_by}` : ""}` : ""}
            {scope === "EQUIPMENT" && current.scope !== "EQUIPMENT" ? ". Saving creates rules just for this equipment." : ""}
          </p>
        ) : scope === "EQUIPMENT" && !equipment ? (
          <p className="text-sm text-muted-foreground">Choose equipment to see or override its rules.</p>
        ) : null}

        {form && (scope === "GLOBAL" || equipment) ? (
          <>
            <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
              <legend className="px-1 text-sm font-semibold">Fair selection for trainings</legend>
              <div className="grid gap-3 md:grid-cols-2">{NUMBER_FIELDS.filter((f) => f.group === "selection").map(numberInput)}</div>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={form.selection_cooldown_blocks} disabled={!editable} onCheckedChange={(v) => set("selection_cooldown_blocks", v)} />
                <span>
                  Hard block during the cooling period
                  <span className="block text-xs text-muted-foreground">Off: they only rank lower. On: they cannot be shortlisted until it ends (OIC can still override with a reason).</span>
                </span>
              </label>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
              <legend className="px-1 text-sm font-semibold">Operator duty</legend>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={form.duty_confirmation_required} disabled={!editable} onCheckedChange={(v) => set("duty_confirmation_required", v)} />
                <span>
                  Ask operators to confirm new duty by default
                  <span className="block text-xs text-muted-foreground">The OIC can switch this per allocation.</span>
                </span>
              </label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {NUMBER_FIELDS.filter((f) => f.group === "duty").map(numberInput)}
                <div className="space-y-1.5">
                  <Label htmlFor="op-rate">Honorarium rate (₹ per hour)</Label>
                  <Input id="op-rate" type="number" min={0} step="0.01" value={form.duty_hourly_rate} disabled={!editable} onChange={(e) => set("duty_hourly_rate", e.target.value)} />
                  <p className="text-xs text-muted-foreground">For statements only — no payments are made from the portal. 0 hides amounts.</p>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
              <legend className="px-1 text-sm font-semibold">Fair-rotation weights</legend>
              <p className="text-xs text-muted-foreground">
                Higher weight = that factor matters more when suggesting who is next. Faculty group and department weights keep any one group from taking more than its share of
                hours.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {WEIGHT_KEYS.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={`op-w-${k}`}>{WEIGHT_LABELS[k] ?? k}</Label>
                    <Input
                      id={`op-w-${k}`}
                      type="number"
                      step="1"
                      value={form.duty_fairness_weights[k]}
                      disabled={!editable}
                      onChange={(e) => set("duty_fairness_weights", { ...form.duty_fairness_weights, [k]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
              <legend className="px-1 text-sm font-semibold">Certificates</legend>
              <div className="grid gap-3 md:grid-cols-2">{NUMBER_FIELDS.filter((f) => f.group === "cert").map(numberInput)}</div>
            </fieldset>

            {editable ? (
              <div className="space-y-1.5">
                <Label htmlFor="op-notes">What changed and why</Label>
                <Textarea id="op-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Shown in the history" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Only the Main Admin can change the rules for all equipment.</p>
            )}
            {editable ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void publish()} disabled={busy || Boolean(problem)}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Publish new version
                </Button>
                {problem ? <span className="text-xs text-rose-700 dark:text-rose-300">{problem}</span> : null}
              </div>
            ) : null}
          </>
        ) : null}

        {history ? (
          <div className="rounded-lg border border-border/70">
            {history.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No versions published yet — the defaults apply.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {history.map((h) => (
                  <li key={h.id ?? `${h.scope}-${h.version}`} className="px-3 py-2 text-sm">
                    <p className="font-medium">
                      {scopeLabel(h)} · v{h.version}
                      {h.is_active ? <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">in force</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.published_at)}
                      {h.created_by ? ` · ${h.created_by}` : ""} · {h.duty_max_hours_week} h/week, {h.duty_max_hours_term} h/semester, cooling {h.duty_cooling_days} d, selection cooling{" "}
                      {h.selection_cooldown_days} d{h.selection_cooldown_blocks ? " (blocking)" : ""}
                    </p>
                    {h.notes ? <p className="text-xs">{h.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      )}
    </SectionCard>
  );
}
