import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Layers, Loader2, Plus, Save, Search, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EquipmentPicker } from "@/components/training/EquipmentPicker";
import { TrainingModuleControls } from "@/components/training/TrainingModuleControls";
import { formatDateTime, humanizeCode, parseIdList, scoreFactorLabel } from "@/components/training/trainingHelpers";
import { DetailRow, EmptyState, LoadingBlock, ModuleUnavailable, SectionCard, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { trainingApi } from "@/lib/trainingApi";
import type {
  PolicyScope,
  PublishPolicyInput,
  TrainingEquipmentRef,
  TrainingPolicy,
  TrainingPolicyFields,
  TrainingPolicyOverview,
} from "@/lib/trainingTypes";

type NumberField = Exclude<
  keyof TrainingPolicyFields,
  "underrepresented_override_department_ids" | "scoring_weights" | "demo_rate_per_hour" | "notes"
>;

const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: NumberField; label: string; unit: string }> }> = [
  {
    title: "Seat caps",
    fields: [
      { key: "per_faculty_cap", label: "Nominations per faculty per call", unit: "" },
      { key: "per_department_pct", label: "Max seats per department", unit: "%" },
      { key: "reserved_pct", label: "Seats reserved for under-represented departments", unit: "%" },
    ],
  },
  {
    title: "Eligibility",
    fields: [
      { key: "cooldown_months", label: "Cooldown after a training", unit: "months" },
      { key: "min_tenure_months_after_training", label: "Minimum remaining tenure", unit: "months" },
      { key: "suspension_lookback_months", label: "Suspension look-back", unit: "months" },
    ],
  },
  {
    title: "Certification validity",
    fields: [
      { key: "trained_validity_months", label: "Trained certification validity", unit: "months" },
      { key: "dormancy_months", label: "Lapses after no use for", unit: "months" },
    ],
  },
  {
    title: "Timelines",
    fields: [
      { key: "seat_confirm_hours", label: "Seat acceptance window", unit: "hours" },
      { key: "appeal_working_days", label: "Appeal window", unit: "working days" },
      { key: "proposal_expiry_working_days", label: "Alternative-time proposal expires after", unit: "working days" },
      { key: "review_sla_working_days", label: "Demo request review SLA", unit: "working days" },
    ],
  },
  {
    title: "Demonstrations",
    fields: [
      { key: "demo_max_minutes", label: "Maximum demonstration length", unit: "minutes" },
      { key: "demo_refund_full_days", label: "Full refund if cancelled at least", unit: "days ahead" },
      { key: "demo_refund_half_days", label: "Half refund if cancelled at least", unit: "days ahead" },
    ],
  },
];

const ALL_NUMBER_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

type FormState = {
  numbers: Partial<Record<NumberField, string>>;
  weights: Record<string, string>;
  underrep: number[];
  notes: string;
};

function formFromPolicy(policy: TrainingPolicy | null, blank: boolean): FormState {
  const numbers: FormState["numbers"] = {};
  if (!blank && policy) {
    for (const f of ALL_NUMBER_FIELDS) {
      const v = policy[f.key];
      numbers[f.key] = v == null ? "" : String(v);
    }
  }
  const weights: Record<string, string> = {};
  if (!blank && policy) {
    for (const [k, v] of Object.entries(policy.scoring_weights ?? {})) weights[k] = String(v);
  }
  return {
    numbers,
    weights,
    underrep: !blank && policy ? [...(policy.underrepresented_override_department_ids ?? [])] : [],
    notes: "",
  };
}

function payloadFromForm(form: FormState): Partial<TrainingPolicyFields> {
  const out: Partial<TrainingPolicyFields> = {};
  for (const f of ALL_NUMBER_FIELDS) {
    const raw = form.numbers[f.key];
    if (raw !== undefined && raw.trim() !== "") (out as Record<string, unknown>)[f.key] = Number(raw);
  }
  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries(form.weights)) if (v.trim() !== "") weights[k] = Number(v);
  if (Object.keys(weights).length) out.scoring_weights = weights;
  if (form.underrep.length) out.underrepresented_override_department_ids = form.underrep;
  if (form.notes.trim()) out.notes = form.notes.trim();
  return out;
}

type Department = { id: number; name: string; code: string };

function DepartmentMultiSelect({ departments, value, onChange }: { departments: Department[] | null; value: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const [text, setText] = useState(value.join(", "));
  if (!departments) {
    return (
      <div className="space-y-1">
        <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(parseIdList(text))} placeholder="Department ids, comma separated" />
        <p className="text-xs text-muted-foreground">Department list unavailable — enter ids.</p>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = departments.filter((d) => !q || d.name.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q));
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search departments" className="h-9 pl-8" />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-md border border-border/70 p-2">
        <ul className="grid gap-1 sm:grid-cols-2">
          {shown.map((d) => (
            <li key={d.id}>
              <label className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50">
                <Checkbox
                  checked={value.includes(d.id)}
                  onCheckedChange={(v) => onChange(v === true ? [...value, d.id] : value.filter((id) => id !== d.id))}
                />
                <span className="truncate">
                  {d.name}
                  {d.code ? <span className="text-muted-foreground"> ({d.code})</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length ? `${value.length} selected — always treated as under-represented.` : "None selected — computed from current certification data."}
      </p>
    </div>
  );
}

function PolicyFieldsForm({
  form,
  onChange,
  defaultWeights,
  departments,
  blankMeansInherit,
  placeholders,
}: {
  form: FormState;
  onChange: (form: FormState) => void;
  defaultWeights: Record<string, number>;
  departments: Department[] | null;
  blankMeansInherit: boolean;
  placeholders?: TrainingPolicy | null;
}) {
  const weightKeys = useMemo(() => [...new Set([...Object.keys(defaultWeights), ...Object.keys(form.weights)])], [defaultWeights, form.weights]);
  const setNumber = (key: NumberField, value: string) => onChange({ ...form, numbers: { ...form.numbers, [key]: value } });
  const placeholderFor = (key: NumberField) => {
    const v = placeholders?.[key];
    return blankMeansInherit ? (v != null ? `Inherit (${v})` : "Inherit") : "";
  };

  return (
    <div className="space-y-5">
      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`policy-${f.key}`} className="text-sm">
                  {f.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`policy-${f.key}`}
                    type="number"
                    min={0}
                    value={form.numbers[f.key] ?? ""}
                    onChange={(e) => setNumber(f.key, e.target.value)}
                    placeholder={placeholderFor(f.key)}
                    className="h-9"
                  />
                  {f.unit ? <span className="shrink-0 text-xs text-muted-foreground">{f.unit}</span> : null}
                </div>
              </div>
            ))}
          </div>
          {group.title === "Demonstrations" ? (
            <p className="text-xs text-muted-foreground">
              Demonstrations are charged at each equipment's internal IITR booking rate and deducted from the faculty member's wallet; the
              refund days above set the cancellation refunds.
            </p>
          ) : null}
        </fieldset>
      ))}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scoring weights</legend>
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table className="min-w-[420px]">
            <TableHeader>
              <TableRow>
                <TableHead>Factor</TableHead>
                <TableHead className="w-28 text-right">Default</TableHead>
                <TableHead className="w-36">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weightKeys.map((key) => (
                <TableRow key={key}>
                  <TableCell className="text-sm">{scoreFactorLabel(key)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{defaultWeights[key] ?? "—"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.weights[key] ?? ""}
                      onChange={(e) => onChange({ ...form, weights: { ...form.weights, [key]: e.target.value } })}
                      placeholder={blankMeansInherit ? "Inherit" : String(defaultWeights[key] ?? "")}
                      className="h-8"
                      aria-label={`Weight for ${scoreFactorLabel(key)}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">Leave a weight blank to use the {blankMeansInherit ? "inherited" : "default"} value. Negative weights penalise.</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Under-represented departments (override)</legend>
        <DepartmentMultiSelect departments={departments} value={form.underrep} onChange={(ids) => onChange({ ...form, underrep: ids })} />
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="policy-notes">Change note</Label>
        <Textarea id="policy-notes" rows={2} value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} placeholder="What changed and why (kept in version history)" />
      </div>
    </div>
  );
}

function policyTarget(p: TrainingPolicy): string {
  if (p.scope === "GLOBAL") return "Institute-wide";
  if (p.scope === "DEPARTMENT") return p.department_name ?? `Department #${p.department_id}`;
  return p.equipment ? `${p.equipment.name} (${p.equipment.code})` : "Equipment";
}

function overriddenFields(p: TrainingPolicy): string[] {
  const out: string[] = [];
  for (const f of ALL_NUMBER_FIELDS) if (p[f.key] != null) out.push(`${f.label}: ${p[f.key]}${f.unit ? ` ${f.unit}` : ""}`);
  if (Object.keys(p.scoring_weights ?? {}).length) out.push(`${Object.keys(p.scoring_weights).length} weight(s)`);
  if (p.underrepresented_override_department_ids?.length) out.push(`${p.underrepresented_override_department_ids.length} dept override(s)`);
  return out;
}

function OverrideDialog({
  open,
  onOpenChange,
  overview,
  departments,
  globalPolicy,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: TrainingPolicyOverview;
  departments: Department[] | null;
  globalPolicy: TrainingPolicy | null;
  onPublished: () => void;
}) {
  const fixedDepartment = !overview.can_edit_global ? overview.department_id : null;
  const [scope, setScope] = useState<Exclude<PolicyScope, "GLOBAL">>("DEPARTMENT");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [equipment, setEquipment] = useState<TrainingEquipmentRef | null>(null);
  const [form, setForm] = useState<FormState>(() => formFromPolicy(null, true));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope("DEPARTMENT");
    setDepartmentId(fixedDepartment ? String(fixedDepartment) : "");
    setEquipment(null);
    setForm(formFromPolicy(null, true));
  }, [open, fixedDepartment]);

  const submit = async () => {
    const input: PublishPolicyInput = { scope, ...payloadFromForm(form) };
    if (scope === "DEPARTMENT") {
      if (!departmentId) return toast.error("Choose the department.");
      input.department_id = Number(departmentId);
    } else {
      if (!equipment) return toast.error("Choose the equipment.");
      input.equipment_id = equipment.equipment_id;
    }
    setBusy(true);
    const res = await trainingApi.publishPolicy(input);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Override published as version ${res.data?.version ?? ""}.`);
    onPublished();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New policy override</DialogTitle>
          <DialogDescription>Only the fields you fill in override the institute-wide policy. Publishing creates a new version.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Applies to</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "DEPARTMENT" | "EQUIPMENT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEPARTMENT">A department</SelectItem>
                <SelectItem value="EQUIPMENT">One equipment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "DEPARTMENT" ? (
            <div className="space-y-1">
              <Label>Department</Label>
              {departments && !fixedDepartment ? (
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={departmentId}
                  disabled={Boolean(fixedDepartment)}
                  onChange={(e) => setDepartmentId(e.target.value.replace(/\D/g, ""))}
                  placeholder="Department id"
                />
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Equipment</Label>
              <EquipmentPicker managed={!overview.can_edit_global} value={equipment} onChange={setEquipment} />
            </div>
          )}
        </div>
        <PolicyFieldsForm
          form={form}
          onChange={setForm}
          defaultWeights={overview.default_weights}
          departments={departments}
          blankMeansInherit
          placeholders={globalPolicy}
        />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Publish override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSettingsTraining() {
  const { user } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = isAdmin || menu("training_policy_settings");

  const [overview, setOverview] = useState<TrainingPolicyOverview | null>(null);
  const [history, setHistory] = useState<TrainingPolicy[] | null>(null);
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [form, setForm] = useState<FormState>(() => formFromPolicy(null, true));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const globalPolicy = useMemo(
    () => overview?.policies.find((p) => p.scope === "GLOBAL" && p.is_active) ?? null,
    [overview],
  );
  const overrides = useMemo(() => (overview?.policies ?? []).filter((p) => p.scope !== "GLOBAL" && p.is_active), [overview]);

  const load = useCallback(async () => {
    setLoading(true);
    const [policyRes, historyRes] = await Promise.all([trainingApi.policy(), trainingApi.policyHistory()]);
    setLoading(false);
    if (policyRes.error || !policyRes.data) {
      toast.error(policyRes.error || "Could not load the training policy.");
      return;
    }
    setOverview(policyRes.data);
    setHistory(historyRes.data?.results ?? []);
    const active = policyRes.data.policies.find((p) => p.scope === "GLOBAL" && p.is_active) ?? null;
    setForm(formFromPolicy(active, false));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    void apiClient.getDepartments("internal").then((res) => {
      const list = res.data?.departments;
      setDepartments(Array.isArray(list) ? list.map((d) => ({ id: d.id, name: d.name, code: d.code })) : null);
    });
  }, [allowed, load]);

  const publishGlobal = async () => {
    setSaving(true);
    const res = await trainingApi.publishPolicy({ scope: "GLOBAL", ...payloadFromForm(form) });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Policy version ${res.data?.version ?? ""} published. Open calls keep the version they started with.`);
    void load();
  };

  return (
    <TrainingPageFrame
      title="Training Policy"
      description="Where Training & Certification is enabled and for whom, plus selection caps, scoring weights, timelines and demonstration charges."
      icon={<Settings2 className="h-5 w-5" />}
      onRefresh={allowed ? () => void load() : undefined}
      refreshing={loading}
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable message="Training policy settings are available to the Main Administrator and department administrators with training management rights." />
      ) : loading && !overview ? (
        <LoadingBlock />
      ) : !overview ? (
        <EmptyState title="Policy not loaded" />
      ) : (
        <>
          {overview.can_manage_module ? (
            <TrainingModuleControls />
          ) : (
            <SectionCard title="Module status" icon={<ShieldCheck className="h-4 w-4" />}>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DetailRow label="Training & Certification">
                  <span className={overview.module_enabled ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-muted-foreground"}>
                    {overview.module_enabled ? "Enabled" : "Disabled"}
                  </span>
                </DetailRow>
                <DetailRow label="Audience">{overview.audience === "EVERYONE" ? "Everyone eligible" : "Test accounts only"}</DetailRow>
                <DetailRow label="Pilot OICs">{overview.pilot_oic_count}</DetailRow>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                The Main Administrator switches the module on and chooses the equipment and audience on this page. Menus stay hidden while the
                module is disabled; you can still prepare the policy here.
              </p>
            </SectionCard>
          )}

          <SectionCard
            title={`Institute-wide policy${globalPolicy ? ` · v${globalPolicy.version}` : ""}`}
            description={
              globalPolicy?.published_at
                ? `Published ${formatDateTime(globalPolicy.published_at)}. Saving publishes a new version; older versions stay in history.`
                : "No policy published yet — defaults apply."
            }
            icon={<Settings2 className="h-4 w-4" />}
            actions={
              overview.can_edit_global ? (
                <Button type="button" size="sm" onClick={() => void publishGlobal()} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Publish new version
                </Button>
              ) : null
            }
          >
            {overview.can_edit_global ? (
              <PolicyFieldsForm
                form={form}
                onChange={setForm}
                defaultWeights={overview.default_weights}
                departments={departments}
                blankMeansInherit={false}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Only the Main Administrator edits the institute-wide policy. You can add overrides for your department and its equipment below.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Department & equipment overrides"
            icon={<Layers className="h-4 w-4" />}
            bodyClassName="p-0"
            actions={
              <Button type="button" size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> New override
              </Button>
            }
          >
            {!overrides.length ? (
              <p className="p-4 text-sm text-muted-foreground">No overrides — the institute-wide policy applies everywhere.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applies to</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Overrides</TableHead>
                      <TableHead className="whitespace-nowrap">Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium">{policyTarget(p)}</p>
                          <p className="text-xs text-muted-foreground">{humanizeCode(p.scope)}</p>
                        </TableCell>
                        <TableCell className="tabular-nums">v{p.version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{overriddenFields(p).join(" · ") || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(p.published_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Certification levels" icon={<ShieldCheck className="h-4 w-4" />} bodyClassName="p-0">
            <ul className="divide-y divide-border/60">
              {[...overview.levels]
                .sort((a, b) => a.rank - b.rank)
                .map((level) => (
                  <li key={level.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{level.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {level.code}
                        {level.default_validity_months ? ` · valid ${level.default_validity_months} months by default` : ""}
                      </p>
                    </div>
                    {level.is_active ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Coming later</span>
                    )}
                  </li>
                ))}
            </ul>
          </SectionCard>

          <SectionCard title="Version history" icon={<History className="h-4 w-4" />} bodyClassName="p-0">
            {!history?.length ? (
              <p className="p-4 text-sm text-muted-foreground">No versions published yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applies to</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="whitespace-nowrap">Published</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{policyTarget(p)}</TableCell>
                        <TableCell className="tabular-nums">v{p.version}</TableCell>
                        <TableCell className="text-xs">{p.is_active ? <span className="font-medium text-emerald-700 dark:text-emerald-300">Active</span> : "Superseded"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(p.published_at)}</TableCell>
                        <TableCell className="text-xs">{typeof p.created_by === "string" ? p.created_by : p.created_by?.name ?? "—"}</TableCell>
                        <TableCell className="max-w-xs text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <OverrideDialog
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            overview={overview}
            departments={departments}
            globalPolicy={globalPolicy}
            onPublished={() => void load()}
          />
        </>
      )}
    </TrainingPageFrame>
  );
}
