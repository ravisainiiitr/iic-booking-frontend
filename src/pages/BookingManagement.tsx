import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import BookingEventHistory from "@/components/BookingEventHistory";
import BookingUserInputs from "@/components/BookingUserInputs";
import UserProfile from "@/components/UserProfile";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { CheckCircle2, XCircle, Clock, RotateCcw, Calendar, History } from "lucide-react";

interface Booking {
  booking_id: number;
  user: number;
  user_email: string;
  user_name: string;
  user_phone?: string | null;
  user_department?: string | null;
  user_profile_picture?: string | null;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  charge_profile: number;
  user_type_snapshot: string;
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
  selected_parameters: any;
  charge_breakdown: Array<{
    amount: number;
    description: string;
  }>;
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
  created_at: string;
  updated_at: string;
}

type ActionType = 'complete' | 'refund' | 'absent' | 'reschedule' | null;

const BookingManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: ActionType; booking: Booking | null }>({
    open: false,
    type: null,
    booking: null,
  });
  const [actionNotes, setActionNotes] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [completeResultFiles, setCompleteResultFiles] = useState<File[]>([]);
  const [completeUploadedFiles, setCompleteUploadedFiles] = useState<string[]>([]);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("BOOKED");
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set());

  // Check if user is operator or manager
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isOperator = userTypeStr === 'operator';
  const isManagerOrAdmin = userTypeStr === 'manager' || userTypeStr === 'admin';
  const isOperatorOrManager = isOperator || isManagerOrAdmin;

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Check authentication
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }

    // Check permissions
    if (!isOperatorOrManager) {
      toast.error("Access denied. Only operators and managers can access this page.");
      navigate("/dashboard");
      return;
    }

    // If user has permission, fetch bookings
    checkAuthAndFetchBookings();
  }, [navigate, authLoading, isAuthenticated, user, isOperatorOrManager]);

  const checkAuthAndFetchBookings = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    // User data should already be available from AuthContext
    if (!user) {
      navigate("/auth");
      return;
    }

    fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      const params: any = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const response = await apiClient.getBookings(params);
      if (response.data && response.data.bookings) {
        setBookings(response.data.bookings);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOperatorOrManager && !authLoading) {
      fetchBookings();
    }
  }, [statusFilter, isOperatorOrManager, authLoading]);

  const openActionDialog = (type: ActionType, booking: Booking) => {
    setActionDialog({ open: true, type, booking });
    setActionNotes("");
    setCompleteResultFiles([]);
    setCompleteUploadedFiles([]);
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, booking: null });
    setActionNotes("");
    setRescheduleLoading(false);
    setCompleteResultFiles([]);
    setCompleteUploadedFiles([]);
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
      toast.success(response.data?.message || "Booking marked as completed");
      fetchBookings();
      if (uploaded.length === 0) {
        closeActionDialog();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to complete booking");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!actionDialog.booking) return;

    try {
      const response = await apiClient.refundBooking(
        actionDialog.booking.booking_id,
        actionNotes || undefined
      );
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Booking refunded successfully");
      closeActionDialog();
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to refund booking");
    }
  };

  const handleAbsent = async () => {
    if (!actionDialog.booking) return;

    try {
      const response = await apiClient.absentBooking(
        actionDialog.booking.booking_id,
        actionNotes || undefined
      );
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Booking marked as absent");
      closeActionDialog();
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark booking as absent");
    }
  };

  const handleRescheduleConfirm = async (startTimeISO: string, endTimeISO: string) => {
    if (!actionDialog.booking) return;

    setRescheduleLoading(true);
    try {
      const response = await apiClient.rescheduleBooking(
        actionDialog.booking.booking_id,
        startTimeISO,
        endTimeISO
      );
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Booking rescheduled successfully");
      closeActionDialog();
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to reschedule booking");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    const colors: Record<string, string> = {
      booked: "bg-blue-500",
      completed: "bg-green-500",
      cancelled: "bg-red-500",
      absent: "bg-orange-500",
      refunded: "bg-purple-500",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const canPerformAction = (booking: Booking, action: ActionType): boolean => {
    if (!action) return false;
    const status = booking.status.toUpperCase();
    
    // Operators can only mark bookings as complete
    if (isOperator) {
      return action === 'complete' && status === 'BOOKED';
    }
    
    // Managers and admins can perform all actions
    switch (action) {
      case 'complete':
        return status === 'BOOKED';
      case 'refund':
        return status !== 'REFUNDED' && status !== 'COMPLETED';
      case 'absent':
        return status === 'BOOKED';
      case 'reschedule':
        return status === 'BOOKED';
      default:
        return false;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Booking Management</h1>
            <p className="text-muted-foreground">Manage all bookings as operator or manager</p>
          </div>
          <div className="flex gap-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookings.map((booking) => (
              <Card key={booking.booking_id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{booking.equipment_name}</CardTitle>
                      <CardDescription>
                        Booking #{booking.booking_id} • {booking.equipment_code}
                      </CardDescription>
                      <div className="mt-2">
                        <UserProfile
                          name={booking.user_name}
                          email={booking.user_email}
                          phone={booking.user_phone}
                          department={booking.user_department}
                          profilePicture={booking.user_profile_picture}
                          size="sm"
                        />
                      </div>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status_display}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Start Time</p>
                      <p className="font-medium">
                        {new Date(booking.start_time).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">End Time</p>
                      <p className="font-medium">
                        {new Date(booking.end_time).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {booking.total_time_minutes} min ({Number(booking.total_hours).toFixed(2)} hrs)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="font-medium text-primary">
                        ₹{Number(booking.total_charge).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {canPerformAction(booking, 'complete') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog('complete', booking)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete
                        </Button>
                      )}
                      {canPerformAction(booking, 'refund') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog('refund', booking)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Refund
                        </Button>
                      )}
                      {canPerformAction(booking, 'absent') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog('absent', booking)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Absent
                        </Button>
                      )}
                      {canPerformAction(booking, 'reschedule') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog('reschedule', booking)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Reschedule
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* User Inputs – Step 1 data; fields with Editing Required are editable until Complete */}
                  {booking.input_values && Object.keys(booking.input_values).length > 0 && (
                    <BookingUserInputs
                      inputValues={booking.input_values}
                      inputFields={booking.input_fields ?? undefined}
                      status={booking.status}
                      onUpdate={async (newInputValues) => {
                        const res = await apiClient.updateBookingInputValues(booking.booking_id, newInputValues as Record<string, string | number | boolean | string[]>);
                        if (res.error) throw new Error(res.error);
                        fetchBookings();
                      }}
                    />
                  )}

                  {booking.charge_breakdown && booking.charge_breakdown.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Charge Breakdown:</p>
                      <ul className="space-y-1">
                        {booking.charge_breakdown.map((charge, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex justify-between">
                            <span>{charge.description}</span>
                            <span>{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
                          </li>
                        ))}
                      </ul>
                      {(() => {
                        const totalCharge = Number(booking.total_charge);
                        const chargeLines = booking.charge_breakdown.filter(
                          (c) => String(c.description || "").trim().toLowerCase() !== "total"
                        );
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
                          <div className="mt-3 pt-3 border-t space-y-1 text-sm">
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
                  {booking.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground">{booking.notes}</p>
                    </div>
                  )}
                  
                  {/* Event History Section */}
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newExpanded = new Set(expandedBookings);
                        if (newExpanded.has(booking.booking_id)) {
                          newExpanded.delete(booking.booking_id);
                        } else {
                          newExpanded.add(booking.booking_id);
                        }
                        setExpandedBookings(newExpanded);
                      }}
                      className="w-full"
                    >
                      <History className="h-4 w-4 mr-2" />
                      {expandedBookings.has(booking.booking_id) ? "Hide" : "Show"} Event History
                    </Button>
                    {expandedBookings.has(booking.booking_id) && (
                      <div className="mt-4">
                        <BookingEventHistory
                          bookingId={booking.booking_id}
                          onEventAdded={() => fetchBookings()}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Dialogs */}
        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeActionDialog()}>
          <DialogContent className={actionDialog.type === 'reschedule' ? 'sm:max-w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto' : ''}>
            <DialogHeader>
              <DialogTitle>
                {actionDialog.type === 'complete' && 'Complete Booking'}
                {actionDialog.type === 'refund' && 'Refund Booking'}
                {actionDialog.type === 'absent' && 'Mark Booking as Absent'}
                {actionDialog.type === 'reschedule' && 'Reschedule Booking'}
              </DialogTitle>
              {actionDialog.booking && (
                <>
                  <DialogDescription>
                    Booking #{actionDialog.booking.booking_id} - {actionDialog.booking.equipment_name}
                  </DialogDescription>
                  <div className="mt-2 space-y-1">
                    <UserProfile
                      name={actionDialog.booking.user_name}
                      email={actionDialog.booking.user_email}
                      phone={actionDialog.booking.user_phone}
                      department={actionDialog.booking.user_department}
                      profilePicture={actionDialog.booking.user_profile_picture}
                      size="sm"
                    />
                    <p className="text-sm text-muted-foreground">
                      Amount: ₹{Number(actionDialog.booking.total_charge).toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </DialogHeader>

            {actionDialog.type === 'reschedule' && actionDialog.booking && (
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

            {actionDialog.type === 'complete' && (
              <div className="space-y-3">
                <div>
                  <Label>Upload results (optional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Attach result files to send to the user&apos;s email with the booking complete message.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id="complete-results-input"
                      onChange={(e) => {
                        const chosen = e.target.files;
                        if (chosen?.length) setCompleteResultFiles((prev) => [...prev, ...Array.from(chosen)]);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('complete-results-input')?.click()}
                    >
                      Browse
                    </Button>
                    {completeResultFiles.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCompleteResultFiles([])}
                      >
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
                    <p className="text-sm font-medium mb-1">
                      {completeUploadedFiles.length} file(s) sent to user email:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {completeUploadedFiles.map((name, i) => (
                        <li key={`${name}-${i}`}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {(actionDialog.type === 'refund' || actionDialog.type === 'absent') && (
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={
                    actionDialog.type === 'refund'
                      ? "Add any notes about the refund..."
                      : "Add any notes about the absence..."
                  }
                />
              </div>
            )}

            {actionDialog.type !== 'reschedule' && (
              <DialogFooter>
                <Button variant="outline" onClick={closeActionDialog}>
                  {actionDialog.type === 'complete' && completeUploadedFiles.length > 0 ? 'Close' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => {
                    if (actionDialog.type === 'complete') {
                      if (completeUploadedFiles.length > 0) closeActionDialog();
                      else handleComplete();
                    } else if (actionDialog.type === 'refund') handleRefund();
                    else if (actionDialog.type === 'absent') handleAbsent();
                  }}
                  disabled={actionDialog.type === 'complete' && completeLoading}
                >
                  {actionDialog.type === 'complete' && completeUploadedFiles.length > 0
                    ? 'Done'
                    : actionDialog.type === 'complete' && completeLoading
                      ? 'Completing...'
                      : 'Confirm'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default BookingManagement;
