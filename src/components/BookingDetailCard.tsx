import { useCallback, useEffect, useState } from "react";
import { apiClient, type PrintAnalysisResult } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { formatINR } from "@/lib/money";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import BookingEventHistory from "@/components/BookingEventHistory";
import BookingUserInputs from "@/components/BookingUserInputs";
import { formatPrintWeightGrams } from "@/components/Print3DBookingPanel";
import { Print3DBookingActuals } from "@/components/Print3DBookingActuals";
import UserProfile from "@/components/UserProfile";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { CheckCircle2, XCircle, RotateCcw, Calendar, History, UserCheck, FolderDown, Download, Star, Banknote, Printer, AlertCircle, ArrowLeft, CopyPlus, BadgeCheck, Handshake, Trash2, Loader2, Wrench, Timer } from "lucide-react";
import { IstemFbrSeal } from "@/components/IstemFbrSeal";
import SampleTraceTimeline from "@/components/SampleTraceTimeline";
import { generateExternalEquipmentRequisitionFormPdf } from "@/lib/externalRequisitionFormPdf";
import { getRealBookingId, type BookingRef } from "@/lib/bookingRef";

export interface BookingDetailCardBooking extends BookingRef {
  virtual_booking_id?: string | null;
  user: number;
  user_email: string;
  user_name: string;
  user_phone?: string | null;
  user_department?: string | null;
  user_profile_picture?: string | null;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  wallet_owner_name?: string | null;
  charge_profile: number;
  user_type_snapshot: string;
  user_type_snapshot_display?: string | null;
  total_time_minutes: number;
  total_hours: number;
  total_charge: string;
  input_values: Record<string, string | boolean | string[] | number>;
  input_fields?: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    editing_required?: boolean;
    options?: (string | { value?: string; label?: string })[];
  }>;
  editable_input_fields?: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    editing_required?: boolean;
    options?: (string | { value?: string; label?: string })[];
  }>;
  selected_parameters: unknown;
  charge_breakdown: Array<{ amount: number; description: string }>;
  status: string;
  status_display: string;
  notes: string;
  /** Admin/OIC grace deadline for auto Operator Absent jobs (does not change slots). */
  operator_absent_hold_until?: string | null;
  atmosphere_sensitive_sample?: boolean;
  /** When false, atmosphere-sensitive option is not offered for this equipment. */
  equipment_atmosphere_sensitive_sample_enabled?: boolean;
  lifecycle_countdown?: {
    enabled: boolean;
    phase?: "submit_sample" | "booking" | "collect_sample" | string;
    title?: string;
    started_at?: string | null;
    deadline_at: string;
    remaining_seconds?: number;
    is_overdue?: boolean;
    atmosphere_sensitive?: boolean;
    extended?: boolean;
    hours?: number;
  } | null;
  /** @deprecated use lifecycle_countdown */
  completion_countdown?: {
    enabled: boolean;
    phase?: string;
    title?: string;
    started_at?: string | null;
    deadline_at: string;
    remaining_seconds?: number;
    is_overdue?: boolean;
    atmosphere_sensitive?: boolean;
    extended?: boolean;
    hours?: number;
  } | null;
  start_time: string;
  end_time: string;
  daily_slots: Array<{
    id: number;
    slot_master: number;
    slot_number: number;
    slot_name: string;
    equipment_code: string;
    date: string;
    start_datetime: string;
    end_datetime: string;
    status: string;
    booking: number;
    booking_id: string | number;
    real_booking_id?: number;
    created_at: string;
    updated_at: string;
  }>;
  sample_trace?: Array<{
    id: number;
    status: string;
    status_display: string;
    sample_identifiers: string;
    created_at: string;
    created_by: number | null;
    created_by_name: string | null;
  }>;
  rating?: number | null;
  rating_on_time_operator_availability?: boolean | null;
  rating_laboratory_cleanliness_organization?: boolean | null;
  rating_sample_handling_care?: boolean | null;
  rating_operator_behaviour_professionalism?: boolean | null;
  rating_compliance_booking_request_parameters?: boolean | null;
  rating_feedback?: string | null;
  rated_at?: string | null;
  equipment_enable_charge_recalculation?: boolean;
  equipment_user_rating_enabled?: boolean;
  created_at: string;
  updated_at: string;
  charge_recalculation_pending_amount?: string | null;
  repeat_sample_enabled?: boolean;
  source_booking_id?: number | null;
  repeat_booking_already_created?: boolean;
  /** Latest repeat sample request (legacy flow), if any */
  repeat_sample_request_status?: string | null;
  equipment_repeat_sample_request_days?: number | null;
  equipment_repeat_sample_disclaimer?: string | null;
  accounts_in_charge?: {
    user_id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    user_type?: string | null;
  } | null;
  lab_in_charge?: {
    user_id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    user_type?: string | null;
  } | null;
  oic_contacts?: Array<{
    user_id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    user_type?: string | null;
  }> | null;
  /** Hours after last slot end before staff may mark Booking Not Utilized; 0 = disabled. */
  equipment_booking_not_utilize_window_hours?: number | null;
  /** Hours after last slot end before auto Operator Unavailable (backend); exposed for reference. */
  equipment_operator_unavailable_after_booking_end_hours?: number | null;
  /** Widen slot picker week nav after maintenance/operator-disruption reschedule (matches My Bookings). */
  maintenance_reschedule_extra_week?: boolean;
  /** True when this booking is already in maintenance-disruption workflow (Admin/OIC flag or equipment maintenance). */
  maintenance_disruption_flag?: boolean;
  is_waitlist_entry?: boolean;
  waitlist_code?: string;
  waitlist_position?: number;
  waitlist_entry_id?: number;
  /** From last booking attempt log (waitlist / My Bookings). */
  booking_attempt_duration_minutes?: number | null;
  booking_attempt_slots_requested?: number | null;
  /** Equipment slot length; used with slots_requested if total_time_minutes is missing. */
  equipment_slot_duration_minutes?: number | null;
  /** I-STEM FBR workflow (when required by charge profile). */
  istem_fbr_number?: string | null;
  istem_fbr_status?: string | null;
  istem_fbr_status_display?: string | null;
  istem_fbr_invalid_reason?: string | null;
  istem_fbr_executed_at?: string | null;
  istem_portal_url?: string | null;
  istem_fbr_status_url?: string | null;
  require_istem_fbr?: boolean;
  sample_return_after_analysis?: boolean;
  return_shipping_fee_amount?: string;
  return_shipping_company?: string;
  return_shipping_tracking_id?: string;
  return_shipping_tracking_updated_at?: string | null;
  equipment_profile_type?: string;
  print_analysis?: PrintAnalysisResult | null;
  print_analyses?: PrintAnalysisResult[];
}

type ActionType =
  | "complete"
  | "refund"
  | "absent"
  | "under_maintenance"
  | "other_disruption"
  | "reschedule"
  | "not_utilized"
  | null;
type ConfirmActionType = ActionType | "charge_recalc_refund" | "charge_recalc_pay";

interface BookingDetailCardProps {
  booking: BookingDetailCardBooking;
  onClose: () => void;
  onUpdated: () => void;
  /** True only for operator role (not manager/admin). */
  isOperator: boolean;
  /** True for admin/manager (Officer In Charge). */
  isManagerOrAdmin?: boolean;
  /** Logged-in user's type string (e.g. admin/manager/operator/lab_incharge). */
  currentUserType?: string | null;
  currentUserId?: number | null;
  backLabel?: string;
  showPrintButton?: boolean;
  /** When provided and user is not operator, show Cancel booking button; called with current booking to open cancel flow in parent */
  onUserCancelClick?: (booking: BookingDetailCardBooking) => void;
}

function formatCountdownParts(totalSeconds: number): { label: string; parts: { d: number; h: number; m: number; s: number } } {
  const overdue = totalSeconds < 0;
  const abs = Math.abs(totalSeconds);
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const chunks: string[] = [];
  if (d > 0) chunks.push(`${d}d`);
  chunks.push(`${h.toString().padStart(2, "0")}h`);
  chunks.push(`${m.toString().padStart(2, "0")}m`);
  chunks.push(`${s.toString().padStart(2, "0")}s`);
  return {
    label: overdue ? `Overdue by ${chunks.join(" ")}` : chunks.join(" "),
    parts: { d, h, m, s },
  };
}

function BookingLifecycleCountdown({
  countdown,
}: {
  countdown: NonNullable<
    BookingDetailCardBooking["lifecycle_countdown"] | BookingDetailCardBooking["completion_countdown"]
  >;
}) {
  const [remaining, setRemaining] = useState(() => {
    const deadline = new Date(countdown.deadline_at).getTime();
    return Math.floor((deadline - Date.now()) / 1000);
  });

  useEffect(() => {
    const deadline = new Date(countdown.deadline_at).getTime();
    const tick = () => setRemaining(Math.floor((deadline - Date.now()) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdown.deadline_at]);

  const overdue = remaining < 0;
  const startedAt = countdown.started_at || null;
  const elapsedFromStart = (() => {
    if (!startedAt) return overdue ? 1 : 0;
    const start = new Date(startedAt).getTime();
    const deadline = new Date(countdown.deadline_at).getTime();
    const windowMs = Math.max(1, deadline - start);
    return Math.min(1, Math.max(0, (Date.now() - start) / windowMs));
  })();
  const ringProgress = overdue ? 1 : elapsedFromStart;
  const { label, parts } = formatCountdownParts(remaining);
  const phase = String(countdown.phase || "");
  const title =
    countdown.title ||
    (phase === "submit_sample"
      ? "Time remaining to submit sample"
      : phase === "collect_sample"
        ? "Time remaining to collect sample"
        : "Time remaining to complete booking");
  const tone = overdue
    ? "from-rose-600/90 to-rose-700/90 border-rose-500/40 text-white"
    : phase === "submit_sample"
      ? "from-teal-500/10 to-cyan-500/10 border-teal-500/30 text-teal-950 dark:text-teal-50"
      : phase === "collect_sample"
        ? "from-cyan-500/10 to-teal-500/10 border-cyan-500/30 text-cyan-950 dark:text-cyan-50"
        : ringProgress > 0.85
          ? "from-amber-500/15 to-orange-500/10 border-amber-500/35 text-amber-950 dark:text-amber-50"
          : "from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-50";

  return (
    <div className={`mb-4 overflow-hidden rounded-2xl border bg-gradient-to-br ${tone} shadow-sm`}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight">
            <Timer className={`h-4 w-4 shrink-0 ${overdue ? "text-white" : ""}`} />
            <span>{overdue ? `${title} — overdue` : title}</span>
            {countdown.atmosphere_sensitive && phase === "submit_sample" && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  overdue ? "bg-white/20 text-white" : "bg-teal-700/15 text-teal-800 dark:text-teal-200"
                }`}
              >
                Atmosphere-sensitive
              </span>
            )}
            {countdown.extended && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  overdue ? "bg-white/20 text-white" : "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                Extended
              </span>
            )}
          </div>
          <p className={`text-xs ${overdue ? "text-white/85" : "text-muted-foreground"}`}>
            Due {new Date(countdown.deadline_at).toLocaleString()}
            {countdown.atmosphere_sensitive && phase === "submit_sample"
              ? " · Sample may be submitted at slot start"
              : ""}
          </p>
        </div>
        <div className="flex items-end gap-2 font-mono tabular-nums">
          {parts.d > 0 && (
            <div className="text-center">
              <div className={`text-2xl font-bold leading-none sm:text-3xl ${overdue ? "text-white" : ""}`}>{parts.d}</div>
              <div className={`mt-1 text-[10px] uppercase tracking-wider ${overdue ? "text-white/70" : "text-muted-foreground"}`}>days</div>
            </div>
          )}
          {[
            { v: parts.h, u: "hrs" },
            { v: parts.m, u: "min" },
            { v: parts.s, u: "sec" },
          ].map((p) => (
            <div key={p.u} className="text-center min-w-[2.75rem]">
              <div className={`text-2xl font-bold leading-none sm:text-3xl ${overdue ? "text-white" : ""}`}>
                {p.v.toString().padStart(2, "0")}
              </div>
              <div className={`mt-1 text-[10px] uppercase tracking-wider ${overdue ? "text-white/70" : "text-muted-foreground"}`}>
                {p.u}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`h-1.5 w-full ${overdue ? "bg-white/20" : "bg-black/5 dark:bg-white/10"}`}>
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            overdue
              ? "bg-white"
              : phase === "submit_sample"
                ? "bg-sky-500"
                : phase === "collect_sample"
                  ? "bg-violet-500"
                  : ringProgress > 0.85
                    ? "bg-amber-500"
                    : "bg-emerald-500"
          }`}
          style={{ width: `${Math.round(ringProgress * 100)}%` }}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  const colors: Record<string, string> = {
    booked: "bg-blue-500",
    disruption_pending: "bg-amber-500",
    under_maintenance: "bg-yellow-600",
    other_disruption: "bg-orange-600",
    completed: "bg-green-500",
    cancelled: "bg-red-500",
    absent: "bg-orange-500",
    refunded: "bg-purple-500",
    booking_not_utilized: "bg-amber-600",
  };
  return colors[statusLower] || "bg-gray-500";
}

function canMarkBookingNotUtilized(booking: BookingDetailCardBooking): boolean {
  if (booking.status.toUpperCase() !== "BOOKED") return false;
  if (!booking.end_time) return false;
  if (booking.atmosphere_sensitive_sample && booking.start_time) {
    const startMs = new Date(booking.start_time).getTime();
    if (Number.isFinite(startMs) && Date.now() < startMs) return false;
  }
  const endMs = new Date(booking.end_time).getTime();
  if (!Number.isFinite(endMs)) return false;
  // Enabled only after the last slot end-time has passed.
  if (Date.now() < endMs) return false;
  const trace = booking.sample_trace ?? [];
  return !trace.some((e) => String(e.status || "").toUpperCase() !== "SAMPLE_SENT");
}

function isExternalUserTypeSnapshot(ut: string | null | undefined): boolean {
  return isExternalBookingUserType(ut);
}

function canPerformAction(booking: BookingDetailCardBooking, action: ActionType, isOperator: boolean): boolean {
  if (!action) return false;
  const status = booking.status.toUpperCase();
  /** Sample Lifecycle "Analyzed" (trace COMPLETED) is the same workflow step as Actions → Complete; no second complete. */
  const traceHasAnalyzed = (booking.sample_trace ?? []).some(
    (e) => String(e.status || "").toUpperCase() === "COMPLETED"
  );
  if (isOperator) {
    if (action === "complete" && status === "BOOKED") return !traceHasAnalyzed;
    if (action === "not_utilized") return canMarkBookingNotUtilized(booking);
    return false;
  }
  switch (action) {
    case "complete":
      if (traceHasAnalyzed) return false;
      return status === "BOOKED";
    case "refund":
      return status !== "REFUNDED" && status !== "COMPLETED";
    case "absent":
      return status === "BOOKED";
    case "under_maintenance":
      if (booking.maintenance_disruption_flag) return false;
      return status === "BOOKED" || status === "PENDING";
    case "other_disruption":
      if (booking.maintenance_disruption_flag) return false;
      return status === "BOOKED" || status === "PENDING";
    case "reschedule":
      return status === "BOOKED" || status === "DISRUPTION_PENDING" || status === "PENDING";
    case "not_utilized":
      return canMarkBookingNotUtilized(booking);
    default:
      return false;
  }
}

export function BookingDetailCard({
  booking: initialBooking,
  onClose,
  onUpdated,
  isOperator,
  isManagerOrAdmin = false,
  currentUserType,
  currentUserId,
  backLabel = "Back to list",
  showPrintButton = false,
  onUserCancelClick,
}: BookingDetailCardProps) {
  const [booking, setBooking] = useState<BookingDetailCardBooking>(initialBooking);
  const isWaitlistedEntry =
    booking.status?.toUpperCase() === "WAITLISTED" || (booking as any).is_waitlist_entry === true;
  const waitlistRequestedDurationMinutes = (() => {
    if (!isWaitlistedEntry) return null;
    const t = Number(booking.total_time_minutes);
    if (Number.isFinite(t) && t > 0) return t;
    const dm = booking.booking_attempt_duration_minutes;
    if (dm != null) {
      const d = Number(dm);
      if (Number.isFinite(d) && d > 0) return d;
    }
    const slots = booking.booking_attempt_slots_requested;
    const slotLen = booking.equipment_slot_duration_minutes;
    if (slots != null && slotLen != null) {
      const s = Number(slots);
      const L = Number(slotLen);
      if (Number.isFinite(s) && s > 0 && Number.isFinite(L) && L > 0) return Math.round(s * L);
    }
    return null;
  })();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: ActionType; booking: BookingDetailCardBooking | null }>({
    open: false,
    type: null,
    booking: null,
  });
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    type: ConfirmActionType | null;
    rescheduleStart?: string;
    rescheduleEnd?: string;
    chargeRecalcBooking?: BookingDetailCardBooking;
  }>({ open: false, type: null });
  const [actionNotes, setActionNotes] = useState("");
  const [sendEmailToSupervisor, setSendEmailToSupervisor] = useState(true);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [completeResultFiles, setCompleteResultFiles] = useState<File[]>([]);
  const [completeUploadedFiles, setCompleteUploadedFiles] = useState<string[]>([]);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [expandedBookings, setExpandedBookings] = useState<Set<string | number>>(new Set([booking.booking_id]));
  const bookingPk = getRealBookingId(booking);
  const [resultsData, setResultsData] = useState<{ exists: boolean; files: Array<{ name: string; download_url: string }> } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsFbrBlock, setResultsFbrBlock] = useState<{ message: string; portalUrl?: string } | null>(null);
  const [resultsFbrInfoOpen, setResultsFbrInfoOpen] = useState(false);
  const [fbrInput, setFbrInput] = useState("");
  const [fbrSaving, setFbrSaving] = useState(false);
  const [fbrInvalidateReason, setFbrInvalidateReason] = useState("");
  const [fbrReviewLoading, setFbrReviewLoading] = useState<null | "execute" | "invalidate">(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [zipDownloadInProgress, setZipDownloadInProgress] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState(0);
  const [ratingRequiredPopupOpen, setRatingRequiredPopupOpen] = useState(false);
  const [chargeRecalcActionLoading, setChargeRecalcActionLoading] = useState(false);
  const [actionSubmitLoading, setActionSubmitLoading] = useState(false);
  const [repeatEligibility, setRepeatEligibility] = useState<{ can_create_repeat: boolean } | null>(null);
  const [enableRepeatLoading, setEnableRepeatLoading] = useState(false);
  const [extendHoldUntilLocal, setExtendHoldUntilLocal] = useState("");
  const [extendHoldReasonCode, setExtendHoldReasonCode] = useState<string>("");
  const [extendHoldReasonDetail, setExtendHoldReasonDetail] = useState("");
  const [extendHoldLoading, setExtendHoldLoading] = useState(false);
  const [atmosphereSaving, setAtmosphereSaving] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<null | "invoice" | "label">(null);
  const [ratingCriteriaDraft, setRatingCriteriaDraft] = useState<{
    on_time_operator_availability: boolean | null;
    laboratory_cleanliness_organization: boolean | null;
    sample_handling_care: boolean | null;
    operator_behaviour_professionalism: boolean | null;
    compliance_booking_request_parameters: boolean | null;
  }>({
    on_time_operator_availability: booking.rating_on_time_operator_availability ?? null,
    laboratory_cleanliness_organization: booking.rating_laboratory_cleanliness_organization ?? null,
    sample_handling_care: booking.rating_sample_handling_care ?? null,
    operator_behaviour_professionalism: booking.rating_operator_behaviour_professionalism ?? null,
    compliance_booking_request_parameters: booking.rating_compliance_booking_request_parameters ?? null,
  });
  const [ratingFeedbackDraft, setRatingFeedbackDraft] = useState<string>(booking.rating_feedback ?? "");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [legacyRepeatInfo, setLegacyRepeatInfo] = useState<{
    can_request: boolean;
    disclaimer: string;
    days_left: number | null;
    reason: string | null;
  } | null>(null);
  const [legacyRepeatDialogOpen, setLegacyRepeatDialogOpen] = useState(false);
  const [legacyRepeatNotes, setLegacyRepeatNotes] = useState("");
  const [legacyRepeatSubmitLoading, setLegacyRepeatSubmitLoading] = useState(false);
  const [sampleDisposedDialogOpen, setSampleDisposedDialogOpen] = useState(false);
  const [sampleDisposedReason, setSampleDisposedReason] = useState("");
  const [returnShipDialogOpen, setReturnShipDialogOpen] = useState(false);
  const [returnShipCompany, setReturnShipCompany] = useState<string>("");
  const [returnShipOther, setReturnShipOther] = useState("");
  const [returnShipTracking, setReturnShipTracking] = useState("");
  const [returnShipSaving, setReturnShipSaving] = useState(false);
  const [postAnalyzedActionLoading, setPostAnalyzedActionLoading] = useState<null | "RETURNED" | "DISPOSED">(null);

  const navigate = useNavigate();

  /** Reload full booking (includes sample_trace, slots, status) after lifecycle API updates. */
  const refreshBookingDetail = useCallback(async (opts?: { silent?: boolean }) => {
    const id = getRealBookingId(booking);
    if (id == null) return;
    const res = await apiClient.getBookings({ booking_id: id, limit: 1 });
    if (res.error) {
      if (!opts?.silent) toast.error(res.error);
      return;
    }
    const b = res.data?.bookings?.[0];
    if (b) setBooking(b as BookingDetailCardBooking);
  }, [booking]);

  // Auto-refresh sample lifecycle while this booking detail is open
  useVisibilityPolling({
    enabled: !isWaitlistedEntry && booking.equipment_profile_type !== "PRINT_3D",
    intervalMs: 12000,
    onPoll: () => refreshBookingDetail({ silent: true }),
  });

  const handleAtmosphereSensitiveChange = async (checked: boolean) => {
    if (bookingPk == null || atmosphereSaving) return;
    setAtmosphereSaving(true);
    try {
      const res = await apiClient.updateBookingAtmosphereSensitiveSample(bookingPk, checked);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data?.booking) {
        setBooking(res.data.booking as BookingDetailCardBooking);
      } else {
        await refreshBookingDetail();
      }
      toast.success(
        checked
          ? "Atmosphere-sensitive sample enabled."
          : "Atmosphere-sensitive sample disabled."
      );
      onUpdated();
    } finally {
      setAtmosphereSaving(false);
    }
  };

  const handleSampleReturnedAction = async () => {
    if (bookingPk == null) return;
    setPostAnalyzedActionLoading("RETURNED");
    try {
      const res = await apiClient.setBookingSampleStatus(bookingPk, "RETURNED");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sample marked as returned.");
      await refreshBookingDetail();
      onUpdated();
    } finally {
      setPostAnalyzedActionLoading(null);
    }
  };

  const handleSampleDisposedConfirm = async () => {
    if (bookingPk == null) return;
    setPostAnalyzedActionLoading("DISPOSED");
    try {
      const res = await apiClient.setBookingSampleStatus(
        bookingPk,
        "DISPOSED",
        undefined,
        undefined,
        sampleDisposedReason.trim() || undefined
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sample marked as disposed.");
      setSampleDisposedDialogOpen(false);
      setSampleDisposedReason("");
      await refreshBookingDetail();
      onUpdated();
    } finally {
      setPostAnalyzedActionLoading(null);
    }
  };

  // Keep local booking in sync when parent passes a newer object.
  useEffect(() => {
    setBooking(initialBooking);
    setFbrInput((initialBooking.istem_fbr_number || "").trim());
  }, [initialBooking]);
  
  useEffect(() => {
    setRatingCriteriaDraft({
      on_time_operator_availability: initialBooking.rating_on_time_operator_availability ?? null,
      laboratory_cleanliness_organization: initialBooking.rating_laboratory_cleanliness_organization ?? null,
      sample_handling_care: initialBooking.rating_sample_handling_care ?? null,
      operator_behaviour_professionalism: initialBooking.rating_operator_behaviour_professionalism ?? null,
      compliance_booking_request_parameters: initialBooking.rating_compliance_booking_request_parameters ?? null,
    });
    setRatingFeedbackDraft(initialBooking.rating_feedback ?? "");
  }, [
    initialBooking.rating_on_time_operator_availability,
    initialBooking.rating_laboratory_cleanliness_organization,
    initialBooking.rating_sample_handling_care,
    initialBooking.rating_operator_behaviour_professionalism,
    initialBooking.rating_compliance_booking_request_parameters,
    initialBooking.rating_feedback,
  ]);

  useEffect(() => {
    if (!bookingPk || booking.status.toUpperCase() !== "COMPLETED") {
      setResultsData(null);
      setResultsLoading(false);
      return;
    }
    let cancelled = false;
    setResultsLoading(true);
    setResultsData(null);
    setResultsFbrBlock(null);
    apiClient
      .getBookingResults(bookingPk)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          if (res.errorCode === "istem_fbr_not_executed") {
            setResultsFbrBlock({ message: res.error, portalUrl: res.istem_portal_url });
          }
          return;
        }
        setResultsData({
          exists: res.data?.exists ?? false,
          files: (res.data?.files ?? []).map((f) => ({ name: f.name, download_url: f.download_url })),
        });
      })
      .finally(() => {
        if (!cancelled) setResultsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking.booking_id, bookingPk, booking.status]);

  useEffect(() => {
    if (
      !isOperator &&
      currentUserId != null &&
      booking.user === currentUserId &&
      booking.status.toUpperCase() === "COMPLETED" &&
      booking.repeat_sample_enabled
    ) {
      if (bookingPk == null) return;
      apiClient.getRepeatSampleEligibility(bookingPk).then((res) => {
        if (!res.error && res.data)
          setRepeatEligibility({ can_create_repeat: (res.data as { can_create_repeat?: boolean }).can_create_repeat ?? false });
        else setRepeatEligibility({ can_create_repeat: false });
      });
    } else {
      setRepeatEligibility(null);
    }
  }, [booking.booking_id, booking.user, booking.status, booking.repeat_sample_enabled, isOperator, currentUserId, bookingPk]);

  useEffect(() => {
    const externalSelf =
      !(isOperator || isManagerOrAdmin) &&
      currentUserId != null &&
      booking.user === currentUserId &&
      isExternalBookingUserType(booking.user_type_snapshot);
    if (
      isOperator ||
      externalSelf ||
      currentUserId == null ||
      booking.user !== currentUserId ||
      booking.status.toUpperCase() !== "COMPLETED" ||
      booking.repeat_sample_enabled ||
      booking.repeat_booking_already_created ||
      booking.source_booking_id ||
      bookingPk == null
    ) {
      setLegacyRepeatInfo(null);
      return;
    }
    const days = booking.equipment_repeat_sample_request_days;
    const equipmentAllowsRepeatRequest = days != null && Number(days) > 0;
    const pending = (booking.repeat_sample_request_status || "").toUpperCase() === "PENDING";
    if (!equipmentAllowsRepeatRequest && !pending) {
      setLegacyRepeatInfo(null);
      return;
    }
    let cancelled = false;
    apiClient.getRepeatSampleInfo(bookingPk).then((res) => {
      if (cancelled || res.error) return;
      setLegacyRepeatInfo(res.data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    isOperator,
    isManagerOrAdmin,
    currentUserId,
    booking.user,
    booking.user_type_snapshot,
    booking.status,
    booking.repeat_sample_enabled,
    booking.repeat_booking_already_created,
    booking.source_booking_id,
    booking.equipment_repeat_sample_request_days,
    booking.repeat_sample_request_status,
    bookingPk,
  ]);

  const handleEnableRepeatSample = async () => {
    setEnableRepeatLoading(true);
    try {
      if (bookingPk == null) {
        toast.error("This booking cannot be updated right now.");
        return;
      }
      const res = await apiClient.enableRepeatSample(bookingPk);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success((res.data as { message?: string })?.message || "Repeat sample enabled");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enable repeat sample");
    } finally {
      setEnableRepeatLoading(false);
    }
  };

  const handleCreateRepeatBooking = () => {
    if (!booking?.equipment || !booking?.booking_id) return;
    const rid = getRealBookingId(booking);
    if (rid == null) {
      toast.error("This booking cannot be used for repeat sample right now.");
      return;
    }
    onClose();
    navigate(`/book-equipment?equipment_id=${booking.equipment}&repeatOf=${rid}`);
  };

  const handleSubmitLegacyRepeatRequest = async () => {
    if (bookingPk == null) return;
    setLegacyRepeatSubmitLoading(true);
    try {
      const res = await apiClient.requestRepeatSample(bookingPk, legacyRepeatNotes.trim() || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success((res.data as { message?: string })?.message || "Repeat sample request submitted.");
      setLegacyRepeatDialogOpen(false);
      setLegacyRepeatNotes("");
      const info = await apiClient.getRepeatSampleInfo(bookingPk);
      if (!info.error && info.data) setLegacyRepeatInfo(info.data);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setLegacyRepeatSubmitLoading(false);
    }
  };

  const openActionDialog = (type: ActionType, b: BookingDetailCardBooking) => {
    setActionDialog({ open: true, type, booking: b });
  };
  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, booking: null });
    setActionNotes("");
  };

  const handleComplete = async () => {
    if (!actionDialog.booking) return;
    setCompleteLoading(true);
    try {
      const filesToSend = completeResultFiles.length > 0 ? completeResultFiles : undefined;
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.completeBooking(bookingPk, filesToSend);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const uploaded = (response.data as { uploaded_files?: string[] })?.uploaded_files ?? [];
      setCompleteUploadedFiles(uploaded);
      toast.success((response.data as { message?: string })?.message || "Booking marked as completed");
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to complete booking");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!actionDialog.booking) return;
    setActionSubmitLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.refundBooking(bookingPk, actionNotes || undefined);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking refunded successfully");
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refund booking");
    } finally {
      setActionSubmitLoading(false);
    }
  };

  const handleMarkNotUtilized = async () => {
    if (!actionDialog.booking) return;
    setActionSubmitLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.markBookingNotUtilized(bookingPk, sendEmailToSupervisor);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking marked as Not Utilized.");
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to mark booking as not utilized");
    } finally {
      setActionSubmitLoading(false);
    }
  };

  const handleAbsent = async () => {
    if (!actionDialog.booking) return;
    setActionSubmitLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.absentBooking(bookingPk, actionNotes || undefined);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(
        (response.data as { message?: string })?.message ||
          "Booking marked as Operator Unavailable. The user was notified to choose refund or reschedule."
      );
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to mark booking as operator unavailable");
    } finally {
      setActionSubmitLoading(false);
    }
  };

  const handleUnderMaintenanceDisruption = async () => {
    if (!actionDialog.booking) return;
    setActionSubmitLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.bookingMaintenanceDisruption(bookingPk, actionNotes || undefined);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const data = response.data as { message?: string; booking?: BookingDetailCardBooking } | undefined;
      if (data?.booking) setBooking(data.booking);
      toast.success(data?.message || "Booking flagged for under-maintenance disruption. User has been notified.");
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to flag booking for under maintenance");
    } finally {
      setActionSubmitLoading(false);
    }
  };

  const handleOtherDisruption = async () => {
    if (!actionDialog.booking) return;
    const reason = (actionNotes || "").trim();
    if (!reason) {
      toast.error("Reason is required for Other Disruption.");
      return;
    }
    setActionSubmitLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = await apiClient.bookingOtherDisruption(bookingPk, reason);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const data = response.data as { message?: string; booking?: BookingDetailCardBooking } | undefined;
      if (data?.booking) setBooking(data.booking);
      toast.success(data?.message || "Booking flagged for Other Disruption. User has been notified.");
      setConfirmAction({ open: false, type: null });
      closeActionDialog();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to flag booking for other disruption");
    } finally {
      setActionSubmitLoading(false);
    }
  };

  const handleRescheduleConfirm = async (startTimeISO: string, endTimeISO: string) => {
    if (!actionDialog.booking) return;
    setRescheduleLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      // Admin / OIC / Lab Operator use staff reschedule (any booking); users use own-booking endpoint.
      const response = isOperator || isManagerOrAdmin
        ? await apiClient.rescheduleBooking(bookingPk, startTimeISO, endTimeISO)
        : await apiClient.userRescheduleBooking(bookingPk, startTimeISO, endTimeISO);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking rescheduled successfully");
      closeActionDialog();
      setConfirmAction({ open: false, type: null });
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reschedule booking");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleConfirmActionProceed = async () => {
    const { type } = confirmAction;
    if (!type) return;
    if (type === "complete" && actionDialog.booking) {
      setConfirmAction({ open: false, type: null });
      await handleComplete();
      return;
    }
    if (type === "refund" && actionDialog.booking) {
      setConfirmAction({ open: false, type: null });
      await handleRefund();
      return;
    }
    if (type === "absent" && actionDialog.booking) {
      setConfirmAction({ open: false, type: null });
      await handleAbsent();
      return;
    }
    if (type === "not_utilized" && actionDialog.booking) {
      setConfirmAction({ open: false, type: null });
      await handleMarkNotUtilized();
      return;
    }
    if (type === "reschedule" && confirmAction.rescheduleStart != null && confirmAction.rescheduleEnd != null && actionDialog.booking) {
      setConfirmAction({ open: false, type: null });
      await handleRescheduleConfirm(confirmAction.rescheduleStart, confirmAction.rescheduleEnd);
      return;
    }
    if (type === "charge_recalc_refund" && confirmAction.chargeRecalcBooking) {
      setConfirmAction({ open: false, type: null });
      await handleProcessChargeRecalcRefund(confirmAction.chargeRecalcBooking);
      return;
    }
    if (type === "charge_recalc_pay" && confirmAction.chargeRecalcBooking) {
      setConfirmAction({ open: false, type: null });
      await handleProcessChargeRecalcPayNow(confirmAction.chargeRecalcBooking);
      return;
    }
    setConfirmAction({ open: false, type: null });
  };

  const handleProcessChargeRecalcRefund = async (b: BookingDetailCardBooking) => {
    setChargeRecalcActionLoading(true);
    try {
      const backendId = getRealBookingId(b);
      if (backendId == null) {
        toast.error("This booking cannot be processed right now.");
        return;
      }
      const res = await apiClient.processChargeRecalculationRefund(backendId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success((res.data as { message?: string })?.message || "Refund processed. Amount credited to wallet.");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to process refund");
    } finally {
      setChargeRecalcActionLoading(false);
    }
  };

  const handleProcessChargeRecalcPayNow = async (b: BookingDetailCardBooking) => {
    setChargeRecalcActionLoading(true);
    try {
      const backendId = getRealBookingId(b);
      if (backendId == null) {
        toast.error("This booking cannot be processed right now.");
        return;
      }
      const res = await apiClient.processChargeRecalculationPayNow(backendId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success((res.data as { message?: string })?.message || "Payment processed. Amount debited from wallet.");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to process payment");
    } finally {
      setChargeRecalcActionLoading(false);
    }
  };

  const submitIstemFbr = async () => {
    if (bookingPk == null) return;
    const v = fbrInput.trim();
    if (!v) {
      toast.error("Enter your FBR number from the I-STEM portal.");
      return;
    }
    setFbrSaving(true);
    try {
      const res = await apiClient.updateBookingIstemFbr(bookingPk, v);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("FBR submitted for Officer in Charge verification.");
      await refreshBookingDetail();
      onUpdated();
    } finally {
      setFbrSaving(false);
    }
  };

  const executeIstemFbrReview = async () => {
    if (bookingPk == null) return;
    setFbrReviewLoading("execute");
    try {
      const res = await apiClient.reviewBookingIstemFbr(bookingPk, "execute");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("FBR marked as verified.");
      setFbrInvalidateReason("");
      await refreshBookingDetail();
      onUpdated();
    } finally {
      setFbrReviewLoading(null);
    }
  };

  const invalidateIstemFbrReview = async () => {
    if (bookingPk == null) return;
    const reason = fbrInvalidateReason.trim();
    if (!reason) {
      toast.error("Enter a short reason so the user can correct the FBR.");
      return;
    }
    setFbrReviewLoading("invalidate");
    try {
      const res = await apiClient.reviewBookingIstemFbr(bookingPk, "invalidate", reason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User will be notified to update the FBR.");
      setFbrInvalidateReason("");
      await refreshBookingDetail();
      onUpdated();
    } finally {
      setFbrReviewLoading(null);
    }
  };

  const isOperatorOrManager = isOperator || isManagerOrAdmin;
  const normalizedCurrentUserType = String(currentUserType || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const isFinanceUser =
    normalizedCurrentUserType === "finance" ||
    normalizedCurrentUserType.includes("accountsincharge") ||
    normalizedCurrentUserType.includes("accounts") ||
    normalizedCurrentUserType.includes("finance");
  const isLabInchargeType =
    normalizedCurrentUserType.includes("labincharge") ||
    normalizedCurrentUserType.includes("labinchargeuser");
  const isCurrentUserLabInchargeContact =
    currentUserId != null &&
    booking.lab_in_charge != null &&
    booking.lab_in_charge.user_id === currentUserId;
  const isLabInchargeUser = isLabInchargeType || isCurrentUserLabInchargeContact;
  const bookingUserTypeLower = (booking.user_type_snapshot || "").toLowerCase();
  const isExternalBookingType = isExternalBookingUserType(booking.user_type_snapshot);
  const isExternalSelfView = !isOperatorOrManager && currentUserId != null && booking.user === currentUserId && isExternalBookingType;

  const canSubmitRating =
    booking.equipment_user_rating_enabled === true &&
    !isOperatorOrManager &&
    currentUserId != null &&
    booking.user === currentUserId &&
    booking.status.toUpperCase() === "COMPLETED" &&
    booking.rating == null;

  const allCriteriaSelected = Object.values(ratingCriteriaDraft).every((v) => v === true || v === false);
  const computedOverallFromDraft = allCriteriaSelected ? Object.values(ratingCriteriaDraft).filter((v) => v === true).length : null;

  const isCompleted = booking.status.toUpperCase() === "COMPLETED";
  const isRefunded = booking.status.toUpperCase() === "REFUNDED";
  const isOperatorUnavailable = booking.status.toUpperCase() === "ABSENT";
  const isBookingNotUtilized = booking.status.toUpperCase() === "BOOKING_NOT_UTILIZED";
  const isHold = booking.status.toUpperCase() === "HOLD";
  const sampleTraceList = booking.sample_trace ?? [];
  const traceHasSampleAccepted = sampleTraceList.some(
    (e) => String(e.status || "").toUpperCase() === "SAMPLE_ACCEPTED"
  );
  const canEditAtmosphereSensitive =
    booking.equipment_atmosphere_sensitive_sample_enabled === true &&
    !isWaitlistedEntry &&
    booking.status.toUpperCase() === "BOOKED" &&
    !traceHasSampleAccepted &&
    bookingPk != null &&
    (isOperatorOrManager || (currentUserId != null && booking.user === currentUserId));
  const traceHasAnalyzed = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "COMPLETED");
  const traceHasReturned = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "RETURNED");
  const traceHasArchived = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "ARCHIVED");
  const traceHasDisposed = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "DISPOSED");
  const returnShippingAccountsLocked = traceHasReturned;

  /** Match Sample Lifecycle: Analyzed shows Done when trace has COMPLETED or booking is Completed. */
  const analyzedDoneForStaffActions = traceHasAnalyzed || isCompleted;
  /** Staff can record return / dispose while booking is still Booked (trace ahead of formal Complete) or Completed. */
  const bookingAllowsPostAnalyzedLifecycleActions =
    (booking.status.toUpperCase() === "BOOKED" || isCompleted) &&
    !isHold &&
    !isRefunded &&
    !isOperatorUnavailable &&
    !isBookingNotUtilized;

  /** After Analyzed: physical return path only (not archive/dispose track). */
  const showSampleReturnedAction =
    isOperatorOrManager &&
    bookingAllowsPostAnalyzedLifecycleActions &&
    analyzedDoneForStaffActions &&
    !traceHasReturned &&
    !traceHasArchived &&
    !traceHasDisposed;

  /** After Archived (e.g. retention) without a prior return — dispose only. */
  const showSampleDisposedAction =
    isOperatorOrManager &&
    bookingAllowsPostAnalyzedLifecycleActions &&
    traceHasArchived &&
    !traceHasReturned &&
    !traceHasDisposed;

  const hasDownloadableResults = !!(resultsData?.exists && (resultsData?.files?.length || 0) > 0);
  const showIstemWorkflow =
    !isWaitlistedEntry &&
    !isFinanceUser &&
    (Boolean(booking.require_istem_fbr) || booking.istem_fbr_status != null);
  const istemPortalUrl = (booking.istem_portal_url || "https://www.istem.gov.in/").trim();
  const istemFbrStatusUrl = (booking.istem_fbr_status_url || "").trim();
  const canSubmitIstemFbr =
    booking.istem_fbr_status === "PENDING_FBR" ||
    booking.istem_fbr_status === "INVALID" ||
    (Boolean(booking.require_istem_fbr) && !booking.istem_fbr_status);
  const isBookingOwnerView =
    !isOperatorOrManager && currentUserId != null && booking.user === currentUserId;
  const equipmentRepeatSampleRequestEnabled =
    booking.equipment_repeat_sample_request_days != null &&
    Number(booking.equipment_repeat_sample_request_days) > 0;
  const repeatSampleRequestPending =
    (booking.repeat_sample_request_status || "").toUpperCase() === "PENDING";
  const oicContacts = Array.isArray(booking.oic_contacts) ? booking.oic_contacts : [];

  return (
    <div id="booking-detail-section" className="mt-6 scroll-mt-6">
      <div className="flex flex-wrap gap-2 mb-4 no-print">
        <Button variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
        {showPrintButton && (
          <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print booking">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        )}
      </div>
      <Card className="booking-detail-print-area">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{booking.equipment_name}</CardTitle>
              <p className="text-xl font-semibold text-foreground mt-1 tracking-tight flex flex-wrap items-center gap-2">
                <span>Booking ID- {booking.virtual_booking_id || `${booking.equipment_code}-#${booking.booking_id}`}</span>
                <IstemFbrSeal
                  requireIstemFbr={booking.require_istem_fbr}
                  istemFbrStatus={booking.istem_fbr_status}
                  size="md"
                  showLabel
                />
              </p>
              <div className="mt-2">
                <UserProfile
                  name={booking.user_name}
                  email={booking.user_email}
                  phone={booking.user_phone}
                  department={booking.user_department}
                  profilePicture={booking.user_profile_picture ? apiClient.getProfilePictureUrl(booking.user) : undefined}
                  size="sm"
                />
                {booking.wallet_owner_name && (
                  <div className="flex items-center gap-1 text-base text-muted-foreground mt-2 ml-11">
                    <UserCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Supervisor Name: {booking.wallet_owner_name}</span>
                  </div>
                )}
              </div>
            </div>
            <Badge className={`${getStatusColor(booking.status)} text-sm`}>{booking.status_display}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-base">
          {!isWaitlistedEntry ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-base text-muted-foreground">Start Time</p>
                <p className="font-medium text-base">{new Date(booking.start_time).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">End Time</p>
                <p className="font-medium text-base">{new Date(booking.end_time).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">Duration</p>
                <p className="font-medium text-base">
                  {booking.total_time_minutes} min ({Number(booking.total_hours).toFixed(2)} hrs)
                </p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">Total Cost</p>
                <p className="font-medium text-base text-primary">{formatINR(booking.total_charge)}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-base text-muted-foreground">Joined</p>
                <p className="font-medium text-base">
                  {booking.created_at ? new Date(booking.created_at).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">Queue position</p>
                <p className="font-medium text-base">
                  {booking.waitlist_code || `WL${booking.waitlist_position ?? "—"}`}
                </p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">Requested duration</p>
                <p className="font-medium text-base">
                  {waitlistRequestedDurationMinutes != null
                    ? `${waitlistRequestedDurationMinutes} min (${(waitlistRequestedDurationMinutes / 60).toFixed(2)} hrs)`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-base text-muted-foreground">Status</p>
                <p className="font-medium text-base">{booking.status_display}</p>
              </div>
            </div>
          )}

          {(booking.lifecycle_countdown?.enabled || booking.completion_countdown?.enabled) &&
            (booking.lifecycle_countdown?.deadline_at || booking.completion_countdown?.deadline_at) && (
            <BookingLifecycleCountdown
              countdown={(booking.lifecycle_countdown || booking.completion_countdown)!}
            />
          )}

          {canEditAtmosphereSensitive ? (
            <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="booking-atmosphere-sensitive"
                  checked={!!booking.atmosphere_sensitive_sample}
                  disabled={atmosphereSaving}
                  onCheckedChange={(c) => {
                    void handleAtmosphereSensitiveChange(c === true);
                  }}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="booking-atmosphere-sensitive" className="font-medium cursor-pointer">
                    Atmosphere-sensitive sample (submit at slot start)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    You can turn this on or off until Sample Accepted. When enabled, the sample may be submitted
                    at slot start and lab staff should not mark Booking Not Utilized before the slot begins.
                  </p>
                </div>
              </div>
              {booking.atmosphere_sensitive_sample && (
                <p className="text-sm text-sky-900 dark:text-sky-100 pl-7">
                  Flagged for staff: sample will be brought at slot start.
                </p>
              )}
            </div>
          ) : booking.atmosphere_sensitive_sample ? (
            <div className="mb-4 rounded-lg border border-sky-500/40 bg-sky-50/80 dark:bg-sky-950/30 px-3 py-2 text-sm text-sky-900 dark:text-sky-100">
              Atmosphere-sensitive sample: will be submitted at slot start. Do not mark Booking Not Utilized before the slot begins.
            </div>
          ) : null}

          {showIstemWorkflow && (
            <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/25 p-4 mb-4 space-y-3">
              <p className="font-semibold text-foreground">I-STEM (national portal)</p>
              {isManagerOrAdmin ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Verify the user&apos;s FBR number on I-STEM before marking it verified or rejected.
                  </p>
                  {istemFbrStatusUrl ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <a href={istemFbrStatusUrl} target="_blank" rel="noopener noreferrer">
                          Check FBR Status
                        </a>
                      </Button>
                      <p className="text-xs text-muted-foreground break-all">{istemFbrStatusUrl}</p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      FBR status check URL is not configured for this equipment. Add it under equipment settings
                      (I-STEM FBR status check URL).
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Parallel booking on the Government of India portal is required. Create your booking on I-STEM using
                    the link below, then enter your Facility Booking Record (FBR) number for verification by the
                    Officer in Charge.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={istemPortalUrl} target="_blank" rel="noopener noreferrer">
                      Open I-STEM booking page
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground break-all">{istemPortalUrl}</p>
                </>
              )}
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-medium">{booking.istem_fbr_status_display || booking.istem_fbr_status || "—"}</span>
                </p>
                {booking.istem_fbr_number ? (
                  <p>
                    <span className="text-muted-foreground">FBR number: </span>
                    <span className="font-mono">{booking.istem_fbr_number}</span>
                  </p>
                ) : null}
                {booking.istem_fbr_invalid_reason ? (
                  <p className="text-destructive whitespace-pre-wrap">{booking.istem_fbr_invalid_reason}</p>
                ) : null}
              </div>
              {isBookingOwnerView && canSubmitIstemFbr && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="istem-fbr-input">I-STEM FBR number</Label>
                      <Input
                        id="istem-fbr-input"
                        value={fbrInput}
                        onChange={(e) => setFbrInput(e.target.value)}
                        placeholder="From your I-STEM booking"
                        className="font-mono"
                      />
                    </div>
                    <Button type="button" onClick={() => void submitIstemFbr()} disabled={fbrSaving}>
                      {fbrSaving ? "Saving…" : "Submit FBR"}
                    </Button>
                  </div>
                )}
              {isManagerOrAdmin && booking.istem_fbr_status === "PENDING_OIC" && (
                <div className="space-y-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                  <p className="text-sm font-medium">
                    OIC: use Check FBR Status on I-STEM to verify, then mark below.
                  </p>
                  {istemFbrStatusUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={istemFbrStatusUrl} target="_blank" rel="noopener noreferrer">
                        Check FBR Status
                      </a>
                    </Button>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={fbrReviewLoading !== null}
                      onClick={() => void executeIstemFbrReview()}
                    >
                      {fbrReviewLoading === "execute" ? "Working…" : "Mark FBR Verified"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="istem-fbr-invalidate">Reject FBR (reason to user)</Label>
                    <Textarea
                      id="istem-fbr-invalidate"
                      value={fbrInvalidateReason}
                      onChange={(e) => setFbrInvalidateReason(e.target.value)}
                      rows={2}
                      placeholder="e.g. FBR not found — please copy the exact number from I-STEM."
                      className="resize-none"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={fbrReviewLoading !== null}
                      onClick={() => void invalidateIstemFbrReview()}
                    >
                      {fbrReviewLoading === "invalidate" ? "Working…" : "Mark FBR invalid"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Invoice + technical contacts: all booking statuses and viewer roles (internal/external/student/faculty/operator/OIC). */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isWaitlistedEntry && (
                <div className="border rounded-md p-3">
                  <p className="text-base font-semibold text-foreground mb-2">
                    For Invoice Related Query Please Contact the Undersigned
                  </p>
                  {booking.accounts_in_charge ? (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium text-sky-700 dark:text-sky-300">{booking.accounts_in_charge.name}</span>
                      </div>
                      {booking.accounts_in_charge.phone ? <div>Contact Number: {booking.accounts_in_charge.phone}</div> : null}
                      {booking.accounts_in_charge.email ? <div>Email: {booking.accounts_in_charge.email}</div> : null}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Not available.</div>
                  )}
                </div>
              )}

              <div className="border rounded-md p-3">
                <p className="text-base font-semibold text-foreground mb-2">
                  For Any Other Technical Query Please Contact the Undersigned-
                </p>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Level 1: Lab Incharge</p>
                    {booking.lab_in_charge ? (
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        <div>
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">{booking.lab_in_charge.name}</span>
                        </div>
                        {booking.lab_in_charge.phone ? <div>Contact Number: {booking.lab_in_charge.phone}</div> : null}
                        {booking.lab_in_charge.email ? <div>Email: {booking.lab_in_charge.email}</div> : null}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-1">Not available.</div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Level 2: Officer In-Charge</p>
                    {oicContacts.length > 0 ? (
                      <div className="space-y-2 mt-1">
                        {oicContacts.map((c) => (
                          <div key={c.user_id} className="text-sm text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium text-violet-700 dark:text-violet-300">{c.name}</span>
                            </div>
                            {c.phone ? <div>Contact Number: {c.phone}</div> : null}
                            {c.email ? <div>Email: {c.email}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-1">Not available.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(booking.rating != null || booking.rating_feedback != null) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-2">User rating</p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {booking.rating != null ? (
                    <>
                      <span className="inline-flex items-center gap-2">
                        <Badge variant="secondary">{booking.rating}/5</Badge>
                        {booking.rated_at && (
                          <span className="text-sm text-muted-foreground">• {new Date(booking.rated_at).toLocaleString()}</span>
                        )}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="grid gap-1 text-sm">
                  {[
                    ["On-Time Operator Availability", booking.rating_on_time_operator_availability],
                    ["Laboratory Cleanliness & Organization", booking.rating_laboratory_cleanliness_organization],
                    ["Sample Handling & Care", booking.rating_sample_handling_care],
                    ["Operator Behaviour & Professionalism", booking.rating_operator_behaviour_professionalism],
                    ["Compliance with Booking Request Parameters", booking.rating_compliance_booking_request_parameters],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{label}</span>
                      {val === true ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" /> Yes
                        </span>
                      ) : val === false ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                          <XCircle className="h-4 w-4" /> No
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  ))}
                </div>
                {booking.rating_feedback && <p className="text-sm text-muted-foreground">{booking.rating_feedback}</p>}
              </div>
            </div>
          )}

          {canSubmitRating && (
            <div className="mt-4 pt-4 border-t no-print">
              <p className="text-base font-medium mb-2">Rate this booking</p>
              <div className="flex flex-col gap-3">
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Overall rating</p>
                    <Badge variant="secondary">{computedOverallFromDraft != null ? `${computedOverallFromDraft}/5` : "—"}</Badge>
                  </div>

                  {([
                    ["on_time_operator_availability", "On-Time Operator Availability"],
                    ["laboratory_cleanliness_organization", "Laboratory Cleanliness & Organization"],
                    ["sample_handling_care", "Sample Handling & Care"],
                    ["operator_behaviour_professionalism", "Operator Behaviour & Professionalism"],
                    ["compliance_booking_request_parameters", "Compliance with Booking Request Parameters"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Label className="text-sm">{label}</Label>
                      <RadioGroup
                        className="flex items-center gap-4"
                        value={
                          ratingCriteriaDraft[key] === true ? "yes" : ratingCriteriaDraft[key] === false ? "no" : ""
                        }
                        onValueChange={(v) =>
                          setRatingCriteriaDraft((prev) => ({
                            ...prev,
                            [key]: v === "yes",
                          }))
                        }
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id={`rate-${key}-yes`} value="yes" disabled={ratingSubmitting} />
                          <Label htmlFor={`rate-${key}-yes`} className="text-sm">
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id={`rate-${key}-no`} value="no" disabled={ratingSubmitting} />
                          <Label htmlFor={`rate-${key}-no`} className="text-sm">
                            No
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="booking-rating-feedback">Feedback (optional)</Label>
                  <Textarea
                    id="booking-rating-feedback"
                    value={ratingFeedbackDraft}
                    onChange={(e) => setRatingFeedbackDraft(e.target.value)}
                    placeholder="Share your experience..."
                    className="mt-1"
                    disabled={ratingSubmitting}
                  />
                </div>

                <div>
                  <Button
                    size="sm"
                    disabled={ratingSubmitting || !allCriteriaSelected}
                    onClick={async () => {
                      if (!allCriteriaSelected) {
                        toast.error("Please select Yes/No for all rating points.");
                        return;
                      }
                      setRatingSubmitting(true);
                      try {
                        if (bookingPk == null) {
                          toast.error("This booking cannot be rated right now.");
                          return;
                        }
                        const res = await apiClient.rateBooking(bookingPk, {
                          on_time_operator_availability: ratingCriteriaDraft.on_time_operator_availability === true,
                          laboratory_cleanliness_organization: ratingCriteriaDraft.laboratory_cleanliness_organization === true,
                          sample_handling_care: ratingCriteriaDraft.sample_handling_care === true,
                          operator_behaviour_professionalism: ratingCriteriaDraft.operator_behaviour_professionalism === true,
                          compliance_booking_request_parameters: ratingCriteriaDraft.compliance_booking_request_parameters === true,
                          feedback: ratingFeedbackDraft,
                        });
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        // Refresh rating section immediately in this detail card.
                        const ratedAt = new Date().toISOString();
                        const overall = computedOverallFromDraft ?? 0;
                        setBooking((prev) => ({
                          ...prev,
                          rating: overall,
                          rating_on_time_operator_availability: ratingCriteriaDraft.on_time_operator_availability,
                          rating_laboratory_cleanliness_organization: ratingCriteriaDraft.laboratory_cleanliness_organization,
                          rating_sample_handling_care: ratingCriteriaDraft.sample_handling_care,
                          rating_operator_behaviour_professionalism: ratingCriteriaDraft.operator_behaviour_professionalism,
                          rating_compliance_booking_request_parameters: ratingCriteriaDraft.compliance_booking_request_parameters,
                          rating_feedback: ratingFeedbackDraft?.trim() ? ratingFeedbackDraft.trim() : null,
                          rated_at: ratedAt,
                        }));
                        toast.success((res.data as any)?.message || "Rating submitted.");
                        onUpdated();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed to submit rating");
                      } finally {
                        setRatingSubmitting(false);
                      }
                    }}
                  >
                    Submit rating
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t no-print">
            <p className="text-base font-medium mb-2">Actions:</p>
            {isRefunded && (
              <p className="text-sm text-muted-foreground mb-2">
                Actions are disabled for refunded bookings.
              </p>
            )}
            {isHold && (
              <p className="text-sm text-muted-foreground mb-2">
                Actions are disabled while booking is in hold state.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {isFinanceUser &&
                isExternalBookingType &&
                booking.sample_return_after_analysis === true &&
                analyzedDoneForStaffActions && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isRefunded ||
                        downloadingDoc !== null ||
                        returnShippingAccountsLocked
                      }
                      onClick={async () => {
                        setDownloadingDoc("label");
                        try {
                          if (bookingPk == null) {
                            toast.error("Return shipping label is unavailable for this booking.");
                            return;
                          }
                          const res = await apiClient.getBookingReturnShippingLabelPdfBlob(bookingPk);
                          if (res.error) {
                            toast.error(res.error);
                            return;
                          }
                          if (res.blob) {
                            const url = URL.createObjectURL(res.blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `return_shipping_label_${booking.virtual_booking_id || booking.booking_id}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        } finally {
                          setDownloadingDoc(null);
                        }
                      }}
                    >
                      <FolderDown className="h-4 w-4 mr-2" />
                      {downloadingDoc === "label" ? "Preparing…" : "Return shipping label"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRefunded || returnShippingAccountsLocked}
                      onClick={() => {
                        setReturnShipCompany("");
                        setReturnShipOther("");
                        setReturnShipTracking(booking.return_shipping_tracking_id || "");
                        setReturnShipDialogOpen(true);
                      }}
                    >
                      <Handshake className="h-4 w-4 mr-2" />
                      Update shipping information
                    </Button>
                    <Dialog open={returnShipDialogOpen} onOpenChange={setReturnShipDialogOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Update shipping information</DialogTitle>
                          <DialogDescription>
                            Select the shipping company and enter the tracking number. This will email the user, mark the sample as
                            returned, and close the lifecycle for further changes.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Shipping company</Label>
                            <Select value={returnShipCompany} onValueChange={setReturnShipCompany}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DTDC">DTDC</SelectItem>
                                <SelectItem value="BLUE_DART">Blue Dart</SelectItem>
                                <SelectItem value="INDIAN_SPEED_POST">Indian Speed Post</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {returnShipCompany === "OTHER" ? (
                            <div className="space-y-2">
                              <Label htmlFor="return-ship-other">Company name</Label>
                              <Input
                                id="return-ship-other"
                                value={returnShipOther}
                                onChange={(e) => setReturnShipOther(e.target.value)}
                                placeholder="Enter shipping company name"
                              />
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            <Label htmlFor="return-ship-tracking">Tracking number</Label>
                            <Input
                              id="return-ship-tracking"
                              value={returnShipTracking}
                              onChange={(e) => setReturnShipTracking(e.target.value)}
                              placeholder="AWB / tracking ID"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" type="button" onClick={() => setReturnShipDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            disabled={returnShipSaving}
                            onClick={async () => {
                              if (!returnShipCompany) {
                                toast.error("Select a shipping company.");
                                return;
                              }
                              if (returnShipCompany === "OTHER" && !returnShipOther.trim()) {
                                toast.error("Enter the company name for Other.");
                                return;
                              }
                              if (!returnShipTracking.trim()) {
                                toast.error("Enter the tracking number.");
                                return;
                              }
                              if (bookingPk == null) {
                                toast.error("This booking cannot be updated right now.");
                                return;
                              }
                              setReturnShipSaving(true);
                              try {
                                const res = await apiClient.setBookingReturnShippingTracking(bookingPk, {
                                  shipping_company: returnShipCompany,
                                  ...(returnShipCompany === "OTHER"
                                    ? { other_company_name: returnShipOther.trim() }
                                    : {}),
                                  tracking_number: returnShipTracking.trim(),
                                });
                                if (res.error) {
                                  toast.error(res.error);
                                  return;
                                }
                                toast.success(res.data?.message || "Shipping details saved and user notified.");
                                setReturnShipDialogOpen(false);
                                await refreshBookingDetail();
                                onUpdated();
                              } finally {
                                setReturnShipSaving(false);
                              }
                            }}
                          >
                            {returnShipSaving ? "Updating…" : "Update"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              {isExternalSelfView && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRefunded}
                      onClick={async () => {
                        try {
                          const blob = await generateExternalEquipmentRequisitionFormPdf(booking);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `equipment_requisition_${booking.virtual_booking_id || booking.booking_id}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to generate form.");
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Equipment requisition form
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isRefunded ||
                        downloadingDoc !== null ||
                        !(Array.isArray(booking.sample_trace) &&
                          booking.sample_trace.some((e: any) => e.status === "COMPLETED"))
                      }
                      onClick={async () => {
                        setDownloadingDoc("invoice");
                        try {
                          if (bookingPk == null) {
                            toast.error("Invoice is unavailable for this booking.");
                            return;
                          }
                          const res = await apiClient.getBookingInvoicePdfBlob(bookingPk);
                          if (res.error) {
                            toast.error(res.error);
                            return;
                          }
                          if (res.blob) {
                            const url = URL.createObjectURL(res.blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `invoice_${booking.virtual_booking_id || booking.booking_id}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        } finally {
                          setDownloadingDoc(null);
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadingDoc === "invoice" ? "Preparing…" : "Invoice (PDF)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRefunded || downloadingDoc !== null}
                      onClick={async () => {
                        setDownloadingDoc("label");
                        try {
                          if (bookingPk == null) {
                            toast.error("Shipping label is unavailable for this booking.");
                            return;
                          }
                          const res = await apiClient.getBookingShippingLabelPdfBlob(bookingPk);
                          if (res.error) {
                            toast.error(res.error);
                            return;
                          }
                          if (res.blob) {
                            const url = URL.createObjectURL(res.blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `shipping_label_${booking.virtual_booking_id || booking.booking_id}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        } finally {
                          setDownloadingDoc(null);
                        }
                      }}
                    >
                      <FolderDown className="h-4 w-4 mr-2" />
                      {downloadingDoc === "label" ? "Preparing…" : "Shipping label"}
                    </Button>
                  </>
                )}
              {onUserCancelClick &&
                !isHold &&
                (booking.status.toUpperCase() === "PENDING" ||
                  booking.status.toUpperCase() === "BOOKED" ||
                  booking.status.toUpperCase() === "DISRUPTION_PENDING" ||
                  booking.status.toUpperCase() === "WAITLISTED" ||
                  (booking as any).is_waitlist_entry === true) &&
                !booking.source_booking_id &&
                (currentUserId != null && booking.user === currentUserId && !isExternalBookingUserType(booking.user_type_snapshot) || (!isOperator && !isExternalSelfView)) && (
                  <Button size="sm" variant="destructive" onClick={() => onUserCancelClick(booking)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    {isWaitlistedEntry ? "Cancel waitlist" : "Cancel booking"}
                  </Button>
                )}
              {!isHold && isOperatorOrManager && canPerformAction(booking, "complete", isOperator) && !isExternalSelfView && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("complete", booking)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {!isHold && isOperatorOrManager && !isLabInchargeUser && canPerformAction(booking, "refund", isOperator) && !isExternalSelfView && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("refund", booking)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refund
                </Button>
              )}
              {!isHold && isOperatorOrManager && !isLabInchargeUser && canPerformAction(booking, "absent", isOperator) && !isExternalSelfView && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("absent", booking)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Operator Unavailable
                </Button>
              )}
              {!isHold &&
                isManagerOrAdmin &&
                canPerformAction(booking, "under_maintenance", isOperator) &&
                !isExternalSelfView && (
                  <Button size="sm" variant="outline" onClick={() => openActionDialog("under_maintenance", booking)}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Under maintenance
                  </Button>
                )}
              {!isHold &&
                isManagerOrAdmin &&
                canPerformAction(booking, "other_disruption", isOperator) &&
                !isExternalSelfView && (
                  <Button size="sm" variant="outline" onClick={() => openActionDialog("other_disruption", booking)}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Other Disruption
                  </Button>
                )}
              {!isHold &&
                !isOperator &&
                !isLabInchargeUser &&
                !isFinanceUser &&
                canPerformAction(booking, "reschedule", isOperator) &&
                !isExternalSelfView && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("reschedule", booking)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
              )}
              {!isHold && isOperatorOrManager && booking.status.toUpperCase() === "BOOKED" && !isExternalSelfView && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canMarkBookingNotUtilized(booking)}
                  onClick={() => canMarkBookingNotUtilized(booking) && openActionDialog("not_utilized", booking)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Booking Not Utilized
                </Button>
              )}
              {isManagerOrAdmin &&
                booking.status.toUpperCase() === "COMPLETED" &&
                !booking.repeat_sample_enabled &&
                !booking.repeat_booking_already_created && (
                <Button size="sm" variant="outline" onClick={handleEnableRepeatSample} disabled={enableRepeatLoading}>
                  <CopyPlus className="h-4 w-4 mr-2" />
                  {enableRepeatLoading ? "Enabling…" : "Enable repeat sample"}
                </Button>
              )}
              {isManagerOrAdmin &&
                (booking.status.toUpperCase() === "BOOKED" || booking.status.toUpperCase() === "PENDING") &&
                !isExternalSelfView && (
                <div className="w-full mt-3 rounded-lg border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Extend operator-absent grace (no slot change)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Delays automatic Operator Absent / Operator Unavailable until the chosen time. Booking slots stay unchanged. The booking user is notified with the reason.
                  </p>
                  {booking.operator_absent_hold_until && (
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Current hold until:{" "}
                      {new Date(booking.operator_absent_hold_until).toLocaleString()}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="extend-hold-until" className="text-xs">Hold until</Label>
                      <Input
                        id="extend-hold-until"
                        type="datetime-local"
                        value={extendHoldUntilLocal}
                        onChange={(e) => setExtendHoldUntilLocal(e.target.value)}
                        className="h-9 w-[220px]"
                      />
                    </div>
                    <div className="space-y-1 min-w-[220px]">
                      <Label className="text-xs">Reason</Label>
                      <Select value={extendHoldReasonCode || undefined} onValueChange={setExtendHoldReasonCode}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operator_medical_emergency">Operator medical emergency</SelectItem>
                          <SelectItem value="minor_equipment_issue">Minor Equipment Issue</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {extendHoldReasonCode === "other" && (
                      <div className="space-y-1 w-full max-w-md">
                        <Label htmlFor="extend-hold-reason-detail" className="text-xs">Specify reason</Label>
                        <Textarea
                          id="extend-hold-reason-detail"
                          value={extendHoldReasonDetail}
                          onChange={(e) => setExtendHoldReasonDetail(e.target.value)}
                          placeholder="Describe the reason…"
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        extendHoldLoading ||
                        !extendHoldUntilLocal ||
                        !extendHoldReasonCode ||
                        (extendHoldReasonCode === "other" && !extendHoldReasonDetail.trim())
                      }
                      onClick={async () => {
                        if (!extendHoldUntilLocal || !extendHoldReasonCode) return;
                        if (extendHoldReasonCode === "other" && !extendHoldReasonDetail.trim()) {
                          toast.error("Please specify the reason.");
                          return;
                        }
                        setExtendHoldLoading(true);
                        try {
                          const iso = new Date(extendHoldUntilLocal).toISOString();
                          const res = await apiClient.extendBookingOperatorAbsentHold(bookingPk, {
                            hold_until: iso,
                            reason_code: extendHoldReasonCode,
                            reason_detail:
                              extendHoldReasonCode === "other"
                                ? extendHoldReasonDetail.trim()
                                : undefined,
                          });
                          if (res.error) {
                            toast.error(typeof res.error === "string" ? res.error : "Failed to extend hold");
                          } else if (res.data?.booking) {
                            setBooking(res.data.booking as BookingDetailCardBooking);
                            onUpdated();
                            toast.success(res.data.message || "Hold extended");
                            setExtendHoldUntilLocal("");
                            setExtendHoldReasonCode("");
                            setExtendHoldReasonDetail("");
                          }
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Failed to extend hold");
                        } finally {
                          setExtendHoldLoading(false);
                        }
                      }}
                    >
                      {extendHoldLoading ? "Saving…" : "Extend"}
                    </Button>
                    {booking.operator_absent_hold_until && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={extendHoldLoading}
                        onClick={async () => {
                          setExtendHoldLoading(true);
                          try {
                            const res = await apiClient.extendBookingOperatorAbsentHold(bookingPk, {
                              clear: true,
                            });
                            if (res.error) {
                              toast.error(typeof res.error === "string" ? res.error : "Failed to clear hold");
                            } else if (res.data?.booking) {
                              setBooking(res.data.booking as BookingDetailCardBooking);
                              onUpdated();
                              toast.success(res.data.message || "Hold cleared");
                            }
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Failed to clear hold");
                          } finally {
                            setExtendHoldLoading(false);
                          }
                        }}
                      >
                        Clear hold
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {isOperatorOrManager && booking.status.toUpperCase() === "COMPLETED" && booking.repeat_sample_enabled && !booking.repeat_booking_already_created && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-sm font-medium text-green-800 dark:text-green-200">
                  <BadgeCheck className="h-4 w-4" />
                  Repeat sample enabled
                </span>
              )}
              {isOperatorOrManager && booking.status.toUpperCase() === "COMPLETED" && booking.repeat_booking_already_created && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <BadgeCheck className="h-4 w-4" />
                  Repeat sample used
                </span>
              )}
              {showSampleReturnedAction && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={postAnalyzedActionLoading !== null}
                  onClick={handleSampleReturnedAction}
                >
                  {postAnalyzedActionLoading === "RETURNED" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Handshake className="h-4 w-4 mr-2" />
                  )}
                  Sample Returned
                </Button>
              )}
              {showSampleDisposedAction && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={postAnalyzedActionLoading !== null}
                  onClick={() => setSampleDisposedDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disposed
                </Button>
              )}
              {!isOperator &&
                currentUserId != null &&
                booking.user === currentUserId &&
                booking.status.toUpperCase() === "COMPLETED" &&
                !booking.source_booking_id &&
                !isExternalSelfView &&
                repeatEligibility?.can_create_repeat && (
                  <Button size="sm" variant="outline" onClick={handleCreateRepeatBooking}>
                    <CopyPlus className="h-4 w-4 mr-2" />
                    Repeat sample
                  </Button>
                )}
              {!resultsLoading && hasDownloadableResults && (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isRefunded}
                  onClick={() => {
                    if (canSubmitRating) {
                      setRatingRequiredPopupOpen(true);
                      return;
                    }
                    setResultsDialogOpen(true);
                  }}
                >
                  <FolderDown className="h-4 w-4 mr-2" />
                  Results
                </Button>
              )}
              {!resultsLoading && isCompleted && isExternalSelfView && resultsFbrBlock && !hasDownloadableResults && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-600 text-amber-800 dark:text-amber-200"
                  type="button"
                  onClick={() => setResultsFbrInfoOpen(true)}
                >
                  Why can&apos;t I download results?
                </Button>
              )}
            </div>
            <Dialog
              open={sampleDisposedDialogOpen}
              onOpenChange={(open) => {
                setSampleDisposedDialogOpen(open);
                if (!open) setSampleDisposedReason("");
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark sample as disposed</DialogTitle>
                  <DialogDescription>
                    This records disposal in the sample lifecycle and notifies the user by email. Optional remarks are included in the record.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-1">
                  <Label htmlFor="sample-disposed-remarks">Remarks (optional)</Label>
                  <Textarea
                    id="sample-disposed-remarks"
                    value={sampleDisposedReason}
                    onChange={(e) => setSampleDisposedReason(e.target.value)}
                    placeholder="e.g. Retention period ended; sample disposed per policy."
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSampleDisposedDialogOpen(false)}
                    disabled={postAnalyzedActionLoading === "DISPOSED"}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleSampleDisposedConfirm}
                    disabled={postAnalyzedActionLoading === "DISPOSED"}
                  >
                    {postAnalyzedActionLoading === "DISPOSED" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Confirm disposed"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {!isOperator &&
              currentUserId != null &&
              booking.user === currentUserId &&
              isCompleted &&
              !booking.source_booking_id &&
              !isExternalSelfView &&
              !booking.repeat_sample_enabled &&
              (repeatSampleRequestPending ||
                (equipmentRepeatSampleRequestEnabled &&
                  (legacyRepeatInfo?.can_request ||
                    (legacyRepeatInfo != null &&
                      !legacyRepeatInfo.can_request &&
                      !!legacyRepeatInfo.reason)))) && (
                <div className="w-full mt-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm no-print">
                  <p className="font-medium text-foreground mb-1">Repeat sample request</p>
                  {repeatSampleRequestPending && (
                    <p className="text-amber-800 dark:text-amber-200">
                      Your repeat sample request is pending review. You will be notified when it is processed.
                    </p>
                  )}
                  {legacyRepeatInfo?.can_request && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {legacyRepeatInfo.days_left != null && (
                        <span className="text-muted-foreground">
                          {legacyRepeatInfo.days_left} day{legacyRepeatInfo.days_left === 1 ? "" : "s"} left to request
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setLegacyRepeatNotes("");
                          setLegacyRepeatDialogOpen(true);
                        }}
                      >
                        <CopyPlus className="h-4 w-4 mr-2" />
                        Request repeat sample
                      </Button>
                    </div>
                  )}
                  {legacyRepeatInfo &&
                    !legacyRepeatInfo.can_request &&
                    legacyRepeatInfo.reason &&
                    !repeatSampleRequestPending && (
                      <p className="text-muted-foreground mt-1">{legacyRepeatInfo.reason}</p>
                    )}
                </div>
              )}
          </div>

          {!isWaitlistedEntry && booking.equipment_profile_type !== "PRINT_3D" && (
            <div className="mt-4 pt-4 border-t no-print">
            {isHold && (
              <p className="text-sm text-muted-foreground mb-2">
                Sample Lifecycle is disabled while booking is in hold state.
              </p>
            )}
            <SampleTraceTimeline
              bookingId={bookingPk ?? 0}
              sampleTrace={booking.sample_trace ?? []}
              canSetSampleSent={
                !isHold &&
                !isRefunded &&
                !isOperatorUnavailable &&
                !isBookingNotUtilized &&
                currentUserId != null &&
                booking.user === currentUserId
              }
              canSetStaffStatus={
                !isHold &&
                (isOperatorOrManager ||
                  (isFinanceUser && isExternalBookingType && !traceHasReturned))
              }
              onTraceUpdated={(trace) => {
                setBooking((prev) => ({ ...prev, sample_trace: trace }));
              }}
              onUpdated={() => {
                void refreshBookingDetail({ silent: true });
                onUpdated();
              }}
              bookingComplete={booking.status.toUpperCase() === "COMPLETED"}
              bookingNotUtilized={isBookingNotUtilized}
              bookingRefunded={isRefunded}
              bookingOperatorUnavailable={isOperatorUnavailable}
              hideHeldForwardedStep={(() => {
                const ut = (booking.user_type_snapshot || "").toLowerCase();
                return ut === "student" || ut === "faculty";
              })()}
              hideSampleStatusActions={(() => {
                if (isRefunded || isOperatorUnavailable || isBookingNotUtilized || isHold) return true;
                // External bookings: staff only get Hold / Forward (no Accepted/Rejected/Analysis/etc.)
                if (isExternalBookingType) return true;
                if (isOperatorOrManager && !isFinanceUser) return false;
                return true;
              })()}
              canSetHeldForwardedActions={
                // Internal: Accounts + Admin. External: operators/managers/admin/finance.
                isExternalBookingType
                  ? isOperatorOrManager || isFinanceUser
                  : isFinanceUser || normalizedCurrentUserType === "admin"
              }
              showHeldForwardedDespiteHideSampleActions={
                isExternalBookingType &&
                (isOperatorOrManager || isFinanceUser) &&
                !traceHasReturned
              }
              useExternalHoldForwardLabels={isExternalBookingType}
              allowHoldForwardWithoutSampleSent={isFinanceUser}
              restrictBookingUserActionsToSampleSent={(() => {
                if (isRefunded || isOperatorUnavailable || isBookingNotUtilized || isHold) return true;
                // Admin/OIC/Lab staff see all actions. Other users see only Sample Sent in sample lifecycle section.
                if (isOperatorOrManager) return false;
                return true;
              })()}
            />
            </div>
          )}

          <Dialog open={resultsFbrInfoOpen} onOpenChange={setResultsFbrInfoOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Results not available yet</DialogTitle>
                <DialogDescription className="text-left space-y-3 pt-2">
                  <span className="block text-foreground">{resultsFbrBlock?.message}</span>
                  {resultsFbrBlock?.portalUrl ? (
                    <a
                      href={resultsFbrBlock.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-primary font-medium underline"
                    >
                      Open I-STEM portal
                    </a>
                  ) : null}
                  <span className="block text-sm font-medium text-foreground pt-2">Officer in Charge (contact)</span>
                  {oicContacts.length > 0 ? (
                    <ul className="text-sm space-y-2 list-none pl-0">
                      {oicContacts.map((c) => (
                        <li key={c.user_id} className="border rounded-md p-2">
                          <div className="font-medium">{c.name}</div>
                          {c.phone ? <div>Mobile: {c.phone}</div> : null}
                          {c.email ? <div>Email: {c.email}</div> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No OIC contact listed for this equipment. Please use institute helpdesk.</p>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => setResultsFbrInfoOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Download Results</DialogTitle>
                <DialogDescription>
                  Download the entire folder as ZIP (includes booking ID folder and all subfiles), or open individual files below.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={zipDownloadInProgress}
                  onClick={async () => {
                    if (bookingPk == null) {
                      toast.error("Result files are unavailable for this booking.");
                      return;
                    }
                    setZipDownloadInProgress(true);
                    setZipDownloadProgress(8);
                    const err = await apiClient.downloadBookingResultsZip(
                      bookingPk,
                      undefined,
                      (percent) => setZipDownloadProgress(percent)
                    );
                    if (err.error) {
                      if (err.errorCode === "istem_fbr_not_executed") {
                        setResultsFbrBlock({
                          message: err.error,
                          portalUrl: err.istem_portal_url,
                        });
                        setResultsFbrInfoOpen(true);
                      }
                      toast.error(err.error);
                      setZipDownloadInProgress(false);
                      setZipDownloadProgress(0);
                    } else {
                      toast.success("Download started. Save prompt should appear shortly.");
                      setZipDownloadProgress(100);
                      window.setTimeout(() => {
                        setZipDownloadInProgress(false);
                        setZipDownloadProgress(0);
                      }, 700);
                    }
                  }}
                >
                  <FolderDown className="h-4 w-4 mr-2" />
                  {zipDownloadInProgress ? "Preparing ZIP..." : "Download folder (ZIP)"}
                </Button>
                {zipDownloadInProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Preparing and downloading ZIP...</span>
                      <span>{zipDownloadProgress}%</span>
                    </div>
                    <Progress value={zipDownloadProgress} className="h-2" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Individual files:</p>
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {resultsData?.files?.map((file, idx) => (
                    <li key={idx}>
                      <a href={file.download_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Download className="h-4 w-4 shrink-0" />
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={legacyRepeatDialogOpen} onOpenChange={setLegacyRepeatDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Request repeat sample</DialogTitle>
                <DialogDescription>
                  Submit a request for a complimentary repeat sample. Staff will review and approve or reject.
                </DialogDescription>
              </DialogHeader>
              {legacyRepeatInfo?.disclaimer ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto rounded-md border p-3">
                  {legacyRepeatInfo.disclaimer}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="legacy-repeat-notes">Notes (optional)</Label>
                <Textarea
                  id="legacy-repeat-notes"
                  rows={3}
                  value={legacyRepeatNotes}
                  onChange={(e) => setLegacyRepeatNotes(e.target.value)}
                  placeholder="Any details for the lab…"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setLegacyRepeatDialogOpen(false)}
                  disabled={legacyRepeatSubmitLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitLegacyRepeatRequest} disabled={legacyRepeatSubmitLoading}>
                  {legacyRepeatSubmitLoading ? "Submitting…" : "Submit request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {!isFinanceUser && booking.equipment_profile_type === "PRINT_3D" &&
            (booking.print_analyses?.length || booking.print_analysis) && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Print files</p>
              <ul className="text-sm space-y-1">
                {(booking.print_analyses?.length
                  ? booking.print_analyses
                  : booking.print_analysis
                    ? [booking.print_analysis]
                    : []
                ).map((file) => (
                  <li key={file.id} className="flex justify-between gap-2">
                    <span className="truncate">{file.stl_filename || file.id}</span>
                    <span className="text-muted-foreground shrink-0">
                      {file.weight_grams != null ? formatPrintWeightGrams(file.weight_grams) : "—"}
                      {file.estimated_time_minutes != null ? ` · ${file.estimated_time_minutes} min` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {booking.print_analysis && booking.equipment_profile_type === "PRINT_3D" && bookingPk != null && (
            <Print3DBookingActuals
              printAnalysis={booking.print_analysis}
              bookingId={bookingPk}
              enableChargeRecalculation={!!booking.equipment_enable_charge_recalculation && !booking.source_booking_id}
              canEdit={isManagerOrAdmin && !booking.source_booking_id && booking.status.toUpperCase() === "BOOKED"}
              onUpdated={(payload) => {
                const updated = payload?.booking;
                if (updated) {
                  setBooking(updated as BookingDetailCardBooking);
                } else {
                  void apiClient.getBooking(bookingPk).then((res) => {
                    if (res.data) setBooking(res.data as BookingDetailCardBooking);
                  });
                }
                // Intentionally do NOT trigger parent list refresh here.
                // Refreshing the list can make the detail panel jump/close, which blocks quick Refund/Deduct actions.
              }}
            />
          )}

          {!isFinanceUser && booking.input_values && Object.keys(booking.input_values).length > 0 ? (
            <BookingUserInputs
              inputValues={booking.input_values}
              inputFields={booking.input_fields ?? undefined}
              editableInputFields={booking.editable_input_fields ?? undefined}
              status={booking.status}
              enableChargeRecalculation={!!booking.equipment_enable_charge_recalculation && !booking.source_booking_id}
              sampleTrace={isWaitlistedEntry ? undefined : (booking.sample_trace ?? undefined)}
              isAdminUser={true}
              disabled={!!booking.source_booking_id}
              atmosphereSensitiveSample={!!booking.atmosphere_sensitive_sample}
              onUpdate={async (newInputValues) => {
                if (bookingPk == null) {
                  toast.error("This booking cannot be updated right now.");
                  return;
                }
                const res = await apiClient.updateBookingInputValues(bookingPk, newInputValues as Record<string, string | number | boolean | string[]>);
                if (res.error) throw new Error(res.error);
                // Reflect edits immediately in booking details without requiring page refresh.
                const updatedBooking = (res.data as { booking?: BookingDetailCardBooking } | undefined)?.booking;
                if (updatedBooking) {
                  setBooking(updatedBooking);
                }
                onUpdated();
              }}
            />
          ) : !isFinanceUser ? (
            <div className="mt-6 pt-6 border-t border-border/80">
              <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/60 shadow-sm overflow-hidden">
                <ul className="divide-y divide-border/50">
                  <li className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 sm:gap-4 px-5 py-4 bg-background/50 dark:bg-background/30">
                    <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-0">
                      Atmosphere-sensitive sample
                    </span>
                    <span className="text-base font-medium text-foreground sm:text-right">
                      {booking.atmosphere_sensitive_sample ? "Yes (submit at slot start)" : "No"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}

          {!isWaitlistedEntry && booking.charge_breakdown && booking.charge_breakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-2">Charge Breakdown:</p>
              <ul className="space-y-1">
                {booking.charge_breakdown.map((charge, index) => (
                  <li key={index} className="text-base text-muted-foreground flex justify-between gap-4 items-start">
                    <span className="whitespace-pre-line min-w-0 shrink">{charge.description}</span>
                    <span className="shrink-0 tabular-nums">{charge.amount >= 0 ? formatINR(charge.amount) : `-${formatINR(-charge.amount)}`}</span>
                  </li>
                ))}
              </ul>
              {(() => {
                const totalCharge = Number(booking.total_charge);
                const chargeLines = booking.charge_breakdown.filter((c) => String(c.description || "").trim().toLowerCase() !== "total");
                const explicitDiscount = Math.abs(
                  booking.charge_breakdown
                    .map((c) => Number(c.amount))
                    .filter((a) => a < 0)
                    .reduce((s, a) => s + a, 0)
                );
                const totalBeforeDiscount = chargeLines
                  .map((c) => Number(c.amount))
                  .filter((a) => a > 0)
                  .reduce((s, a) => s + a, 0);
                const inferredDiscount = totalBeforeDiscount > totalCharge ? totalBeforeDiscount - totalCharge : 0;
                const discountAmount = explicitDiscount > 0 ? explicitDiscount : inferredDiscount;
                const hasDiscount = discountAmount > 0;
                return (
                  <div className="mt-3 pt-3 border-t space-y-1 text-base">
                    {hasDiscount && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Total amount</span>
                          <span>{formatINR(totalBeforeDiscount)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Discount</span>
                          <span>-{formatINR(discountAmount)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>{hasDiscount ? "Final amount after discount" : "Total"}</span>
                      <span className="text-primary">{formatINR(totalCharge)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {booking.charge_recalculation_pending_amount != null && Number(booking.charge_recalculation_pending_amount) !== 0 && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-base font-medium">Charge recalculation summary</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previous charge</span>
                  <span>{formatINR(Number(booking.total_charge) - Number(booking.charge_recalculation_pending_amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New charge</span>
                  <span>{formatINR(booking.total_charge)}</span>
                </div>
                {Number(booking.charge_recalculation_pending_amount) < 0 ? (
                  <>
                    <div className="flex justify-between font-medium text-green-600 dark:text-green-500">
                      <span>Refund amount</span>
                      <span>{formatINR(Math.abs(Number(booking.charge_recalculation_pending_amount)))}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2">
                      {isManagerOrAdmin
                        ? "Click Refund Money to credit this amount to the user's wallet."
                        : "Click Refund to credit this amount to the associated wallet."}
                    </p>
                    <Button size="sm" className="mt-2" onClick={() => setConfirmAction({ open: true, type: "charge_recalc_refund", chargeRecalcBooking: booking })} disabled={chargeRecalcActionLoading}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {chargeRecalcActionLoading ? "Processing…" : (isManagerOrAdmin ? "Refund Money" : "Refund")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between font-medium text-amber-600 dark:text-amber-500">
                      <span>Extra amount to pay</span>
                      <span>{formatINR(booking.charge_recalculation_pending_amount)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2">
                      {isManagerOrAdmin
                        ? "Click Deduct Money to debit this amount from the user's wallet."
                        : "Click Pay Now to debit this amount from the associated wallet."}
                    </p>
                    <Button size="sm" className="mt-2" onClick={() => setConfirmAction({ open: true, type: "charge_recalc_pay", chargeRecalcBooking: booking })} disabled={chargeRecalcActionLoading}>
                      <Banknote className="h-4 w-4 mr-2" />
                      {chargeRecalcActionLoading ? "Processing…" : (isManagerOrAdmin ? "Deduct Money" : "Pay Now")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {booking.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-1">Notes:</p>
              <p className="text-base text-muted-foreground">{booking.notes}</p>
            </div>
          )}

          {!isWaitlistedEntry && (
            <div className="mt-4 pt-4 border-t no-print">
              <Button
                variant="ghost"
                size="sm"
                className="text-base w-full"
                onClick={() => {
                  setExpandedBookings((prev) => {
                    const next = new Set(prev);
                    if (next.has(booking.booking_id)) next.delete(booking.booking_id);
                    else next.add(booking.booking_id);
                    return next;
                  });
                }}
              >
                <History className="h-4 w-4 mr-2" />
                {expandedBookings.has(booking.booking_id) ? "Hide" : "Show"} Event History
              </Button>
              {expandedBookings.has(booking.booking_id) && (
                <div className="mt-4">
                  {bookingPk != null ? (
                    <BookingEventHistory bookingId={bookingPk} onEventAdded={onUpdated} />
                  ) : null}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className={actionDialog.type === "reschedule" ? "sm:max-w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "complete" && "Complete Booking"}
              {actionDialog.type === "refund" && "Refund Booking"}
              {actionDialog.type === "absent" && "Operator Unavailable"}
              {actionDialog.type === "under_maintenance" && "Under maintenance (disruption)"}
              {actionDialog.type === "other_disruption" && "Other Disruption"}
              {actionDialog.type === "reschedule" && "Reschedule Booking"}
              {actionDialog.type === "not_utilized" && "Booking Not Utilized"}
            </DialogTitle>
            {actionDialog.booking && (
              <>
                <DialogDescription>
                  Booking {actionDialog.booking.virtual_booking_id || `${actionDialog.booking.equipment_code}-#${actionDialog.booking.booking_id}`} - {actionDialog.booking.equipment_name}
                </DialogDescription>
                <div className="mt-2 space-y-1">
                  <UserProfile
                    name={actionDialog.booking.user_name}
                    email={actionDialog.booking.user_email}
                    phone={actionDialog.booking.user_phone}
                    department={actionDialog.booking.user_department}
                    profilePicture={actionDialog.booking.user_profile_picture ? apiClient.getProfilePictureUrl(actionDialog.booking.user) : undefined}
                    size="sm"
                  />
                  {actionDialog.booking.wallet_owner_name && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2 ml-11">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>Supervisor Name: {actionDialog.booking.wallet_owner_name}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Amount: {formatINR(actionDialog.booking.total_charge)}</p>
                </div>
              </>
            )}
          </DialogHeader>

          {actionDialog.type === "reschedule" && actionDialog.booking && (
            <RescheduleSlotPicker
              equipmentId={actionDialog.booking.equipment}
              maintenanceExtraWeekBookingId={
                actionDialog.booking.maintenance_reschedule_extra_week ||
                actionDialog.booking.status?.toUpperCase() === "DISRUPTION_PENDING"
                  ? getRealBookingId(actionDialog.booking) ?? undefined
                  : undefined
              }
              booking={{
                booking_id: actionDialog.booking.booking_id,
                real_booking_id: actionDialog.booking.real_booking_id,
                equipment: actionDialog.booking.equipment,
                start_time: actionDialog.booking.start_time,
                end_time: actionDialog.booking.end_time,
                daily_slots: (actionDialog.booking.daily_slots ?? []).map((s) => ({
                  id: s.id,
                  start_datetime: s.start_datetime,
                  end_datetime: s.end_datetime,
                  date: s.date,
                })),
              }}
              onConfirm={(startTimeISO, endTimeISO) => handleRescheduleConfirm(startTimeISO, endTimeISO)}
              onCancel={closeActionDialog}
              confirmLoading={rescheduleLoading}
            />
          )}

          {actionDialog.type === "complete" && (
            <div className="space-y-3">
              <div>
                <Label>Upload results (optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">Attach result files to send to the user&apos;s email with the booking complete message.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    id={`complete-results-input-${booking.booking_id}`}
                    onChange={(e) => {
                      const chosen = e.target.files;
                      if (chosen?.length) setCompleteResultFiles((prev) => [...prev, ...Array.from(chosen)]);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`complete-results-input-${booking.booking_id}`)?.click()}>
                    Browse
                  </Button>
                  {completeResultFiles.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCompleteResultFiles([])}>
                      Clear files
                    </Button>
                  )}
                </div>
                {completeResultFiles.length > 0 && (
                  <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                    {completeResultFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`}>{f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              {completeUploadedFiles.length > 0 && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium mb-1">{completeUploadedFiles.length} file(s) sent to user email:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {completeUploadedFiles.map((name, i) => (
                      <li key={`${name}-${i}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(actionDialog.type === "refund" ||
            actionDialog.type === "absent" ||
            actionDialog.type === "under_maintenance" ||
            actionDialog.type === "other_disruption") && (
            <div className="space-y-2">
              <Label htmlFor="notes">
                {actionDialog.type === "other_disruption" ? "Reason (Required)" : "Notes (Optional)"}
              </Label>
              <Textarea
                id="notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionDialog.type === "refund"
                    ? "Add any notes about the refund..."
                    : actionDialog.type === "under_maintenance"
                      ? "Optional context for staff (e.g. equipment issue reference)..."
                      : actionDialog.type === "other_disruption"
                        ? "Enter reason for disruption (this will be emailed to the user)..."
                      : "Add any notes (e.g. reason operator was unavailable)..."
                }
              />
              {actionDialog.type === "under_maintenance" && (
                <p className="text-sm text-muted-foreground">
                  This does not refund the booking. The user receives an email with options to cancel (refund) or reschedule. After the equipment is operational again, extended week navigation applies for their reschedule.
                </p>
              )}
              {actionDialog.type === "other_disruption" && (
                <p className="text-sm text-muted-foreground">
                  Reason is required. The user will receive an email containing the same reason, and can then choose cancel (refund) or reschedule from My Bookings.
                </p>
              )}
              {actionDialog.type === "absent" && (
                <p className="text-sm text-muted-foreground">
                  This does not refund immediately. The booking moves to &quot;Awaiting your choice (disruption)&quot; and the user is emailed to choose cancel (refund) or reschedule. If they take no action by the decision deadline, a full refund is issued automatically.
                </p>
              )}
            </div>
          )}

          {actionDialog.type === "not_utilized" && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-email-supervisor"
                  checked={sendEmailToSupervisor}
                  onCheckedChange={(checked) => setSendEmailToSupervisor(checked === true)}
                />
                <Label htmlFor="send-email-supervisor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Send email to supervisor
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                If checked, the user and the Supervisor will receive an email. If unchecked, only the user will be notified. No refund will be issued.
              </p>
            </div>
          )}

          {actionDialog.type !== "reschedule" && (
            <DialogFooter>
              <Button variant="outline" onClick={closeActionDialog} disabled={actionSubmitLoading || completeLoading}>
                {actionDialog.type === "complete" && completeUploadedFiles.length > 0 ? "Close" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  if (actionDialog.type === "complete") {
                    if (completeUploadedFiles.length > 0) closeActionDialog();
                    else handleComplete();
                  } else if (actionDialog.type === "refund") handleRefund();
                  else if (actionDialog.type === "absent") handleAbsent();
                  else if (actionDialog.type === "under_maintenance") handleUnderMaintenanceDisruption();
                  else if (actionDialog.type === "other_disruption") handleOtherDisruption();
                  else if (actionDialog.type === "not_utilized") handleMarkNotUtilized();
                }}
                disabled={actionSubmitLoading || (actionDialog.type === "complete" && completeLoading)}
              >
                {actionSubmitLoading || (actionDialog.type === "complete" && completeLoading)
                  ? "Request under process…"
                  : actionDialog.type === "complete" && completeUploadedFiles.length > 0
                    ? "Done"
                    : "Confirm"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation popup before executing booking actions */}
      <AlertDialog open={confirmAction.open} onOpenChange={(open) => !open && setConfirmAction((p) => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.type === "complete" && "Confirm Complete"}
              {confirmAction.type === "refund" && "Confirm Refund"}
              {confirmAction.type === "absent" && "Confirm Operator Unavailable"}
              {confirmAction.type === "reschedule" && "Confirm Reschedule"}
              {confirmAction.type === "not_utilized" && "Confirm Booking Not Utilized"}
              {confirmAction.type === "charge_recalc_refund" && (isManagerOrAdmin ? "Confirm Refund Money" : "Confirm Refund (charge recalculation)")}
              {confirmAction.type === "charge_recalc_pay" && (isManagerOrAdmin ? "Confirm Deduct Money" : "Confirm Pay Now (charge recalculation)")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "complete" && "Are you sure you want to mark this booking as completed? This action cannot be undone."}
              {confirmAction.type === "refund" && "Are you sure you want to refund this booking? The amount will be credited to the user's wallet. This action cannot be undone."}
              {confirmAction.type === "absent" &&
                "Are you sure you want to mark this booking as Operator Unavailable? The user will be asked to choose cancel (refund) or reschedule by email; no immediate refund."}
              {confirmAction.type === "reschedule" && "Are you sure you want to reschedule this booking to the selected slot(s)? This will update the booking time."}
              {confirmAction.type === "not_utilized" && "Are you sure you want to mark this booking as Not Utilized? No refund will be issued. The user and optionally the supervisor will be notified by email. This action cannot be undone."}
              {confirmAction.type === "charge_recalc_refund" && (isManagerOrAdmin
                ? "Are you sure you want to refund this amount? It will be credited to the user's wallet immediately and an email will be sent."
                : "Are you sure you want to process this refund? The amount will be credited to the user's wallet.")}
              {confirmAction.type === "charge_recalc_pay" && (isManagerOrAdmin
                ? "Are you sure you want to deduct this amount? It will be debited from the user's wallet immediately and an email will be sent."
                : "Are you sure you want to debit this amount from the user's wallet? This will complete the charge recalculation payment.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmActionProceed}>
              Yes, proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={ratingRequiredPopupOpen} onOpenChange={setRatingRequiredPopupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rating required</AlertDialogTitle>
            <AlertDialogDescription>
              Please submit your rating first, then download results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRatingRequiredPopupOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
