import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { apiClient, type OicEquipmentSettings, type OicEquipmentSettingsRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type IntField =
  | "external_slot_quota_percent"
  | "booking_not_utilize_window_hours"
  | "operator_unavailable_after_booking_end_hours"
  | "operator_absent_disruption_after_booking_end_hours"
  | "sample_submission_lead_hours"
  | "sample_collect_deadline_hours";

type TimeField = "slot_window_reference_time" | "weekly_view_time_from" | "weekly_view_time_to";

type Draft = Record<IntField | TimeField, string> & {
  slot_window_reference_weekday: string;
  important_instruction: string;
};

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

const NO_WEEKDAY = "__none__";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const IMPORTANT_INSTRUCTION_MAX_LENGTH = 5000;
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
    key: "operator_unavailable_after_booking_end_hours",
    label: "Auto Operator Unavailable (hours after booking end)",
    hint: "If staff work started but the run is unfinished this long after the booking ends, it is auto-marked Operator Unavailable (full refund). 0 disables.",
    max: 8760,
    section: "booking",
  },
  {
    key: "operator_absent_disruption_after_booking_end_hours",
    label: "Auto Operator Absent Disruption (hours after booking end)",
    hint: "If the sample is still stuck at Sample Accepted or Processing this long after the booking ends, the Operator Absent disruption flow starts (refund or reschedule choice). 0 disables.",
    max: 8760,
    section: "booking",
  },
  {
    key: "sample_submission_lead_hours",
    label: "Sample submission lead time (hours before slot start)",
    hint: "Users should submit samples this many hours before the slot starts. Does not apply to external users or atmosphere-sensitive samples. 0 = slot start.",
    max: 8760,
    section: "sample",
  },
  {
    key: "sample_collect_deadline_hours",
    label: "Sample collect / discard deadline (hours after completion)",
    hint: "Hours after completion to collect the sample before it may be discarded. 0 hides this countdown.",
    max: 8760,
    section: "sample",
  },
];

function toDraft(settings: OicEquipmentSettings): Draft {
  return {
    slot_window_reference_weekday:
      settings.slot_window_reference_weekday == null ? NO_WEEKDAY : String(settings.slot_window_reference_weekday),
    slot_window_reference_time: settings.slot_window_reference_time ?? "",
    weekly_view_time_from: settings.weekly_view_time_from ?? "",
    weekly_view_time_to: settings.weekly_view_time_to ?? "",
    external_slot_quota_percent: String(settings.external_slot_quota_percent ?? 0),
    booking_not_utilize_window_hours: String(settings.booking_not_utilize_window_hours ?? 0),
    operator_unavailable_after_booking_end_hours: String(settings.operator_unavailable_after_booking_end_hours ?? 0),
    operator_absent_disruption_after_booking_end_hours: String(
      settings.operator_absent_disruption_after_booking_end_hours ?? 0,
    ),
    sample_submission_lead_hours: String(settings.sample_submission_lead_hours ?? 0),
    sample_collect_deadline_hours: String(settings.sample_collect_deadline_hours ?? 0),
    important_instruction: settings.important_instruction ?? "",
  };
}

function toPayload(draft: Draft): { payload: Partial<OicEquipmentSettings>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const payload: Partial<OicEquipmentSettings> = {
    slot_window_reference_weekday:
      draft.slot_window_reference_weekday === NO_WEEKDAY ? null : Number(draft.slot_window_reference_weekday),
    slot_window_reference_time: draft.slot_window_reference_time || null,
    weekly_view_time_from: draft.weekly_view_time_from || null,
    weekly_view_time_to: draft.weekly_view_time_to || null,
  };
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
  if (draft.weekly_view_time_from && draft.weekly_view_time_to && draft.weekly_view_time_from >= draft.weekly_view_time_to) {
    errors.weekly_view_time_to = "'Time to' must be later than 'Time from'.";
  }
  const instruction = draft.important_instruction.trim();
  if (instruction.length > IMPORTANT_INSTRUCTION_MAX_LENGTH) {
    errors.important_instruction = `Keep the important instruction under ${IMPORTANT_INSTRUCTION_MAX_LENGTH} characters.`;
  } else {
    payload.important_instruction = instruction;
  }
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

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OicEquipmentSettingsRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupsError, setGroupsError] = useState("");
  const [quotaDraft, setQuotaDraft] = useState<QuotaRow[]>([]);

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

  const setField = (key: keyof Draft, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
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
    if (!selected || !draft) return false;
    const { payload, errors: localErrors } = toPayload(draft);
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
          <div className="rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-5 text-white shadow-xl">
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
            <h1 className="text-2xl font-semibold tracking-tight">Booking rules &amp; instructions</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Set the important instruction shown to users, when slots become visible, usage quotas, and booking and
              sample deadlines for each equipment you manage.
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
                          {r.equipment_name} ({r.equipment_code})
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
                      Shown prominently as a note on the equipment page and when booking. Leave empty to show nothing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <Label htmlFor="oic-setting-important-instruction" className="sr-only">
                      Important instruction
                    </Label>
                    <Textarea
                      id="oic-setting-important-instruction"
                      rows={3}
                      value={draft.important_instruction}
                      onChange={(e) => setField("important_instruction", e.target.value)}
                      placeholder="e.g. Samples must be completely dry. Bring your own sample holders."
                      aria-invalid={Boolean(errors.important_instruction)}
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {draft.important_instruction.trim().length}/{IMPORTANT_INSTRUCTION_MAX_LENGTH}
                    </p>
                    {fieldError("important_instruction")}
                  </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="rounded-2xl border-border/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Slot visibility</CardTitle>
                      <CardDescription>
                        When next week&apos;s slots open to internal users, and the time range regular users see.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                        Before this day and time only the current week is visible; from then on the current and next
                        week are visible. Leave empty for no restriction.
                      </p>
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
                      <CardContent className="space-y-4">{renderIntFields("booking")}</CardContent>
                    </Card>
                    <Card className="rounded-2xl border-border/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Sample timings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">{renderIntFields("sample")}</CardContent>
                    </Card>
                  </div>
                </div>

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
