import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import {
  apiClient,
  type OicEquipmentDepthUsage,
  type OicEquipmentSettings,
  type OicEquipmentSettingsRow,
  type ResultsDeadlineUnit,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RICH_TEXT_PLAIN_MAX_LENGTH, richTextToPlain } from "@/lib/richText";
import { unlimitedQuotaConfigHint } from "@/lib/bookingQuota";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type IntField =
  | "external_slot_quota_percent"
  | "booking_not_utilize_window_hours"
  | "sample_submission_lead_hours"
  | "sample_collect_deadline_hours";

type TimeField = "slot_window_reference_time" | "weekly_view_time_from" | "weekly_view_time_to";

type DepthField =
  | "waitlist_queue_depth"
  | "max_urgent_requests"
  | "max_rush_relief_requests_per_week"
  | "max_surcharge_urgent_requests_per_week";

type Draft = Record<IntField | TimeField | DepthField, string> & {
  slot_window_reference_weekday: string;
  results_deadline_value: string;
  results_deadline_unit: ResultsDeadlineUnit;
  show_results_deadline_to_users: boolean;
  important_instruction: string;
  important_instruction_by_user_type: Record<string, string>;
};

const RESULTS_DEADLINE_MAX: Record<ResultsDeadlineUnit, number> = { WORKING_DAYS: 60, HOURS: 720 };

type QuotaMinutesField =
  | "internal_individual_quota_minutes"
  | "internal_faculty_quota_minutes"
  | "external_individual_quota_minutes"
  | "external_faculty_quota_minutes";

type QuotaRow = Record<QuotaMinutesField, number> & { quota_type: string; is_enforced: boolean };

type GroupRow = {
  equipment_group_id: number;
  name: string;
  equipment?: Array<{ equipment_id: number; code?: string; name?: string }>;
  quotas?: Array<Partial<QuotaRow> & { quota_type: string }>;
};

/** Individual Students see the IITR Student instruction, so they get no instruction of their own. */
const INSTRUCTION_HIDDEN_USER_TYPES = new Set(["individual_student"]);
const NO_WEEKDAY = "__none__";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const QUOTA_TYPES = ["WEEKLY", "MONTHLY"] as const;
const QUOTA_MINUTES_FIELDS: Array<{ key: QuotaMinutesField; label: string }> = [
  { key: "internal_individual_quota_minutes", label: "Internal individual" },
  { key: "internal_faculty_quota_minutes", label: "Internal faculty" },
  { key: "external_individual_quota_minutes", label: "External individual" },
  { key: "external_faculty_quota_minutes", label: "External faculty" },
];

const INT_FIELDS: Array<{ key: IntField; label: string; hint: string; max: number; section: "external" | "booking" | "sample" }> = [
  {
    key: "external_slot_quota_percent",
    label: "External Slot Quota (%)",
    hint: "0 = external users cannot book. Limit is a % of the week's bookable slots.",
    max: 100,
    section: "external",
  },
  {
    key: "booking_not_utilize_window_hours",
    label: "Booking Not Utilize Window (hours)",
    hint: "Hours after the last slot ends before staff may mark Booking Not Utilized (no refund). 0 hides this action.",
    max: 8760,
    section: "booking",
  },
  {
    key: "sample_submission_lead_hours",
    label: "Sample submission lead time (hours before slot start)",
    hint: "Users should submit samples this many hours before the slot starts. External users and atmosphere-sensitive samples may submit at slot start. 0 = no sample submission deadline (no countdown, reminder email or notification).",
    max: 8760,
    section: "sample",
  },
  {
    key: "sample_collect_deadline_hours",
    label: "Sample collect / discard deadline (hours after completion)",
    hint: "Hours after completion to collect the sample before it may be discarded. 0 = no collect deadline (no countdown and no collection notice in the completion email). When this and the submission lead time are both 0, users bring and take back their samples in person: no sample reminder, collection or disposal emails, and no automatic Not Utilized marking.",
    max: 8760,
    section: "sample",
  },
];

const DEPTH_FIELDS: Array<{
  key: DepthField;
  label: string;
  hint: string;
  max: number;
  usage: (u: OicEquipmentDepthUsage, limit: number | null) => string;
}> = [
  {
    key: "waitlist_queue_depth",
    label: "Waitlist depth",
    hint: "Most people who can wait in this equipment's queue at once. 0 or empty = waitlist off (no one can join). Lowering it never removes people already in the queue; new people can join once the queue is below the limit.",
    max: 500,
    usage: (u, limit) =>
      limit
        ? `${u.waitlist_active} of ${limit} in queue`
        : u.waitlist_active > 0
          ? `Waitlist off; ${u.waitlist_active} still in queue`
          : "Waitlist off",
  },
  {
    key: "max_urgent_requests",
    label: "Open urgent requests at a time (Type A and B together)",
    hint: "Most urgent requests that can wait for a decision at once. Empty = no limit. 0 = no new urgent requests.",
    max: 100,
    usage: (u, limit) => (limit == null ? `${u.urgent_pending} open (no limit)` : `${u.urgent_pending} of ${limit} open`),
  },
  {
    key: "max_rush_relief_requests_per_week",
    label: "Type A urgent requests (rush relief) per week",
    hint: "Counts this calendar week's (Monday–Sunday) approved Type A requests plus those still pending. Empty = no limit. 0 = no Type A requests for this equipment.",
    max: 100,
    usage: (u, limit) =>
      limit == null ? `${u.rush_relief_this_week} this week (no limit)` : `${u.rush_relief_this_week} of ${limit} this week`,
  },
  {
    key: "max_surcharge_urgent_requests_per_week",
    label: "Type B urgent requests (50% surcharge) per week",
    hint: "Counts this calendar week's (Monday–Sunday) approved Type B requests plus those still pending. Empty = no limit. 0 = no Type B requests for this equipment.",
    max: 100,
    usage: (u, limit) =>
      limit == null ? `${u.surcharge_this_week} this week (no limit)` : `${u.surcharge_this_week} of ${limit} this week`,
  },
];

const EMPTY_USAGE: OicEquipmentDepthUsage = {
  waitlist_active: 0,
  urgent_pending: 0,
  rush_relief_this_week: 0,
  surcharge_this_week: 0,
};

const optionalCount = (value: number | null | undefined) => (value == null ? "" : String(value));

function parseDepth(raw: string, key: DepthField): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return key === "waitlist_queue_depth" ? 0 : null;
  return Number(trimmed);
}

function toDraft(settings: OicEquipmentSettings): Draft {
  return {
    slot_window_reference_weekday:
      settings.slot_window_reference_weekday == null ? NO_WEEKDAY : String(settings.slot_window_reference_weekday),
    slot_window_reference_time: settings.slot_window_reference_time ?? "",
    weekly_view_time_from: settings.weekly_view_time_from ?? "",
    weekly_view_time_to: settings.weekly_view_time_to ?? "",
    external_slot_quota_percent: String(settings.external_slot_quota_percent ?? 0),
    booking_not_utilize_window_hours: String(settings.booking_not_utilize_window_hours ?? 0),
    results_deadline_value: String(settings.results_deadline_value ?? 0),
    results_deadline_unit: settings.results_deadline_unit === "HOURS" ? "HOURS" : "WORKING_DAYS",
    show_results_deadline_to_users: Boolean(settings.show_results_deadline_to_users),
    sample_submission_lead_hours: String(settings.sample_submission_lead_hours ?? 0),
    sample_collect_deadline_hours: String(settings.sample_collect_deadline_hours ?? 0),
    waitlist_queue_depth: String(settings.waitlist_queue_depth ?? 0),
    max_urgent_requests: optionalCount(settings.max_urgent_requests),
    max_rush_relief_requests_per_week: optionalCount(settings.max_rush_relief_requests_per_week),
    max_surcharge_urgent_requests_per_week: optionalCount(settings.max_surcharge_urgent_requests_per_week),
    important_instruction: settings.important_instruction ?? "",
    important_instruction_by_user_type: Object.fromEntries(
      Object.entries(settings.important_instruction_by_user_type ?? {}).filter(
        ([code]) => !INSTRUCTION_HIDDEN_USER_TYPES.has(code),
      ),
    ),
  };
}

function toPayload(
  draft: Draft,
  saved: Draft,
  canEditSlotWindowReference: boolean,
): { payload: Partial<OicEquipmentSettings>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const payload: Partial<OicEquipmentSettings> = {
    weekly_view_time_from: draft.weekly_view_time_from || null,
    weekly_view_time_to: draft.weekly_view_time_to || null,
  };
  if (canEditSlotWindowReference) {
    payload.slot_window_reference_weekday =
      draft.slot_window_reference_weekday === NO_WEEKDAY ? null : Number(draft.slot_window_reference_weekday);
    payload.slot_window_reference_time = draft.slot_window_reference_time || null;
  }
  for (const field of DEPTH_FIELDS) {
    if (draft[field.key].trim() === saved[field.key].trim()) continue;
    const value = parseDepth(draft[field.key], field.key);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > field.max)) {
      errors[field.key] = `Enter a whole number from 0 to ${field.max}, or leave empty.`;
    } else {
      (payload as Record<DepthField, number | null>)[field.key] = value;
    }
  }
  for (const field of INT_FIELDS) {
    const raw = draft[field.key].trim();
    const value = Number(raw);
    if (raw === "" || !Number.isInteger(value)) {
      errors[field.key] = "Enter a whole number.";
    } else if (value < 0 || value > field.max) {
      errors[field.key] = `Enter a value between 0 and ${field.max}.`;
    } else {
      payload[field.key] = value;
    }
  }
  const deadlineRaw = draft.results_deadline_value.trim();
  const deadline = Number(deadlineRaw);
  const deadlineMax = RESULTS_DEADLINE_MAX[draft.results_deadline_unit];
  if (deadlineRaw === "" || !Number.isInteger(deadline)) {
    errors.results_deadline_value = "Enter a whole number.";
  } else if (deadline < 0 || deadline > deadlineMax) {
    errors.results_deadline_value = `Enter a value between 0 and ${deadlineMax}.`;
  } else {
    payload.results_deadline_value = deadline;
    payload.results_deadline_unit = draft.results_deadline_unit;
  }
  payload.show_results_deadline_to_users = draft.show_results_deadline_to_users;
  if (draft.weekly_view_time_from && draft.weekly_view_time_to && draft.weekly_view_time_from >= draft.weekly_view_time_to) {
    errors.weekly_view_time_to = "'Time to' must be later than 'Time from'.";
  }
  const cleanInstruction = (html: string) => (richTextToPlain(html) ? html.trim() : "");
  const tooLong = (html: string) => richTextToPlain(html).length > RICH_TEXT_PLAIN_MAX_LENGTH;
  const instruction = cleanInstruction(draft.important_instruction);
  if (tooLong(instruction)) {
    errors.important_instruction = `Keep the important instruction under ${RICH_TEXT_PLAIN_MAX_LENGTH} characters.`;
  } else {
    payload.important_instruction = instruction;
  }
  const perType: Record<string, string> = {};
  for (const [code, html] of Object.entries(draft.important_instruction_by_user_type)) {
    const clean = cleanInstruction(html);
    if (tooLong(clean)) {
      errors.important_instruction_by_user_type = `Keep each instruction under ${RICH_TEXT_PLAIN_MAX_LENGTH} characters.`;
    } else if (clean) {
      perType[code] = clean;
    }
  }
  payload.important_instruction_by_user_type = perType;
  return { payload, errors };
}

function groupQuotas(group: GroupRow | null): QuotaRow[] {
  if (!group) return [];
  const existing = group.quotas ?? [];
  return QUOTA_TYPES.map((t) => {
    const found = existing.find((q) => String(q.quota_type).toUpperCase() === t);
    return {
      quota_type: t,
      internal_individual_quota_minutes: Number(found?.internal_individual_quota_minutes ?? 0),
      internal_faculty_quota_minutes: Number(found?.internal_faculty_quota_minutes ?? 0),
      external_individual_quota_minutes: Number(found?.external_individual_quota_minutes ?? 0),
      external_faculty_quota_minutes: Number(found?.external_faculty_quota_minutes ?? 0),
      is_enforced: found ? found.is_enforced !== false : true,
    };
  });
}

export default function OICEquipmentSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = userType === "admin" || userType === "manager";

  const [canEditSlotWindowReference, setCanEditSlotWindowReference] = useState(userType === "admin");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OicEquipmentSettingsRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupsError, setGroupsError] = useState("");
  const [quotaDraft, setQuotaDraft] = useState<QuotaRow[]>([]);
  const [instructionUserTypes, setInstructionUserTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [addInstructionType, setAddInstructionType] = useState("");

  const selected = useMemo(
    () => rows.find((r) => String(r.equipment_id) === selectedId) ?? null,
    [rows, selectedId],
  );
  const savedDraft = useMemo(() => (selected ? toDraft(selected.settings) : null), [selected]);
  const settingsDirty = Boolean(draft && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft));

  const group = useMemo(
    () =>
      selected
        ? groups.find((g) => (g.equipment ?? []).some((e) => e.equipment_id === selected.equipment_id)) ?? null
        : null,
    [groups, selected],
  );
  const savedQuotas = useMemo(() => groupQuotas(group), [group]);
  const quotaDirty = Boolean(group) && JSON.stringify(quotaDraft) !== JSON.stringify(savedQuotas);
  const dirty = settingsDirty || quotaDirty;

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can manage booking rules.");
      navigate("/dashboard");
      return;
    }
    let cancelled = false;
    void apiClient.getOicEquipmentSettings().then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const list = res.data?.equipments ?? [];
      setRows(list);
      if (typeof res.data?.can_edit_slot_window_reference === "boolean") {
        setCanEditSlotWindowReference(res.data.can_edit_slot_window_reference);
      }
      setInstructionUserTypes(
        (res.data?.instruction_user_types ?? []).filter((o) => !INSTRUCTION_HIDDEN_USER_TYPES.has(o.value)),
      );
      if (list.length > 0) setSelectedId(String(list[0].equipment_id));
    });
    void apiClient.getOicEquipmentGroupQuotas().then((res) => {
      if (cancelled) return;
      if (res.error) {
        setGroupsError(res.error);
        return;
      }
      setGroups((res.data?.groups ?? []) as GroupRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [canManage, navigate]);

  useEffect(() => {
    setDraft(savedDraft);
    setErrors({});
  }, [savedDraft]);

  useEffect(() => {
    setQuotaDraft(savedQuotas);
  }, [savedQuotas]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const setTypeInstruction = (code: string, html: string | null) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.important_instruction_by_user_type };
      if (html === null) delete next[code];
      else next[code] = html;
      return { ...d, important_instruction_by_user_type: next };
    });
    setErrors((e) => {
      if (!e.important_instruction_by_user_type) return e;
      const next = { ...e };
      delete next.important_instruction_by_user_type;
      return next;
    });
  };

  const setQuotaField = (quotaType: string, field: QuotaMinutesField | "is_enforced", value: number | boolean) => {
    setQuotaDraft((prev) => prev.map((q) => (q.quota_type === quotaType ? { ...q, [field]: value } : q)));
  };

  const discard = () => {
    setDraft(savedDraft);
    setQuotaDraft(savedQuotas);
    setErrors({});
  };

  const saveSettings = async (): Promise<boolean> => {
    if (!selected || !draft || !savedDraft) return false;
    const { payload, errors: localErrors } = toPayload(draft, savedDraft, canEditSlotWindowReference);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      toast.error("Please correct the highlighted settings.");
      return false;
    }
    const res = await apiClient.updateOicEquipmentSettings(selected.equipment_id, payload);
    const updated = res.data?.equipment;
    if (res.error || !updated) {
      const serverErrors = (res.data as { errors?: Record<string, string> } | undefined)?.errors;
      if (serverErrors) setErrors(serverErrors);
      toast.error(res.error || "Could not save settings.");
      return false;
    }
    setRows((prev) => prev.map((r) => (r.equipment_id === updated.equipment_id ? updated : r)));
    return true;
  };

  const saveQuotas = async (): Promise<boolean> => {
    if (!group) return false;
    const res = await apiClient.updateOicEquipmentGroupQuotas(group.equipment_group_id, quotaDraft);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    const refreshed = await apiClient.getOicEquipmentGroupQuotas();
    if (!refreshed.error && refreshed.data?.groups) setGroups(refreshed.data.groups as GroupRow[]);
    return true;
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const settingsOk = settingsDirty ? await saveSettings() : true;
    const quotasOk = quotaDirty ? await saveQuotas() : true;
    setSaving(false);
    if (settingsOk && quotasOk) toast.success(`Booking rules saved for ${selected.equipment_name}.`);
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  const renderIntFields = (section: "external" | "booking" | "sample") =>
    INT_FIELDS.filter((f) => f.section === section).map((f) => (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={`oic-setting-${f.key}`}>{f.label}</Label>
        <Input
          id={`oic-setting-${f.key}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={f.max}
          step={1}
          value={draft?.[f.key] ?? ""}
          onChange={(e) => setField(f.key, e.target.value)}
          aria-invalid={Boolean(errors[f.key])}
        />
        <p className="text-xs text-muted-foreground">{f.hint}</p>
        {fieldError(f.key)}
      </div>
    ));

  const groupPeers = (group?.equipment ?? [])
    .map((e) => e.code || e.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl space-y-5 px-4 py-5">
        <StandaloneOnly>
          <div className="rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-5 text-white shadow-xl">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="-ml-2 mb-2 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Equipment Booking Configuration</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Set the important instruction shown to users, slot visibility, waitlist and urgent request limits, usage
              quotas, and booking and sample deadlines for each equipment you manage.
            </p>
          </div>
        </StandaloneOnly>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No equipment is assigned to you yet.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl border-border/70">
              <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="oic-settings-equipment">Equipment</Label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger id="oic-settings-equipment">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (
                        <SelectItem key={r.equipment_id} value={String(r.equipment_id)}>
                          {r.equipment_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="gap-1.5" disabled={!dirty || saving} onClick={discard}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Discard
                  </Button>
                  <Button type="button" className="gap-1.5" disabled={!dirty || saving} onClick={() => void save()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {draft && (
              <>
                <Card className="rounded-2xl border-amber-500/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                      Important instruction
                    </CardTitle>
                    <CardDescription>
                      Shown as a note on the equipment page and when booking. Format it like a Word document: text
                      size, bold, colours, bulleted and numbered lists, and links. Click Preview to see it as users
                      will. The default applies to every user type that has no instruction of its own. Leave empty
                      to show nothing. Individual Students see the IITR Student instruction.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="font-semibold">Default (all user types)</Label>
                      <RichTextEditor
                        value={draft.important_instruction}
                        onChange={(html) => setField("important_instruction", html)}
                        placeholder="e.g. Samples must be completely dry. Bring your own sample holders."
                        ariaLabel="Default important instruction"
                        invalid={Boolean(errors.important_instruction)}
                      />
                      {fieldError("important_instruction")}
                    </div>

                    {Object.keys(draft.important_instruction_by_user_type).map((code) => {
                      const label = instructionUserTypes.find((o) => o.value === code)?.label ?? code;
                      return (
                        <div key={code} className="space-y-1.5 rounded-xl border border-dashed p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="font-semibold">Instruction for {label}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setTypeInstruction(code, null)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              Remove
                            </Button>
                          </div>
                          <RichTextEditor
                            value={draft.important_instruction_by_user_type[code] ?? ""}
                            onChange={(html) => setTypeInstruction(code, html)}
                            placeholder={`Instruction shown only to ${label} users`}
                            ariaLabel={`Important instruction for ${label}`}
                          />
                        </div>
                      );
                    })}
                    {fieldError("important_instruction_by_user_type")}

                    {instructionUserTypes.some((o) => !(o.value in draft.important_instruction_by_user_type)) && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[14rem] space-y-1.5">
                          <Label htmlFor="oic-add-instruction-type">Add an instruction for a user type</Label>
                          <Select value={addInstructionType} onValueChange={setAddInstructionType}>
                            <SelectTrigger id="oic-add-instruction-type">
                              <SelectValue placeholder="Choose user type" />
                            </SelectTrigger>
                            <SelectContent>
                              {instructionUserTypes
                                .filter((o) => !(o.value in draft.important_instruction_by_user_type))
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-1.5"
                          disabled={!addInstructionType}
                          onClick={() => {
                            setTypeInstruction(addInstructionType, "");
                            setAddInstructionType("");
                          }}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                          Add
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="rounded-2xl border-border/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Slot visibility</CardTitle>
                      <CardDescription>
                        {canEditSlotWindowReference
                          ? "When next week's slots open to internal users, and the time range regular users see."
                          : "The time range regular users see, and the share of slots external users may book."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {canEditSlotWindowReference && (
                        <div className="space-y-4" data-testid="oic-slot-window-reference">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="oic-setting-weekday">Slot window reference weekday</Label>
                              <Select
                                value={draft.slot_window_reference_weekday}
                                onValueChange={(v) => setField("slot_window_reference_weekday", v)}
                              >
                                <SelectTrigger id="oic-setting-weekday">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_WEEKDAY}>No restriction</SelectItem>
                                  {WEEKDAYS.map((day, i) => (
                                    <SelectItem key={day} value={String(i)}>
                                      {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldError("slot_window_reference_weekday")}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="oic-setting-ref-time">Reference time (24h)</Label>
                              <Input
                                id="oic-setting-ref-time"
                                type="time"
                                value={draft.slot_window_reference_time}
                                onChange={(e) => setField("slot_window_reference_time", e.target.value)}
                              />
                              {fieldError("slot_window_reference_time")}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Before this day and time only the current week is visible; from then on the current and
                            next week are visible. Leave empty for no restriction. Only the Main Administrator can
                            change this.
                          </p>
                        </div>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="oic-setting-view-from">Weekly view from (24h)</Label>
                          <Input
                            id="oic-setting-view-from"
                            type="time"
                            value={draft.weekly_view_time_from}
                            onChange={(e) => setField("weekly_view_time_from", e.target.value)}
                          />
                          {fieldError("weekly_view_time_from")}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="oic-setting-view-to">Weekly view to (24h)</Label>
                          <Input
                            id="oic-setting-view-to"
                            type="time"
                            value={draft.weekly_view_time_to}
                            onChange={(e) => setField("weekly_view_time_to", e.target.value)}
                          />
                          {fieldError("weekly_view_time_to")}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Only slots in this range are shown to regular users. Leave both empty for no limit. Admin and
                        OIC always see the full week.
                      </p>
                      {renderIntFields("external")}
                    </CardContent>
                  </Card>

                  <div className="space-y-5">
                    <Card className="rounded-2xl border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Booking and operator timings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {renderIntFields("booking")}
                        <div className="space-y-1.5" data-testid="oic-results-deadline">
                          <Label htmlFor="oic-setting-results-deadline">Results deadline (after the slot or sample receipt)</Label>
                          <div className="flex gap-2">
                            <Input
                              id="oic-setting-results-deadline"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={RESULTS_DEADLINE_MAX[draft.results_deadline_unit]}
                              step={1}
                              className="w-28"
                              value={draft.results_deadline_value}
                              onChange={(e) => setField("results_deadline_value", e.target.value)}
                              aria-invalid={Boolean(errors.results_deadline_value)}
                            />
                            <Select
                              value={draft.results_deadline_unit}
                              onValueChange={(v) => setField("results_deadline_unit", v as ResultsDeadlineUnit)}
                            >
                              <SelectTrigger className="w-44" aria-label="Results deadline unit">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="WORKING_DAYS">Working days</SelectItem>
                                <SelectItem value="HOURS">Hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Time within which the laboratory shares results, counted from the slot end, or from the
                            Sample Accepted time if the sample is received after the slot. No deadline applies until the
                            sample is received. Working days skip
                            Saturdays, Sundays and institute holidays (results are due by the end of the last working
                            day); use hours for fast instruments. Bookings still open after it appear as Results overdue
                            for you and the Lab Operators. If the sample is still with the lab and no results are
                            shared, the booking enters the Operator Absent flow (user chooses refund or reschedule); if
                            the run was abandoned after work started, the user gets a full refund. Use Extend results
                            deadline on a booking for a genuine delay. 0 = no deadline (no overdue list and no
                            automatic safeguard).
                          </p>
                          {fieldError("results_deadline_value")}
                          {fieldError("results_deadline_unit")}
                          <label className="flex items-start gap-2 pt-1 text-sm">
                            <Checkbox
                              checked={draft.show_results_deadline_to_users}
                              onCheckedChange={(c) => setField("show_results_deadline_to_users", c === true)}
                              aria-label="Show results deadline to users"
                            />
                            <span>
                              Show results deadline to users
                              <span className="block text-xs text-muted-foreground">
                                Off by default. When on, the sample submission policy lists this equipment with its
                                results time and the booking details show &quot;Results expected by&quot; a date.
                              </span>
                            </span>
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Sample timings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">{renderIntFields("sample")}</CardContent>
                    </Card>
                  </div>
                </div>

                <Card className="rounded-2xl border-border/70" data-testid="oic-booking-depths">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Waitlist and urgent requests</CardTitle>
                    <CardDescription>
                      How many people can wait in the queue, and how many urgent requests this equipment accepts. When
                      a limit is reached, new requests are refused with a message saying so; nothing already in the
                      queue or awaiting a decision is removed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {DEPTH_FIELDS.map((f) => {
                      const parsed = parseDepth(draft[f.key], f.key);
                      const limit = parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <Label htmlFor={`oic-setting-${f.key}`}>{f.label}</Label>
                          <Input
                            id={`oic-setting-${f.key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={f.max}
                            step={1}
                            placeholder={f.key === "waitlist_queue_depth" ? "0 (off)" : "No limit"}
                            value={draft[f.key]}
                            onChange={(e) => setField(f.key, e.target.value)}
                            aria-invalid={Boolean(errors[f.key])}
                          />
                          <p className="text-xs font-medium text-foreground" data-testid={`oic-usage-${f.key}`}>
                            {f.usage(selected?.usage ?? EMPTY_USAGE, limit)}
                          </p>
                          <p className="text-xs text-muted-foreground">{f.hint}</p>
                          {fieldError(f.key)}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Usage quotas</CardTitle>
                    <CardDescription>
                      Maximum booking time per user in a week or month, in minutes (60 = 1 hour).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {groupsError ? (
                      <p className="text-sm text-destructive">Could not load usage quotas: {groupsError}</p>
                    ) : !group ? (
                      <p className="text-sm text-muted-foreground">
                        This equipment is not in an equipment group, so no weekly or monthly usage quota applies. Ask
                        Admin to add it to a group if a quota is needed.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Group <span className="font-medium text-foreground">{group.name}</span>. The quota is shared
                          by all equipment in this group{groupPeers ? `: ${groupPeers}` : ""}.
                        </p>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Quota type</TableHead>
                                {QUOTA_MINUTES_FIELDS.map((f) => (
                                  <TableHead key={f.key}>{f.label} (min)</TableHead>
                                ))}
                                <TableHead>Enforced</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {quotaDraft.map((row) => (
                                <TableRow key={row.quota_type}>
                                  <TableCell className="font-medium">
                                    {row.quota_type === "WEEKLY" ? "Weekly" : "Monthly"}
                                  </TableCell>
                                  {QUOTA_MINUTES_FIELDS.map((f) => (
                                    <TableCell key={f.key} className="py-2">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        className="h-8 min-w-[6rem]"
                                        aria-label={`${row.quota_type === "WEEKLY" ? "Weekly" : "Monthly"} ${f.label} quota in minutes`}
                                        value={row[f.key]}
                                        onChange={(e) =>
                                          setQuotaField(row.quota_type, f.key, Math.max(0, parseInt(e.target.value, 10) || 0))
                                        }
                                      />
                                    </TableCell>
                                  ))}
                                  <TableCell>
                                    <Checkbox
                                      checked={row.is_enforced}
                                      aria-label={`Enforce ${row.quota_type === "WEEKLY" ? "weekly" : "monthly"} quota`}
                                      onCheckedChange={(c) => setQuotaField(row.quota_type, "is_enforced", c === true)}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {unlimitedQuotaConfigHint(quotaDraft) ? (
                          <p className="text-xs text-muted-foreground">{unlimitedQuotaConfigHint(quotaDraft)}</p>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
