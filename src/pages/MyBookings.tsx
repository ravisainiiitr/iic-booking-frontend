import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { X, FolderDown, Download, Star, Filter, RotateCcw, Banknote } from "lucide-react";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface Booking {
  booking_id: number;
  virtual_booking_id?: string | null;
  user: number;
  user_email: string;
  user_name: string;
  created_by_name?: string | null;
  user_phone?: string | null;
  user_department?: string | null;
  user_profile_picture?: string | null;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  wallet_owner_name?: string | null;
  equipment_reschedule_hours_threshold?: number;
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
  equipment_weekly_view_display?: 'TIME' | 'SLOT_ID';
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
  completed_at?: string | null;
  equipment_repeat_sample_request_days?: number | null;
  equipment_repeat_sample_disclaimer?: string | null;
  equipment_enable_charge_recalculation?: boolean;
  equipment_user_rating_enabled?: boolean;
  repeat_sample_request_status?: string | null;
  repeat_sample_enabled?: boolean;
  source_booking_id?: number | null;
  created_at: string;
  updated_at: string;
  charge_recalculation_pending_amount?: string | null;
}

const PAGE_SIZE = 50;

const MyBookings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [overrideBooking, setOverrideBooking] = useState<Booking | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [resultsCache, setResultsCache] = useState<Record<number, { exists: boolean; files: Array<{ name: string; download_url: string }> }>>({});
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [resultsDialogFiles, setResultsDialogFiles] = useState<Array<{ name: string; download_url: string }>>([]);
  const [resultsDialogBookingId, setResultsDialogBookingId] = useState<number | null>(null);
  const [resultsLoadingId, setResultsLoadingId] = useState<number | null>(null);
  const [ratingLoadingId, setRatingLoadingId] = useState<number | null>(null);
  const [ratingDraft, setRatingDraft] = useState<Record<number, { stars: number; feedback: string }>>({});
  const [chargeRecalcActionLoading, setChargeRecalcActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [ordering, setOrdering] = useState<string>("-created_at");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  const [currentUserType, setCurrentUserType] = useState<string | null>(null);

  useEffect(() => {
    if (user?.user_type != null) setCurrentUserType(String(user.user_type));
  }, [user?.user_type]);

  const isAdminOrOIC = (): boolean => {
    if (!currentUserType) return false;
    const t = String(currentUserType).toLowerCase();
    return t === "admin" || t === "manager";
  };

  const shouldShowTimeDisplay = (booking: Booking): boolean => {
    if (isAdminOrOIC()) return true;
    return booking.equipment_weekly_view_display !== "SLOT_ID";
  };

  const handleResultsClick = async (booking: Booking) => {
    const bid = booking.booking_id;
    const cached = resultsCache[bid];
    if (cached) {
      if (cached.exists && cached.files.length > 0) {
        setResultsDialogFiles(cached.files);
        setResultsDialogBookingId(bid);
        setResultsDialogOpen(true);
      } else {
        toast.info("No results folder found for this booking.");
      }
      return;
    }
    setResultsLoadingId(bid);
    const res = await apiClient.getBookingResults(bid);
    setResultsLoadingId(null);
    const exists = res.data?.exists ?? false;
    const files = (res.data?.files ?? []).map((f) => ({ name: f.name, download_url: f.download_url }));
    setResultsCache((prev) => ({ ...prev, [bid]: { exists, files } }));
    if (exists && files.length > 0) {
      setResultsDialogFiles(files);
      setResultsDialogBookingId(bid);
      setResultsDialogOpen(true);
    } else {
      toast.info("No results folder found for this booking.");
    }
  };

  useEffect(() => {
    const pendingRating = searchParams.get("pending_rating");
    const onlyShowPendingRating = pendingRating === "1" || pendingRating === "true";
    if (onlyShowPendingRating) {
      setStatusFilter("COMPLETED");
      setSearchParams({}, { replace: true });
    }
    if (authLoading) return;
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    checkAuthAndFetchBookings(onlyShowPendingRating);
  }, [authLoading]);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) return;
    apiClient.getEquipments(undefined, "ACTIVE").then((res) => {
      if (res.data?.equipments) {
        setEquipmentList(
          res.data.equipments.map((e: { equipment_id: number; name?: string; code?: string }) => ({
            equipment_id: e.equipment_id,
            name: e.name || e.code || "",
            code: e.code || "",
          }))
        );
      }
    }).catch(() => {});
  }, []);

  // When opening from email link (e.g. ?booking=123), fetch that booking and show detail
  const bookingIdParam = searchParams.get("booking");
  useEffect(() => {
    if (!bookingIdParam) return;
    const bid = parseInt(bookingIdParam, 10);
    if (!Number.isInteger(bid)) return;
    const inList = bookings.some((b) => b.booking_id === bid);
    if (inList) {
      setSelectedBookingId(bid);
      setOverrideBooking(null);
      setTimeout(() => document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      return;
    }
    let cancelled = false;
    apiClient.getBookings({ booking_id: bid, limit: 1 }).then((res) => {
      if (cancelled || res.error) return;
      const b = res.data?.bookings?.[0];
      if (b) {
        setOverrideBooking(b);
        setSelectedBookingId(bid);
        setTimeout(() => document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      }
    });
    return () => { cancelled = true; };
  }, [bookingIdParam, bookings]);

  const checkAuthAndFetchBookings = async (onlyShowPendingRating?: boolean) => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    fetchBookings(onlyShowPendingRating ? { status: "COMPLETED", onlyShowUnrated: true } : undefined, 1);
  };

  const fetchBookings = async (overrides?: { status?: string; onlyShowUnrated?: boolean }, pageOverride?: number) => {
    try {
      setLoading(true);
      const currentPage = pageOverride ?? page;
      const params: Record<string, string | number | boolean> = {
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        list_view: true,
      };
      const status = overrides?.status ?? statusFilter;
      if (status !== "all") params.status = status;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (equipmentFilter && equipmentFilter !== "all") params.equipment_id = equipmentFilter;
      if (ordering) params.ordering = ordering;
      const response = await apiClient.getBookings(params);
      if (response.error) {
        toast.error(response.error || "Failed to load bookings");
        setBookings([]);
        setTotalCount(0);
      } else if (response.data && response.data.bookings) {
        let list = response.data.bookings;
        if (overrides?.onlyShowUnrated) {
          list = list.filter(
            (b: Booking) =>
              (b.rating == null || b.rating === undefined) && (b.equipment_user_rating_enabled !== false)
          );
        }
        setBookings(list);
        setTotalCount(response.data.total_count ?? list.length);
      } else {
        setBookings([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
      setBookings([]);
      setTotalCount(0);
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
      booked: "bg-blue-500",
      in_progress: "bg-green-500",
      completed: "bg-green-500",
      cancelled: "bg-red-500",
      rejected: "bg-red-500",
      absent: "bg-orange-500",
      refunded: "bg-purple-500",
      booking_not_utilized: "bg-amber-600",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const formatBookingStartDate = (startTime: string) => {
    if (!startTime) return "—";
    const d = new Date(startTime);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };

  const formatDuration = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const showBookingDetail = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setOverrideBooking(null);
    apiClient.getBookings({ booking_id: bookingId, limit: 1 }).then((res) => {
      if (res.data?.bookings?.[0]) setOverrideBooking(res.data.bookings[0]);
    });
    setTimeout(() => document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const closeDetail = () => {
    setSelectedBookingId(null);
    setOverrideBooking(null);
    setSearchParams((prev) => {
      prev.delete("booking");
      return prev;
    });
  };

  const canCancelOrReschedule = (status: string) => {
    const statusLower = status.toLowerCase();
    return statusLower === "pending" || statusLower === "booked";
  };

  const isRepeatBooking = (booking: Booking): boolean =>
    (booking.source_booking_id != null && booking.source_booking_id !== undefined) ||
    (typeof booking.virtual_booking_id === "string" && booking.virtual_booking_id.endsWith("R"));

  const isWithinThresholdWindow = (booking: Booking): boolean => {
    if (!canCancelOrReschedule(booking.status)) return false;
    if (!booking.start_time) return false;
    try {
      const startTime = new Date(booking.start_time);
      const now = new Date();
      if (startTime <= now) return false;
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
      return hoursUntilStart > threshold;
    } catch {
      return false;
    }
  };

  const canRateBooking = (booking: Booking): boolean => {
    if (booking.rating != null && booking.rating !== undefined) return false;
    if (booking.equipment_user_rating_enabled === false) return false;
    return booking.status.toUpperCase() === "COMPLETED";
  };

  const handleSubmitRating = async (booking: Booking) => {
    const draft = ratingDraft[booking.booking_id];
    if (!draft || draft.stars < 1) {
      toast.error("Please select a rating (1–5 stars).");
      return;
    }
    setRatingLoadingId(booking.booking_id);
    const res = await apiClient.rateBooking(booking.booking_id, draft.stars, draft.feedback.trim() || undefined);
    setRatingLoadingId(null);
    if (res.error) {
      toast.error(res.error || "Failed to submit rating");
      return;
    }
    toast.success("Rating submitted.");
    setRatingDraft((prev) => {
      const next = { ...prev };
      delete next[booking.booking_id];
      return next;
    });
    await fetchBookings(undefined, page);
  };

  const canShowRepeatSampleButton = (booking: Booking): boolean => {
    if (booking.status.toUpperCase() !== "COMPLETED") return false;
    const status = (booking.repeat_sample_request_status || "").toUpperCase();
    if (status === "PENDING" || status === "APPROVED") return false;
    return false;
  };

  const canReschedule = (booking: Booking) => {
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
    if (isRepeatBooking(booking)) {
      toast.error("Repeat sample bookings cannot be cancelled. Please contact admin if you need to cancel.");
      return;
    }
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
      setSelectedBookingId(null);
      setOverrideBooking(null);
      await fetchBookings(undefined, page);
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
        setSelectedBookingId(null);
        setOverrideBooking(null);
        await fetchBookings(undefined, page);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to reschedule booking");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessChargeRecalcRefund = async (b: Booking) => {
    setChargeRecalcActionLoading(true);
    try {
      const res = await apiClient.processChargeRecalculationRefund(b.booking_id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Refund processed. Amount credited to wallet.");
      await fetchBookings(undefined, page);
    } catch (e: any) {
      toast.error(e.message || "Failed to process refund");
    } finally {
      setChargeRecalcActionLoading(false);
    }
  };

  const handleProcessChargeRecalcPayNow = async (b: Booking) => {
    setChargeRecalcActionLoading(true);
    try {
      const res = await apiClient.processChargeRecalculationPayNow(b.booking_id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Payment processed. Amount debited from wallet.");
      await fetchBookings(undefined, page);
    } catch (e: any) {
      toast.error(e.message || "Failed to process payment");
    } finally {
      setChargeRecalcActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const token = apiClient.getToken();
  if (!authLoading && !token) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter your bookings by status, date range, equipment, or search.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="BOOKED">BOOKED</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    <SelectItem value="ABSENT">Operator Unavailable</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                    <SelectItem value="BOOKING_NOT_UTILIZED">Booking Not Utilized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Booking ID or equipment name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All equipment</SelectItem>
                    {equipmentList.map((eq) => (
                      <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                        {eq.name || eq.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort</Label>
                <Select value={ordering} onValueChange={setOrdering}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-created_at">Newest first</SelectItem>
                    <SelectItem value="created_at">Oldest first</SelectItem>
                    <SelectItem value="-start_time">Start time (newest)</SelectItem>
                    <SelectItem value="start_time">Start time (oldest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => {
                  setPage(1);
                  setSelectedBookingId(null);
                  setOverrideBooking(null);
                  fetchBookings(undefined, 1);
                }}
              >
                Apply filters
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setStartDate("");
                  setEndDate("");
                  setSearchQuery("");
                  setEquipmentFilter("all");
                  setOrdering("-created_at");
                  setPage(1);
                  setSelectedBookingId(null);
                  setOverrideBooking(null);
                  setTimeout(() => fetchBookings(undefined, 1), 0);
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {!loading && bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              {statusFilter !== "all" || startDate || endDate || searchQuery.trim() || (equipmentFilter && equipmentFilter !== "all") ? (
                <>
                  <p className="text-muted-foreground mb-4">No bookings match your filters</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter("all");
                      setStartDate("");
                      setEndDate("");
                      setSearchQuery("");
                      setEquipmentFilter("all");
                      setOrdering("-created_at");
                      setPage(1);
                      setSelectedBookingId(null);
                      setOverrideBooking(null);
                      setTimeout(() => fetchBookings(undefined, 1), 0);
                    }}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">No bookings yet</p>
                  <Button onClick={() => navigate("/equipments")}>
                    Book Equipment
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden border shadow-sm">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-lg">My Bookings</CardTitle>
                <CardDescription>Click a booking ID to view full details. Use filters above and Apply to search.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Booking ID</TableHead>
                      <TableHead className="font-semibold">Equipment</TableHead>
                      <TableHead className="font-semibold">Start</TableHead>
                      <TableHead className="font-semibold">Duration</TableHead>
                      <TableHead className="font-semibold">Cost</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Rating</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && bookings.length === 0 ? (
                      <>
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={8} className="h-12">
                              <div className="animate-pulse flex gap-2">
                                <div className="h-4 bg-muted rounded w-24" />
                                <div className="h-4 bg-muted rounded w-32" />
                                <div className="h-4 bg-muted rounded w-28" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ) : (
                      bookings.map((booking) => (
                      <TableRow key={booking.booking_id} className="group">
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => showBookingDetail(booking.booking_id)}
                            className={`inline-flex items-center gap-1.5 hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded ${
                              booking.status.toUpperCase() === "COMPLETED"
                                ? "text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                                : "text-primary hover:text-primary/80"
                            }`}
                          >
                            {booking.virtual_booking_id || `${booking.equipment_code}-#${booking.booking_id}`}
                            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={booking.equipment_name}>
                          {booking.equipment_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatBookingStartDate(booking.start_time)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDuration(booking.total_time_minutes)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-primary">
                          ₹{Number(booking.total_charge).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status_display}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {booking.rating != null ? (
                            <span className="inline-flex items-center gap-0.5" title={`${booking.rating}/5`}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-4 w-4 ${s <= (booking.rating ?? 0) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                                />
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => showBookingDetail(booking.booking_id)}
                            >
                              View
                            </Button>
                            {booking.status.toUpperCase() === "COMPLETED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={resultsLoadingId === booking.booking_id}
                                onClick={() => handleResultsClick(booking)}
                              >
                                {resultsLoadingId === booking.booking_id ? "…" : "Results"}
                              </Button>
                            )}
                            {canCancelOrReschedule(booking.status) && canReschedule(booking) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setRescheduleDialogOpen(true);
                                }}
                              >
                                Reschedule
                              </Button>
                            )}
                            {canCancelOrReschedule(booking.status) && !isRepeatBooking(booking) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleCancelClick(booking)}
                              >
                                Cancel
                              </Button>
                            )}
                            {canRateBooking(booking) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  showBookingDetail(booking.booking_id);
                                  setRatingDraft((prev) => ({ ...prev, [booking.booking_id]: { stars: 0, feedback: "" } }));
                                }}
                              >
                                Rate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              {totalCount > 0 && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-t bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} booking{totalCount !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        closeDetail();
                        fetchBookings(undefined, Math.max(1, page - 1));
                      }}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        closeDetail();
                        fetchBookings(undefined, nextPage);
                      }}
                      disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {selectedBookingId != null && (() => {
              if (!overrideBooking) {
                return (
                  <div id="booking-detail-section" className="mt-6 flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Loading booking details…</span>
                  </div>
                );
              }
              return (
                <BookingDetailCard
                  booking={overrideBooking as BookingDetailCardBooking}
                  onClose={closeDetail}
                  onUpdated={() => fetchBookings(undefined, page)}
                  isOperator={false}
                  currentUserId={user?.id}
                  backLabel="Back to list"
                  showPrintButton
                  onUserCancelClick={(b) => {
                    setSelectedBooking(b as Booking);
                    setCancelDialogOpen(true);
                  }}
                />
              );
            })()}
          </>
        )}

        {/* Results download dialog */}
        <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download Results</DialogTitle>
              <DialogDescription>
                Download the entire folder as ZIP (includes booking ID folder and all subfiles), or open individual files below.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {resultsDialogBookingId != null && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    const err = await apiClient.downloadBookingResultsZip(resultsDialogBookingId);
                    if (err.error) toast.error(err.error);
                    else toast.success("Download started.");
                  }}
                >
                  <FolderDown className="h-4 w-4 mr-2" />
                  Download folder (ZIP)
                </Button>
              )}
              <p className="text-sm text-muted-foreground">Individual files:</p>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {resultsDialogFiles.map((file, idx) => (
                  <li key={idx}>
                    <a
                      href={file.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </DialogContent>
        </Dialog>

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
                    <p><strong>{shouldShowTimeDisplay(selectedBooking) ? "Start Time:" : "Date:"}</strong>{" "}
                      {shouldShowTimeDisplay(selectedBooking)
                        ? new Date(selectedBooking.start_time).toLocaleString()
                        : new Date(selectedBooking.start_time).toLocaleDateString()}
                    </p>
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