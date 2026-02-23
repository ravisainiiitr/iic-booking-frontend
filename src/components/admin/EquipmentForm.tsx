import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type EquipmentFormData = {
  name?: string;
  code?: string;
  description?: string | null;
  status?: string | null;
  location?: string | null;
  profile_type?: string | null;
  category?: number | null;
  equipment_group?: number | null;
  internal_department?: number | null;
  visibility_group?: number | null;
  slot_duration_minutes?: number;
  slots_per_day?: number;
  reschedule_hours_threshold?: number;
  split_booking_enabled?: boolean;
};

type EquipmentFormChoices = {
  categories: Array<{ id: number; name: string; code?: string | null }>;
  equipment_groups: Array<{ equipment_group_id: number; name: string; code: string }>;
  internal_departments: Array<{ id: number; name: string; code: string }>;
  user_groups: Array<{ id: number; name: string; code: string }>;
  profile_type_choices: Array<{ value: string; label: string }>;
  status_choices: Array<{ value: string; label: string }>;
};

type Props = {
  initialData?: EquipmentFormData | Record<string, unknown> | null;
  equipmentId?: number | null;
  onSave: (data: EquipmentFormData, options?: { imageFile?: File; videoFile?: File }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

export function EquipmentForm({ initialData, equipmentId, onSave, onCancel, saving }: Props) {
  const [choices, setChoices] = useState<EquipmentFormChoices | null>(null);
  const [choicesLoading, setChoicesLoading] = useState(true);
  const [choicesError, setChoicesError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: "",
    code: "",
    description: "",
    status: "ACTIVE",
    location: "",
    profile_type: null,
    category: null,
    equipment_group: null,
    internal_department: null,
    visibility_group: null,
    slot_duration_minutes: 30,
    slots_per_day: 12,
    reschedule_hours_threshold: 48,
    split_booking_enabled: false,
    ...initialData,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChoicesLoading(true);
      setChoicesError(null);
      const res = await apiClient.getEquipmentFormChoices();
      if (cancelled) return;
      if (res.error) {
        setChoicesError(res.error);
        setChoices(null);
      } else if (res.data) {
        setChoices(res.data);
      }
      setChoicesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialData && typeof initialData === "object") {
      const d = initialData as EquipmentFormData;
      setFormData((prev) => ({
        ...prev,
        name: d.name ?? "",
        code: d.code ?? "",
        description: d.description ?? "",
        status: d.status ?? "ACTIVE",
        location: d.location ?? "",
        profile_type: d.profile_type ?? null,
        category: d.category ?? null,
        equipment_group: d.equipment_group ?? null,
        internal_department: d.internal_department ?? null,
        visibility_group: d.visibility_group ?? null,
        slot_duration_minutes: d.slot_duration_minutes ?? 30,
        slots_per_day: d.slots_per_day ?? 12,
        reschedule_hours_threshold: d.reschedule_hours_threshold ?? 48,
        split_booking_enabled: d.split_booking_enabled ?? false,
      }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EquipmentFormData = {
      name: formData.name || undefined,
      code: formData.code || undefined,
      description: formData.description || null,
      status: formData.status || null,
      location: formData.location || null,
      profile_type: formData.profile_type || null,
      category: formData.category ?? null,
      equipment_group: formData.equipment_group ?? null,
      internal_department: formData.internal_department ?? null,
      visibility_group: formData.visibility_group ?? null,
      slot_duration_minutes: formData.slot_duration_minutes,
      slots_per_day: formData.slots_per_day,
      reschedule_hours_threshold: formData.reschedule_hours_threshold,
      split_booking_enabled: formData.split_booking_enabled,
    };
    onSave(payload);
  };

  if (choicesLoading || !choices) {
    return (
      <div className="flex items-center justify-center py-8">
        {choicesError ? (
          <p className="text-destructive">{choicesError}</p>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="equipment-name">Name *</Label>
          <Input
            id="equipment-name"
            value={formData.name ?? ""}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipment-code">Code *</Label>
          <Input
            id="equipment-code"
            value={formData.code ?? ""}
            onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={formData.category != null ? String(formData.category) : "none"}
            onValueChange={(v) => setFormData((p) => ({ ...p, category: v === "none" ? null : parseInt(v, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {choices.categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.code ? `(${c.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Equipment Group</Label>
          <Select
            value={formData.equipment_group != null ? String(formData.equipment_group) : "none"}
            onValueChange={(v) => setFormData((p) => ({ ...p, equipment_group: v === "none" ? null : parseInt(v, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {choices.equipment_groups.map((g) => (
                <SelectItem key={g.equipment_group_id} value={String(g.equipment_group_id)}>{g.name} ({g.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Internal Department</Label>
          <Select
            value={formData.internal_department != null ? String(formData.internal_department) : "none"}
            onValueChange={(v) => setFormData((p) => ({ ...p, internal_department: v === "none" ? null : parseInt(v, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {choices.internal_departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name} {d.code ? `(${d.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Visibility Group</Label>
          <Select
            value={formData.visibility_group != null ? String(formData.visibility_group) : "none"}
            onValueChange={(v) => setFormData((p) => ({ ...p, visibility_group: v === "none" ? null : parseInt(v, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select group (public if none)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None (public) —</SelectItem>
              {choices.user_groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Profile Type</Label>
          <Select
            value={formData.profile_type ?? "none"}
            onValueChange={(v) => setFormData((p) => ({ ...p, profile_type: v === "none" ? null : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Profile type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {choices.profile_type_choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={formData.status ?? "ACTIVE"}
            onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.status_choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipment-description">Description</Label>
        <Textarea
          id="equipment-description"
          value={formData.description ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipment-location">Location</Label>
        <Input
          id="equipment-location"
          value={formData.location ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="slot-duration">Slot duration (minutes)</Label>
          <Input
            id="slot-duration"
            type="number"
            min={1}
            value={formData.slot_duration_minutes ?? 30}
            onChange={(e) => setFormData((p) => ({ ...p, slot_duration_minutes: parseInt(e.target.value, 10) || 30 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slots-per-day">Slots per day</Label>
          <Input
            id="slots-per-day"
            type="number"
            min={1}
            value={formData.slots_per_day ?? 12}
            onChange={(e) => setFormData((p) => ({ ...p, slots_per_day: parseInt(e.target.value, 10) || 12 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reschedule-threshold">Reschedule threshold (hours)</Label>
          <Input
            id="reschedule-threshold"
            type="number"
            min={0}
            value={formData.reschedule_hours_threshold ?? 48}
            onChange={(e) => setFormData((p) => ({ ...p, reschedule_hours_threshold: parseInt(e.target.value, 10) || 48 }))}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="split-booking"
          checked={formData.split_booking_enabled ?? false}
          onCheckedChange={(checked) => setFormData((p) => ({ ...p, split_booking_enabled: !!checked }))}
        />
        <Label htmlFor="split-booking">Split booking enabled</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}
