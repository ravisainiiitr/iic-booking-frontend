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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import BookingEventHistory from "@/components/BookingEventHistory";
import { X, Calendar as CalendarIcon, History } from "lucide-react";

interface Booking {
  booking_id: number;
  user: number;
  user_email: string;
  user_name: string;
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

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelRefund, setCancelRefund] = useState(false);
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
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
    const response = await apiClient.getBookings();
    if (response.data && response.data.bookings) {
      setBookings(response.data.bookings);
    }
    setLoading(false);
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
    return statusLower === "pending" || statusLower === "confirmed";
  };

  const handleCancelClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancelNotes("");
    setCancelRefund(false);
    setCancelDialogOpen(true);
  };

  const handleRescheduleClick = (booking: Booking) => {
    setSelectedBooking(booking);
    // Pre-fill with current booking times
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    
    // Format as datetime-local input format (YYYY-MM-DDTHH:mm)
    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setRescheduleStartTime(formatDateTime(startDate));
    setRescheduleEndTime(formatDateTime(endDate));
    setRescheduleDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return;

    setActionLoading(true);
    try {
      const response = await apiClient.userCancelBooking(
        selectedBooking.booking_id,
        cancelRefund,
        cancelNotes || undefined
      );

      if (response.error) {
        toast.error(response.error || "Failed to cancel booking");
      } else {
        toast.success(response.data?.message || "Booking cancelled successfully");
        setCancelDialogOpen(false);
        setSelectedBooking(null);
        await fetchBookings(); // Refresh bookings list
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!selectedBooking) return;

    if (!rescheduleStartTime || !rescheduleEndTime) {
      toast.error("Please select both start and end times");
      return;
    }

    const startDate = new Date(rescheduleStartTime);
    const endDate = new Date(rescheduleEndTime);

    if (endDate <= startDate) {
      toast.error("End time must be after start time");
      return;
    }

    setActionLoading(true);
    try {
      // Convert to ISO string for API
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const response = await apiClient.userRescheduleBooking(
        selectedBooking.booking_id,
        startISO,
        endISO
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="refund"
                  checked={cancelRefund}
                  onCheckedChange={(checked) => setCancelRefund(checked === true)}
                />
                <Label htmlFor="refund" className="text-sm font-normal cursor-pointer">
                  Request refund to wallet
                </Label>
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reschedule Booking</DialogTitle>
              <DialogDescription>
                Select new start and end times for your booking.
                {selectedBooking && (
                  <div className="mt-2 text-sm">
                    <p><strong>Equipment:</strong> {selectedBooking.equipment_name}</p>
                    <p><strong>Current Start:</strong> {new Date(selectedBooking.start_time).toLocaleString()}</p>
                    <p><strong>Current End:</strong> {new Date(selectedBooking.end_time).toLocaleString()}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reschedule-start">New Start Time</Label>
                <Input
                  id="reschedule-start"
                  type="datetime-local"
                  value={rescheduleStartTime}
                  onChange={(e) => setRescheduleStartTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-end">New End Time</Label>
                <Input
                  id="reschedule-end"
                  type="datetime-local"
                  value={rescheduleEndTime}
                  onChange={(e) => setRescheduleEndTime(e.target.value)}
                  min={rescheduleStartTime || new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRescheduleDialogOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRescheduleConfirm}
                disabled={actionLoading || !rescheduleStartTime || !rescheduleEndTime}
              >
                {actionLoading ? "Rescheduling..." : "Confirm Reschedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default MyBookings;