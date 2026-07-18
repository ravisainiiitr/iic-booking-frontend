import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, GitBranch, Trash2, CalendarClock, Pencil } from "lucide-react";
import { toast } from "sonner";

type ModeChild = { equipment_id: number; code: string; name: string; status?: string };
type ModeSchedule = {
  id: number;
  parent_equipment_id: number;
  mode_equipment_id: number;
  mode_equipment_code?: string;
  mode_equipment_name?: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  behavior: string;
  behavior_display?: string;
  unavailable_label?: string;
  unavailable_color?: string;
  exclusive_blocked_label?: string;
  exclusive_blocked_color?: string;
};
type ModeFamily = {
  parent_equipment_id: number;
  parent_code: string;
  parent_name: string;
  parent_status?: string;
  children: ModeChild[];
  schedules: ModeSchedule[];
};
type Linkable = { equipment_id: number; code: string; name: string };

type ScheduleForm = {
  mode_equipment_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  behavior: "PARALLEL" | "EXCLUSIVE";
  unavailable_label: string;
  unavailable_color: string;
  exclusive_blocked_label: string;
  exclusive_blocked_color: string;
};

const emptyForm = (): ScheduleForm => ({
  mode_equipment_id: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  behavior: "PARALLEL",
  unavailable_label: "Mode not scheduled",
  unavailable_color: "#9ca3af",
  exclusive_blocked_label: "Alternate mode active",
  exclusive_blocked_color: "#9ca3af",
});

function openChangeSlotStatus(
  navigate: ReturnType<typeof useNavigate>,
  equipmentId: number,
  monthIso?: string
) {
  const params = new URLSearchParams({
    equipment_id: String(equipmentId),
    mode: "status",
  });
  if (monthIso && /^\d{4}-\d{2}/.test(monthIso)) {
    params.set("month", monthIso.slice(0, 7));
  }
  navigate(`/book-equipment?${params.toString()}`);
}

export default function OICMultiMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdmin = userType === "admin";
  const canManage = isAdmin || userType === "manager";

  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<ModeFamily[]>([]);
  const [linkable, setLinkable] = useState<Linkable[]>([]);
  const [behaviors, setBehaviors] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);

  const selected = useMemo(
    () => families.find((f) => String(f.parent_equipment_id) === selectedParentId) ?? null,
    [families, selectedParentId]
  );

  const modeOptions = useMemo(() => {
    if (!selected) {
      return linkable.filter((e) => String(e.equipment_id) !== selectedParentId);
    }
    const childIds = new Set(selected.children.map((c) => c.equipment_id));
    const children = selected.children.map((c) => ({
      equipment_id: c.equipment_id,
      code: c.code,
      name: c.name,
    }));
    const extras = linkable.filter(
      (e) => e.equipment_id !== selected.parent_equipment_id && !childIds.has(e.equipment_id)
    );
    return [...children, ...extras];
  }, [selected, linkable, selectedParentId]);

  const parentOptions = useMemo(
    () =>
      families.map((f) => ({
        equipment_id: f.parent_equipment_id,
        code: f.parent_code,
        name: f.parent_name,
      })),
    [families]
  );

  const load = async (preferParentId?: string) => {
    setLoading(true);
    const res = await apiClient.getOicMultiMode();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const list = (res.data?.families || []) as ModeFamily[];
    setFamilies(list);
    setLinkable((res.data?.linkable_equipment || []) as Linkable[]);
    setBehaviors((res.data?.behaviors || []) as Array<{ value: string; label: string }>);
    const nextId =
      preferParentId && list.some((f) => String(f.parent_equipment_id) === preferParentId)
        ? preferParentId
        : list.length > 0
          ? String(list[0].parent_equipment_id)
          : "";
    setSelectedParentId(nextId);
  };

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can configure Multi-Mode Equipment.");
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canManage, navigate]);

  useEffect(() => {
    setEditingId(null);
    setForm(emptyForm());
  }, [selectedParentId]);

  const startEdit = (s: ModeSchedule) => {
    setEditingId(s.id);
    setForm({
      mode_equipment_id: String(s.mode_equipment_id),
      start_date: s.start_date || "",
      end_date: s.end_date || "",
      start_time: (s.start_time || "").slice(0, 5),
      end_time: (s.end_time || "").slice(0, 5),
      behavior: (s.behavior === "EXCLUSIVE" ? "EXCLUSIVE" : "PARALLEL") as "PARALLEL" | "EXCLUSIVE",
      unavailable_label: s.unavailable_label || "Mode not scheduled",
      unavailable_color: s.unavailable_color || "#9ca3af",
      exclusive_blocked_label: s.exclusive_blocked_label || "Alternate mode active",
      exclusive_blocked_color: s.exclusive_blocked_color || "#9ca3af",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const payloadFromForm = () => ({
    parent_equipment_id: Number(selectedParentId),
    mode_equipment_id: Number(form.mode_equipment_id),
    start_date: form.start_date,
    end_date: form.end_date,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    behavior: form.behavior,
    unavailable_label: form.unavailable_label,
    unavailable_color: form.unavailable_color,
    exclusive_blocked_label: form.exclusive_blocked_label,
    exclusive_blocked_color: form.exclusive_blocked_color,
  });

  const onSave = async () => {
    if (!selectedParentId || !form.mode_equipment_id || !form.start_date || !form.end_date) {
      toast.error("Select parent, mode, and date range.");
      return;
    }
    setSaving(true);
    const payload = payloadFromForm();
    const res = editingId
      ? await apiClient.updateOicMultiModeSchedule(editingId, payload)
      : await apiClient.createOicMultiModeSchedule(payload);
    setSaving(false);
    if (res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Failed to save schedule.");
      return;
    }
    toast.success(editingId ? "Schedule updated." : "Mode schedule created.");
    cancelEdit();
    await load(selectedParentId);
  };

  const onDelete = async (scheduleId: number) => {
    setDeletingId(scheduleId);
    const res = await apiClient.deleteOicMultiModeSchedule(scheduleId);
    setDeletingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Schedule deleted.");
    if (editingId === scheduleId) cancelEdit();
    await load(selectedParentId);
  };

  const scheduleFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Mode equipment</Label>
          <Select
            value={form.mode_equipment_id}
            onValueChange={(v) => setForm((p) => ({ ...p, mode_equipment_id: v }))}
            disabled={!!editingId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map((m) => (
                <SelectItem key={m.equipment_id} value={String(m.equipment_id)}>
                  {m.code} — {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Start date</Label>
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>End date</Label>
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Start time (optional)</Label>
          <Input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>End time (optional)</Label>
          <Input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Behavior</Label>
          <Select
            value={form.behavior}
            onValueChange={(v) => setForm((p) => ({ ...p, behavior: v as "PARALLEL" | "EXCLUSIVE" }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(behaviors.length
                ? behaviors
                : [
                    { value: "PARALLEL", label: "Parallel" },
                    { value: "EXCLUSIVE", label: "Mutually Exclusive" },
                  ]
              ).map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unavailable status label (child outside schedule)</Label>
          <Input
            value={form.unavailable_label}
            onChange={(e) => setForm((p) => ({ ...p, unavailable_label: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Unavailable background color</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              className="w-14 h-10 p-1"
              value={form.unavailable_color}
              onChange={(e) => setForm((p) => ({ ...p, unavailable_color: e.target.value }))}
            />
            <Input
              value={form.unavailable_color}
              onChange={(e) => setForm((p) => ({ ...p, unavailable_color: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Blocked slot label (parent during exclusive)</Label>
          <Input
            value={form.exclusive_blocked_label}
            onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_label: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Blocked background color (exclusive)</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              className="w-14 h-10 p-1"
              value={form.exclusive_blocked_color}
              onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_color: e.target.value }))}
            />
            <Input
              value={form.exclusive_blocked_color}
              onChange={(e) => setForm((p) => ({ ...p, exclusive_blocked_color: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onSave()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {editingId ? "Save changes" : "Create schedule"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={cancelEdit}>
            Cancel edit
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 gap-2 text-white/90 hover:text-white hover:bg-white/20"
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
              <h1 className="text-2xl font-semibold tracking-tight">Multi-Mode Equipment</h1>
              <p className="mt-1 text-sm text-white/85 max-w-2xl">
                Schedule Parallel or Mutually Exclusive modes for equipment with Multi-Mode enabled.
                Configure labels and colors for unavailable/exclusive slots.
              </p>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Select a parent instrument, then link modes and schedules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : parentOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Multi-Mode-enabled equipment available. Enable &quot;Multi-Mode Equipment&quot; on
                the equipment create/edit form first (default is off).
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Parent (base) equipment</Label>
                  <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((p) => (
                        <SelectItem key={p.equipment_id} value={String(p.equipment_id)}>
                          {p.code} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedParentId && (
                  <div className="rounded-md border border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/20 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <CalendarClock className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Operate days / slots (Change slot status)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Configure availability in advance for the base and each child. Outside a
                          child&apos;s schedule, slots show the unavailable label/color. During
                          exclusive windows, parent slots show the blocked label/color (not blank).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                        <span>
                          <span className="font-medium">
                            {selected?.parent_code ||
                              parentOptions.find((p) => String(p.equipment_id) === selectedParentId)?.code}
                          </span>
                          {" — "}
                          {selected?.parent_name ||
                            parentOptions.find((p) => String(p.equipment_id) === selectedParentId)?.name}
                          <span className="text-muted-foreground"> (base)</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openChangeSlotStatus(navigate, Number(selectedParentId))}
                        >
                          Change slot status
                        </Button>
                      </div>
                      {(selected?.children || []).map((c) => (
                        <div
                          key={c.equipment_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="font-medium">{c.code}</span>
                            {" — "}
                            {c.name}
                            <span className="text-muted-foreground"> (mode)</span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openChangeSlotStatus(navigate, c.equipment_id)}
                          >
                            Change slot status
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border p-4 space-y-4">
                  <p className="font-medium text-sm">
                    {editingId ? `Edit schedule #${editingId}` : "Add mode schedule"}
                  </p>
                  {scheduleFields}
                </div>

                {selected && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Schedules</p>
                    {selected.schedules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No schedules yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selected.schedules.map((s) => (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium">
                                {s.mode_equipment_code || s.mode_equipment_id}
                              </span>
                              {" · "}
                              {s.start_date} → {s.end_date}
                              {s.start_time || s.end_time
                                ? ` · ${(s.start_time || "…").slice(0, 5)}–${(s.end_time || "…").slice(0, 5)}`
                                : ""}
                              {" · "}
                              <span className="text-muted-foreground">
                                {s.behavior_display || s.behavior}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(s)}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openChangeSlotStatus(navigate, s.mode_equipment_id, s.start_date)
                                }
                              >
                                Slots
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                disabled={deletingId === s.id}
                                onClick={() => void onDelete(s.id)}
                              >
                                {deletingId === s.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
