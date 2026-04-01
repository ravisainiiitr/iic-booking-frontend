import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import UserProfile from "@/components/UserProfile";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { CheckCircle2, XCircle, RotateCcw, Calendar, History, UserCheck, FolderDown, Download, Star, Banknote, Printer, AlertCircle, ArrowLeft, CopyPlus, BadgeCheck, Handshake, Trash2, Loader2, Wrench } from "lucide-react";
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
}

type ActionType = "complete" | "refund" | "absent" | "under_maintenance" | "reschedule" | "not_utilized" | null;
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

function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  const colors: Record<string, string> = {
    booked: "bg-blue-500",
    disruption_pending: "bg-amber-500",
    under_maintenance: "bg-yellow-600",
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
  const endMs = new Date(booking.end_time).getTime();
  if (!Number.isFinite(endMs)) return false;
  // Enabled only after the last slot end-time has passed.
  if (Date.now() < endMs) return false;
  const trace = booking.sample_trace ?? [];
  return !trace.some((e) => String(e.status || "").toUpperCase() !== "SAMPLE_SENT");
}

function canPerformAction(booking: BookingDetailCardBooking, action: ActionType, isOperator: boolean): boolean {
  if (!action) return false;
  const status = booking.status.toUpperCase();
  if (isOperator) {
    if (action === "complete" && status === "BOOKED") return true;
    if (action === "not_utilized") return canMarkBookingNotUtilized(booking);
    return false;
  }
  switch (action) {
    case "complete":
      return status === "BOOKED";
    case "refund":
      return status !== "REFUNDED" && status !== "COMPLETED";
    case "absent":
      return status === "BOOKED";
    case "under_maintenance":
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
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [zipDownloadInProgress, setZipDownloadInProgress] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState(0);
  const [ratingRequiredPopupOpen, setRatingRequiredPopupOpen] = useState(false);
  const [chargeRecalcActionLoading, setChargeRecalcActionLoading] = useState(false);
  const [actionSubmitLoading, setActionSubmitLoading] = useState(false);
  const [repeatEligibility, setRepeatEligibility] = useState<{ can_create_repeat: boolean } | null>(null);
  const [enableRepeatLoading, setEnableRepeatLoading] = useState(false);
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
  const [postAnalyzedActionLoading, setPostAnalyzedActionLoading] = useState<null | "RETURNED" | "DISPOSED">(null);

  const navigate = useNavigate();

  /** Reload full booking (includes sample_trace, slots, status) after lifecycle API updates. */
  const refreshBookingDetail = useCallback(async () => {
    const id = getRealBookingId(booking);
    if (id == null) return;
    const res = await apiClient.getBookings({ booking_id: id, limit: 1 });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const b = res.data?.bookings?.[0];
    if (b) setBooking(b as BookingDetailCardBooking);
  }, [booking]);

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
    apiClient
      .getBookingResults(bookingPk)
      .then((res) => {
        if (cancelled || res.error) return;
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
  }, [booking.booking_id, bookingPk]);

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
      ["external", "rnd", "industry", "other"].includes((booking.user_type_snapshot || "").toLowerCase());
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

  const handleRescheduleConfirm = async (startTimeISO: string, endTimeISO: string) => {
    if (!actionDialog.booking) return;
    setRescheduleLoading(true);
    try {
      const bookingPk = getRealBookingId(actionDialog.booking);
      if (bookingPk == null) throw new Error("Invalid booking reference.");
      const response = isOperator
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
      const res = await apiClient.processChargeRecalculationRefund(b.booking_id);
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
      const res = await apiClient.processChargeRecalculationPayNow(b.booking_id);
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

  const isOperatorOrManager = isOperator || isManagerOrAdmin;
  const normalizedCurrentUserType = String(currentUserType || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const isLabInchargeType =
    normalizedCurrentUserType.includes("labincharge") ||
    normalizedCurrentUserType.includes("labinchargeuser");
  const isCurrentUserLabInchargeContact =
    currentUserId != null &&
    booking.lab_in_charge != null &&
    booking.lab_in_charge.user_id === currentUserId;
  const isLabInchargeUser = isLabInchargeType || isCurrentUserLabInchargeContact;
  const bookingUserTypeLower = (booking.user_type_snapshot || "").toLowerCase();
  const isExternalBookingType = ["external", "rnd", "industry", "other"].includes(bookingUserTypeLower);
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
  const traceHasAnalyzed = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "COMPLETED");
  const traceHasReturned = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "RETURNED");
  const traceHasArchived = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "ARCHIVED");
  const traceHasDisposed = sampleTraceList.some((e) => String(e.status || "").toUpperCase() === "DISPOSED");

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
              <p className="text-xl font-semibold text-foreground mt-1 tracking-tight">
                Booking ID- {booking.virtual_booking_id || `${booking.equipment_code}-#${booking.booking_id}`}
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
              <p className="font-medium text-base text-primary">₹{Number(booking.total_charge).toFixed(2)}</p>
            </div>
          </div>

          {/* Invoice + technical contacts: all booking statuses and viewer roles (internal/external/student/faculty/operator/OIC). */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {isOperatorOrManager &&
              currentUserId != null &&
                booking.user === currentUserId &&
                ["external", "rnd", "industry", "other"].includes((booking.user_type_snapshot || "").toLowerCase()) && (
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
                  booking.status.toUpperCase() === "DISRUPTION_PENDING") &&
                !booking.source_booking_id &&
                (currentUserId != null && booking.user === currentUserId && !["external", "rnd", "industry", "other"].includes((booking.user_type_snapshot || "").toLowerCase()) || (!isOperator && !isExternalSelfView)) && (
                  <Button size="sm" variant="destructive" onClick={() => onUserCancelClick(booking)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel booking
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
              {!isHold && !isLabInchargeUser && canPerformAction(booking, "reschedule", isOperator) && !isExternalSelfView && (
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
                  Sample returned
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
                  Sample disposed
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
              canSetStaffStatus={!isHold && isOperatorOrManager}
              onUpdated={async () => {
                await refreshBookingDetail();
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
                // Admin/OIC/Lab staff see all staff status actions. Other users see only Sample Sent.
                if (isOperatorOrManager) return false;
                return true;
              })()}
              restrictBookingUserActionsToSampleSent={(() => {
                if (isRefunded || isOperatorUnavailable || isBookingNotUtilized || isHold) return true;
                // Admin/OIC/Lab staff see all actions. Other users see only Sample Sent in sample lifecycle section.
                if (isOperatorOrManager) return false;
                return true;
              })()}
            />
          </div>

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

          {booking.input_values && Object.keys(booking.input_values).length > 0 && (
            <BookingUserInputs
              inputValues={booking.input_values}
              inputFields={booking.input_fields ?? undefined}
              editableInputFields={booking.editable_input_fields ?? undefined}
              status={booking.status}
              enableChargeRecalculation={!!booking.equipment_enable_charge_recalculation && !booking.source_booking_id}
              sampleTrace={booking.sample_trace ?? undefined}
              isAdminUser={true}
              disabled={!!booking.source_booking_id}
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
          )}

          {booking.charge_breakdown && booking.charge_breakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-2">Charge Breakdown:</p>
              <ul className="space-y-1">
                {booking.charge_breakdown.map((charge, index) => (
                  <li key={index} className="text-base text-muted-foreground flex justify-between gap-4 items-start">
                    <span className="whitespace-pre-line min-w-0 shrink">{charge.description}</span>
                    <span className="shrink-0 tabular-nums">{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
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
                          <span>₹{totalBeforeDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Discount</span>
                          <span>-₹{discountAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>{hasDiscount ? "Final amount after discount" : "Total"}</span>
                      <span className="text-primary">₹{totalCharge.toFixed(2)}</span>
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
                  <span>₹{(Number(booking.total_charge) - Number(booking.charge_recalculation_pending_amount)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New charge</span>
                  <span>₹{Number(booking.total_charge).toFixed(2)}</span>
                </div>
                {Number(booking.charge_recalculation_pending_amount) < 0 ? (
                  <>
                    <div className="flex justify-between font-medium text-green-600 dark:text-green-500">
                      <span>Refund amount</span>
                      <span>₹{Math.abs(Number(booking.charge_recalculation_pending_amount)).toFixed(2)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2">Click Refund to credit this amount to the associated wallet.</p>
                    <Button size="sm" className="mt-2" onClick={() => setConfirmAction({ open: true, type: "charge_recalc_refund", chargeRecalcBooking: booking })} disabled={chargeRecalcActionLoading}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {chargeRecalcActionLoading ? "Processing…" : "Refund"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between font-medium text-amber-600 dark:text-amber-500">
                      <span>Extra amount to pay</span>
                      <span>₹{Number(booking.charge_recalculation_pending_amount).toFixed(2)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-2">Click Pay Now to debit this amount from the associated wallet.</p>
                    <Button size="sm" className="mt-2" onClick={() => setConfirmAction({ open: true, type: "charge_recalc_pay", chargeRecalcBooking: booking })} disabled={chargeRecalcActionLoading}>
                      <Banknote className="h-4 w-4 mr-2" />
                      {chargeRecalcActionLoading ? "Processing…" : "Pay Now"}
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
                  <p className="text-sm text-muted-foreground">Amount: ₹{Number(actionDialog.booking.total_charge).toFixed(2)}</p>
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

          {(actionDialog.type === "refund" || actionDialog.type === "absent" || actionDialog.type === "under_maintenance") && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionDialog.type === "refund"
                    ? "Add any notes about the refund..."
                    : actionDialog.type === "under_maintenance"
                      ? "Optional context for staff (e.g. equipment issue reference)..."
                      : "Add any notes (e.g. reason operator was unavailable)..."
                }
              />
              {actionDialog.type === "under_maintenance" && (
                <p className="text-sm text-muted-foreground">
                  This does not refund the booking. The user receives an email with options to cancel (refund) or reschedule. After the equipment is operational again, extended week navigation applies for their reschedule.
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
              {confirmAction.type === "charge_recalc_refund" && "Confirm Refund (charge recalculation)"}
              {confirmAction.type === "charge_recalc_pay" && "Confirm Pay Now (charge recalculation)"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "complete" && "Are you sure you want to mark this booking as completed? This action cannot be undone."}
              {confirmAction.type === "refund" && "Are you sure you want to refund this booking? The amount will be credited to the user's wallet. This action cannot be undone."}
              {confirmAction.type === "absent" &&
                "Are you sure you want to mark this booking as Operator Unavailable? The user will be asked to choose cancel (refund) or reschedule by email; no immediate refund."}
              {confirmAction.type === "reschedule" && "Are you sure you want to reschedule this booking to the selected slot(s)? This will update the booking time."}
              {confirmAction.type === "not_utilized" && "Are you sure you want to mark this booking as Not Utilized? No refund will be issued. The user and optionally the supervisor will be notified by email. This action cannot be undone."}
              {confirmAction.type === "charge_recalc_refund" && "Are you sure you want to process this refund? The amount will be credited to the user's wallet."}
              {confirmAction.type === "charge_recalc_pay" && "Are you sure you want to debit this amount from the user's wallet? This will complete the charge recalculation payment."}
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
