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
  important_instruction?: string | null;
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
  /** Weekly grid vertical axis: TIME = show time; SLOT_ID = show slot number/name. Only admin and OIC can change. */
  weekly_view_display?: 'TIME' | 'SLOT_ID';
  /** Only show slots starting at or after this time (24h). Leave empty for no limit. */
  weekly_view_time_from?: string | null;
  /** Only show slots ending at or before this time (24h). Leave empty for no limit. */
  weekly_view_time_to?: string | null;
  /** @deprecated Weekly view range uses only from/to time. Kept for API compatibility. */
  weekly_view_max_rows?: number | null;
  /** @deprecated Not used in Weekly view range. Kept for API compatibility. */
  weekly_view_default_days?: number | null;
  /** Weekday (0=Mon … 6=Sun) at which the next week becomes visible to internal users. Leave empty for no restriction. */
  slot_window_reference_weekday?: number | null;
  /** Time (24h, HH:mm) on that weekday when the next week opens. */
  slot_window_reference_time?: string | null;
  /** Max waitlist length for this equipment (0 = disabled). Set when creating/editing equipment. */
  waitlist_queue_depth?: number | null;
  /** Max PENDING urgent requests for this equipment at a time. Leave empty for no cap. Admin and OIC. */
  max_urgent_requests?: number | null;
  repeat_sample_request_days?: number | null;
  repeat_sample_disclaimer?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  equipment_managers?: Array<{ manager: number }>;
  equipment_operators?: Array<{ operator: number }>;
  equipment_specifications?: Array<{ spec_key: string; spec_value?: string }>;
  equipment_accessories?: Array<{ accessory_name: string; is_optional?: boolean }>;
  equipment_additional_accessories?: Array<{ additional_accessory_name: string; additional_accessory_description?: string; is_optional?: boolean }>;
  slot_masters?: Array<{ slot_number: number; slot_name?: string; open_time: string; close_time: string; is_active?: boolean }>;
  charge_profiles?: Array<{ user_type: string; is_active?: boolean; primary_unit_charge: string | number; secondary_unit_charge?: string | number; breakpoint?: string | number | null; time_formula?: string | null }>;
  input_fields?: Array<{ field_key: string; field_label: string; field_type: string; is_required?: boolean; default_value?: string; options?: string[]; help_text?: string }>;
};

type EquipmentFormChoices = {
  categories: Array<{ id: number; name: string; code?: string | null }>;
  equipment_groups: Array<{ equipment_group_id: number; name: string; code: string }>;
  internal_departments: Array<{ id: number; name: string; code: string }>;
  user_groups: Array<{ id: number; name: string; code: string }>;
  managers: Array<{ id: number; name: string; email: string }>;
  operators: Array<{ id: number; name: string; email: string }>;
  profile_type_choices: Array<{ value: string; label: string }>;
  status_choices: Array<{ value: string; label: string }>;
  user_type_choices?: Array<{ value: string; label: string }>;
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
    important_instruction: "",
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
    weekly_view_display: 'TIME',
    weekly_view_time_from: null,
    weekly_view_time_to: null,
    weekly_view_max_rows: null,
    weekly_view_default_days: 7,
    slot_window_reference_weekday: null,
    slot_window_reference_time: null,
    waitlist_queue_depth: 0,
    max_urgent_requests: null,
    repeat_sample_request_days: null,
    repeat_sample_disclaimer: "",
    equipment_managers: [],
    equipment_operators: [],
    equipment_specifications: [],
    equipment_accessories: [],
    equipment_additional_accessories: [],
    slot_masters: [],
    charge_profiles: [],
    input_fields: [],
    ...initialData,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

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
      const d = initialData as Record<string, unknown>;
      const managers = (d.managers || d.equipment_managers || []) as Array<{ manager: number }>;
      const operators = (d.operators || d.equipment_operators || []) as Array<{ operator: number }>;
      const specs = (d.specifications || d.equipment_specifications || []) as Array<{ spec_key: string; spec_value?: string }>;
      const accessories = (d.accessories || d.equipment_accessories || []) as Array<{ accessory_name: string; is_optional?: boolean }>;
      const addAccessories = (d.additional_accessories || d.equipment_additional_accessories || []) as Array<{ additional_accessory_name: string; additional_accessory_description?: string; is_optional?: boolean }>;
      const slots = (d.slot_masters || []) as Array<{ slot_number: number; slot_name?: string; open_time: string; close_time: string; is_active?: boolean }>;
      const profiles = (d.charge_profiles || []) as Array<Record<string, unknown>>;
      const inputs = (d.input_fields || []) as Array<Record<string, unknown>>;
      setFormData((prev) => ({
        ...prev,
        name: (d.name as string) ?? "",
        code: (d.code as string) ?? "",
        description: (d.description as string) ?? "",
        important_instruction: (d.important_instruction as string) ?? "",
        status: (d.status as string) ?? "ACTIVE",
        location: (d.location as string) ?? "",
        profile_type: (d.profile_type as string | null) ?? null,
        category: (d.category as number | null) ?? null,
        equipment_group: (d.equipment_group as number | null) ?? (d.equipment_group_id as number | null) ?? null,
        internal_department: (d.internal_department as number | null) ?? null,
        visibility_group: (d.visibility_group as number | null) ?? null,
        slot_duration_minutes: (d.slot_duration_minutes as number) ?? 30,
        slots_per_day: (d.slots_per_day as number) ?? 12,
        reschedule_hours_threshold: (d.reschedule_hours_threshold as number) ?? 48,
        split_booking_enabled: (d.split_booking_enabled as boolean) ?? false,
        weekly_view_display: (d.weekly_view_display === 'SLOT_ID' ? 'SLOT_ID' : 'TIME') as 'TIME' | 'SLOT_ID',
        weekly_view_time_from: (d.weekly_view_time_from != null && String(d.weekly_view_time_from).trim() !== '') ? String(d.weekly_view_time_from).slice(0, 5) : null,
        weekly_view_time_to: (d.weekly_view_time_to != null && String(d.weekly_view_time_to).trim() !== '') ? String(d.weekly_view_time_to).slice(0, 5) : null,
        weekly_view_max_rows: (d.weekly_view_max_rows != null && d.weekly_view_max_rows !== '') ? Number(d.weekly_view_max_rows) : null,
        weekly_view_default_days: (d.weekly_view_default_days != null && d.weekly_view_default_days !== '') ? Number(d.weekly_view_default_days) : 7,
        slot_window_reference_weekday: (d.slot_window_reference_weekday != null && d.slot_window_reference_weekday !== '') ? Number(d.slot_window_reference_weekday) : null,
        slot_window_reference_time: (d.slot_window_reference_time != null && String(d.slot_window_reference_time).trim() !== '') ? String(d.slot_window_reference_time).slice(0, 5) : null,
        waitlist_queue_depth: (d.waitlist_queue_depth as number | null) ?? 0,
        max_urgent_requests: (d.max_urgent_requests as number | null) ?? null,
        repeat_sample_request_days: (d.repeat_sample_request_days as number | null) ?? null,
        repeat_sample_disclaimer: (d.repeat_sample_disclaimer as string) ?? "",
        created_at: (d.created_at as string) ?? null,
        updated_at: (d.updated_at as string) ?? null,
        image_url: (d.image_url as string) ?? null,
        video_url: (d.video_url as string) ?? null,
        equipment_managers: Array.isArray(managers) ? managers.map((m) => ({ manager: typeof m.manager === "number" ? m.manager : (m as Record<string, unknown>).manager as number })) : prev.equipment_managers ?? [],
        equipment_operators: Array.isArray(operators) ? operators.map((o) => ({ operator: typeof o.operator === "number" ? o.operator : (o as Record<string, unknown>).operator as number })) : prev.equipment_operators ?? [],
        equipment_specifications: Array.isArray(specs) ? specs.map((s) => ({ spec_key: s.spec_key ?? "", spec_value: s.spec_value ?? "" })) : prev.equipment_specifications ?? [],
        equipment_accessories: Array.isArray(accessories) ? accessories.map((a) => ({ accessory_name: a.accessory_name ?? "", is_optional: a.is_optional ?? false })) : prev.equipment_accessories ?? [],
        equipment_additional_accessories: Array.isArray(addAccessories) ? addAccessories.map((a) => ({ additional_accessory_name: a.additional_accessory_name ?? "", additional_accessory_description: a.additional_accessory_description ?? "", is_optional: a.is_optional ?? false })) : prev.equipment_additional_accessories ?? [],
        slot_masters: Array.isArray(slots) ? slots.map((s) => ({ slot_number: s.slot_number, slot_name: s.slot_name ?? "", open_time: typeof s.open_time === "string" ? s.open_time : "", close_time: typeof s.close_time === "string" ? s.close_time : "", is_active: s.is_active ?? true })) : prev.slot_masters ?? [],
        charge_profiles: Array.isArray(profiles) ? profiles.map((p) => ({ user_type: String(p.user_type ?? ""), is_active: p.is_active !== false, primary_unit_charge: p.primary_unit_charge ?? 0, secondary_unit_charge: p.secondary_unit_charge ?? 0, breakpoint: p.breakpoint ?? null, time_formula: p.time_formula ?? null })) : prev.charge_profiles ?? [],
        input_fields: Array.isArray(inputs) ? inputs.map((i) => ({ field_key: String(i.field_key ?? ""), field_label: String(i.field_label ?? ""), field_type: String(i.field_type ?? "text"), is_required: i.is_required === true, default_value: String(i.default_value ?? ""), options: Array.isArray(i.options) ? i.options as string[] : [], help_text: String(i.help_text ?? "") })) : prev.input_fields ?? [],
      }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EquipmentFormData = {
      name: formData.name || undefined,
      code: formData.code || undefined,
      description: formData.description || null,
      important_instruction: formData.important_instruction ?? null,
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
      weekly_view_display: formData.weekly_view_display ?? 'TIME',
      weekly_view_time_from: formData.weekly_view_time_from && formData.weekly_view_time_from.trim() !== '' ? formData.weekly_view_time_from.trim() : null,
      weekly_view_time_to: formData.weekly_view_time_to && formData.weekly_view_time_to.trim() !== '' ? formData.weekly_view_time_to.trim() : null,
      weekly_view_max_rows: formData.weekly_view_max_rows != null && formData.weekly_view_max_rows !== '' ? formData.weekly_view_max_rows : null,
      weekly_view_default_days: formData.weekly_view_default_days != null && formData.weekly_view_default_days !== '' ? formData.weekly_view_default_days : null,
      slot_window_reference_weekday: formData.slot_window_reference_weekday != null && formData.slot_window_reference_weekday !== '' ? formData.slot_window_reference_weekday : null,
      slot_window_reference_time: formData.slot_window_reference_time && formData.slot_window_reference_time.trim() !== '' ? formData.slot_window_reference_time.trim() : null,
      waitlist_queue_depth: formData.waitlist_queue_depth ?? 0,
      max_urgent_requests: formData.max_urgent_requests != null && formData.max_urgent_requests !== '' ? (typeof formData.max_urgent_requests === 'number' ? formData.max_urgent_requests : parseInt(String(formData.max_urgent_requests), 10)) : null,
      repeat_sample_request_days: formData.repeat_sample_request_days ?? null,
      repeat_sample_disclaimer: formData.repeat_sample_disclaimer != null ? String(formData.repeat_sample_disclaimer) : "",
      equipment_managers: formData.equipment_managers ?? [],
      equipment_operators: formData.equipment_operators ?? [],
      equipment_specifications: formData.equipment_specifications ?? [],
      equipment_accessories: formData.equipment_accessories ?? [],
      equipment_additional_accessories: formData.equipment_additional_accessories ?? [],
      slot_masters: formData.slot_masters ?? [],
      charge_profiles: formData.charge_profiles ?? [],
      input_fields: formData.input_fields ?? [],
    };
    onSave(payload, { imageFile: imageFile ?? undefined, videoFile: videoFile ?? undefined });
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
      <h3 className="text-sm font-semibold border-b pb-2">Basic Information</h3>
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

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Important Instruction</h3>
      <p className="text-muted-foreground text-xs">Optional instructions shown prominently on the equipment page (above specifications).</p>
      <Textarea
        id="equipment-important-instruction"
        value={formData.important_instruction ?? ""}
        onChange={(e) => setFormData((p) => ({ ...p, important_instruction: e.target.value || "" }))}
        placeholder="Important instructions for users"
        rows={3}
      />

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Image</h3>
      <p className="text-muted-foreground text-xs">Upload a new image or view the current one.</p>
      {formData.image_url && (
        <div className="rounded border p-2">
          <img src={formData.image_url} alt="Equipment" className="max-h-32 object-contain" />
        </div>
      )}
      <div>
        <Label className="text-muted-foreground text-xs">Upload new image</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          className="mt-1"
        />
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Video</h3>
      <p className="text-muted-foreground text-xs">Upload a video file (MP4, WebM, OGG).</p>
      {formData.video_url && (
        <p className="text-sm">
          <a href={formData.video_url} target="_blank" rel="noreferrer" className="text-primary underline">Current video</a>
        </p>
      )}
      <div>
        <Label className="text-muted-foreground text-xs">Upload new video</Label>
        <Input
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          className="mt-1"
        />
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Slot Configuration</h3>
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
        <div className="space-y-2">
          <Label htmlFor="waitlist-queue-depth">Waitlist queue depth</Label>
          <Input
            id="waitlist-queue-depth"
            type="number"
            min={0}
            placeholder="0 = disabled"
            value={formData.waitlist_queue_depth ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFormData((p) => ({
                ...p,
                waitlist_queue_depth: v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
          />
          <p className="text-muted-foreground text-xs">When a booking fails, the user is added to the waitlist and notified of their position. Set to 0 to disable. Admin and OIC can view and clear the queue.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-urgent-requests">Max urgent requests (per equipment)</Label>
          <Input
            id="max-urgent-requests"
            type="number"
            min={0}
            placeholder="Empty = no cap"
            value={formData.max_urgent_requests ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFormData((p) => ({
                ...p,
                max_urgent_requests: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
          />
          <p className="text-muted-foreground text-xs">Maximum number of PENDING urgent requests allowed for this equipment at a time. Leave empty for no cap. Admin and OIC.</p>
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

      <div className="space-y-2 max-w-xs">
        <Label>Weekly view display</Label>
        <Select
          value={formData.weekly_view_display ?? 'TIME'}
          onValueChange={(v: 'TIME' | 'SLOT_ID') => setFormData((p) => ({ ...p, weekly_view_display: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Show time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TIME">Show time</SelectItem>
            <SelectItem value="SLOT_ID">Hide time</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">Show time: time on vertical axis. Hide time: vertical axis labels hidden (display only). Admin and OIC always see time.</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <h4 className="text-sm font-medium">Weekly view range (admin and OIC)</h4>
        <p className="text-muted-foreground text-xs">Set the time window (24h) that regular users see in the weekly slot view and in Step 3 (Select Time Slots). Only slots within this range are shown. Leave both empty for no limit. Admin and OIC always see the full weekly view.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weekly-view-time-from">Time from (24h)</Label>
            <Input
              id="weekly-view-time-from"
              type="time"
              value={formData.weekly_view_time_from ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, weekly_view_time_from: e.target.value || null }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weekly-view-time-to">Time to (24h)</Label>
            <Input
              id="weekly-view-time-to"
              type="time"
              value={formData.weekly_view_time_to ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, weekly_view_time_to: e.target.value || null }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 max-w-2xl">
        <h4 className="text-sm font-medium">Slot window (internal users)</h4>
        <p className="text-muted-foreground text-xs">When the next week becomes visible to students/faculty: only current week until this day+time; on or after it, current and next week. Leave both empty for no restriction (current + next week always).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slot-window-weekday">Reference weekday</Label>
            <Select
              value={formData.slot_window_reference_weekday != null ? String(formData.slot_window_reference_weekday) : "__none__"}
              onValueChange={(v) => setFormData((p) => ({ ...p, slot_window_reference_weekday: v === "__none__" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger id="slot-window-weekday">
                <SelectValue placeholder="No restriction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No restriction</SelectItem>
                <SelectItem value="0">Monday</SelectItem>
                <SelectItem value="1">Tuesday</SelectItem>
                <SelectItem value="2">Wednesday</SelectItem>
                <SelectItem value="3">Thursday</SelectItem>
                <SelectItem value="4">Friday</SelectItem>
                <SelectItem value="5">Saturday</SelectItem>
                <SelectItem value="6">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-window-time">Reference time (24h)</Label>
            <Input
              id="slot-window-time"
              type="time"
              value={formData.slot_window_reference_time ?? ""}
              onChange={(e) => setFormData((p) => ({ ...p, slot_window_reference_time: e.target.value || null }))}
            />
          </div>
        </div>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Repeat sample request</h3>
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="text-sm font-medium">Repeat sample request</h4>
        <p className="text-muted-foreground text-sm">
          Allow users to request a repeat sample within a time window after completion. Leave days empty or 0 to disable.
        </p>
        <div className="space-y-2">
          <Label htmlFor="repeat-sample-days">Repeat sample request window (days)</Label>
          <Input
            id="repeat-sample-days"
            type="number"
            min={0}
            placeholder="e.g. 30 — leave empty or 0 to disable"
            value={formData.repeat_sample_request_days ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFormData((p) => ({
                ...p,
                repeat_sample_request_days: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-sample-disclaimer">Customized disclaimer</Label>
          <Textarea
            id="repeat-sample-disclaimer"
            placeholder="Disclaimer text shown when the user requests a repeat sample (optional)"
            value={formData.repeat_sample_disclaimer ?? ""}
            onChange={(e) => setFormData((p) => ({ ...p, repeat_sample_disclaimer: e.target.value || "" }))}
            rows={3}
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Managers</h3>
      <p className="text-muted-foreground text-xs">Equipment managers (users with manager type).</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value="__add__"
          onValueChange={(v) => {
            if (!v || v === "__add__") return;
            const id = parseInt(v, 10);
            if (!id || (formData.equipment_managers ?? []).some((m) => m.manager === id)) return;
            setFormData((p) => ({ ...p, equipment_managers: [...(p.equipment_managers ?? []), { manager: id }] }));
          }}
        >
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Add manager" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__add__" disabled>Add manager</SelectItem>
            {(choices.managers ?? []).filter((m) => !(formData.equipment_managers ?? []).some((x) => x.manager === m.id)).map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name || m.email} ({m.email})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded border divide-y">
        {(formData.equipment_managers ?? []).length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No managers.</p>
        ) : (
          (formData.equipment_managers ?? []).map((m, idx) => (
            <div key={idx} className="flex items-center justify-between p-2">
              <span className="text-sm">{(choices.managers ?? []).find((c) => c.id === m.manager)?.name || (choices.managers ?? []).find((c) => c.id === m.manager)?.email || `ID ${m.manager}`}</span>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_managers: (p.equipment_managers ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))
        )}
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Operators</h3>
      <p className="text-muted-foreground text-xs">Equipment operators (users with operator type).</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value="__add__"
          onValueChange={(v) => {
            if (!v || v === "__add__") return;
            const id = parseInt(v, 10);
            if (!id || (formData.equipment_operators ?? []).some((o) => o.operator === id)) return;
            setFormData((p) => ({ ...p, equipment_operators: [...(p.equipment_operators ?? []), { operator: id }] }));
          }}
        >
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Add operator" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__add__" disabled>Add operator</SelectItem>
            {(choices.operators ?? []).filter((o) => !(formData.equipment_operators ?? []).some((x) => x.operator === o.id)).map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>{o.name || o.email} ({o.email})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded border divide-y">
        {(formData.equipment_operators ?? []).length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No operators.</p>
        ) : (
          (formData.equipment_operators ?? []).map((o, idx) => (
            <div key={idx} className="flex items-center justify-between p-2">
              <span className="text-sm">{(choices.operators ?? []).find((c) => c.id === o.operator)?.name || (choices.operators ?? []).find((c) => c.id === o.operator)?.email || `ID ${o.operator}`}</span>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_operators: (p.equipment_operators ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))
        )}
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Specifications</h3>
      <p className="text-muted-foreground text-xs">Key-value specifications (e.g. Capacity, Resolution).</p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Key" id="spec-key-new" className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
          <Input placeholder="Value" id="spec-value-new" className="flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const key = (document.getElementById("spec-key-new") as HTMLInputElement)?.value?.trim(); const val = (document.getElementById("spec-value-new") as HTMLInputElement)?.value?.trim(); if (key) { setFormData((p) => ({ ...p, equipment_specifications: [...(p.equipment_specifications ?? []), { spec_key: key, spec_value: val }] })); (document.getElementById("spec-key-new") as HTMLInputElement).value = ""; (document.getElementById("spec-value-new") as HTMLInputElement).value = ""; } } }} />
          <Button type="button" variant="secondary" size="sm" onClick={() => { const key = (document.getElementById("spec-key-new") as HTMLInputElement)?.value?.trim(); const val = (document.getElementById("spec-value-new") as HTMLInputElement)?.value?.trim(); if (key) { setFormData((p) => ({ ...p, equipment_specifications: [...(p.equipment_specifications ?? []), { spec_key: key, spec_value: val }] })); (document.getElementById("spec-key-new") as HTMLInputElement).value = ""; (document.getElementById("spec-value-new") as HTMLInputElement).value = ""; } }}>Add</Button>
        </div>
        <div className="rounded border divide-y">
          {(formData.equipment_specifications ?? []).length === 0 ? <p className="p-2 text-sm text-muted-foreground">No specifications.</p> : (formData.equipment_specifications ?? []).map((s, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2">
              <span className="text-sm font-mono">{s.spec_key}</span>
              <span className="text-sm text-muted-foreground flex-1 truncate">{s.spec_value ?? ""}</span>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_specifications: (p.equipment_specifications ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Accessories</h3>
      <p className="text-muted-foreground text-xs">Equipment accessories.</p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Accessory name" id="acc-name-new" className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={() => { const name = (document.getElementById("acc-name-new") as HTMLInputElement)?.value?.trim(); if (name) { setFormData((p) => ({ ...p, equipment_accessories: [...(p.equipment_accessories ?? []), { accessory_name: name, is_optional: false }] })); (document.getElementById("acc-name-new") as HTMLInputElement).value = ""; } }}>Add</Button>
        </div>
        <div className="rounded border divide-y">
          {(formData.equipment_accessories ?? []).length === 0 ? <p className="p-2 text-sm text-muted-foreground">No accessories.</p> : (formData.equipment_accessories ?? []).map((a, idx) => (
            <div key={idx} className="flex items-center justify-between p-2">
              <span className="text-sm">{a.accessory_name}{a.is_optional ? " (optional)" : ""}</span>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_accessories: (p.equipment_accessories ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Additional accessories</h3>
      <p className="text-muted-foreground text-xs">Additional accessories with description.</p>
      <div className="rounded border divide-y">
        {(formData.equipment_additional_accessories ?? []).length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">None.</p>
        ) : (
          (formData.equipment_additional_accessories ?? []).map((a, idx) => (
            <div key={idx} className="p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  placeholder="Name"
                  value={a.additional_accessory_name}
                  onChange={(e) => setFormData((p) => {
                    const arr = [...(p.equipment_additional_accessories ?? [])];
                    arr[idx] = { ...arr[idx], additional_accessory_name: e.target.value };
                    return { ...p, equipment_additional_accessories: arr };
                  })}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={a.is_optional ?? false}
                    onCheckedChange={(c) => setFormData((p) => {
                      const arr = [...(p.equipment_additional_accessories ?? [])];
                      arr[idx] = { ...arr[idx], is_optional: !!c };
                      return { ...p, equipment_additional_accessories: arr };
                    })}
                  />
                  <Label className="text-xs">Optional</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_additional_accessories: (p.equipment_additional_accessories ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
                </div>
              </div>
              <Textarea
                placeholder="Description"
                value={a.additional_accessory_description ?? ""}
                onChange={(e) => setFormData((p) => {
                  const arr = [...(p.equipment_additional_accessories ?? [])];
                  arr[idx] = { ...arr[idx], additional_accessory_description: e.target.value };
                  return { ...p, equipment_additional_accessories: arr };
                })}
                rows={2}
                className="text-sm"
              />
            </div>
          ))
        )}
        <div className="p-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setFormData((p) => ({ ...p, equipment_additional_accessories: [...(p.equipment_additional_accessories ?? []), { additional_accessory_name: "", additional_accessory_description: "", is_optional: false }] }))}>Add row</Button>
        </div>
      </div>

      {(formData.created_at != null || formData.updated_at != null) && (
        <>
          <h3 className="text-sm font-semibold border-b pb-2 pt-2">Timestamps</h3>
          <p className="text-xs text-muted-foreground">Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} · Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}</p>
        </>
      )}

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
