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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type IntField =
  | "external_slot_quota_percent"
  | "booking_not_utilize_window_hours"
  | "operator_unavailable_after_booking_end_hours"
  | "operator_absent_disruption_after_booking_end_hours"
  | "sample_submission_lead_hours"
  | "sample_collect_deadline_hours";

type TimeField = "slot_window_reference_time" | "weekly_view_time_from" | "weekly_view_time_to";

type Draft = Record<IntField | TimeField, string> & { slot_window_reference_weekday: string };

const NO_WEEKDAY = "__none__";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  return { payload, errors };
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

  const selected = useMemo(
    () => rows.find((r) => String(r.equipment_id) === selectedId) ?? null,
    [rows, selectedId],
  );
  const savedDraft = useMemo(() => (selected ? toDraft(selected.settings) : null), [selected]);
  const dirty = Boolean(draft && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft));

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can manage equipment settings.");
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
    return () => {
      cancelled = true;
    };
  }, [canManage, navigate]);

  useEffect(() => {
    setDraft(savedDraft);
    setErrors({});
  }, [savedDraft]);

  const setField = (key: keyof Draft, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    if (!selected || !draft) return;
    const { payload, errors: localErrors } = toPayload(draft);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setSaving(true);
    const res = await apiClient.updateOicEquipmentSettings(selected.equipment_id, payload);
    setSaving(false);
    const updated = res.data?.equipment;
    if (res.error || !updated) {
      const serverErrors = (res.data as { errors?: Record<string, string> } | undefined)?.errors;
      if (serverErrors) setErrors(serverErrors);
      toast.error(res.error || "Could not save settings.");
      return;
    }
    setRows((prev) => prev.map((r) => (r.equipment_id === updated.equipment_id ? updated : r)));
    toast.success(`Settings saved for ${updated.equipment_name}.`);
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
            <h1 className="text-2xl font-semibold tracking-tight">Slot visibility &amp; timings</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Control when slots become visible, the external slot quota, and booking and sample deadlines for each
              equipment you manage.
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
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!dirty || saving}
                    onClick={() => {
                      setDraft(savedDraft);
                      setErrors({});
                    }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Discard
                  </Button>
                  <Button type="button" className="gap-1.5" disabled={!dirty || saving} onClick={save}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {draft && (
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
