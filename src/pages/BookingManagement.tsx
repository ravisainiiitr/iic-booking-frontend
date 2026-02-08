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
import UserProfile from "@/components/UserProfile";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { CheckCircle2, XCircle, Clock, RotateCcw, Calendar, X, History } from "lucide-react";

interface Booking {
  booking_id: number;
  user: number;
  user_email: string;
  user_name: string;
  user_phone?: string | null;
  user_profile_picture?: string | null;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  charge_profile: number;
  user_type_snapshot: string;
  total_time_minutes: number;
  total_hours: number;
  total_charge: string;
  input_values: Record<string, string | boolean | string[]>;
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

type ActionType = 'complete' | 'refund' | 'absent' | 'reschedule' | 'cancel' | null;

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
  const [refundOnCancel, setRefundOnCancel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set());

  // Check if user is operator or manager
  const isOperatorOrManager = user?.user_type === 'operator' || user?.user_type === 'manager' || user?.user_type === 'admin';

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
    setRefundOnCancel(false);
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, booking: null });
    setActionNotes("");
    setRescheduleLoading(false);
    setRefundOnCancel(false);
  };

  const handleComplete = async () => {
    if (!actionDialog.booking) return;

    try {
      const response = await apiClient.completeBooking(actionDialog.booking.booking_id);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Booking marked as completed");
      closeActionDialog();
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to complete booking");
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

  const handleCancel = async () => {
    if (!actionDialog.booking) return;

    try {
      const response = await apiClient.cancelBooking(
        actionDialog.booking.booking_id,
        refundOnCancel,
        actionNotes || undefined
      );
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Booking cancelled successfully");
      closeActionDialog();
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking");
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
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
    
    switch (action) {
      case 'complete':
        return status === 'PENDING' || status === 'CONFIRMED';
      case 'refund':
        return status !== 'REFUNDED';
      case 'absent':
        return status === 'PENDING' || status === 'CONFIRMED';
      case 'reschedule':
        return status === 'PENDING' || status === 'CONFIRMED';
      case 'cancel':
        return status !== 'CANCELLED' && status !== 'REFUNDED';
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
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
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
                      {canPerformAction(booking, 'cancel') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog('cancel', booking)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {booking.charge_breakdown && booking.charge_breakdown.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Charge Breakdown:</p>
                      <ul className="space-y-1">
                        {booking.charge_breakdown.map((charge, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex justify-between">
                            <span>{charge.description}</span>
                            <span>₹{charge.amount.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
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
                {actionDialog.type === 'cancel' && 'Cancel Booking'}
              </DialogTitle>
              <DialogDescription>
                {actionDialog.booking && (
                  <>
                    Booking #{actionDialog.booking.booking_id} - {actionDialog.booking.equipment_name}
                    <br />
                    <div className="mt-2">
                      <UserProfile
                        name={actionDialog.booking.user_name}
                        email={actionDialog.booking.user_email}
                        phone={actionDialog.booking.user_phone}
                        profilePicture={actionDialog.booking.user_profile_picture}
                        size="sm"
                      />
                    </div>
                    <br />
                    Amount: ₹{Number(actionDialog.booking.total_charge).toFixed(2)}
                  </>
                )}
              </DialogDescription>
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

            {actionDialog.type === 'cancel' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="refund"
                    checked={refundOnCancel}
                    onChange={(e) => setRefundOnCancel(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="refund" className="cursor-pointer">
                    Refund booking amount to user's wallet
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add any notes about the cancellation..."
                  />
                </div>
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
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (actionDialog.type === 'complete') handleComplete();
                    else if (actionDialog.type === 'refund') handleRefund();
                    else if (actionDialog.type === 'absent') handleAbsent();
                    else if (actionDialog.type === 'cancel') handleCancel();
                  }}
                >
                  Confirm
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
