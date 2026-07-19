import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { hasRbacPermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Layers3 } from "lucide-react";

interface EquipmentModeScheduleRow {
  id: number;
  parent_equipment: number;
  parent_equipment_code?: string;
  parent_equipment_name?: string;
  mode_equipment: number;
  mode_equipment_code?: string;
  mode_equipment_name?: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  behavior: "PARALLEL" | "EXCLUSIVE";
  unavailable_label: string;
  unavailable_color: string;
  exclusive_blocked_label: string;
  exclusive_blocked_color: string;
}

interface EquipmentOption {
  equipment_id: number;
  code: string;
  name: string;
}

interface FormState {
  parent_equipment: string;
  mode_equipment: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  behavior: "PARALLEL" | "EXCLUSIVE";
  unavailable_label: string;
  unavailable_color: string;
  exclusive_blocked_label: string;
  exclusive_blocked_color: string;
}

const EMPTY_FORM: FormState = {
  parent_equipment: "",
  mode_equipment: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  behavior: "PARALLEL",
  unavailable_label: "Mode not scheduled",
  unavailable_color: "#9ca3af",
  exclusive_blocked_label: "Alternate mode active",
  exclusive_blocked_color: "#9ca3af",
};

export default function AdminEquipmentModeSchedules() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const isDeptAdmin = userTypeStr === "dept_admin";
  const canAccess =
    isAdmin ||
    (isDeptAdmin &&
      (hasRbacPermission(user, "admin_settings.equipment") || hasRbacPermission(user, "equipment.manage")));

  const [rows, setRows] = useState<EquipmentModeScheduleRow[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("You do not have access to Equipment Mode Schedules.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const res = await apiClient.adminList<EquipmentModeScheduleRow>("equipmentModeSchedules");
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<EquipmentModeScheduleRow>(res.data));
    }
    setLoading(false);
  };

  const fetchEquipmentOptions = async () => {
    const res = await apiClient.adminEquipmentList();
    if (res.error || !Array.isArray(res.data)) return;
    const raw = res.data as Array<{ equipment_id?: number; id?: number; code?: string; name?: string }>;
    setEquipmentOptions(
      raw.map((e) => ({
        equipment_id: e.equipment_id ?? (e.id as number),
        code: String(e.code ?? ""),
        name: String(e.name ?? e.code ?? ""),
      }))
    );
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchRows();
    fetchEquipmentOptions();
  }, [canAccess]);

  const equipmentLabel = (id: number, fallbackCode?: string, fallbackName?: string) => {
    const opt = equipmentOptions.find((e) => e.equipment_id === id);
    if (opt) return `${opt.code} — ${opt.name}`;
    if (fallbackCode || fallbackName) return `${fallbackCode ?? ""} ${fallbackName ?? ""}`.trim();
    return `#${id}`;
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (row: EquipmentModeScheduleRow) => {
    setEditingId(row.id);
    setForm({
      parent_equipment: String(row.parent_equipment),
      mode_equipment: String(row.mode_equipment),
      start_date: row.start_date,
      end_date: row.end_date,
      start_time: row.start_time ?? "",
      end_time: row.end_time ?? "",
      behavior: row.behavior,
      unavailable_label: row.unavailable_label ?? "",
      unavailable_color: row.unavailable_color ?? "#9ca3af",
      exclusive_blocked_label: row.exclusive_blocked_label ?? "",
      exclusive_blocked_color: row.exclusive_blocked_color ?? "#9ca3af",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.parent_equipment || !form.mode_equipment || !form.start_date || !form.end_date) {
      toast.error("Parent equipment, mode equipment, start and end dates are required.");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      parent_equipment: parseInt(form.parent_equipment, 10),
      mode_equipment: parseInt(form.mode_equipment, 10),
      start_date: form.start_date,
      end_date: form.end_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      behavior: form.behavior,
      unavailable_label: form.unavailable_label,
      unavailable_color: form.unavailable_color,
      exclusive_blocked_label: form.exclusive_blocked_label,
      exclusive_blocked_color: form.exclusive_blocked_color,
    };
    const res =
      editingId === null
        ? await apiClient.adminCreate<EquipmentModeScheduleRow>("equipmentModeSchedules", payload)
        : await apiClient.adminUpdate<EquipmentModeScheduleRow>("equipmentModeSchedules", editingId, payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId === null ? "Schedule created." : "Schedule updated.");
    setModalOpen(false);
    fetchRows();
  };

  const handleDelete = async (row: EquipmentModeScheduleRow) => {
    if (!confirm("Delete this mode schedule?")) return;
    const res = await apiClient.adminDelete("equipmentModeSchedules", row.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Schedule deleted.");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  if (!canAccess && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings/equipment")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Equipment settings
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers3 className="h-8 w-8 text-primary" />
            Equipment Mode Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            Date-ranged activation of a child mode under a multi-mode parent instrument. Parallel: child is bookable
            alongside the parent. Exclusive: child replaces the parent in the catalog for those dates.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>All mode schedules</CardTitle>
              <CardDescription>Create, edit, or remove mode schedules.</CardDescription>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add schedule
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No mode schedules yet. Add one to get started.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parent</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Time window</TableHead>
                      <TableHead>Behavior</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {equipmentLabel(row.parent_equipment, row.parent_equipment_code, row.parent_equipment_name)}
                        </TableCell>
                        <TableCell>{equipmentLabel(row.mode_equipment, row.mode_equipment_code, row.mode_equipment_name)}</TableCell>
                        <TableCell>
                          {row.start_date} → {row.end_date}
                        </TableCell>
                        <TableCell>
                          {row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : "All day"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              row.behavior === "EXCLUSIVE"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-primary/10 text-primary border-primary/20"
                            }
                          >
                            {row.behavior === "EXCLUSIVE" ? "Exclusive" : "Parallel"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Add mode schedule" : "Edit mode schedule"}</DialogTitle>
            <DialogDescription>
              Choose the parent (base) equipment and the mode (child) equipment, the active date range, and behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mode-parent">Parent equipment</Label>
                <Select value={form.parent_equipment} onValueChange={(v) => setForm((f) => ({ ...f, parent_equipment: v }))}>
                  <SelectTrigger id="mode-parent">
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {e.code} — {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode-child">Mode equipment</Label>
                <Select value={form.mode_equipment} onValueChange={(v) => setForm((f) => ({ ...f, mode_equipment: v }))}>
                  <SelectTrigger id="mode-child">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {e.code} — {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mode-start-date">Start date</Label>
                <Input
                  id="mode-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode-end-date">End date</Label>
                <Input
                  id="mode-end-date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mode-start-time">Start time (optional)</Label>
                <Input
                  id="mode-start-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode-end-time">End time (optional)</Label>
                <Input
                  id="mode-end-time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode-behavior">Behavior</Label>
              <Select value={form.behavior} onValueChange={(v) => setForm((f) => ({ ...f, behavior: v as "PARALLEL" | "EXCLUSIVE" }))}>
                <SelectTrigger id="mode-behavior">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARALLEL">Parallel (bookable alongside parent)</SelectItem>
                  <SelectItem value="EXCLUSIVE">Mutually Exclusive (replaces parent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mode-unavail-label">Unavailable label (child)</Label>
                <Input
                  id="mode-unavail-label"
                  value={form.unavailable_label}
                  onChange={(e) => setForm((f) => ({ ...f, unavailable_label: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode-unavail-color">Unavailable color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.unavailable_color}
                    onChange={(e) => setForm((f) => ({ ...f, unavailable_color: e.target.value }))}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.unavailable_color}
                    onChange={(e) => setForm((f) => ({ ...f, unavailable_color: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
            {form.behavior === "EXCLUSIVE" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mode-exclusive-label">Blocked label (parent)</Label>
                  <Input
                    id="mode-exclusive-label"
                    value={form.exclusive_blocked_label}
                    onChange={(e) => setForm((f) => ({ ...f, exclusive_blocked_label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mode-exclusive-color">Blocked color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.exclusive_blocked_color}
                      onChange={(e) => setForm((f) => ({ ...f, exclusive_blocked_color: e.target.value }))}
                      className="h-10 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.exclusive_blocked_color}
                      onChange={(e) => setForm((f) => ({ ...f, exclusive_blocked_color: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
