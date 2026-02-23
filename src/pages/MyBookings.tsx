import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import BookingEventHistory from "@/components/BookingEventHistory";
import BookingUserInputs from "@/components/BookingUserInputs";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import TicketForm, { TICKET_TYPE } from "@/components/TicketForm";
import { X, Calendar as CalendarIcon, History, HelpCircle } from "lucide-react";

interface Booking {
  booking_id: number;
  user: number;
  user_email: string;
  user_name: string;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  equipment_reschedule_hours_threshold?: number;
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

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set());

  useEffect(() => {
    checkAuthAndFetchBookings();
  }, []);

  const checkAuthAndFetchBookings = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      navigate("/auth");
      return;
    }

    fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getBookings();
      if (response.error) {
        toast.error(response.error || "Failed to load bookings");
        setBookings([]);
      } else if (response.data && response.data.bookings) {
        setBookings(response.data.bookings);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
      approved: "bg-blue-500",
      in_progress: "bg-green-500",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
      rejected: "bg-red-500",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const canCancelOrReschedule = (status: string) => {
    const statusLower = status.toLowerCase();
    return statusLower === "pending" || statusLower === "booked";
  };

  // Check if booking is within the reschedule/cancel threshold window
  const isWithinThresholdWindow = (booking: Booking): boolean => {
    // Check status first
    if (!canCancelOrReschedule(booking.status)) {
      return false;
    }

    // Check if start time exists
    if (!booking.start_time) {
      return false;
    }

    try {
      const startTime = new Date(booking.start_time);
      const now = new Date();
      
      // Check if start time is in the past
      if (startTime <= now) {
        return false;
      }
      
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Get threshold from equipment (default to 48 hours if not specified)
      const threshold = booking.equipment_reschedule_hours_threshold ?? 48;

      // Show options if booking is more than threshold hours away
      return hoursUntilStart > threshold;
    } catch (error) {
      console.error('Error calculating threshold window:', error);
      return false;
    }
  };

  const canReschedule = (booking: Booking) => {
    // Check status first
    if (!canCancelOrReschedule(booking.status)) {
      return false;
    }

    // Check if reschedule is allowed based on time threshold
    if (!booking.start_time) {
      return false;
    }

    try {
      const startTime = new Date(booking.start_time);
      const now = new Date();
      
      // Check if start time is in the past
      if (startTime <= now) {
        return false;
      }
      
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Get threshold from equipment (default to 48 hours if not specified)
      const threshold = booking.equipment_reschedule_hours_threshold ?? 48;

      // Allow reschedule if booking is more than threshold hours away
      return hoursUntilStart > threshold;
    } catch (error) {
      console.error('Error calculating reschedule eligibility:', error);
      return false;
    }
  };

  const handleCancelClick = (booking: Booking) => {
    // Check if cancel is allowed based on time threshold
    if (!isWithinThresholdWindow(booking)) {
      if (booking.start_time) {
        const startTime = new Date(booking.start_time);
        const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
        const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
        toast.error(
          `Cancel is only available until ${cutoffTime.toLocaleString()}. Kindly contact the admin to cancel the booking.`
        );
      } else {
        toast.error("Cannot cancel this booking. Start time is not available.");
      }
      return;
    }
    
    setSelectedBooking(booking);
    setCancelNotes("");
    setCancelDialogOpen(true);
  };

  const handleRescheduleClick = (booking: Booking) => {
    // Check if reschedule is allowed based on time threshold
    if (!canReschedule(booking)) {
      if (booking.start_time) {
        const startTime = new Date(booking.start_time);
        const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
        const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
        toast.error(
          `Reschedule is only available until ${cutoffTime.toLocaleString()}. Kindly contact the admin to reschedule the booking.`
        );
      } else {
        toast.error("Cannot reschedule this booking. Start time is not available.");
      }
      return;
    }
    
    setSelectedBooking(booking);
    setRescheduleDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return;

    setActionLoading(true);
    try {
      // Cancel booking with refund (always refund)
      const response = await apiClient.userCancelBooking(
        selectedBooking.booking_id,
        true, // Always refund
        cancelNotes || undefined
      );

      if (response.error) {
        toast.error(response.error || "Failed to cancel booking");
        setActionLoading(false);
        return;
      }
      
      if (!response.data) {
        toast.error("Invalid response from server");
        setActionLoading(false);
        return;
      }
      
      toast.success(response.data.message || "Booking cancelled and refund processed successfully");
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      setCancelNotes("");
      await fetchBookings(); // Refresh bookings list
    } catch (error: any) {
      console.error("Cancel booking error:", error);
      toast.error(error.message || "Failed to cancel booking");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleConfirm = async (startTimeISO: string, endTimeISO: string) => {
    if (!selectedBooking) return;

    setActionLoading(true);
    try {
      const response = await apiClient.userRescheduleBooking(
        selectedBooking.booking_id,
        startTimeISO,
        endTimeISO
      );

      if (response.error) {
        toast.error(response.error || "Failed to reschedule booking");
      } else {
        toast.success(response.data?.message || "Booking rescheduled successfully");
        setRescheduleDialogOpen(false);
        setSelectedBooking(null);
        await fetchBookings(); // Refresh bookings list
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to reschedule booking");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
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
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No bookings yet</p>
                <Button onClick={() => navigate("/equipments")}>
                Book Equipment
              </Button>
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
                        {booking.equipment_code} • {booking.user_type_snapshot}
                      </CardDescription>
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
                            <span>{Number(charge.amount) >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
                          </li>
                        ))}
                      </ul>
                      {(() => {
                        const totalCharge = Number(booking.total_charge);
                        // Exclude "Total" line so we don't count final amount as part of subtotal
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
                        // Show discount if we have an explicit Discount line or inferred (subtotal > final)
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
                  {booking.daily_slots && booking.daily_slots.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Booked Slots:</p>
                      <div className="flex flex-wrap gap-2">
                        {booking.daily_slots.map((slot) => (
                          <Badge key={slot.id} variant="outline" className="text-xs">
                            {slot.slot_name} ({new Date(slot.start_datetime).toLocaleString()})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {booking.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground">{booking.notes}</p>
                    </div>
                  )}
                  {canCancelOrReschedule(booking.status) && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRescheduleClick(booking)}
                        className="flex-1"
                        title={!canReschedule(booking) && booking.start_time ? 
                          `Reschedule is only available until ${(() => {
                            const startTime = new Date(booking.start_time);
                            const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
                            const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
                            return cutoffTime.toLocaleString();
                          })()}` : 
                          'Reschedule this booking'}
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Reschedule
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelClick(booking)}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                  {canCancelOrReschedule(booking.status) && !canReschedule(booking) && booking.start_time && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>
                        Reschedule is only available until{' '}
                        {(() => {
                          const startTime = new Date(booking.start_time);
                          const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
                          const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
                          return cutoffTime.toLocaleString();
                        })()}
                      </p>
                    </div>
                  )}
                  {booking.status.toLowerCase() === 'booked' && (
                    <div className="mt-4 pt-4 border-t">
                      <TicketForm
                        trigger={
                          <Button variant="outline" size="sm" className="w-full">
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Create Support Ticket
                          </Button>
                        }
                        initialValues={{
                          ticket_type: "booking", // Auto-set to booking for booking-related tickets
                          subject: `Support Request for Booking #${booking.booking_id} - ${booking.equipment_name}`,
                          description: `Booking Details:\n- Booking ID: #${booking.booking_id}\n- Equipment: ${booking.equipment_name} (${booking.equipment_code})\n- Start Time: ${new Date(booking.start_time).toLocaleString()}\n- End Time: ${new Date(booking.end_time).toLocaleString()}\n- Total Charge: ₹${Number(booking.total_charge).toFixed(2)}\n\nPlease describe your issue or request:`,
                          related_equipment_id: booking.equipment,
                          related_booking_id: booking.booking_id,
                        }}
                        hideTicketType={true} // Hide ticket type field since it's auto-set to booking
                        onSuccess={() => {
                          toast.success("Support ticket created successfully");
                        }}
                      />
                    </div>
                  )}
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

        {/* Cancel Booking Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone.
                {selectedBooking && (
                  <div className="mt-2 text-sm">
                    <p><strong>Equipment:</strong> {selectedBooking.equipment_name}</p>
                    <p><strong>Start Time:</strong> {new Date(selectedBooking.start_time).toLocaleString()}</p>
                    <p><strong>Total Charge:</strong> ₹{Number(selectedBooking.total_charge).toFixed(2)}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {selectedBooking && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <p className="font-medium text-blue-900 mb-1">Refund Information</p>
                  <p className="text-blue-800">
                    The booking will be cancelled and ₹{Number(selectedBooking.total_charge).toFixed(2)} will be refunded to your wallet immediately.
                  </p>
                </div>
              )}
              <div className="space-y-2">
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancel-notes">Cancellation Notes (Optional)</Label>
                <Textarea
                  id="cancel-notes"
                  placeholder="Enter reason for cancellation..."
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelConfirm}
                disabled={actionLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reschedule Booking Dialog */}
        <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
          <DialogContent className="sm:max-w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reschedule Booking</DialogTitle>
              <DialogDescription>
                {selectedBooking && (
                  <span><strong>{selectedBooking.equipment_name}</strong> – Select the same number of consecutive slots in the week below.</span>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <RescheduleSlotPicker
                equipmentId={selectedBooking.equipment}
                booking={{
                  booking_id: selectedBooking.booking_id,
                  equipment: selectedBooking.equipment,
                  start_time: selectedBooking.start_time,
                  end_time: selectedBooking.end_time,
                  daily_slots: (selectedBooking.daily_slots ?? []).map((s) => ({
                    id: s.id,
                    start_datetime: s.start_datetime,
                    end_datetime: s.end_datetime,
                    date: s.date,
                  })),
                }}
                onConfirm={handleRescheduleConfirm}
                onCancel={() => setRescheduleDialogOpen(false)}
                confirmLoading={actionLoading}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default MyBookings;