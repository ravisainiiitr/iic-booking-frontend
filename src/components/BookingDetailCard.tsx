import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import BookingEventHistory from "@/components/BookingEventHistory";
import BookingUserInputs from "@/components/BookingUserInputs";
import UserProfile from "@/components/UserProfile";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { CheckCircle2, XCircle, RotateCcw, Calendar, History, UserCheck, FolderDown, Download, Star, Banknote, Printer, AlertCircle, ArrowLeft, CopyPlus, BadgeCheck } from "lucide-react";
import SampleTraceTimeline from "@/components/SampleTraceTimeline";

export interface BookingDetailCardBooking {
  booking_id: number;
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
    booking_id: number;
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
}

type ActionType = "complete" | "refund" | "absent" | "reschedule" | "not_utilized" | null;

interface BookingDetailCardProps {
  booking: BookingDetailCardBooking;
  onClose: () => void;
  onUpdated: () => void;
  isOperator: boolean;
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
    completed: "bg-green-500",
    cancelled: "bg-red-500",
    absent: "bg-orange-500",
    refunded: "bg-purple-500",
    booking_not_utilized: "bg-amber-600",
  };
  return colors[statusLower] || "bg-gray-500";
}

function canPerformAction(booking: BookingDetailCardBooking, action: ActionType, isOperator: boolean): boolean {
  if (!action) return false;
  const status = booking.status.toUpperCase();
  if (isOperator) return action === "complete" && status === "BOOKED";
  switch (action) {
    case "complete":
      return status === "BOOKED";
    case "refund":
      return status !== "REFUNDED" && status !== "COMPLETED";
    case "absent":
      return status === "BOOKED";
    case "reschedule":
      return status === "BOOKED";
    case "not_utilized":
      return status === "BOOKED";
    default:
      return false;
  }
}

export function BookingDetailCard({
  booking,
  onClose,
  onUpdated,
  isOperator,
  currentUserId,
  backLabel = "Back to list",
  showPrintButton = false,
  onUserCancelClick,
}: BookingDetailCardProps) {
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: ActionType; booking: BookingDetailCardBooking | null }>({
    open: false,
    type: null,
    booking: null,
  });
  const [actionNotes, setActionNotes] = useState("");
  const [sendEmailToSupervisor, setSendEmailToSupervisor] = useState(true);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [completeResultFiles, setCompleteResultFiles] = useState<File[]>([]);
  const [completeUploadedFiles, setCompleteUploadedFiles] = useState<string[]>([]);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set([booking.booking_id]));
  const [resultsData, setResultsData] = useState<{ exists: boolean; files: Array<{ name: string; download_url: string }> } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [chargeRecalcActionLoading, setChargeRecalcActionLoading] = useState(false);
  const [repeatEligibility, setRepeatEligibility] = useState<{ can_create_repeat: boolean } | null>(null);
  const [enableRepeatLoading, setEnableRepeatLoading] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<null | "invoice" | "label">(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);
    setResultsData(null);
    apiClient
      .getBookingResults(booking.booking_id)
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
  }, [booking.booking_id]);

  useEffect(() => {
    if (
      !isOperator &&
      currentUserId != null &&
      booking.user === currentUserId &&
      booking.status.toUpperCase() === "COMPLETED" &&
      booking.repeat_sample_enabled
    ) {
      apiClient.getRepeatSampleEligibility(booking.booking_id).then((res) => {
        if (!res.error && res.data)
          setRepeatEligibility({ can_create_repeat: (res.data as { can_create_repeat?: boolean }).can_create_repeat ?? false });
        else setRepeatEligibility({ can_create_repeat: false });
      });
    } else {
      setRepeatEligibility(null);
    }
  }, [booking.booking_id, booking.user, booking.status, booking.repeat_sample_enabled, isOperator, currentUserId]);

  const handleEnableRepeatSample = async () => {
    setEnableRepeatLoading(true);
    try {
      const res = await apiClient.enableRepeatSample(booking.booking_id);
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
    onClose();
    navigate(`/book-equipment?equipment_id=${booking.equipment}&repeatOf=${booking.booking_id}`);
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
      const response = await apiClient.completeBooking(actionDialog.booking.booking_id, filesToSend);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const uploaded = (response.data as { uploaded_files?: string[] })?.uploaded_files ?? [];
      setCompleteUploadedFiles(uploaded);
      toast.success((response.data as { message?: string })?.message || "Booking marked as completed");
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
    try {
      const response = await apiClient.refundBooking(actionDialog.booking.booking_id, actionNotes || undefined);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking refunded successfully");
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refund booking");
    }
  };

  const handleMarkNotUtilized = async () => {
    if (!actionDialog.booking) return;
    try {
      const response = await apiClient.markBookingNotUtilized(actionDialog.booking.booking_id, sendEmailToSupervisor);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking marked as Not Utilized.");
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to mark booking as not utilized");
    }
  };

  const handleAbsent = async () => {
    if (!actionDialog.booking) return;
    try {
      const response = await apiClient.absentBooking(actionDialog.booking.booking_id, actionNotes || undefined);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking marked as Operator Unavailable. Full refund issued.");
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to mark booking as operator unavailable");
    }
  };

  const handleRescheduleConfirm = async (startTimeISO: string, endTimeISO: string) => {
    if (!actionDialog.booking) return;
    setRescheduleLoading(true);
    try {
      const response = isOperator
        ? await apiClient.rescheduleBooking(actionDialog.booking.booking_id, startTimeISO, endTimeISO)
        : await apiClient.userRescheduleBooking(actionDialog.booking.booking_id, startTimeISO, endTimeISO);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success((response.data as { message?: string })?.message || "Booking rescheduled successfully");
      closeActionDialog();
      onClose();
      onUpdated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to reschedule booking");
    } finally {
      setRescheduleLoading(false);
    }
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

  const isOperatorOrManager = true;

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

          {(booking.rating != null || booking.rating_feedback != null) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-2">User rating</p>
              <div className="flex flex-wrap items-center gap-2">
                {booking.rating != null ? (
                  <>
                    <span className="inline-flex items-center gap-0.5" title={`${booking.rating}/5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-5 w-5 ${s <= (booking.rating ?? 0) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                        />
                      ))}
                    </span>
                    {booking.rated_at && (
                      <span className="text-sm text-muted-foreground">• {new Date(booking.rated_at).toLocaleString()}</span>
                    )}
                  </>
                ) : null}
                {booking.rating_feedback && <p className="text-sm text-muted-foreground w-full mt-1">{booking.rating_feedback}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t no-print">
            <p className="text-base font-medium mb-2">Actions:</p>
            <div className="flex flex-wrap gap-2">
              {currentUserId != null &&
                booking.user === currentUserId &&
                ["external", "rnd", "industry", "other"].includes((booking.user_type_snapshot || "").toLowerCase()) && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingDoc !== null}
                      onClick={async () => {
                        setDownloadingDoc("invoice");
                        try {
                          const res = await apiClient.getBookingInvoicePdfBlob(booking.booking_id);
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
                      disabled={downloadingDoc !== null}
                      onClick={async () => {
                        setDownloadingDoc("label");
                        try {
                          const res = await apiClient.getBookingShippingLabelPdfBlob(booking.booking_id);
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
              {canPerformAction(booking, "complete", isOperator) && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("complete", booking)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {canPerformAction(booking, "refund", isOperator) && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("refund", booking)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refund
                </Button>
              )}
              {canPerformAction(booking, "absent", isOperator) && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("absent", booking)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Operator Unavailable
                </Button>
              )}
              {canPerformAction(booking, "reschedule", isOperator) && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("reschedule", booking)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
              )}
              {canPerformAction(booking, "not_utilized", isOperator) && (
                <Button size="sm" variant="outline" onClick={() => openActionDialog("not_utilized", booking)}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Booking Not Utilized
                </Button>
              )}
              {isOperator && booking.status.toUpperCase() === "COMPLETED" && !booking.repeat_sample_enabled && !booking.repeat_booking_already_created && (
                <Button size="sm" variant="outline" onClick={handleEnableRepeatSample} disabled={enableRepeatLoading}>
                  <CopyPlus className="h-4 w-4 mr-2" />
                  {enableRepeatLoading ? "Enabling…" : "Enable repeat sample"}
                </Button>
              )}
              {isOperator && booking.status.toUpperCase() === "COMPLETED" && booking.repeat_sample_enabled && !booking.repeat_booking_already_created && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-sm font-medium text-green-800 dark:text-green-200">
                  <BadgeCheck className="h-4 w-4" />
                  Repeat sample enabled
                </span>
              )}
              {isOperator && booking.status.toUpperCase() === "COMPLETED" && booking.repeat_booking_already_created && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <BadgeCheck className="h-4 w-4" />
                  Repeat sample used
                </span>
              )}
              {!isOperator && repeatEligibility?.can_create_repeat && (
                <Button size="sm" variant="outline" onClick={handleCreateRepeatBooking}>
                  <CopyPlus className="h-4 w-4 mr-2" />
                  Repeat sample
                </Button>
              )}
              {!isOperator && onUserCancelClick && (booking.status.toUpperCase() === "PENDING" || booking.status.toUpperCase() === "BOOKED") && !booking.source_booking_id && (
                <Button size="sm" variant="destructive" onClick={() => onUserCancelClick(booking)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel booking
                </Button>
              )}
              <Button
                size="sm"
                variant={resultsData?.exists ? "default" : "outline"}
                className={resultsData?.exists ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                disabled={resultsLoading}
                onClick={() => {
                  if (resultsData?.exists && resultsData.files.length > 0) setResultsDialogOpen(true);
                  else if (resultsData && !resultsData.exists && !resultsLoading) toast.info("No results folder found for this booking in S3.");
                }}
              >
                <FolderDown className="h-4 w-4 mr-2" />
                {resultsLoading ? "Checking…" : "Results"}
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t no-print">
            <SampleTraceTimeline
              bookingId={booking.booking_id}
              sampleTrace={booking.sample_trace ?? []}
              canSetSampleSent={currentUserId != null && booking.user === currentUserId}
              canSetStaffStatus={isOperatorOrManager}
              onUpdated={onUpdated}
              bookingComplete={booking.status.toUpperCase() === "COMPLETED"}
              hideHeldForwardedStep={(() => {
                const ut = (booking.user_type_snapshot || "").toLowerCase();
                return ut === "student" || ut === "faculty";
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
                  onClick={async () => {
                    const err = await apiClient.downloadBookingResultsZip(booking.booking_id);
                    if (err.error) toast.error(err.error);
                    else toast.success("Download started.");
                  }}
                >
                  <FolderDown className="h-4 w-4 mr-2" />
                  Download folder (ZIP)
                </Button>
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

          {booking.input_values && Object.keys(booking.input_values).length > 0 && (
            <BookingUserInputs
              inputValues={booking.input_values}
              inputFields={booking.input_fields ?? undefined}
              status={booking.status}
              enableChargeRecalculation={!!booking.equipment_enable_charge_recalculation}
              sampleTrace={booking.sample_trace ?? undefined}
              isAdminUser={true}
              onUpdate={async (newInputValues) => {
                const res = await apiClient.updateBookingInputValues(booking.booking_id, newInputValues as Record<string, string | number | boolean | string[]>);
                if (res.error) throw new Error(res.error);
                onUpdated();
              }}
            />
          )}

          {booking.charge_breakdown && booking.charge_breakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-base font-medium mb-2">Charge Breakdown:</p>
              <ul className="space-y-1">
                {booking.charge_breakdown.map((charge, index) => (
                  <li key={index} className="text-base text-muted-foreground flex justify-between">
                    <span>{charge.description}</span>
                    <span>{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
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
                    <Button size="sm" className="mt-2" onClick={() => handleProcessChargeRecalcRefund(booking)} disabled={chargeRecalcActionLoading}>
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
                    <Button size="sm" className="mt-2" onClick={() => handleProcessChargeRecalcPayNow(booking)} disabled={chargeRecalcActionLoading}>
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
                <BookingEventHistory bookingId={booking.booking_id} onEventAdded={onUpdated} />
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
              booking={{
                booking_id: actionDialog.booking.booking_id,
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
              onConfirm={handleRescheduleConfirm}
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

          {(actionDialog.type === "refund" || actionDialog.type === "absent") && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={actionDialog.type === "refund" ? "Add any notes about the refund..." : "Add any notes (e.g. reason operator was unavailable)..."}
              />
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
              <Button variant="outline" onClick={closeActionDialog}>
                {actionDialog.type === "complete" && completeUploadedFiles.length > 0 ? "Close" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  if (actionDialog.type === "complete") {
                    if (completeUploadedFiles.length > 0) closeActionDialog();
                    else handleComplete();
                  } else if (actionDialog.type === "refund") handleRefund();
                  else if (actionDialog.type === "absent") handleAbsent();
                  else if (actionDialog.type === "not_utilized") handleMarkNotUtilized();
                }}
                disabled={actionDialog.type === "complete" && completeLoading}
              >
                {actionDialog.type === "complete" && completeUploadedFiles.length > 0 ? "Done" : actionDialog.type === "complete" && completeLoading ? "Completing..." : "Confirm"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
