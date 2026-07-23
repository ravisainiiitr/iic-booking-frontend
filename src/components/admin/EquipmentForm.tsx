import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { linesToOptions, normalizeOptionsList, optionsToLines } from "@/lib/dynamicFieldOptions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Collapsible card matching Django Admin's fieldset grouping, in the app's own visual language. */
function FormSection({
  id,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border scroll-mt-4" id={id}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-start justify-between gap-3 p-4 text-left rounded-lg hover:bg-muted/40 transition-colors"
        >
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4 data-[state=open]:animate-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

const EQUIPMENT_SECTION_NAV: Array<{ id: string; label: string }> = [
  { id: "eq-sec-basic", label: "Basic" },
  { id: "eq-sec-instruction", label: "Instruction" },
  { id: "eq-sec-emails", label: "Emails" },
  { id: "eq-sec-media", label: "Image/Video" },
  { id: "eq-sec-slots", label: "Slot config" },
  { id: "eq-sec-managers", label: "OIC" },
  { id: "eq-sec-operators", label: "Operators" },
  { id: "eq-sec-specs", label: "Specs" },
  { id: "eq-sec-accessories", label: "Accessories" },
  { id: "eq-sec-inputs", label: "Dynamic fields" },
  { id: "eq-sec-slot-masters", label: "Slot masters" },
  { id: "eq-sec-charges", label: "Charges" },
];

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
  parent_equipment?: number | null;
  /** When true, this base instrument can have child modes and mode schedules. Default false. */
  enable_multi_mode?: boolean;
  internal_department?: number | null;
  visibility_group?: number | null;
  slot_duration_minutes?: number;
  slot_tolerance_minutes?: number;
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
  /** % of the week's bookable slots (snapshotted) that external users may book. 0 = externals cannot book. */
  external_slot_quota_percent?: number;
  /** Max waitlist length for this equipment (0 = disabled). Set when creating/editing equipment. */
  waitlist_queue_depth?: number | null;
  /** Max PENDING urgent requests for this equipment at a time. Leave empty for no cap. Admin and OIC. */
  max_urgent_requests?: number | null;
  /** After booking end time, if sample lifecycle has no update or only Sample Sent for this many hours, auto-mark as Booking Not Utilized. 0 = disabled. */
  booking_not_utilize_window_hours?: number | null;
  /** Hours after last slot end before auto Operator Unavailable (full refund) when staff engaged beyond Sample Sent. 0 = disabled. */
  operator_unavailable_after_booking_end_hours?: number | null;
  skip_quota_check?: boolean;
  enable_charge_recalculation?: boolean;
  user_rating_enabled?: boolean;
  sample_preparation_by_user?: boolean;
  urgent_peak_window_minutes?: number | null;
  operator_absent_disruption_after_booking_end_hours?: number | null;
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
  equipment_operators?: Array<{ operator: number; role?: 'PRIMARY' | 'SECONDARY' }>;
  equipment_specifications?: Array<{ spec_key: string; spec_value?: string }>;
  equipment_accessories?: Array<{ accessory_name: string; is_optional?: boolean; is_enabled?: boolean }>;
  equipment_additional_accessories?: Array<{ additional_accessory_name: string; additional_accessory_description?: string; is_optional?: boolean; is_enabled?: boolean }>;
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
  input_fields?: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    is_required?: boolean;
    editing_required?: boolean;
    default_value?: string;
    options?: string[] | Record<string, unknown>;
    /** When true (NUMERIC), negative values are allowed within configured limits. */
    allow_negative?: boolean;
    help_text?: string;
    source_element_field_key?: string | null;
  }>;
  print_materials?: Array<{ code: string; name: string; density_g_per_cm3?: string | number; price_per_gram: string | number; user_type?: string | null; is_active?: boolean; display_order?: number }>;
  /** MULTI_PARAM slot options (Django MultiParamDefinition / slot_options). */
  param_definitions?: Array<{
    user_type?: string | null;
    param_name: string;
    param_code: string;
    unit_time_minutes: number | string;
    unit_charge: number | string;
    is_active?: boolean;
  }>;
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
  parent_equipment_choices?: Array<{ equipment_id: number; code: string; name: string }>;
  internal_departments: Array<{ id: number; name: string; code: string; department_type?: string }>;
  user_groups: Array<{ id: number; name: string; code: string }>;
  managers: StaffUserChoice[];
  operators: StaffUserChoice[];
  profile_type_choices: Array<{ value: string; label: string }>;
  status_choices: Array<{ value: string; label: string }>;
  user_type_choices?: Array<{ value: string; label: string }>;
  dynamic_input_field_type_choices?: Array<{ value: string; label: string }>;
};

const DYNAMIC_INPUT_FIELD_KEYS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

type Props = {
  initialData?: EquipmentFormData | Record<string, unknown> | null;
  equipmentId?: number | null;
  onSave: (
    data: EquipmentFormData,
    options?: { imageFile?: File; videoFile?: File; clearImage?: boolean; clearVideo?: boolean },
  ) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

export function EquipmentForm({ initialData, equipmentId, onSave, onCancel, saving }: Props) {
  const { user } = useAuth();
  const userTypeStr = String(user?.user_type ?? "").toLowerCase();
  const isDeptAdmin = userTypeStr === "dept_admin";
  const lockDepartmentId =
    isDeptAdmin && equipmentId == null && user?.department != null
      ? Number(user.department)
      : null;
  const isDeptAdminPendingCreate = lockDepartmentId != null;

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
    parent_equipment: null,
    enable_multi_mode: false,
    internal_department: null,
    visibility_group: null,
    slot_duration_minutes: 30,
    slot_tolerance_minutes: 0,
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
    external_slot_quota_percent: 0,
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
    param_definitions: [],
    ...initialData,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [clearVideo, setClearVideo] = useState(false);
  const [addLookupOpen, setAddLookupOpen] = useState<null | "category" | "group">(null);
  const [addLookupName, setAddLookupName] = useState("");
  const [addLookupCode, setAddLookupCode] = useState("");
  const [addLookupSaving, setAddLookupSaving] = useState(false);

  // Dept Admin create: force Internal Department to their assigned department.
  useEffect(() => {
    if (lockDepartmentId == null) return;
    setFormData((p) =>
      p.internal_department === lockDepartmentId
        ? p
        : { ...p, internal_department: lockDepartmentId }
    );
  }, [lockDepartmentId]);

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

  const openAddLookup = (kind: "category" | "group") => {
    setAddLookupName("");
    setAddLookupCode("");
    setAddLookupOpen(kind);
  };

  const saveAddLookup = async () => {
    if (!addLookupOpen) return;
    const name = addLookupName.trim();
    const code = addLookupCode.trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    if (addLookupOpen === "group" && !code) {
      toast.error("Code is required for an equipment group.");
      return;
    }
    setAddLookupSaving(true);
    try {
      if (addLookupOpen === "category") {
        const res = await apiClient.adminCreate<{ id: number; name: string; code?: string | null }>(
          "equipmentCategories",
          { name, code: code || null, description: "" }
        );
        if (res.error || !res.data) {
          toast.error(res.error || "Failed to create category.");
          return;
        }
        const created = res.data;
        setChoices((prev) =>
          prev
            ? {
                ...prev,
                categories: [
                  ...prev.categories,
                  { id: created.id, name: created.name, code: created.code ?? null },
                ],
              }
            : prev
        );
        setFormData((p) => ({ ...p, category: created.id }));
        toast.success("Category added.");
      } else {
        const res = await apiClient.adminCreate<{
          equipment_group_id: number;
          name: string;
          code: string;
        }>("equipmentGroups", { name, code, description: "" });
        if (res.error || !res.data) {
          toast.error(res.error || "Failed to create equipment group.");
          return;
        }
        const created = res.data;
        setChoices((prev) =>
          prev
            ? {
                ...prev,
                equipment_groups: [
                  ...prev.equipment_groups,
                  {
                    equipment_group_id: created.equipment_group_id,
                    name: created.name,
                    code: created.code,
                  },
                ],
              }
            : prev
        );
        setFormData((p) => ({ ...p, equipment_group: created.equipment_group_id }));
        toast.success("Equipment group added.");
      }
      setAddLookupOpen(null);
    } finally {
      setAddLookupSaving(false);
    }
  };

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
      const operators = (d.operators || d.equipment_operators || []) as Array<{ operator: number; role?: string }>;
      const specs = (d.specifications || d.equipment_specifications || []) as Array<{ spec_key: string; spec_value?: string }>;
      const accessories = (d.accessories || d.equipment_accessories || []) as Array<{ accessory_name: string; is_optional?: boolean; is_enabled?: boolean }>;
      const addAccessories = (d.additional_accessories || d.equipment_additional_accessories || []) as Array<{ additional_accessory_name: string; additional_accessory_description?: string; is_optional?: boolean; is_enabled?: boolean }>;
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
        parent_equipment: (d.parent_equipment as number | null) ?? (d.parent_equipment_id as number | null) ?? null,
        enable_multi_mode: d.enable_multi_mode === true,
        internal_department: (d.internal_department as number | null) ?? null,
        visibility_group: (d.visibility_group as number | null) ?? null,
        slot_duration_minutes: (d.slot_duration_minutes as number) ?? 30,
        slot_tolerance_minutes: Math.max(0, Number(d.slot_tolerance_minutes ?? 0) || 0),
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
        external_slot_quota_percent:
          d.external_slot_quota_percent != null && d.external_slot_quota_percent !== ''
            ? Math.min(100, Math.max(0, Number(d.external_slot_quota_percent)))
            : 0,
        waitlist_queue_depth: (d.waitlist_queue_depth as number | null) ?? 0,
        max_urgent_requests: (d.max_urgent_requests as number | null) ?? null,
        booking_not_utilize_window_hours: (d.booking_not_utilize_window_hours as number | null) ?? 24,
        operator_unavailable_after_booking_end_hours: (d.operator_unavailable_after_booking_end_hours as number | null) ?? 24,
        skip_quota_check: d.skip_quota_check === true,
        enable_charge_recalculation: d.enable_charge_recalculation === true,
        user_rating_enabled: d.user_rating_enabled !== false,
        sample_preparation_by_user: d.sample_preparation_by_user === true,
        urgent_peak_window_minutes: (d.urgent_peak_window_minutes as number | null) ?? null,
        operator_absent_disruption_after_booking_end_hours:
          (d.operator_absent_disruption_after_booking_end_hours as number | null) ?? null,
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
        equipment_operators: Array.isArray(operators) ? operators.map((o) => ({ operator: typeof o.operator === "number" ? o.operator : (o as Record<string, unknown>).operator as number, role: o.role === "SECONDARY" ? "SECONDARY" : "PRIMARY" })) : prev.equipment_operators ?? [],
        equipment_specifications: Array.isArray(specs) ? specs.map((s) => ({ spec_key: s.spec_key ?? "", spec_value: s.spec_value ?? "" })) : prev.equipment_specifications ?? [],
        equipment_accessories: Array.isArray(accessories) ? accessories.map((a) => ({ accessory_name: a.accessory_name ?? "", is_optional: a.is_optional ?? false, is_enabled: a.is_enabled !== false })) : prev.equipment_accessories ?? [],
        equipment_additional_accessories: Array.isArray(addAccessories) ? addAccessories.map((a) => ({ additional_accessory_name: a.additional_accessory_name ?? "", additional_accessory_description: a.additional_accessory_description ?? "", is_optional: a.is_optional ?? false, is_enabled: a.is_enabled !== false })) : prev.equipment_additional_accessories ?? [],
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
        input_fields: Array.isArray(inputs) ? inputs.map((i) => {
          const rawOpts = i.options;
          const optsObj =
            rawOpts && typeof rawOpts === "object" && !Array.isArray(rawOpts)
              ? (rawOpts as Record<string, unknown>)
              : null;
          const allowNeg =
            optsObj != null &&
            (optsObj.allow_negative === true ||
              optsObj.allowNegative === true ||
              String(optsObj.allow_negative ?? "").toLowerCase() === "true");
          return {
            field_key: String(i.field_key ?? ""),
            field_label: String(i.field_label ?? ""),
            field_type: String(i.field_type ?? "TEXT"),
            is_required: i.is_required === true,
            editing_required: i.editing_required === true,
            default_value: String(i.default_value ?? ""),
            options: Array.isArray(rawOpts)
              ? normalizeOptionsList(rawOpts)
              : optsObj
                ? optsObj
                : [],
            allow_negative: allowNeg,
            help_text: String(i.help_text ?? ""),
            source_element_field_key: (i.source_element_field_key as string | null) ?? null,
          };
        }) : prev.input_fields ?? [],
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
        param_definitions: Array.isArray(d.slot_options || d.param_definitions)
          ? ((d.slot_options || d.param_definitions) as Array<Record<string, unknown>>).map((row) => ({
              user_type: (row.user_type as string | null) ?? null,
              param_name: String(row.param_name ?? ""),
              param_code: String(row.param_code ?? ""),
              unit_time_minutes: row.unit_time_minutes ?? 0,
              unit_charge: row.unit_charge ?? 0,
              is_active: row.is_active !== false,
            }))
          : prev.param_definitions ?? [],
      }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Name is required.");
      return;
    }
    const inputFields = formData.input_fields ?? [];
    for (let i = 0; i < inputFields.length; i++) {
      const key = String(inputFields[i].field_key || "").trim().toUpperCase();
      const label = String(inputFields[i].field_label || "").trim();
      if (!/^[A-Z]$/.test(key)) {
        toast.error(`Dynamic input field #${i + 1}: Field key must be a single letter A–Z.`);
        return;
      }
      if (!label) {
        toast.error(`Dynamic input field ${key}: Field label is required.`);
        return;
      }
    }
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
      parent_equipment: formData.parent_equipment ?? null,
      enable_multi_mode: formData.enable_multi_mode === true,
      internal_department: formData.internal_department ?? null,
      visibility_group: formData.visibility_group ?? null,
      slot_duration_minutes: formData.slot_duration_minutes,
      slot_tolerance_minutes: Math.max(0, Number(formData.slot_tolerance_minutes ?? 0) || 0),
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
      external_slot_quota_percent:
        formData.external_slot_quota_percent != null && formData.external_slot_quota_percent !== ''
          ? Math.min(100, Math.max(0, Number(formData.external_slot_quota_percent)))
          : 0,
      waitlist_queue_depth: formData.waitlist_queue_depth ?? 0,
      max_urgent_requests: formData.max_urgent_requests != null && formData.max_urgent_requests !== '' ? (typeof formData.max_urgent_requests === 'number' ? formData.max_urgent_requests : parseInt(String(formData.max_urgent_requests), 10)) : null,
      booking_not_utilize_window_hours:
        formData.booking_not_utilize_window_hours != null && formData.booking_not_utilize_window_hours !== ''
          ? (typeof formData.booking_not_utilize_window_hours === 'number'
              ? formData.booking_not_utilize_window_hours
              : parseInt(String(formData.booking_not_utilize_window_hours), 10))
          : 24,
      skip_quota_check: formData.skip_quota_check === true,
      enable_charge_recalculation: formData.enable_charge_recalculation === true,
      user_rating_enabled: formData.user_rating_enabled !== false,
      sample_preparation_by_user: formData.sample_preparation_by_user === true,
      urgent_peak_window_minutes:
        formData.urgent_peak_window_minutes != null && formData.urgent_peak_window_minutes !== ""
          ? Number(formData.urgent_peak_window_minutes)
          : null,
      operator_absent_disruption_after_booking_end_hours:
        formData.operator_absent_disruption_after_booking_end_hours != null &&
        formData.operator_absent_disruption_after_booking_end_hours !== ""
          ? Number(formData.operator_absent_disruption_after_booking_end_hours)
          : null,
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
      input_fields: (formData.input_fields ?? []).map((f) => {
        const fieldType = String(f.field_type || "").toUpperCase();
        const field_key = String(f.field_key || "").trim().toUpperCase().slice(0, 1);
        const field_label = String(f.field_label || "").trim();
        const source_element_field_key = f.source_element_field_key
          ? String(f.source_element_field_key).trim().toUpperCase().slice(0, 1) || null
          : null;
        if (fieldType === "NUMERIC") {
          const base =
            f.options && typeof f.options === "object" && !Array.isArray(f.options)
              ? { ...(f.options as Record<string, unknown>) }
              : ({} as Record<string, unknown>);
          if (f.allow_negative) base.allow_negative = true;
          else delete base.allow_negative;
          return {
            ...f,
            field_key,
            field_label,
            source_element_field_key,
            options: Object.keys(base).length > 0 ? base : [],
          };
        }
        return {
          ...f,
          field_key,
          field_label,
          source_element_field_key,
          options: normalizeOptionsList(f.options),
        };
      }),
      print_materials: formData.print_materials ?? [],
      param_definitions: (formData.param_definitions ?? []).map((row) => ({
        user_type: row.user_type || null,
        param_name: row.param_name,
        param_code: row.param_code,
        unit_time_minutes:
          typeof row.unit_time_minutes === "number"
            ? row.unit_time_minutes
            : parseInt(String(row.unit_time_minutes || "0"), 10) || 0,
        unit_charge: row.unit_charge,
        is_active: row.is_active !== false,
      })),
    };
    onSave(payload, {
      imageFile: imageFile ?? undefined,
      videoFile: videoFile ?? undefined,
      clearImage: clearImage && !imageFile,
      clearVideo: clearVideo && !videoFile,
    });
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
    <form onSubmit={handleSubmit} className="h-full min-h-0 flex flex-col">
      {isDeptAdminPendingCreate ? (
        <div className="mx-0 mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          This equipment will be submitted for <strong>Main Admin approval</strong> and will not
          become active until approved. Your Internal Department is fixed to your assigned
          department.
        </div>
      ) : null}
      <div className="shrink-0 z-10 py-2 bg-background border-b mb-1">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Jump to section — dialog is scrollable; use these to open each Django Admin block
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_SECTION_NAV.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const container = document.getElementById("equipment-form-scroll");
                const el = document.getElementById(item.id);
                if (!el) return;
                const trigger = el.querySelector("button");
                if (trigger instanceof HTMLButtonElement && trigger.getAttribute("data-state") === "closed") {
                  trigger.click();
                }
                window.setTimeout(() => {
                  if (container) {
                    const top =
                      el.getBoundingClientRect().top -
                      container.getBoundingClientRect().top +
                      container.scrollTop -
                      8;
                    container.scrollTo({ top, behavior: "smooth" });
                  } else {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }, 80);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {/* Scrollable body — min-h-0 is required for flex children to scroll inside dialog */}
      <div id="equipment-form-scroll" className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2 space-y-4 py-2 text-base">
        <FormSection id="eq-sec-basic" title="Basic information" description="Name, code, category, visibility and status." defaultOpen>
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
          <div className="flex items-center justify-between gap-2">
            <Label>Category</Label>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openAddLookup("category")}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
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
          <div className="flex items-center justify-between gap-2">
            <Label>Equipment Group</Label>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openAddLookup("group")}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
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
        <div className="space-y-2 sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-multi-mode"
              checked={formData.enable_multi_mode === true}
              disabled={formData.parent_equipment != null}
              onCheckedChange={(checked) =>
                setFormData((p) => ({
                  ...p,
                  enable_multi_mode: !!checked,
                  // Multi-mode bases cannot also be child modes
                  parent_equipment: checked ? null : p.parent_equipment,
                }))
              }
            />
            <Label htmlFor="enable-multi-mode">Enable Multi-Mode Equipment</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Default is off. When enabled, this instrument can have alternate operating modes and
            date-based mode schedules (configured under Multi-Mode Equipment). Only enabled
            equipment appear for multi-mode configuration.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Parent Equipment (multi-mode)</Label>
          <Select
            value={formData.parent_equipment != null ? String(formData.parent_equipment) : "none"}
            disabled={formData.enable_multi_mode === true}
            onValueChange={(v) =>
              setFormData((p) => ({ ...p, parent_equipment: v === "none" ? null : parseInt(v, 10) }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select parent (base mode)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None (standalone / base) —</SelectItem>
              {(choices.parent_equipment_choices || [])
                .filter((e) => equipmentId == null || e.equipment_id !== equipmentId)
                .map((e) => (
                  <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                    {e.code} — {e.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Set when this equipment is an alternate operating mode of a Multi-Mode-enabled base instrument.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Internal Department</Label>
          {isDeptAdminPendingCreate || (isDeptAdmin && equipmentId != null) ? (
            <>
              <Input
                readOnly
                disabled
                value={
                  choices.internal_departments.find(
                    (d) => Number(d.id) === Number(formData.internal_department)
                  )
                    ? `${choices.internal_departments.find((d) => Number(d.id) === Number(formData.internal_department))!.name}${
                        choices.internal_departments.find((d) => Number(d.id) === Number(formData.internal_department))!.code
                          ? ` (${choices.internal_departments.find((d) => Number(d.id) === Number(formData.internal_department))!.code})`
                          : ""
                      }`
                    : user?.department_name
                      ? `${user.department_name}${user.department_code ? ` (${user.department_code})` : ""}`
                      : formData.internal_department != null
                        ? `Department #${formData.internal_department}`
                        : "—"
                }
              />
              <p className="text-muted-foreground text-xs">
                Locked to your assigned department. Department Administrators cannot change this.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
            value={formData.status === "MAINTENANCE" ? "REPAIR" : (formData.status ?? "ACTIVE")}
            onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.status_choices
                .filter((c) => c.value !== "MAINTENANCE")
                .map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.profile_type === "MULTI_PARAM" && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Slot options configuration</h3>
              <p className="text-sm text-muted-foreground">
                Per user-type radio options with time and charge (Django MultiParamDefinition inline).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  param_definitions: [
                    ...(p.param_definitions ?? []),
                    {
                      user_type: choices.user_type_choices?.[0]?.value ?? "",
                      param_name: "",
                      param_code: "",
                      unit_time_minutes: 60,
                      unit_charge: 0,
                      is_active: true,
                    },
                  ],
                }))
              }
            >
              Add slot option
            </Button>
          </div>
          {(formData.param_definitions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No slot options configured.</p>
          ) : (
            (formData.param_definitions ?? []).map((row, idx) => (
              <div key={idx} className="grid gap-3 sm:grid-cols-6 border rounded-md p-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">User type</Label>
                  <Select
                    value={row.user_type || "__none__"}
                    onValueChange={(v) =>
                      setFormData((p) => {
                        const rows = [...(p.param_definitions ?? [])];
                        rows[idx] = { ...rows[idx], user_type: v === "__none__" ? null : v };
                        return { ...p, param_definitions: rows };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="User type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any</SelectItem>
                      {(choices.user_type_choices ?? []).map((ut) => (
                        <SelectItem key={ut.value} value={ut.value}>
                          {ut.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={row.param_name}
                    onChange={(e) =>
                      setFormData((p) => {
                        const rows = [...(p.param_definitions ?? [])];
                        rows[idx] = { ...rows[idx], param_name: e.target.value };
                        return { ...p, param_definitions: rows };
                      })
                    }
                    placeholder="Slot 1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input
                    value={row.param_code}
                    onChange={(e) =>
                      setFormData((p) => {
                        const rows = [...(p.param_definitions ?? [])];
                        rows[idx] = { ...rows[idx], param_code: e.target.value };
                        return { ...p, param_definitions: rows };
                      })
                    }
                    placeholder="slot_1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minutes</Label>
                  <Input
                    type="number"
                    value={String(row.unit_time_minutes ?? "")}
                    onChange={(e) =>
                      setFormData((p) => {
                        const rows = [...(p.param_definitions ?? [])];
                        rows[idx] = { ...rows[idx], unit_time_minutes: e.target.value };
                        return { ...p, param_definitions: rows };
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Charge</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(row.unit_charge ?? "")}
                    onChange={(e) =>
                      setFormData((p) => {
                        const rows = [...(p.param_definitions ?? [])];
                        rows[idx] = { ...rows[idx], unit_charge: e.target.value };
                        return { ...p, param_definitions: rows };
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.is_active !== false}
                      onChange={(e) =>
                        setFormData((p) => {
                          const rows = [...(p.param_definitions ?? [])];
                          rows[idx] = { ...rows[idx], is_active: e.target.checked };
                          return { ...p, param_definitions: rows };
                        })
                      }
                    />
                    Active
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        param_definitions: (p.param_definitions ?? []).filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
                    { code: "", name: "", density_g_per_cm3: "1.24", price_per_gram: "2.5", user_type: null, is_active: true, display_order: (p.print_materials?.length ?? 0) },
                  ],
                }))
              }
            >
              Add material
            </Button>
          </div>
          {(formData.print_materials ?? []).length > 0 && (
            <div className="hidden sm:grid gap-3 sm:grid-cols-8 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Code</span>
              <span>Name</span>
              <span>Density (g/cm³)</span>
              <span>₹ / gram</span>
              <span>Order</span>
              <span>User type</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
          )}
          {(formData.print_materials ?? []).map((mat, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-8 border rounded-md p-3 items-center">
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">Code</Label>
                <Input placeholder="Code" value={mat.code} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], code: e.target.value }; return { ...p, print_materials: rows }; })} />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">Name</Label>
                <Input placeholder="Name" value={mat.name} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], name: e.target.value }; return { ...p, print_materials: rows }; })} />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">Density (g/cm³)</Label>
                <Input placeholder="Density" type="number" step="0.001" value={String(mat.density_g_per_cm3 ?? "")} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], density_g_per_cm3: e.target.value }; return { ...p, print_materials: rows }; })} />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">₹ / gram</Label>
                <Input placeholder="₹/gram" type="number" step="0.01" value={String(mat.price_per_gram ?? "")} onChange={(e) => setFormData((p) => { const rows = [...(p.print_materials ?? [])]; rows[idx] = { ...rows[idx], price_per_gram: e.target.value }; return { ...p, print_materials: rows }; })} />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">Order</Label>
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
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">User type</Label>
              <Select
                value={mat.user_type ? String(mat.user_type) : "__all__"}
                onValueChange={(value) =>
                  setFormData((p) => {
                    const rows = [...(p.print_materials ?? [])];
                    rows[idx] = { ...rows[idx], user_type: value === "__all__" ? null : value };
                    return { ...p, print_materials: rows };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="User type (all)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All user types</SelectItem>
                  {(choices?.user_type_choices ?? [])
                    .filter((ut) => String(ut.value ?? "").trim() !== "")
                    .map((ut) => (
                    <SelectItem key={ut.value} value={String(ut.value)}>
                      {ut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">Status</Label>
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
        </FormSection>

      <FormSection id="eq-sec-instruction" title="Important Instruction" description="Optional instructions shown prominently on the equipment page (above specifications)." defaultOpen>
        <Textarea
          id="equipment-important-instruction"
          value={formData.important_instruction ?? ""}
          onChange={(e) => setFormData((p) => ({ ...p, important_instruction: e.target.value || "" }))}
          placeholder="Important instructions for users"
          rows={3}
        />
      </FormSection>

      <FormSection title="Catalog card — Make & Model" description="Optional manufacturer and model lines on equipment catalog cards, below department.">
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
      </FormSection>

      <FormSection title="Advanced booking options">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.skip_quota_check === true}
            onCheckedChange={(c) => setFormData((p) => ({ ...p, skip_quota_check: c === true }))}
          />
          Skip quota check
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.enable_charge_recalculation === true}
            onCheckedChange={(c) => setFormData((p) => ({ ...p, enable_charge_recalculation: c === true }))}
          />
          Enable charge recalculation
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.user_rating_enabled !== false}
            onCheckedChange={(c) => setFormData((p) => ({ ...p, user_rating_enabled: c === true }))}
          />
          User rating enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.sample_preparation_by_user === true}
            onCheckedChange={(c) => setFormData((p) => ({ ...p, sample_preparation_by_user: c === true }))}
          />
          Sample preparation by user
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Urgent peak window (minutes)</Label>
          <Input
            type="number"
            min={0}
            value={formData.urgent_peak_window_minutes ?? ""}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                urgent_peak_window_minutes: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label>Operator-absent disruption after booking end (hours)</Label>
          <Input
            type="number"
            min={0}
            value={formData.operator_absent_disruption_after_booking_end_hours ?? ""}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                operator_absent_disruption_after_booking_end_hours:
                  e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="Optional"
          />
        </div>
      </div>
      </FormSection>

      <FormSection id="eq-sec-emails" title="Booking & completion emails" description="Optional extra text per equipment. Completion email text is appended when a booking is marked complete; paste URLs for clickable links in HTML mail." defaultOpen>
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
      </FormSection>

      <FormSection title="I-STEM portal" description="Configure separate links for booking users and for OIC/Admin FBR verification.">
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
      </FormSection>

      <FormSection id="eq-sec-charges" title="Charge profiles" description="Per user-type pricing." defaultOpen>
      <p className="text-muted-foreground text-xs">
        Enable <strong>Require I-STEM FBR</strong> when that user type must submit and verify an I-STEM Facility Booking Record.
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
              <div key={`${cp.user_type}-${idx}`} className="p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
                  <div className="space-y-1">
                    <Label htmlFor={`cp-secondary-${idx}`}>Secondary charge</Label>
                    <Input
                      id={`cp-secondary-${idx}`}
                      type="number"
                      step="0.01"
                      value={String(cp.secondary_unit_charge ?? "")}
                      onChange={(e) =>
                        setFormData((p) => {
                          const arr = [...(p.charge_profiles ?? [])];
                          arr[idx] = { ...arr[idx], secondary_unit_charge: e.target.value };
                          return { ...p, charge_profiles: arr };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cp-breakpoint-${idx}`}>Breakpoint</Label>
                    <Input
                      id={`cp-breakpoint-${idx}`}
                      type="number"
                      step="0.01"
                      placeholder="Optional"
                      value={cp.breakpoint === null || cp.breakpoint === undefined ? "" : String(cp.breakpoint)}
                      onChange={(e) =>
                        setFormData((p) => {
                          const arr = [...(p.charge_profiles ?? [])];
                          arr[idx] = { ...arr[idx], breakpoint: e.target.value === "" ? null : e.target.value };
                          return { ...p, charge_profiles: arr };
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cp-formula-${idx}`}>Time formula</Label>
                  <Input
                    id={`cp-formula-${idx}`}
                    placeholder='e.g. (A * C) + B'
                    value={cp.time_formula ?? ""}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.charge_profiles ?? [])];
                        arr[idx] = { ...arr[idx], time_formula: e.target.value === "" ? null : e.target.value };
                        return { ...p, charge_profiles: arr };
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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
                    breakpoint: null,
                    time_formula: null,
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
      </FormSection>

      <FormSection id="eq-sec-media" title="Image / Video" description="Upload new files, or clear the current ones. Images are stored in S3 and displayed via a stable URL." defaultOpen>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Image</h4>
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
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null);
              if (e.target.files?.[0]) setClearImage(false);
            }}
            className="mt-1"
          />
        </div>
        {hasEquipmentImage && !imageFile ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="equipment-clear-image"
              checked={clearImage}
              onCheckedChange={(checked) => setClearImage(checked === true)}
            />
            <Label htmlFor="equipment-clear-image" className="text-sm font-normal cursor-pointer">
              Clear current image
            </Label>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Video</h4>
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
            onChange={(e) => {
              setVideoFile(e.target.files?.[0] ?? null);
              if (e.target.files?.[0]) setClearVideo(false);
            }}
            className="mt-1"
          />
        </div>
        {formData.video_url && !videoFile ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="equipment-clear-video"
              checked={clearVideo}
              onCheckedChange={(checked) => setClearVideo(checked === true)}
            />
            <Label htmlFor="equipment-clear-video" className="text-sm font-normal cursor-pointer">
              Clear current video
            </Label>
          </div>
        ) : null}
      </div>
      </FormSection>

      <FormSection id="eq-sec-slots" title="Slot Configuration" description="Slot duration, per-day count, reschedule window, results location, and related booking behavior." defaultOpen>
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
          <Label htmlFor="slot-tolerance">Slot Tolerance (Minutes)</Label>
          <Input
            id="slot-tolerance"
            type="number"
            min={0}
            value={formData.slot_tolerance_minutes ?? 0}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setFormData((p) => ({ ...p, slot_tolerance_minutes: 0 }));
                return;
              }
              const n = parseInt(v, 10);
              if (Number.isNaN(n)) return;
              setFormData((p) => ({ ...p, slot_tolerance_minutes: Math.max(0, n) }));
            }}
          />
          <p className="text-muted-foreground text-xs">
            Allow analysis time to overrun allocated slot capacity by up to this many minutes before
            another slot is required. Example: 30-min slots, 35-min analysis, tolerance 5 → 1 slot.
            0 keeps legacy strict rounding (ceil). Configurable by Main / Department Administrator.
          </p>
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
            Used when Sample Lifecycle changes to Sample Accepted. Folder structure:
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="external-slot-quota-percent">External Slot Quota (%)</Label>
            <Input
              id="external-slot-quota-percent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={formData.external_slot_quota_percent ?? 0}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === "") {
                  setFormData((p) => ({ ...p, external_slot_quota_percent: 0 }));
                  return;
                }
                const n = parseInt(v, 10);
                if (!Number.isFinite(n)) return;
                setFormData((p) => ({ ...p, external_slot_quota_percent: Math.min(100, Math.max(0, n)) }));
              }}
            />
            <p className="text-muted-foreground text-xs">
              0 = external users cannot book. Limit is a % of the week&apos;s bookable slots (snapshotted), not reserved times. Configurable by Main/Department Administrator.
            </p>
          </div>
        </div>
      </div>
      </FormSection>

      <FormSection title="Repeat sample request" description="Allow users to request a repeat sample within a time window after completion. Leave days empty or 0 to disable.">
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
      </FormSection>

      <FormSection
        id="eq-sec-managers"
        title="Equipment Officer In Charge (Managers)"
        description={`Officer In Charge users belonging to Internal departments${formData.internal_department != null ? " (preferentially matching the selected department)" : ""}.`}
        defaultOpen
      >
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
      </FormSection>

      <FormSection
        id="eq-sec-operators"
        title="Equipment Operators"
        description={`Lab Incharge users belonging to Internal departments${formData.internal_department != null ? " (preferentially matching the selected department)" : ""}.`}
        defaultOpen
      >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value="__add__"
          onValueChange={(v) => {
            if (!v || v === "__add__") return;
            const id = parseInt(v, 10);
            if (!id || (formData.equipment_operators ?? []).some((o) => o.operator === id)) return;
            setFormData((p) => ({ ...p, equipment_operators: [...(p.equipment_operators ?? []), { operator: id, role: "PRIMARY" }] }));
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
            <div key={idx} className="flex items-center justify-between gap-2 p-2">
              <span className="text-sm flex-1">{(choices.operators ?? []).find((c) => c.id === o.operator)?.name || (choices.operators ?? []).find((c) => c.id === o.operator)?.email || `ID ${o.operator}`}</span>
              <Select
                value={o.role === "SECONDARY" ? "SECONDARY" : "PRIMARY"}
                onValueChange={(v) =>
                  setFormData((p) => {
                    const arr = [...(p.equipment_operators ?? [])];
                    arr[idx] = { ...arr[idx], role: v === "SECONDARY" ? "SECONDARY" : "PRIMARY" };
                    return { ...p, equipment_operators: arr };
                  })
                }
              >
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary</SelectItem>
                  <SelectItem value="SECONDARY">Secondary</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_operators: (p.equipment_operators ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))
        )}
      </div>
      </FormSection>

      <FormSection id="eq-sec-specs" title="Equipment Specifications" description="Key-value specifications (e.g. Capacity, Resolution)." defaultOpen>
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
      </FormSection>

      <FormSection id="eq-sec-accessories" title="Accessories / Additional accessories" description="Standard and additional equipment accessories." defaultOpen>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Accessories</h4>
        <div className="flex gap-2">
          <Input placeholder="Accessory name" id="acc-name-new" className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={() => { const name = (document.getElementById("acc-name-new") as HTMLInputElement)?.value?.trim(); if (name) { setFormData((p) => ({ ...p, equipment_accessories: [...(p.equipment_accessories ?? []), { accessory_name: name, is_optional: false, is_enabled: true }] })); (document.getElementById("acc-name-new") as HTMLInputElement).value = ""; } }}>Add</Button>
        </div>
        <div className="rounded border divide-y">
          {(formData.equipment_accessories ?? []).length === 0 ? <p className="p-2 text-sm text-muted-foreground">No accessories.</p> : (formData.equipment_accessories ?? []).map((a, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 p-2">
              <span className="text-sm flex-1">{a.accessory_name}</span>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={a.is_optional ?? false}
                  onCheckedChange={(c) => setFormData((p) => {
                    const arr = [...(p.equipment_accessories ?? [])];
                    arr[idx] = { ...arr[idx], is_optional: !!c };
                    return { ...p, equipment_accessories: arr };
                  })}
                />
                <Label className="text-xs">Optional</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={a.is_enabled !== false}
                  onCheckedChange={(c) => setFormData((p) => {
                    const arr = [...(p.equipment_accessories ?? [])];
                    arr[idx] = { ...arr[idx], is_enabled: c === true };
                    return { ...p, equipment_accessories: arr };
                  })}
                />
                <Label className="text-xs">Enabled</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData((p) => ({ ...p, equipment_accessories: (p.equipment_accessories ?? []).filter((_, i) => i !== idx) }))}>Remove</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Additional accessories</h4>
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
                  <Checkbox
                    checked={a.is_enabled !== false}
                    onCheckedChange={(c) => setFormData((p) => {
                      const arr = [...(p.equipment_additional_accessories ?? [])];
                      arr[idx] = { ...arr[idx], is_enabled: c === true };
                      return { ...p, equipment_additional_accessories: arr };
                    })}
                  />
                  <Label className="text-xs">Enabled</Label>
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
          <Button type="button" variant="outline" size="sm" onClick={() => setFormData((p) => ({ ...p, equipment_additional_accessories: [...(p.equipment_additional_accessories ?? []), { additional_accessory_name: "", additional_accessory_description: "", is_optional: false, is_enabled: true }] }))}>Add row</Button>
        </div>
      </div>
      </div>
      </FormSection>

      <FormSection
        id="eq-sec-inputs"
        title="Dynamic Input Fields"
        description="Per-equipment dynamic fields (A–Z) used in charge formulas and booking forms. Matches Django DynamicInputFieldInline."
        defaultOpen
      >
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const used = new Set((formData.input_fields ?? []).map((f) => f.field_key));
              const nextKey = DYNAMIC_INPUT_FIELD_KEYS.find((k) => !used.has(k)) ?? "A";
              setFormData((p) => ({
                ...p,
                input_fields: [
                  ...(p.input_fields ?? []),
                  {
                    field_key: nextKey,
                    field_label: "",
                    field_type: choices.dynamic_input_field_type_choices?.[0]?.value ?? "TEXT",
                    is_required: false,
                    editing_required: false,
                    default_value: "",
                    options: [],
                    help_text: "",
                    source_element_field_key: null,
                  },
                ],
              }));
            }}
          >
            Add field
          </Button>
        </div>
        {(formData.input_fields ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No dynamic input fields configured.</p>
        ) : (
          (formData.input_fields ?? []).map((f, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Field key</Label>
                  <Select
                    value={f.field_key || "A"}
                    onValueChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = { ...arr[idx], field_key: v };
                        return { ...p, input_fields: arr };
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DYNAMIC_INPUT_FIELD_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs">Field label</Label>
                  <Input
                    value={f.field_label}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = { ...arr[idx], field_label: e.target.value };
                        return { ...p, input_fields: arr };
                      })
                    }
                    placeholder="e.g. Number of samples"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Field type</Label>
                  <Select
                    value={f.field_type || "TEXT"}
                    onValueChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        const prev = arr[idx];
                        const nextType = String(v || "").toUpperCase();
                        const prevType = String(prev.field_type || "").toUpperCase();
                        let nextOptions = prev.options;
                        if (nextType === "NUMERIC") {
                          nextOptions =
                            prev.options && typeof prev.options === "object" && !Array.isArray(prev.options)
                              ? prev.options
                              : {};
                        } else if (prevType === "NUMERIC" || !Array.isArray(prev.options)) {
                          nextOptions = [];
                        } else {
                          nextOptions = normalizeOptionsList(prev.options);
                        }
                        arr[idx] = { ...prev, field_type: v, options: nextOptions as typeof prev.options };
                        return { ...p, input_fields: arr };
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(choices.dynamic_input_field_type_choices ?? [
                        { value: "NUMERIC", label: "Numeric" },
                        { value: "TEXT", label: "Text" },
                        { value: "RADIO", label: "Radio" },
                        { value: "COMBO", label: "Combo/Dropdown" },
                        { value: "MULTI_SELECT", label: "Multi-select" },
                        { value: "TOGGLE", label: "Toggle" },
                        { value: "PERIODIC_TABLE", label: "Periodic table / Element selector" },
                        { value: "TABLE", label: "Table" },
                        { value: "ICPMS_STANDARD_COVERAGE", label: "ICPMS Standard Coverage" },
                      ]).map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Default value</Label>
                  <Input
                    value={f.default_value ?? ""}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = { ...arr[idx], default_value: e.target.value };
                        return { ...p, input_fields: arr };
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {String(f.field_type || "").toUpperCase() === "TABLE"
                      ? "Row count field key"
                      : "Source element field key"}
                  </Label>
                  <Select
                    value={f.source_element_field_key || "__none__"}
                    onValueChange={(v) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = { ...arr[idx], source_element_field_key: v === "__none__" ? null : v };
                        return { ...p, input_fields: arr };
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {DYNAMIC_INPUT_FIELD_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {String(f.field_type || "").toUpperCase() === "TABLE"
                      ? "When set (e.g. A), the table auto-generates that many rows from the referenced field’s value. First column is Serial Number (1…N)."
                      : "For ICPMS Standard Coverage: the Periodic Table field key providing the element list."}
                  </p>
                </div>
                <div className="flex items-center gap-4 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={f.is_required ?? false}
                      onCheckedChange={(c) =>
                        setFormData((p) => {
                          const arr = [...(p.input_fields ?? [])];
                          arr[idx] = { ...arr[idx], is_required: c === true };
                          return { ...p, input_fields: arr };
                        })
                      }
                    />
                    <Label className="text-xs">Required</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={f.editing_required ?? false}
                      onCheckedChange={(c) =>
                        setFormData((p) => {
                          const arr = [...(p.input_fields ?? [])];
                          arr[idx] = { ...arr[idx], editing_required: c === true };
                          return { ...p, input_fields: arr };
                        })
                      }
                    />
                    <Label className="text-xs">Editing required</Label>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Options (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={optionsToLines(f.options)}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = {
                          ...arr[idx],
                          options: linesToOptions(e.target.value),
                        };
                        return { ...p, input_fields: arr };
                      })
                    }
                    placeholder={"For RADIO / COMBO / MULTI_SELECT / TABLE, one option (or column header) per line"}
                    disabled={String(f.field_type || "").toUpperCase() === "NUMERIC"}
                  />
                  {String(f.field_type || "").toUpperCase() === "NUMERIC" && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id={`allow-neg-${idx}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={Boolean(f.allow_negative)}
                        onChange={(e) =>
                          setFormData((p) => {
                            const arr = [...(p.input_fields ?? [])];
                            arr[idx] = { ...arr[idx], allow_negative: e.target.checked };
                            return { ...p, input_fields: arr };
                          })
                        }
                      />
                      <Label htmlFor={`allow-neg-${idx}`} className="text-xs font-normal cursor-pointer">
                        Allow negative values when lower limit is blank (opens floor to −upper). Negative lower/upper
                        limits in help text already permit signed values and defaults.
                      </Label>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Help text</Label>
                  <Textarea
                    rows={3}
                    value={f.help_text ?? ""}
                    onChange={(e) =>
                      setFormData((p) => {
                        const arr = [...(p.input_fields ?? [])];
                        arr[idx] = { ...arr[idx], help_text: e.target.value };
                        return { ...p, input_fields: arr };
                      })
                    }
                    placeholder="NUMERIC: line 1 = lower limit (e.g. -50), line 2 = upper limit, line 3 = step. Negative defaults are allowed when within these limits."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setFormData((p) => ({ ...p, input_fields: (p.input_fields ?? []).filter((_, i) => i !== idx) }))}
                >
                  Remove field
                </Button>
              </div>
            </div>
          ))
        )}
      </FormSection>

      <FormSection
        id="eq-sec-slot-masters"
        title="Slot Masters"
        description="Named booking slots for this equipment (slot number, name, open/close time). Matches Django SlotMasterInline."
        defaultOpen
      >
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const nextNumber = (formData.slot_masters ?? []).reduce((max, s) => Math.max(max, Number(s.slot_number) || 0), 0) + 1;
              setFormData((p) => ({
                ...p,
                slot_masters: [
                  ...(p.slot_masters ?? []),
                  { slot_number: nextNumber, slot_name: "", open_time: "09:00", close_time: "10:00", is_active: true },
                ],
              }));
            }}
          >
            Add slot
          </Button>
        </div>
        {(formData.slot_masters ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No slot masters configured.</p>
        ) : (
          (formData.slot_masters ?? []).map((s, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-6 border rounded-md p-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Slot number</Label>
                <Input
                  type="number"
                  min={1}
                  value={String(s.slot_number ?? "")}
                  onChange={(e) =>
                    setFormData((p) => {
                      const arr = [...(p.slot_masters ?? [])];
                      arr[idx] = { ...arr[idx], slot_number: parseInt(e.target.value, 10) || 0 };
                      return { ...p, slot_masters: arr };
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Slot name</Label>
                <Input
                  value={s.slot_name ?? ""}
                  onChange={(e) =>
                    setFormData((p) => {
                      const arr = [...(p.slot_masters ?? [])];
                      arr[idx] = { ...arr[idx], slot_name: e.target.value };
                      return { ...p, slot_masters: arr };
                    })
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Open time</Label>
                <Input
                  type="time"
                  value={s.open_time ?? ""}
                  onChange={(e) =>
                    setFormData((p) => {
                      const arr = [...(p.slot_masters ?? [])];
                      arr[idx] = { ...arr[idx], open_time: e.target.value };
                      return { ...p, slot_masters: arr };
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Close time</Label>
                <Input
                  type="time"
                  value={s.close_time ?? ""}
                  onChange={(e) =>
                    setFormData((p) => {
                      const arr = [...(p.slot_masters ?? [])];
                      arr[idx] = { ...arr[idx], close_time: e.target.value };
                      return { ...p, slot_masters: arr };
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={s.is_active !== false}
                    onCheckedChange={(c) =>
                      setFormData((p) => {
                        const arr = [...(p.slot_masters ?? [])];
                        arr[idx] = { ...arr[idx], is_active: c === true };
                        return { ...p, slot_masters: arr };
                      })
                    }
                  />
                  Active
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setFormData((p) => ({ ...p, slot_masters: (p.slot_masters ?? []).filter((_, i) => i !== idx) }))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </FormSection>

      {(formData.created_at != null || formData.updated_at != null) && (
        <FormSection title="Timestamps">
          <p className="text-sm text-muted-foreground">
            Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} · Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}
          </p>
        </FormSection>
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

      <Dialog open={addLookupOpen != null} onOpenChange={(open) => !open && setAddLookupOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addLookupOpen === "group" ? "Add equipment group" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              {addLookupOpen === "group"
                ? "Create a new equipment group and select it for this instrument."
                : "Create a new category and select it for this instrument."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="lookup-name">Name *</Label>
              <Input
                id="lookup-name"
                value={addLookupName}
                onChange={(e) => setAddLookupName(e.target.value)}
                placeholder={addLookupOpen === "group" ? "e.g. Electron Microscopy" : "e.g. Analytical"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookup-code">
                Code{addLookupOpen === "group" ? " *" : " (optional)"}
              </Label>
              <Input
                id="lookup-code"
                value={addLookupCode}
                onChange={(e) => setAddLookupCode(e.target.value)}
                placeholder={addLookupOpen === "group" ? "e.g. EM-GRP" : "e.g. ANALYTICAL"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddLookupOpen(null)} disabled={addLookupSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveAddLookup()} disabled={addLookupSaving}>
              {addLookupSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add &amp; select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
