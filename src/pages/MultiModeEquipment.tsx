import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { apiClient } from "@/lib/api";
import {
  DEFAULT_EXCLUSIVE_LABEL,
  DEFAULT_GREY,
  DEFAULT_UNAVAILABLE_LABEL,
  WEEKDAY_LABELS,
  describeHours,
  describeWeekdays,
  isoDate,
  modeColor,
  monthGrid,
  scheduleCoversDate,
  type ModeAvailability,
  type ModeBehavior,
  type MultiModeCandidate,
  type MultiModeFamily,
  type MultiModeOverview,
  type MultiModeSchedule,
} from "@/lib/multiMode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type ScheduleForm = {
  mode_equipment_id: string;
  start_date: string;
  end_date: string;
  weekdays: number[];
  hours: "all" | "window";
  start_time: string;
  end_time: string;
  behavior: ModeBehavior;
  unavailable_label: string;
  unavailable_color: string;
  exclusive_blocked_label: string;
  exclusive_blocked_color: string;
};

type ModeDraft = Record<number, { checked: boolean; availability: ModeAvailability }>;

const AVAILABILITY_LABEL: Record<ModeAvailability, string> = {
  ALWAYS: "Always available",
  SCHEDULED_ONLY: "Only on scheduled days",
};

const emptyForm = (date = "", modeId = ""): ScheduleForm => ({
  mode_equipment_id: modeId,
  start_date: date,
  end_date: date,
  weekdays: [],
  hours: "all",
  start_time: "",
  end_time: "",
  behavior: "PARALLEL",
  unavailable_label: DEFAULT_UNAVAILABLE_LABEL,
  unavailable_color: DEFAULT_GREY,
  exclusive_blocked_label: DEFAULT_EXCLUSIVE_LABEL,
  exclusive_blocked_color: DEFAULT_GREY,
});

function formFromSchedule(s: MultiModeSchedule): ScheduleForm {
  const hasWindow = Boolean(s.start_time && s.end_time);
  return {
    mode_equipment_id: String(s.mode_equipment_id),
    start_date: s.start_date,
    end_date: s.end_date,
    weekdays: [...(s.weekdays ?? [])],
    hours: hasWindow ? "window" : "all",
    start_time: (s.start_time ?? "").slice(0, 5),
    end_time: (s.end_time ?? "").slice(0, 5),
    behavior: s.behavior === "EXCLUSIVE" ? "EXCLUSIVE" : "PARALLEL",
    unavailable_label: s.unavailable_label || DEFAULT_UNAVAILABLE_LABEL,
    unavailable_color: s.unavailable_color || DEFAULT_GREY,
    exclusive_blocked_label: s.exclusive_blocked_label || DEFAULT_EXCLUSIVE_LABEL,
    exclusive_blocked_color: s.exclusive_blocked_color || DEFAULT_GREY,
  };
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function equipmentLabel(e: { code?: string | null; name?: string | null }): string {
  if (e.code && e.name && e.name !== e.code) return `${e.code} — ${e.name}`;
  return e.name || e.code || "";
}

function openChangeSlotStatus(navigate: ReturnType<typeof useNavigate>, equipmentId: number, monthIso?: string) {
  const params = new URLSearchParams({ equipment_id: String(equipmentId), mode: "status" });
  if (monthIso && /^\d{4}-\d{2}/.test(monthIso)) params.set("month", monthIso.slice(0, 7));
  navigate(`/book-equipment?${params.toString()}`);
}

export default function MultiModeEquipment() {
  const navigate = useNavigate();

  const [overview, setOverview] = useState<MultiModeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [baseId, setBaseId] = useState<string>("");

  const [family, setFamily] = useState<MultiModeFamily | null>(null);
  const [candidates, setCandidates] = useState<MultiModeCandidate[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [draft, setDraft] = useState<ModeDraft>({});
  const [savingModes, setSavingModes] = useState(false);
  const [modesError, setModesError] = useState<string | null>(null);

  const today = isoDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isAdminScope = overview?.scope === "admin";

  const loadOverview = useCallback(async (dept: string) => {
    setLoading(true);
    const res = await apiClient.getOicMultiMode(dept !== "all" ? Number(dept) : null);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load multi-mode equipment.");
      if (res.status === 403) navigate("/dashboard");
      return;
    }
    setOverview(res.data);
  }, [navigate]);

  const loadFamily = useCallback(async (id: string) => {
    if (!id) {
      setFamily(null);
      setCandidates([]);
      return;
    }
    setFamilyLoading(true);
    const res = await apiClient.getMultiModeFamily(Number(id));
    setFamilyLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load this instrument.");
      setFamily(null);
      setCandidates([]);
      return;
    }
    setFamily(res.data.family);
    setCandidates(res.data.candidates);
  }, []);

  useEffect(() => {
    void loadOverview(departmentId);
  }, [departmentId, loadOverview]);

  useEffect(() => {
    setModesError(null);
    void loadFamily(baseId);
  }, [baseId, loadFamily]);

  useEffect(() => {
    const next: ModeDraft = {};
    for (const c of candidates) {
      next[c.equipment_id] = { checked: c.is_mode, availability: c.mode_availability ?? "ALWAYS" };
    }
    setDraft(next);
  }, [candidates]);

  const baseOptions = useMemo(() => {
    if (!overview) return [];
    const modeCount = new Map(overview.families.map((f) => [f.parent_equipment_id, f.children.length]));
    return [...overview.base_candidates]
      .map((e) => ({ ...e, modes: modeCount.get(e.equipment_id) ?? 0 }))
      .sort((a, b) => Number(b.modes > 0) - Number(a.modes > 0) || a.code.localeCompare(b.code));
  }, [overview]);

  useEffect(() => {
    if (!overview) return;
    if (baseId && baseOptions.some((o) => String(o.equipment_id) === baseId)) return;
    const firstFamily = overview.families[0];
    setBaseId(firstFamily ? String(firstFamily.parent_equipment_id) : "");
  }, [overview, baseOptions, baseId]);

  const modes = family?.children ?? [];
  const modeIds = useMemo(() => modes.map((m) => m.equipment_id), [modes]);
  const schedules = family?.schedules ?? [];

  const modesDirty = candidates.some((c) => {
    const d = draft[c.equipment_id];
    if (!d) return false;
    if (d.checked !== c.is_mode) return true;
    return d.checked && c.is_mode && d.availability !== (c.mode_availability ?? "ALWAYS");
  });

  const saveModes = async () => {
    if (!family) return;
    const payload = Object.entries(draft)
      .filter(([, d]) => d.checked)
      .map(([id, d]) => ({ equipment_id: Number(id), mode_availability: d.availability }));
    setSavingModes(true);
    setModesError(null);
    const res = await apiClient.saveMultiModeFamily(family.parent_equipment_id, payload);
    setSavingModes(false);
    if (res.error || !res.data) {
      setModesError(res.error || "Could not save the modes.");
      return;
    }
    toast.success("Modes saved.");
    setFamily(res.data.family);
    setCandidates(res.data.candidates);
    void loadOverview(departmentId);
  };

  const schedulesOn = (iso: string) => schedules.filter((s) => scheduleCoversDate(s, iso));

  const openAdd = (date = "") => {
    setEditingId(null);
    setForm(emptyForm(date, modes.length === 1 ? String(modes[0].equipment_id) : ""));
    setAdvancedOpen(false);
    setDayOpen(null);
    setFormOpen(true);
  };

  const openEdit = (s: MultiModeSchedule) => {
    setEditingId(s.id);
    setForm(formFromSchedule(s));
    setAdvancedOpen(false);
    setDayOpen(null);
    setFormOpen(true);
  };

  const toggleWeekday = (day: number) =>
    setForm((p) => ({
      ...p,
      weekdays: p.weekdays.includes(day) ? p.weekdays.filter((d) => d !== day) : [...p.weekdays, day].sort(),
    }));

  const saveSchedule = async () => {
    if (!family) return;
    if (!form.mode_equipment_id || !form.start_date || !form.end_date) {
      toast.error("Choose the mode and both dates.");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("The To date must be on or after the From date.");
      return;
    }
    if (form.hours === "window" && (!form.start_time || !form.end_time)) {
      toast.error("Enter both hours, or choose All day.");
      return;
    }
    const payload = {
      mode_equipment_id: Number(form.mode_equipment_id),
      start_date: form.start_date,
      end_date: form.end_date,
      weekdays: form.weekdays,
      start_time: form.hours === "window" ? form.start_time : null,
      end_time: form.hours === "window" ? form.end_time : null,
      behavior: form.behavior,
      unavailable_label: form.unavailable_label,
      unavailable_color: form.unavailable_color,
      exclusive_blocked_label: form.exclusive_blocked_label,
      exclusive_blocked_color: form.exclusive_blocked_color,
    };
    setSaving(true);
    const res = editingId
      ? await apiClient.updateOicMultiModeSchedule(editingId, payload)
      : await apiClient.createOicMultiModeSchedule({ ...payload, parent_equipment_id: family.parent_equipment_id });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId ? "Schedule updated." : "Schedule added.");
    setFormOpen(false);
    await loadFamily(String(family.parent_equipment_id));
  };

  const deleteSchedule = async (s: MultiModeSchedule) => {
    if (!family) return;
    if (!window.confirm(`Delete the ${s.mode_equipment_code || "mode"} schedule ${s.start_date} to ${s.end_date}?`)) return;
    setDeletingId(s.id);
    const res = await apiClient.deleteOicMultiModeSchedule(s.id);
    setDeletingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Schedule deleted.");
    await loadFamily(String(family.parent_equipment_id));
  };

  const weeks = monthGrid(month.year, month.month);
  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthIso = isoDate(new Date(month.year, month.month, 1));
  const shiftMonth = (delta: number) =>
    setMonth((p) => {
      const d = new Date(p.year, p.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const selectedMode = modes.find((m) => String(m.equipment_id) === form.mode_equipment_id);
  const scheduleSummary = (s: MultiModeSchedule) =>
    [
      `${formatDay(s.start_date)} to ${formatDay(s.end_date)}`,
      describeWeekdays(s.weekdays),
      describeHours(s.start_time, s.end_time),
    ].join(" · ");

  const renderScheduleRow = (s: MultiModeSchedule) => (
    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: modeColor(modeIds, s.mode_equipment_id) }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-medium">
            {s.mode_equipment_code || s.mode_equipment_name || `#${s.mode_equipment_id}`}
            {s.behavior === "EXCLUSIVE" ? (
              <Badge variant="outline" className="ml-2 gap-1 align-middle">
                <Lock className="h-3 w-3" aria-hidden />
                Only this mode
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2 align-middle">
                Alongside others
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{scheduleSummary(s)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(s)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openChangeSlotStatus(navigate, s.mode_equipment_id, s.start_date)}
        >
          Slots
        </Button>
        <Button
          type="button"
          aria-label="Delete schedule"
          title="Delete schedule"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={deletingId === s.id}
          onClick={() => void deleteSchedule(s)}
        >
          {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </li>
  );

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-5">
        <StandaloneOnly>
          <div className="rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 -ml-2 gap-2 text-white/90 hover:bg-white/20 hover:text-white"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Multi-mode equipment</h1>
                <p className="mt-1 max-w-2xl text-sm text-white/85">
                  Choose which instruments are modes of a base instrument, then plan the days a mode runs.
                  Modes can be booked any day unless you limit them or run one on its own.
                </p>
              </div>
            </div>
          </div>
        </StandaloneOnly>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Instrument</CardTitle>
            <CardDescription>
              {isAdminScope
                ? "All equipment. Narrow the list by department if needed."
                : "Equipment you look after as Officer In Charge."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !overview ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {isAdminScope && (
                  <div className="space-y-2">
                    <Label htmlFor="mm-department">Department</Label>
                    <Select value={departmentId} onValueChange={(v) => { setBaseId(""); setDepartmentId(v); }}>
                      <SelectTrigger id="mm-department" aria-label="Department">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {(overview?.departments ?? []).map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={isAdminScope ? "space-y-2" : "space-y-2 sm:col-span-2"}>
                  <Label htmlFor="mm-base">Base instrument</Label>
                  <Select value={baseId} onValueChange={setBaseId} disabled={baseOptions.length === 0}>
                    <SelectTrigger id="mm-base" aria-label="Base instrument">
                      <SelectValue placeholder={baseOptions.length ? "Choose an instrument" : "No equipment available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {baseOptions.map((o) => (
                        <SelectItem key={o.equipment_id} value={String(o.equipment_id)}>
                          {equipmentLabel(o)}
                          {o.modes > 0 ? ` · ${o.modes} mode${o.modes === 1 ? "" : "s"}` : ""}
                          {isAdminScope && departmentId === "all" && o.department_name ? ` · ${o.department_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {baseId && (familyLoading && !family ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : family ? (
          <>
            <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle>Modes of {family.parent_code}</CardTitle>
                <CardDescription>
                  Tick the instruments that are other modes of {family.parent_name || family.parent_code}. Only
                  equipment in the same department that is not already part of another instrument is listed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other equipment can be a mode of this instrument.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {candidates.map((c) => {
                      const d = draft[c.equipment_id] ?? { checked: c.is_mode, availability: "ALWAYS" as ModeAvailability };
                      const id = `mm-mode-${c.equipment_id}`;
                      return (
                        <li
                          key={c.equipment_id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={d.checked}
                              disabled={c.locked}
                              onCheckedChange={(v) =>
                                setDraft((p) => ({ ...p, [c.equipment_id]: { ...d, checked: v === true } }))
                              }
                            />
                            <Label htmlFor={id} className="cursor-pointer font-normal">
                              {equipmentLabel(c)}
                              {c.locked ? (
                                <span className="ml-1 text-xs text-muted-foreground">(managed by another OIC)</span>
                              ) : null}
                            </Label>
                          </div>
                          {d.checked && (
                            <Select
                              value={d.availability}
                              disabled={c.locked}
                              onValueChange={(v) =>
                                setDraft((p) => ({
                                  ...p,
                                  [c.equipment_id]: { ...d, availability: v as ModeAvailability },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[220px]" aria-label={`When can ${c.code} be booked`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALWAYS">{AVAILABILITY_LABEL.ALWAYS}</SelectItem>
                                <SelectItem value="SCHEDULED_ONLY">{AVAILABILITY_LABEL.SCHEDULED_ONLY}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Always available: the mode can be booked any day, except when another mode runs on its own.
                  Only on scheduled days: the mode can be booked only on the days you add below.
                </p>
                {modesError && (
                  <Alert variant="destructive">
                    <AlertTitle>Modes not saved</AlertTitle>
                    <AlertDescription>{modesError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveModes()} disabled={!modesDirty || savingModes}>
                    {savingModes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save modes
                  </Button>
                  {modesDirty && (
                    <Button variant="outline" onClick={() => setCandidates([...candidates])} disabled={savingModes}>
                      Undo changes
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Mode calendar</CardTitle>
                  <CardDescription>Click a day to add or change what runs that day.</CardDescription>
                </div>
                <Button onClick={() => openAdd()} disabled={modes.length === 0} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add schedule
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {modes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tick at least one mode above and save before planning days.</p>
                ) : null}

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{equipmentLabel({ code: family.parent_code, name: family.parent_name })}</span>
                      <span className="text-muted-foreground"> (base)</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openChangeSlotStatus(navigate, family.parent_equipment_id, monthIso)}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Slot status
                    </Button>
                  </div>
                  {modes.map((m) => (
                    <div
                      key={m.equipment_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: modeColor(modeIds, m.equipment_id) }}
                          aria-hidden
                        />
                        <span className="font-medium">{equipmentLabel(m)}</span>
                        <span className="text-xs text-muted-foreground">
                          {AVAILABILITY_LABEL[m.mode_availability ?? "ALWAYS"]}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openChangeSlotStatus(navigate, m.equipment_id, monthIso)}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        Slot status
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="font-medium">{monthLabel}</p>
                  <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
                    <thead>
                      <tr>
                        {WEEKDAY_LABELS.map((w) => (
                          <th key={w} className="pb-1 text-center font-medium text-muted-foreground">
                            {w}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wi) => (
                        <tr key={wi}>
                          {week.map((iso, di) => {
                            if (!iso) return <td key={di} className="h-20 border border-border/40 bg-muted/20" />;
                            const active = schedulesOn(iso);
                            const exclusive = active.find((s) => s.behavior === "EXCLUSIVE");
                            return (
                              <td key={di} className="h-20 border border-border/40 p-0 align-top">
                                <button
                                  type="button"
                                  disabled={modes.length === 0}
                                  onClick={() => (active.length ? setDayOpen(iso) : openAdd(iso))}
                                  className={`flex h-full min-h-20 w-full flex-col gap-1 p-1 text-left transition-colors hover:bg-primary/5 disabled:cursor-default disabled:hover:bg-transparent ${
                                    exclusive ? "bg-muted/40" : ""
                                  }`}
                                  aria-label={`${formatDay(iso)}${active.length ? `, ${active.length} schedule(s)` : ""}`}
                                >
                                  <span
                                    className={`text-[11px] font-medium ${
                                      iso === today ? "rounded bg-primary px-1 text-primary-foreground" : "text-muted-foreground"
                                    }`}
                                  >
                                    {Number(iso.slice(8, 10))}
                                  </span>
                                  {active.slice(0, 3).map((s) => (
                                    <span
                                      key={s.id}
                                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                                      style={{ backgroundColor: modeColor(modeIds, s.mode_equipment_id) }}
                                      title={`${s.mode_equipment_code ?? ""} · ${s.behavior === "EXCLUSIVE" ? "only this mode" : "alongside others"} · ${describeHours(s.start_time, s.end_time)}`}
                                    >
                                      {s.behavior === "EXCLUSIVE" ? <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden /> : null}
                                      <span className="truncate">{s.mode_equipment_code || s.mode_equipment_name}</span>
                                    </span>
                                  ))}
                                  {active.length > 3 ? (
                                    <span className="text-[10px] text-muted-foreground">+{active.length - 3} more</span>
                                  ) : null}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden />
                  Only this mode: the base instrument and the other modes cannot be booked at that time.
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">All schedules</p>
                  {schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No schedules yet.</p>
                  ) : (
                    <ul className="space-y-2">{schedules.map(renderScheduleRow)}</ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null)}
      </main>

      <Dialog open={dayOpen != null} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dayOpen ? formatDay(dayOpen) : ""}</DialogTitle>
            <DialogDescription>What runs on this day.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">{dayOpen ? schedulesOn(dayOpen).map(renderScheduleRow) : null}</ul>
          <DialogFooter>
            <Button onClick={() => dayOpen && openAdd(dayOpen)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add schedule for this day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Change schedule" : "Add schedule"}</DialogTitle>
            <DialogDescription>{family ? `For ${family.parent_code}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mm-form-mode">Mode</Label>
              <Select value={form.mode_equipment_id} onValueChange={(v) => setForm((p) => ({ ...p, mode_equipment_id: v }))}>
                <SelectTrigger id="mm-form-mode" aria-label="Mode">
                  <SelectValue placeholder="Choose the mode" />
                </SelectTrigger>
                <SelectContent>
                  {modes.map((m) => (
                    <SelectItem key={m.equipment_id} value={String(m.equipment_id)}>
                      {equipmentLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mm-form-from">From date</Label>
                <Input
                  id="mm-form-from"
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      start_date: e.target.value,
                      end_date: p.end_date && p.end_date >= e.target.value ? p.end_date : e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-form-to">To date</Label>
                <Input
                  id="mm-form-to"
                  type="date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Repeat on (optional)</Label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Repeat on">
                {WEEKDAY_LABELS.map((w, i) => {
                  const on = form.weekdays.includes(i);
                  return (
                    <Button
                      key={w}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      className="h-8 rounded-full px-3"
                      onClick={() => toggleWeekday(i)}
                    >
                      {w}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.weekdays.length ? `Only on ${describeWeekdays(form.weekdays)} between the dates.` : "Every day between the dates."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Hours</Label>
              <RadioGroup
                value={form.hours}
                onValueChange={(v) => setForm((p) => ({ ...p, hours: v as ScheduleForm["hours"] }))}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="mm-hours-all" />
                  <Label htmlFor="mm-hours-all" className="font-normal">All day</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="window" id="mm-hours-window" />
                  <Label htmlFor="mm-hours-window" className="font-normal">Only between</Label>
                </div>
              </RadioGroup>
              {form.hours === "window" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label="From time"
                    value={form.start_time}
                    onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">and</span>
                  <Input
                    type="time"
                    aria-label="To time"
                    value={form.end_time}
                    onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Can other modes and the base instrument be booked at the same time?</Label>
              <RadioGroup
                value={form.behavior}
                onValueChange={(v) => setForm((p) => ({ ...p, behavior: v as ModeBehavior }))}
                className="space-y-1"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="PARALLEL" id="mm-behavior-yes" className="mt-0.5" />
                  <Label htmlFor="mm-behavior-yes" className="font-normal">
                    Yes, they can be booked at the same time
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="EXCLUSIVE" id="mm-behavior-no" className="mt-0.5" />
                  <Label htmlFor="mm-behavior-no" className="font-normal">
                    No, only this mode can be booked then
                  </Label>
                </div>
              </RadioGroup>
              {form.behavior === "PARALLEL" && selectedMode && (selectedMode.mode_availability ?? "ALWAYS") === "ALWAYS" && (
                <p className="text-xs text-muted-foreground">
                  {selectedMode.code} is already always available, so this schedule only marks the calendar. To limit
                  it to these days, set it to &quot;Only on scheduled days&quot; under Modes.
                </p>
              )}
            </div>
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1">
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                  Advanced: slot labels and colours
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mm-unavail-label" className="text-xs">Label when the mode is not scheduled</Label>
                    <Input
                      id="mm-unavail-label"
                      value={form.unavailable_label}
                      onChange={(e) => setForm((p) => ({ ...p, unavailable_label: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mm-unavail-color" className="text-xs">Colour</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="mm-unavail-color"
                        type="color"
                        className="h-9 w-14 p-1"
                        value={form.unavailable_color}
                        onChange={(e) => setForm((p) => ({ ...p, unavailable_color: e.target.value }))}
                      />
                      <Input
                        aria-label="Colour when the mode is not scheduled (hex)"
                        value={form.unavailable_color}
                        onChange={(e) => setForm((p) => ({ ...p, unavailable_color: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mm-excl-label" className="text-xs">Label on other slots while only this mode runs</Label>
                    <Input
                      id="mm-excl-label"
                      value={form.exclusive_blocked_label}
                      onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_label: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mm-excl-color" className="text-xs">Colour</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="mm-excl-color"
                        type="color"
                        className="h-9 w-14 p-1"
                        value={form.exclusive_blocked_color}
                        onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_color: e.target.value }))}
                      />
                      <Input
                        aria-label="Colour on other slots while only this mode runs (hex)"
                        value={form.exclusive_blocked_color}
                        onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_color: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveSchedule()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Add schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
