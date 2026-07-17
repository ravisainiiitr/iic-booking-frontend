import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api";
import EquipmentImage from "@/components/EquipmentImage";
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
  make?: string | null;
  show_make_on_card?: boolean;
  model_information?: string | null;
  show_model_on_card?: boolean;
  booking_email_extra_text?: string | null;
  completion_email_extra_text?: string | null;
  print_3d_stl_notification_email?: string | null;
  istem_portal_url?: string | null;
  istem_fbr_status_url?: string | null;
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
  results_base_location?: string | null;
  split_booking_enabled?: boolean;
  /** Nullable override: null = use user's preference on booking page. */
  auto_slot_selection_default?: boolean | null;
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
  /** After booking end time, if sample lifecycle has no update or only Sample Sent for this many hours, auto-mark as Booking Not Utilized. 0 = disabled. */
  booking_not_utilize_window_hours?: number | null;
  /** Hours after last slot end before auto Operator Unavailable (full refund) when staff engaged beyond Sample Sent. 0 = disabled. */
  operator_unavailable_after_booking_end_hours?: number | null;
  /** Show sample lifecycle countdowns on booking details. */
  show_lifecycle_countdowns?: boolean;
  /** Hours before slot start by which the sample should be submitted (0 = slot start). */
  sample_submission_lead_hours?: number | null;
  /** Hours after booking completion to collect sample before discard (0 = hide). */
  sample_collect_deadline_hours?: number | null;
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
  charge_profiles?: Array<{
    user_type: string;
    is_active?: boolean;
    require_istem_fbr?: boolean;
    show_charge_breakdown?: boolean;
    primary_unit_charge: string | number;
    secondary_unit_charge?: string | number;
    breakpoint?: string | number | null;
    time_formula?: string | null;
  }>;
  input_fields?: Array<{ field_key: string; field_label: string; field_type: string; is_required?: boolean; default_value?: string; options?: string[]; help_text?: string }>;
  print_materials?: Array<{ code: string; name: string; density_g_per_cm3?: string | number; price_per_gram: string | number; user_type?: string | null; is_active?: boolean; display_order?: number }>;
};

type StaffUserChoice = {
  id: number;
  name: string;
  email: string;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
};

type EquipmentFormChoices = {
  categories: Array<{ id: number; name: string; code?: string | null }>;
  equipment_groups: Array<{ equipment_group_id: number; name: string; code: string }>;
  internal_departments: Array<{ id: number; name: string; code: string; department_type?: string }>;
  user_groups: Array<{ id: number; name: string; code: string }>;
  managers: StaffUserChoice[];
  operators: StaffUserChoice[];
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
    make: "",
    show_make_on_card: false,
    model_information: "",
    show_model_on_card: false,
    booking_email_extra_text: "",
    completion_email_extra_text: "",
    print_3d_stl_notification_email: "",
    istem_portal_url: "",
    istem_fbr_status_url: "",
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
    results_base_location: "D:\\Results",
    split_booking_enabled: false,
    auto_slot_selection_default: null,
    weekly_view_display: 'TIME',
    weekly_view_time_from: null,
    weekly_view_time_to: null,
    weekly_view_max_rows: null,
    weekly_view_default_days: 7,
    slot_window_reference_weekday: null,
    slot_window_reference_time: null,
    waitlist_queue_depth: 0,
    max_urgent_requests: null,
    booking_not_utilize_window_hours: 24,
    operator_unavailable_after_booking_end_hours: 24,
    show_lifecycle_countdowns: true,
    sample_submission_lead_hours: 24,
    sample_collect_deadline_hours: 72,
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
    print_materials: [],
    ...initialData,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const hasEquipmentImage = !!formData.image_url && equipmentId;
  const localImagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(() => {
    return () => {
      if (localImagePreview) URL.revokeObjectURL(localImagePreview);
    };
  }, [localImagePreview]);

  /** Officers / Lab Incharge from Internal departments only; optionally match selected internal department. */
  const managersForDepartment = useMemo(() => {
    const list = choices?.managers ?? [];
    if (formData.internal_department == null) return list;
    return list.filter((m) => Number(m.department_id) === Number(formData.internal_department));
  }, [choices?.managers, formData.internal_department]);

  const operatorsForDepartment = useMemo(() => {
    const list = choices?.operators ?? [];
    if (formData.internal_department == null) return list;
    return list.filter((o) => Number(o.department_id) === Number(formData.internal_department));
  }, [choices?.operators, formData.internal_department]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChoicesLoading(true);
      setChoicesError(null);
      const [choicesRes, deptsRes] = await Promise.all([
        apiClient.getEquipmentFormChoices(),
        apiClient.getDepartments("internal"),
      ]);
      if (cancelled) return;
      if (choicesRes.error) {
        setChoicesError(choicesRes.error);
        setChoices(null);
      } else if (choicesRes.data) {
        const fromUsersDeptApi = (deptsRes.data?.departments || []).map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code || "",
          department_type: d.department_type || "internal",
        }));
        // Prefer /departments/?type=internal so department code matches users.Department.
        setChoices({
          ...choicesRes.data,
          internal_departments:
            fromUsersDeptApi.length > 0
              ? fromUsersDeptApi
              : choicesRes.data.internal_departments,
        });
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
        make: (d.make as string) ?? "",
        show_make_on_card: Boolean(d.show_make_on_card),
        model_information: (d.model_information as string) ?? "",
        show_model_on_card: Boolean(d.show_model_on_card),
        booking_email_extra_text: (d.booking_email_extra_text as string) ?? "",
        completion_email_extra_text: (d.completion_email_extra_text as string) ?? "",
        print_3d_stl_notification_email: (d.print_3d_stl_notification_email as string) ?? "",
        istem_portal_url: (d.istem_portal_url as string) ?? "",
        istem_fbr_status_url: (d.istem_fbr_status_url as string) ?? "",
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
        results_base_location: (d.results_base_location as string) ?? "D:\\Results",
        split_booking_enabled: (d.split_booking_enabled as boolean) ?? false,
        auto_slot_selection_default:
          (d.auto_slot_selection_default === true ? true : d.auto_slot_selection_default === false ? false : null) as boolean | null,
        weekly_view_display: (d.weekly_view_display === 'SLOT_ID' ? 'SLOT_ID' : 'TIME') as 'TIME' | 'SLOT_ID',
        weekly_view_time_from: (d.weekly_view_time_from != null && String(d.weekly_view_time_from).trim() !== '') ? String(d.weekly_view_time_from).slice(0, 5) : null,
        weekly_view_time_to: (d.weekly_view_time_to != null && String(d.weekly_view_time_to).trim() !== '') ? String(d.weekly_view_time_to).slice(0, 5) : null,
        weekly_view_max_rows: (d.weekly_view_max_rows != null && d.weekly_view_max_rows !== '') ? Number(d.weekly_view_max_rows) : null,
        weekly_view_default_days: (d.weekly_view_default_days != null && d.weekly_view_default_days !== '') ? Number(d.weekly_view_default_days) : 7,
        slot_window_reference_weekday: (d.slot_window_reference_weekday != null && d.slot_window_reference_weekday !== '') ? Number(d.slot_window_reference_weekday) : null,
        slot_window_reference_time: (d.slot_window_reference_time != null && String(d.slot_window_reference_time).trim() !== '') ? String(d.slot_window_reference_time).slice(0, 5) : null,
        waitlist_queue_depth: (d.waitlist_queue_depth as number | null) ?? 0,
        max_urgent_requests: (d.max_urgent_requests as number | null) ?? null,
        booking_not_utilize_window_hours: (d.booking_not_utilize_window_hours as number | null) ?? 24,
        operator_unavailable_after_booking_end_hours: (d.operator_unavailable_after_booking_end_hours as number | null) ?? 24,
        show_lifecycle_countdowns: d.show_lifecycle_countdowns !== false,
        sample_submission_lead_hours: (d.sample_submission_lead_hours as number | null) ?? 24,
        sample_collect_deadline_hours: (d.sample_collect_deadline_hours as number | null) ?? 72,
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
        charge_profiles: Array.isArray(profiles) ? profiles.map((p) => ({
          user_type: String(p.user_type ?? ""),
          is_active: p.is_active !== false,
          require_istem_fbr: Boolean(p.require_istem_fbr),
          show_charge_breakdown: p.show_charge_breakdown !== false,
          primary_unit_charge: p.primary_unit_charge ?? 0,
          secondary_unit_charge: p.secondary_unit_charge ?? 0,
          breakpoint: p.breakpoint ?? null,
          time_formula: p.time_formula ?? null,
        })) : prev.charge_profiles ?? [],
        input_fields: Array.isArray(inputs) ? inputs.map((i) => ({ field_key: String(i.field_key ?? ""), field_label: String(i.field_label ?? ""), field_type: String(i.field_type ?? "text"), is_required: i.is_required === true, default_value: String(i.default_value ?? ""), options: Array.isArray(i.options) ? i.options as string[] : [], help_text: String(i.help_text ?? "") })) : prev.input_fields ?? [],
        print_materials: Array.isArray(d.print_materials)
          ? (d.print_materials as Array<Record<string, unknown>>).map((m) => ({
              code: String(m.code ?? ""),
              name: String(m.name ?? ""),
              density_g_per_cm3: m.density_g_per_cm3 ?? "1.24",
              price_per_gram: m.price_per_gram ?? "0",
              user_type: (m.user_type as string | null) ?? null,
              is_active: m.is_active !== false,
              display_order: Number(m.display_order ?? 0),
            }))
          : prev.print_materials ?? [],
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
      make: formData.make?.trim() || "",
      show_make_on_card: Boolean(formData.show_make_on_card),
      model_information: formData.model_information?.trim() || "",
      show_model_on_card: Boolean(formData.show_model_on_card),
      booking_email_extra_text: formData.booking_email_extra_text?.trim() || "",
      completion_email_extra_text: formData.completion_email_extra_text?.trim() || "",
      print_3d_stl_notification_email: formData.print_3d_stl_notification_email?.trim() || "",
      istem_portal_url: formData.istem_portal_url?.trim() || "",
      istem_fbr_status_url: formData.istem_fbr_status_url?.trim() || "",
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
      results_base_location:
        formData.results_base_location && formData.results_base_location.trim() !== ""
          ? formData.results_base_location.trim()
          : "D:\\Results",
      split_booking_enabled: formData.split_booking_enabled,
      auto_slot_selection_default:
        formData.auto_slot_selection_default === true ? true : formData.auto_slot_selection_default === false ? false : null,
      weekly_view_display: formData.weekly_view_display ?? 'TIME',
      weekly_view_time_from: formData.weekly_view_time_from && formData.weekly_view_time_from.trim() !== '' ? formData.weekly_view_time_from.trim() : null,
      weekly_view_time_to: formData.weekly_view_time_to && formData.weekly_view_time_to.trim() !== '' ? formData.weekly_view_time_to.trim() : null,
      weekly_view_max_rows: formData.weekly_view_max_rows != null && formData.weekly_view_max_rows !== '' ? formData.weekly_view_max_rows : null,
      weekly_view_default_days: formData.weekly_view_default_days != null && formData.weekly_view_default_days !== '' ? formData.weekly_view_default_days : null,
      slot_window_reference_weekday: formData.slot_window_reference_weekday != null && formData.slot_window_reference_weekday !== '' ? formData.slot_window_reference_weekday : null,
      slot_window_reference_time: formData.slot_window_reference_time && formData.slot_window_reference_time.trim() !== '' ? formData.slot_window_reference_time.trim() : null,
      waitlist_queue_depth: formData.waitlist_queue_depth ?? 0,
      max_urgent_requests: formData.max_urgent_requests != null && formData.max_urgent_requests !== '' ? (typeof formData.max_urgent_requests === 'number' ? formData.max_urgent_requests : parseInt(String(formData.max_urgent_requests), 10)) : null,
      booking_not_utilize_window_hours:
        formData.booking_not_utilize_window_hours != null && formData.booking_not_utilize_window_hours !== ''
          ? (typeof formData.booking_not_utilize_window_hours === 'number'
              ? formData.booking_not_utilize_window_hours
              : parseInt(String(formData.booking_not_utilize_window_hours), 10))
          : 24,
      operator_unavailable_after_booking_end_hours:
        formData.operator_unavailable_after_booking_end_hours != null && formData.operator_unavailable_after_booking_end_hours !== ''
          ? (typeof formData.operator_unavailable_after_booking_end_hours === 'number'
              ? formData.operator_unavailable_after_booking_end_hours
              : parseInt(String(formData.operator_unavailable_after_booking_end_hours), 10))
          : 24,
      show_lifecycle_countdowns: formData.show_lifecycle_countdowns !== false,
      sample_submission_lead_hours:
        formData.sample_submission_lead_hours != null && formData.sample_submission_lead_hours !== ''
          ? (typeof formData.sample_submission_lead_hours === 'number'
              ? formData.sample_submission_lead_hours
              : parseInt(String(formData.sample_submission_lead_hours), 10))
          : 24,
      sample_collect_deadline_hours:
        formData.sample_collect_deadline_hours != null && formData.sample_collect_deadline_hours !== ''
          ? (typeof formData.sample_collect_deadline_hours === 'number'
              ? formData.sample_collect_deadline_hours
              : parseInt(String(formData.sample_collect_deadline_hours), 10))
          : 72,
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
      print_materials: formData.print_materials ?? [],
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
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8 py-4 text-base">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Basic information</h3>
            <p className="text-sm text-muted-foreground">Name, code, category, visibility and status.</p>
          </div>
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
            onValueChange={(v) => {
              const nextDept = v === "none" ? null : parseInt(v, 10);
              setFormData((p) => {
                const mgrIds = new Set(
                  (choices?.managers ?? [])
                    .filter(
                      (m) =>
                        nextDept == null || Number(m.department_id) === Number(nextDept)
                    )
                    .map((m) => m.id)
                );
                const opIds = new Set(
                  (choices?.operators ?? [])
                    .filter(
                      (o) =>
                        nextDept == null || Number(o.department_id) === Number(nextDept)
                    )
                    .map((o) => o.id)
                );
                return {
                  ...p,
                  internal_department: nextDept,
                  equipment_managers: (p.equipment_managers ?? []).filter((m) => mgrIds.has(m.manager)),
                  equipment_operators: (p.equipment_operators ?? []).filter((o) => opIds.has(o.operator)),
                };
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Internal department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {choices.internal_departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name} {d.code ? `(${d.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Only departments with type Internal are listed. Officer In Charge / Lab Incharge below are limited to users in Internal departments.
          </p>
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

      {formData.profile_type === "PRINT_3D" && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-2 max-w-xl">
            <Label htmlFor="print-3d-stl-notification-email">STL notification email</Label>
            <Input
              id="print-3d-stl-notification-email"
              type="email"
              value={formData.print_3d_stl_notification_email ?? ""}
              onChange={(e) =>
                setFormData((p) => ({ ...p, print_3d_stl_notification_email: e.target.value }))
              }
              placeholder="lab@example.com"
            />
            <p className="text-xs text-muted-foreground">
              When a booking is confirmed, the user&apos;s STL file(s) and booking details are sent to this address.
              Leave empty to disable.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">3D print materials</h3>
              <p className="text-sm text-muted-foreground">Filament catalog with dynamic price per gram.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  print_materials: [
                    ...(p.print_materials ?? []),
                    { code: "", name: "", density_g_per_cm3: "1.24", price_per_gram: "2.5", is_active: true, display_order: (p.print_materials?.length ?? 0) },
                  ],
                }))
              }
            >
              Add material
            </Button>
          </div>
          {(formData.print_materials ?? []).map((mat, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-8 border rounded-md p-3 items-center">
              <Input placeholder="Code" value={mat.code} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], code: e.target.value }; return { ...p, print_materials: rows }; })} />
              <Input placeholder="Name" value={mat.name} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], name: e.target.value }; return { ...p, print_materials: rows }; })} />
              <Input placeholder="Density" type="number" step="0.001" value={String(mat.density_g_per_cm3 ?? "")} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], density_g_per_cm3: e.target.value }; return { ...p, print_materials: rows }; })} />
              <Input placeholder="₹/gram" type="number" step="0.01" value={String(mat.price_per_gram ?? "")} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], price_per_gram: e.target.value }; return { ...p, print_materials: rows }; })} />
              <Input
                placeholder="Order"
                type="number"
                step="1"
                value={String(mat.display_order ?? 0)}
                onChange={(e) =>
                  setFormData((p) => {
                    const rows = [...(p.print_materials ?? [])];
                    const n = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                    rows[idx] = { ...rows[idx], display_order: Number.isFinite(n) ? n : 0 };
                    return { ...p, print_materials: rows };
                  })
                }
              />
              <Select
                value={(mat.user_type ?? "") || ""}
                onValueChange={(value) =>
                  setFormData((p) => {
                    const rows = [...(p.print_materials ?? [])];
                    rows[idx] = { ...rows[idx], user_type: value ? value : null };
                    return { ...p, print_materials: rows };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="User type (all)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All user types</SelectItem>
                  {(choices?.user_type_choices ?? []).map((ut) => (
                    <SelectItem key={ut.value} value={ut.value}>
                      {ut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={mat.is_active !== false}
                  onCheckedChange={(checked) =>
                    setFormData((p) => {
                      const rows = [...(p.print_materials ?? [])];
                      rows[idx] = { ...rows[idx], is_active: checked === true };
                      return { ...p, print_materials: rows };
                    })
                  }
                  aria-label="Enable material"
                />
                <span className="text-xs text-muted-foreground">Enabled</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFormData((p) => ({ ...p, print_materials: (p.print_materials ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))}
        </div>
      )}

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

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Catalog card — Make &amp; Model</h3>
      <p className="text-muted-foreground text-xs">Optional manufacturer and model lines on equipment catalog cards, below department.</p>
      <div className="space-y-2">
        <Label htmlFor="equipment-make">Make</Label>
        <Input
          id="equipment-make"
          value={formData.make ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, make: e.target.value }))}
          placeholder='e.g. Zeiss, Thermo Fisher'
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="equipment-show-make-on-card"
          checked={Boolean(formData.show_make_on_card)}
          onCheckedChange={(checked) =>
            setFormData((p) => ({ ...p, show_make_on_card: checked === true }))
          }
        />
        <Label htmlFor="equipment-show-make-on-card" className="text-sm font-normal cursor-pointer">
          Show Make on equipment catalog card
        </Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="equipment-model-information">Model</Label>
        <Input
          id="equipment-model-information"
          value={formData.model_information ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, model_information: e.target.value }))}
          placeholder='e.g. Sigma 300, FE-SEM'
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="equipment-show-model-on-card"
          checked={Boolean(formData.show_model_on_card)}
          onCheckedChange={(checked) =>
            setFormData((p) => ({ ...p, show_model_on_card: checked === true }))
          }
        />
        <Label htmlFor="equipment-show-model-on-card" className="text-sm font-normal cursor-pointer">
          Show Model on equipment catalog card
        </Label>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Booking &amp; completion emails</h3>
      <p className="text-muted-foreground text-xs">
        Optional extra text per equipment. Completion email text is appended when a booking is marked complete; paste URLs for clickable links in HTML mail.
      </p>
      <div className="space-y-2">
        <Label htmlFor="booking-email-extra">Extra text — booking confirmation &amp; reminders</Label>
        <Textarea
          id="booking-email-extra"
          value={formData.booking_email_extra_text ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, booking_email_extra_text: e.target.value }))}
          rows={3}
          placeholder="Plain text appended to booking confirmation and reminder emails"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="completion-email-extra">Extra text — completion email</Label>
        <Textarea
          id="completion-email-extra"
          value={formData.completion_email_extra_text ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, completion_email_extra_text: e.target.value }))}
          rows={3}
          placeholder="Appended when booking is completed. Example: Download results from https://..."
        />
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">I-STEM portal</h3>
      <p className="text-muted-foreground text-xs">
        Configure separate links for booking users and for OIC/Admin FBR verification.
      </p>
      <div className="space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="istem-portal-url">I-STEM booking page URL (for users)</Label>
          <Input
            id="istem-portal-url"
            type="url"
            value={formData.istem_portal_url ?? ""}
            onChange={(e) => setFormData((p) => ({ ...p, istem_portal_url: e.target.value }))}
            placeholder="https://www.istem.gov.in/..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="istem-fbr-status-url">I-STEM FBR status check URL (for OIC / Admin)</Label>
          <Input
            id="istem-fbr-status-url"
            type="url"
            value={formData.istem_fbr_status_url ?? ""}
            onChange={(e) => setFormData((p) => ({ ...p, istem_fbr_status_url: e.target.value }))}
            placeholder="https://www.istem.gov.in/.../fbr-status"
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Charge profiles</h3>
      <p className="text-muted-foreground text-xs">
        Per user-type pricing. Enable <strong>Require I-STEM FBR</strong> when that user type must submit and verify an I-STEM Facility Booking Record.
        <strong> Show charge breakdown</strong> is on by default; uncheck to hide the itemized breakdown in Charge Calculation.
      </p>
      <div className="rounded border divide-y">
        {(formData.charge_profiles ?? []).length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No charge profiles yet. Add rows below or save equipment first in Django admin.</p>
        ) : (
          (formData.charge_profiles ?? []).map((cp, idx) => {
            const label =
              (choices.user_type_choices ?? []).find((c) => c.value === cp.user_type)?.label || cp.user_type;
            return (
              <div key={`${cp.user_type}-${idx}`} className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-end">
                <div className="space-y-1">
                  <Label>User type</Label>
                  <p className="text-sm font-medium">{label}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cp-primary-${idx}`}>Primary charge</Label>
                  <Input
                    id={`cp-primary-${idx}`}
                    type="number"
                    step="0.01"
                    value={String(cp.primary_unit_charge ?? "")}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.charge_profiles ?? [])];
                        arr[idx] = { ...arr[idx], primary_unit_charge: e.target.value };
                        return { ...p, charge_profiles: arr };
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`cp-active-${idx}`}
                    checked={cp.is_active !== false}
                    onCheckedChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.charge_profiles ?? [])];
                        arr[idx] = { ...arr[idx], is_active: v === true };
                        return { ...p, charge_profiles: arr };
                      })
                    }
                  />
                  <Label htmlFor={`cp-active-${idx}`} className="text-sm font-normal">Active</Label>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`cp-istem-${idx}`}
                    checked={Boolean(cp.require_istem_fbr)}
                    onCheckedChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.charge_profiles ?? [])];
                        arr[idx] = { ...arr[idx], require_istem_fbr: v === true };
                        return { ...p, charge_profiles: arr };
                      })
                    }
                  />
                  <Label htmlFor={`cp-istem-${idx}`} className="text-sm font-normal">Require I-STEM FBR</Label>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`cp-breakdown-${idx}`}
                    checked={cp.show_charge_breakdown !== false}
                    onCheckedChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.charge_profiles ?? [])];
                        arr[idx] = { ...arr[idx], show_charge_breakdown: v === true };
                        return { ...p, charge_profiles: arr };
                      })
                    }
                  />
                  <Label htmlFor={`cp-breakdown-${idx}`} className="text-sm font-normal">Show charge breakdown</Label>
                </div>
              </div>
            );
          })
        )}
      </div>
      {(choices.user_type_choices ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Select
            value="__add__"
            onValueChange={(v) => {
              if (!v || v === "__add__") return;
              if ((formData.charge_profiles ?? []).some((cp) => cp.user_type === v)) return;
              setFormData((p) => ({
                ...p,
                charge_profiles: [
                  ...(p.charge_profiles ?? []),
                  {
                    user_type: v,
                    is_active: true,
                    require_istem_fbr: false,
                    show_charge_breakdown: true,
                    primary_unit_charge: 0,
                    secondary_unit_charge: 0,
                  },
                ],
              }));
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Add charge profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__add__" disabled>Add charge profile</SelectItem>
              {(choices.user_type_choices ?? [])
                .filter((c) => !(formData.charge_profiles ?? []).some((cp) => cp.user_type === c.value))
                .map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <h3 className="text-sm font-semibold border-b pb-2 pt-2">Image</h3>
      <p className="text-muted-foreground text-xs">Upload a new image or view the current one. Images are stored in S3 and displayed via a stable URL.</p>
      {formData.image_url || imageFile ? (
        <div className="rounded border p-2">
          {localImagePreview ? (
            <img
              src={localImagePreview}
              alt="Equipment preview"
              className="max-h-32 object-contain"
            />
          ) : (
            <EquipmentImage
              equipmentId={equipmentId ?? null}
              enabled={!!hasEquipmentImage}
              alt="Equipment"
              className="max-h-32 object-contain"
            />
          )}
        </div>
      ) : null}
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
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="results-base-location">Results base location</Label>
          <Input
            id="results-base-location"
            type="text"
            placeholder="D:\\Results"
            value={formData.results_base_location ?? "D:\\Results"}
            onChange={(e) => setFormData((p) => ({ ...p, results_base_location: e.target.value }))}
          />
          <p className="text-muted-foreground text-xs">
            Used when Sample Lifecycle changes to In Analysis. Folder structure:
            Equipment Code → Internal/External → Year → Department → User → Booking ID.
          </p>
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
        <div className="space-y-2">
          <Label htmlFor="booking-not-utilize-window-hours">Booking Not Utilize Window (hours)</Label>
          <Input
            id="booking-not-utilize-window-hours"
            type="number"
            min={0}
            placeholder="Default 24, 0 = disabled"
            value={formData.booking_not_utilize_window_hours ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFormData((p) => ({
                ...p,
                booking_not_utilize_window_hours: v === "" ? 24 : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
          />
          <p className="text-muted-foreground text-xs">
            Hours after the last slot ends before Lab/OIC/Admin may mark Booking Not Utilized (no refund), only when lifecycle has no update or only &quot;Sample Sent&quot;. Set to 0 to hide this action for this equipment.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operator-unavailable-after-booking-end-hours">Auto Operator Unavailable (hours after booking end)</Label>
          <Input
            id="operator-unavailable-after-booking-end-hours"
            type="number"
            min={0}
            placeholder="Default 24, 0 = disabled"
            value={formData.operator_unavailable_after_booking_end_hours ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFormData((p) => ({
                ...p,
                operator_unavailable_after_booking_end_hours: v === "" ? 24 : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
          />
          <p className="text-muted-foreground text-xs">
            After the last slot ends, if the booking is still open and lifecycle shows staff work beyond &quot;Sample Sent&quot; but the run is not finished (not analyzed/returned/archived/disposed), the system auto-marks Operator Unavailable (full refund) after this many hours. Set to 0 to disable. User no-shows use manual Booking Not Utilized.
          </p>
        </div>
        <div className="space-y-3 sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-lifecycle-countdowns"
              checked={formData.show_lifecycle_countdowns !== false}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, show_lifecycle_countdowns: !!checked }))
              }
            />
            <Label htmlFor="show-lifecycle-countdowns">Show sample lifecycle countdowns on booking details</Label>
          </div>
          <p className="text-muted-foreground text-xs">
            Shows: time to submit sample (before Sample Accepted), booking time to slot end (after Sample Accepted),
            and time to collect sample (after booking completed).
          </p>
          {formData.show_lifecycle_countdowns !== false && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sample-submission-lead-hours">Sample submission lead time (hours before slot start)</Label>
                <Input
                  id="sample-submission-lead-hours"
                  type="number"
                  min={0}
                  placeholder="Default 24"
                  value={formData.sample_submission_lead_hours ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setFormData((p) => ({
                      ...p,
                      sample_submission_lead_hours: v === "" ? 24 : Math.max(0, parseInt(v, 10) || 0),
                    }));
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Users should submit samples this many hours before the slot starts. Atmosphere-sensitive bookings may submit at slot start. 0 = deadline is slot start.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sample-collect-deadline-hours">Collect / discard deadline (hours after completion)</Label>
                <Input
                  id="sample-collect-deadline-hours"
                  type="number"
                  min={0}
                  placeholder="Default 72"
                  value={formData.sample_collect_deadline_hours ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setFormData((p) => ({
                      ...p,
                      sample_collect_deadline_hours: v === "" ? 72 : Math.max(0, parseInt(v, 10) || 0),
                    }));
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  After booking completion, hours remaining to collect the sample before discard. 0 = hide this countdown.
                </p>
              </div>
            </div>
          )}
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

      <div className="space-y-2 max-w-sm">
        <Label>Auto Slot Selection default (override)</Label>
        <Select
          value={
            formData.auto_slot_selection_default === true
              ? "true"
              : formData.auto_slot_selection_default === false
                ? "false"
                : "null"
          }
          onValueChange={(v) =>
            setFormData((p) => ({
              ...p,
              auto_slot_selection_default: v === "true" ? true : v === "false" ? false : null,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Use user's preference" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">Use user preference</SelectItem>
            <SelectItem value="true">Enabled by default</SelectItem>
            <SelectItem value="false">Disabled by default</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Controls the default state of the booking page toggle for this equipment. When unset, the user&apos;s profile preference is used.
        </p>
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
      <p className="text-muted-foreground text-xs">
        Officer In Charge users belonging to Internal departments
        {formData.internal_department != null ? " (preferentially matching the selected department)" : ""}.
      </p>
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
            {managersForDepartment.filter((m) => !(formData.equipment_managers ?? []).some((x) => x.manager === m.id)).map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name || m.email} ({m.email})
                {m.department_name
                  ? ` — ${m.department_name}${m.department_code ? ` (${m.department_code})` : ""}`
                  : ""}
              </SelectItem>
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
      <p className="text-muted-foreground text-xs">
        Lab Incharge users belonging to Internal departments
        {formData.internal_department != null ? " (preferentially matching the selected department)" : ""}.
      </p>
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
            {operatorsForDepartment.filter((o) => !(formData.equipment_operators ?? []).some((x) => x.operator === o.id)).map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name || o.email} ({o.email})
                {o.department_name
                  ? ` — ${o.department_name}${o.department_code ? ` (${o.department_code})` : ""}`
                  : ""}
              </SelectItem>
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
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-base font-semibold">Timestamps</h3>
            <p className="text-sm text-muted-foreground">
              Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} · Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}
            </p>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {equipmentId ? `Editing equipment #${equipmentId}` : "Creating new equipment"}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
