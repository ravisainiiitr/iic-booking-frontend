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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import RescheduleSlotPicker from "@/components/RescheduleSlotPicker";
import { X, FolderDown, Download, Star, Filter, RotateCcw, Banknote } from "lucide-react";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import { getBookingKey, getRealBookingId, type BookingRef } from "@/lib/bookingRef";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface Booking extends BookingRef {
  virtual_booking_id?: string | null;
  user: number;
  user_email: string;
  user_name: string;
  created_by_name?: string | null;
  created_by?: number | null;
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
    booking_id: string | number;
    real_booking_id?: number | null;
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
  has_results?: boolean;
  oic_contacts?: Array<{
    user_id: number;
    name: string;
    email?: string;
    phone?: string | null;
    user_type?: string;
  }>;
  istem_fbr_number?: string | null;
  istem_fbr_status?: string | null;
  istem_fbr_status_display?: string | null;
  istem_fbr_invalid_reason?: string | null;
  istem_fbr_executed_at?: string | null;
  repeat_sample_request_status?: string | null;
  repeat_sample_enabled?: boolean;
  source_booking_id?: number | null;
  created_at: string;
  updated_at: string;
  charge_recalculation_pending_amount?: string | null;
  waitlist_entry_id?: number;
  waitlist_position?: number;
  waitlist_code?: string;
  is_waitlist_entry?: boolean;
  booking_attempt_requested_at?: string | null;
  booking_attempt_failure_reason?: string | null;
  booking_attempt_number_of_samples?: number | null;
  booking_attempt_slots_requested?: number | null;
  booking_attempt_duration_minutes?: number | null;
  booking_attempt_additional_info?: any;
  /** Equipment under-maintenance disruption policy */
  maintenance_disruption_flag?: boolean;
  maintenance_decision_deadline_at?: string | null;
  maintenance_reschedule_extra_week?: boolean;
  /** When equipment became operational again; used server-side for extra reschedule weeks */
  maintenance_operational_marked_at?: string | null;
  equipment_status?: string | null;
  /** False when equipment is not ACTIVE (e.g. under maintenance) */
  equipment_is_operational?: boolean;
  equipment_profile_type?: string | null;
  equipment_profile_type_display?: string | null;
}

const SAMPLE_BASED_PROFILE_TYPES = new Set(["SAMPLE", "SAMPLE_ELEMENT", "MULTI_PARAM"]);

function usesInputReductionForPartialCancel(booking: Booking | null): boolean {
  const pt = (booking?.equipment_profile_type || "").toUpperCase();
  return SAMPLE_BASED_PROFILE_TYPES.has(pt);
}

function getCurrentReductionValue(booking: Booking, fieldKey: string): number {
  const raw = booking.input_values?.[fieldKey];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function getReductionFieldMeta(booking: Booking): { key: string; label: string } {
  const key = usesInputReductionForPartialCancel(booking) ? "A" : "B";
  const field = booking.input_fields?.find((f) => f.field_key === key);
  return { key, label: field?.field_label || (key === "A" ? "Number of samples" : "Number of slots") };
}

const PAGE_SIZE = 50;

type BookingDailySlot = Booking["daily_slots"][number];

function slotHasStarted(slot: Pick<BookingDailySlot, "start_datetime">): boolean {
  return new Date(slot.start_datetime).getTime() <= Date.now();
}

function getDefaultCancelSlotIds(booking: Booking, allowStartedSlots: boolean): number[] {
  const slots = [...(booking.daily_slots ?? [])].sort(
    (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  );
  return slots.filter((s) => allowStartedSlots || !slotHasStarted(s)).map((s) => s.id);
}

function calculateCancelRefundAmount(booking: Booking, selectedSlotIds: number[]): number {
  const slots = booking.daily_slots ?? [];
  if (slots.length === 0 || selectedSlotIds.length === 0) return 0;
  const totalCharge = Number(booking.total_charge);
  if (selectedSlotIds.length >= slots.length) return totalCharge;
  // Equal share per slot (matches backend partial-cancel refund).
  return (totalCharge / slots.length) * selectedSlotIds.length;
}

const MyBookings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBookingId, setSelectedBookingId] = useState<string | number | null>(null);
  const [overrideBooking, setOverrideBooking] = useState<Booking | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelSlotIds, setCancelSlotIds] = useState<number[]>([]);
  const [cancelSlotsLoading, setCancelSlotsLoading] = useState(false);
  const [cancelEntireBooking, setCancelEntireBooking] = useState(true);
  const [cancelReducedValue, setCancelReducedValue] = useState<number>(1);
  const [cancelPreview, setCancelPreview] = useState<{
    refund_amount: string;
    slots_to_release_count: number;
    slots_to_keep_count: number;
    new_charge: string;
  } | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resultsCache, setResultsCache] = useState<Record<string, { exists: boolean; files: Array<{ name: string; download_url: string }> }>>({});
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [resultsDialogFiles, setResultsDialogFiles] = useState<Array<{ name: string; download_url: string }>>([]);
  const [resultsDialogBookingId, setResultsDialogBookingId] = useState<number | null>(null);
  const [resultsLoadingId, setResultsLoadingId] = useState<string | number | null>(null);
  const [zipDownloadInProgress, setZipDownloadInProgress] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState(0);
  const [resultsFbrInfoOpen, setResultsFbrInfoOpen] = useState(false);
  const [resultsFbrBlock, setResultsFbrBlock] = useState<{ message: string; portalUrl?: string } | null>(null);
  const [resultsDialogBooking, setResultsDialogBooking] = useState<Booking | null>(null);
  const [ratingRequiredPopupOpen, setRatingRequiredPopupOpen] = useState(false);
  const [ratingLoadingId, setRatingLoadingId] = useState<string | number | null>(null);
  const [ratingDraft, setRatingDraft] = useState<Record<string, { stars: number; feedback: string }>>({});
  const [chargeRecalcActionLoading, setChargeRecalcActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [ordering, setOrdering] = useState<string>("-created_at");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  const [currentUserType, setCurrentUserType] = useState<string | null>(null);
  const [cancelProgress, setCancelProgress] = useState(0);
  const isFacultyUser = String(currentUserType || "").toLowerCase() === "faculty";
  const isAccountsFinanceUser = String(currentUserType || "").toLowerCase() === "finance";
  const isLabOperatorUser = String(currentUserType || "").toLowerCase() === "operator";

  useEffect(() => {
    if (user?.user_type != null) setCurrentUserType(String(user.user_type));
  }, [user?.user_type]);

  // Show a smooth progress bar while cancellation is being processed.
  useEffect(() => {
    if (!(cancelDialogOpen && actionLoading)) {
      setCancelProgress(0);
      return;
    }
    setCancelProgress(12);
    const timer = window.setInterval(() => {
      setCancelProgress((prev) => (prev >= 92 ? prev : Math.min(92, prev + 8)));
    }, 220);
    return () => window.clearInterval(timer);
  }, [cancelDialogOpen, actionLoading]);

  useEffect(() => {
    if (!cancelDialogOpen || !selectedBooking || isWaitlistedEntry(selectedBooking)) {
      setCancelPreview(null);
      return;
    }
    const backendId = getRealBookingId(selectedBooking);
    if (backendId == null) return;

    const inputReduction = usesInputReductionForPartialCancel(selectedBooking);
    if (cancelEntireBooking) {
      setCancelPreview(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setCancelPreviewLoading(true);
      try {
        if (inputReduction) {
          const { key } = getReductionFieldMeta(selectedBooking);
          const current = getCurrentReductionValue(selectedBooking, key);
          if (cancelReducedValue >= current || cancelReducedValue < 1) {
            setCancelPreview(null);
            return;
          }
          const res = await apiClient.partialCancelPreview(backendId, {
            reduced_input_values: { [key]: cancelReducedValue },
          });
          if (res.data && !res.error) {
            setCancelPreview({
              refund_amount: res.data.refund_amount,
              slots_to_release_count: res.data.slots_to_release_count,
              slots_to_keep_count: res.data.slots_to_keep_count,
              new_charge: res.data.new_charge,
            });
          } else {
            setCancelPreview(null);
          }
        } else {
          const allSlots = selectedBooking.daily_slots ?? [];
          if (cancelSlotIds.length === 0 || cancelSlotIds.length >= allSlots.length) {
            setCancelPreview(null);
            return;
          }
          const res = await apiClient.partialCancelPreview(backendId, { slot_ids: cancelSlotIds });
          if (res.data && !res.error) {
            setCancelPreview({
              refund_amount: res.data.refund_amount,
              slots_to_release_count: res.data.slots_to_release_count,
              slots_to_keep_count: res.data.slots_to_keep_count,
              new_charge: res.data.new_charge,
            });
          } else {
            setCancelPreview(null);
          }
        }
      } catch {
        setCancelPreview(null);
      } finally {
        setCancelPreviewLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    cancelDialogOpen,
    selectedBooking,
    cancelEntireBooking,
    cancelReducedValue,
    cancelSlotIds,
  ]);

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
    if (canRateBooking(booking)) {
      setRatingRequiredPopupOpen(true);
      showBookingDetail(booking);
      return;
    }
    if (booking.has_results !== true) {
      toast.info("Results are not available for this booking yet.");
      return;
    }
    const bid = booking.booking_id;
    const backendId = getRealBookingId(booking);
    const cacheKey = getBookingKey(booking);
    const cached = resultsCache[cacheKey];
    if (cached) {
      if (cached.exists && cached.files.length > 0) {
        setResultsDialogBooking(booking);
        setResultsDialogFiles(cached.files);
        setResultsDialogBookingId(backendId);
        setResultsDialogOpen(true);
      } else {
        toast.info("No results folder found for this booking.");
      }
      return;
    }
    if (backendId == null) {
      toast.error("Result files are unavailable for this booking.");
      return;
    }
    setResultsLoadingId(bid);
    const res = await apiClient.getBookingResults(backendId);
    setResultsLoadingId(null);
    if (res.error) {
      if (res.errorCode === "istem_fbr_not_executed") {
        setResultsFbrBlock({ message: res.error, portalUrl: res.istem_portal_url });
        setResultsDialogBooking(booking);
        setResultsFbrInfoOpen(true);
        return;
      }
      toast.error(res.error);
      return;
    }
    const exists = res.data?.exists ?? false;
    const files = (res.data?.files ?? []).map((f) => ({ name: f.name, download_url: f.download_url }));
    setResultsCache((prev) => ({ ...prev, [cacheKey]: { exists, files } }));
    if (exists && files.length > 0) {
      setResultsDialogBooking(booking);
      setResultsDialogFiles(files);
      setResultsDialogBookingId(backendId);
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
    const inList = bookings.some((b) => getBookingKey(b) === bookingIdParam);
    if (inList) {
      const row = bookings.find((b) => getBookingKey(b) === bookingIdParam);
      setSelectedBookingId(bookingIdParam);
      setOverrideBooking(null);
      const backendId = row ? getRealBookingId(row) : null;
      if (backendId != null) {
        apiClient.getBookings({ booking_id: backendId, limit: 1 }).then((res) => {
          if (res.data?.bookings?.[0]) setOverrideBooking(res.data.bookings[0]);
        });
      }
      setTimeout(() => document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      return;
    }
    let cancelled = false;
    apiClient.getBookings({ search: bookingIdParam, limit: 1 }).then((res) => {
      if (cancelled || res.error) return;
      const b = res.data?.bookings?.[0];
      if (b) {
        setOverrideBooking(b);
        setSelectedBookingId(b.booking_id);
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
      if (status !== "all" && status !== "WAITLISTED") params.status = status;
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
        let list = response.data.bookings as unknown as Booking[];
        if (!isAccountsFinanceUser && (status === "all" || status === "WAITLISTED")) {
          const waitlistRes = await apiClient.getMyWaitlistEntries();
          if (!waitlistRes.error && Array.isArray(waitlistRes.data?.entries)) {
            list = [...list, ...(waitlistRes.data?.entries as unknown as Booking[])];
          }
        }
        if (status === "WAITLISTED") {
          list = list.filter((b: Booking) => isWaitlistedEntry(b));
        }
        list = [...list].sort((a, b) => {
          const aTs = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const bTs = b?.created_at ? new Date(b.created_at).getTime() : 0;
          return ordering === "created_at" ? aTs - bTs : bTs - aTs;
        });
        if (overrides?.onlyShowUnrated) {
          list = list.filter(
            (b: Booking) =>
              (b.rating == null || b.rating === undefined) &&
              (b.equipment_user_rating_enabled !== false) &&
              (!isFacultyUser || (user?.id != null && Number(b.user) === Number(user.id)))
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
      waitlisted: "bg-amber-500",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const formatBookingStartDate = (startTime: string) => {
    if (!startTime) return "—";
    const d = new Date(startTime);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };

  const formatDuration = (totalMinutes: number) => {
    if (totalMinutes <= 0) return "—";
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const showBookingDetail = (booking: Booking) => {
    const bookingId = booking.booking_id;
    const backendId = getRealBookingId(booking);
    setSelectedBookingId(bookingId);
    setOverrideBooking(null);
    if (backendId == null) return;
    apiClient.getBookings({ booking_id: backendId, limit: 1 }).then((res) => {
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

  const showWaitlistDetail = (booking: Booking) => {
    setSelectedBookingId(booking.booking_id);
    setOverrideBooking(booking);
    setTimeout(
      () =>
        document
          .getElementById("booking-detail-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      150
    );
  };

  const canCancelOrReschedule = (status: string) => {
    const statusLower = status.toLowerCase();
    return (
      statusLower === "pending" ||
      statusLower === "booked" ||
      statusLower === "disruption_pending"
    );
  };

  const isWaitlistedEntry = (booking: Booking) =>
    booking.status?.toUpperCase() === "WAITLISTED" || booking.is_waitlist_entry === true;

  const canCancelBooking = (booking: Booking) =>
    isWaitlistedEntry(booking) || canCancelOrReschedule(booking.status);

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
      // Allow actions at the exact cutoff moment; disallow only when strictly inside the threshold window.
      return hoursUntilStart >= threshold;
    } catch {
      return false;
    }
  };

  const canRateBooking = (booking: Booking): boolean => {
    if (isAccountsFinanceUser) return false;
    if (booking.rating != null && booking.rating !== undefined) return false;
    if (booking.equipment_user_rating_enabled === false) return false;
    if (isFacultyUser && (user?.id == null || Number(booking.user) !== Number(user.id))) return false;
    return booking.status.toUpperCase() === "COMPLETED";
  };

  const handleSubmitRating = async (booking: Booking) => {
    const bookingKey = getBookingKey(booking);
    const draft = ratingDraft[bookingKey];
    if (!draft || draft.stars < 1) {
      toast.error("Please select a rating (1–5 stars).");
      return;
    }
    const backendId = getRealBookingId(booking);
    if (backendId == null) {
      toast.error("This booking cannot be rated right now.");
      return;
    }
    setRatingLoadingId(booking.booking_id);
    const res = await apiClient.rateBooking(backendId, {
      rating: draft.stars,
      feedback: draft.feedback.trim() || undefined,
    });
    setRatingLoadingId(null);
    if (res.error) {
      toast.error(res.error || "Failed to submit rating");
      return;
    }
    toast.success("Rating submitted.");
    setRatingDraft((prev) => {
      const next = { ...prev };
      delete next[bookingKey];
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
      if (!booking.maintenance_disruption_flag && startTime <= now) {
        return false;
      }
      
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Get threshold from equipment (default to 48 hours if not specified)
      const threshold = booking.equipment_reschedule_hours_threshold ?? 48;

      // Under maintenance disruption: reschedule only after equipment is operational again
      if (booking.maintenance_disruption_flag && booking.equipment_is_operational === false) {
        return false;
      }

      // Disruption policy (maintenance/operator absent): reschedule allowed even inside threshold
      if (booking.maintenance_disruption_flag) {
        return true;
      }

      // Allow reschedule if booking is more than threshold hours away
      // Allow reschedule at the exact cutoff moment; disallow only when strictly inside the threshold window.
      return hoursUntilStart >= threshold;
    } catch (error) {
      console.error('Error calculating reschedule eligibility:', error);
      return false;
    }
  };

  /** Cancel allowed outside normal threshold when maintenance disruption policy applies. Waitlist: any time if entry id present. */
  const canUseCancelButton = (booking: Booking) => {
    if (isRepeatBooking(booking)) return false;
    if (isWaitlistedEntry(booking)) {
      return Boolean(booking.waitlist_entry_id);
    }
    return (
      canCancelBooking(booking) &&
      (!!booking.maintenance_disruption_flag || isWithinThresholdWindow(booking))
    );
  };

  const restrictedExternalUserType =
    currentUserType &&
    ["external", "rnd", "industry", "other"].includes(String(currentUserType).toLowerCase());

  /** Table Cancel: waitlisted users may cancel queue entry even when external; normal bookings keep existing external restriction. */
  const canShowTableCancelButton = (booking: Booking) =>
    !isAccountsFinanceUser &&
    !isLabOperatorUser &&
    canUseCancelButton(booking) &&
    (isWaitlistedEntry(booking) || !restrictedExternalUserType);

  const openCancelDialog = async (booking: Booking) => {
    setCancelNotes("");
    setCancelSlotIds([]);
    setCancelEntireBooking(true);
    setCancelPreview(null);
    setCancelReducedValue(getCurrentReductionValue(booking, "A"));
    setSelectedBooking(booking);
    setCancelDialogOpen(true);

    if (isWaitlistedEntry(booking)) {
      return;
    }

    const backendId = getRealBookingId(booking);
    if (backendId == null) {
      setCancelSlotIds(getDefaultCancelSlotIds(booking, isAdminOrOIC()));
      return;
    }

    setCancelSlotsLoading(true);
    try {
      const res = await apiClient.getBookings({ booking_id: backendId, limit: 1 });
      const fullBooking = res.data?.bookings?.[0] as unknown as Booking | undefined;
      if (!res.error && fullBooking) {
        setSelectedBooking(fullBooking);
        setCancelSlotIds(getDefaultCancelSlotIds(fullBooking, isAdminOrOIC()));
        const currentA = getCurrentReductionValue(fullBooking, "A");
        setCancelReducedValue(currentA > 1 ? currentA - 1 : 1);
      } else {
        setCancelSlotIds(getDefaultCancelSlotIds(booking, isAdminOrOIC()));
        if (res.error) {
          toast.error(res.error || "Could not load booking slots");
        }
      }
    } catch {
      setCancelSlotIds(getDefaultCancelSlotIds(booking, isAdminOrOIC()));
      toast.error("Could not load booking slots");
    } finally {
      setCancelSlotsLoading(false);
    }
  };

  const handleCancelClick = (booking: Booking) => {
    if (isRepeatBooking(booking)) {
      toast.error("Repeat sample bookings cannot be cancelled. Please contact admin if you need to cancel.");
      return;
    }
    if (isWaitlistedEntry(booking)) {
      openCancelDialog(booking);
      return;
    }
    // Check if cancel is allowed based on time threshold (maintenance disruption: always allowed)
    if (!booking.maintenance_disruption_flag && !isWithinThresholdWindow(booking)) {
      if (booking.start_time) {
        const startTime = new Date(booking.start_time);
        const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
        const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
        toast.error(
          `Cancellation is only available until ${cutoffTime.toLocaleString()}. Kindly contact the admin to cancel the booking.`
        );
      } else {
        toast.error("Cannot cancel this booking. Start time is not available.");
      }
      return;
    }
    
    openCancelDialog(booking);
  };

  const handleRescheduleClick = (booking: Booking) => {
    // Check if reschedule is allowed based on time threshold
    if (!canReschedule(booking)) {
      if (booking.start_time) {
        const startTime = new Date(booking.start_time);
        const threshold = booking.equipment_reschedule_hours_threshold ?? 48;
        const cutoffTime = new Date(startTime.getTime() - threshold * 60 * 60 * 1000);
        toast.error(
          `Rescheduling is only available until ${cutoffTime.toLocaleString()}. Kindly contact the admin to reschedule the booking.`
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
    if (selectedBooking.source_booking_id != null) {
      toast.error("Repeat sample bookings cannot be cancelled. Please contact admin if you need to cancel.");
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      setCancelNotes("");
      setCancelSlotIds([]);
      return;
    }

    setActionLoading(true);
    try {
      if (isWaitlistedEntry(selectedBooking)) {
        const entryId = selectedBooking.waitlist_entry_id;
        if (!entryId) {
          toast.error("Waitlist entry id is missing.");
          setActionLoading(false);
          return;
        }
        const response = await apiClient.cancelMyWaitlistEntry(entryId);
        if (response.error) {
          toast.error(response.error || "Failed to cancel waitlisted booking");
          setActionLoading(false);
          return;
        }
        toast.success(response.data?.message || "Waitlisted booking cancelled successfully.");
        setCancelDialogOpen(false);
        setSelectedBooking(null);
        setCancelNotes("");
        setSelectedBookingId(null);
        setOverrideBooking(null);
        await fetchBookings(undefined, page);
        setActionLoading(false);
        return;
      }

      // Cancel booking with refund (always refund)
      const backendId = getRealBookingId(selectedBooking);
      if (backendId == null) {
        toast.error("This booking cannot be cancelled right now.");
        setActionLoading(false);
        return;
      }
      if ((selectedBooking.daily_slots?.length ?? 0) > 0 && !cancelEntireBooking) {
        const inputReduction = usesInputReductionForPartialCancel(selectedBooking);
        if (inputReduction) {
          const { key } = getReductionFieldMeta(selectedBooking);
          const current = getCurrentReductionValue(selectedBooking, key);
          if (cancelReducedValue >= current || cancelReducedValue < 1) {
            toast.error(`Enter a reduced ${getReductionFieldMeta(selectedBooking).label.toLowerCase()} less than ${current}.`);
            setActionLoading(false);
            return;
          }
        } else if (cancelSlotIds.length === 0) {
          toast.error("Select at least one slot to cancel.");
          setActionLoading(false);
          return;
        }
      }

      let slotIdsPayload: number[] | undefined;
      let reducedInputValues: Record<string, number> | undefined;
      const slotCount = selectedBooking.daily_slots?.length ?? 0;

      if (slotCount > 0 && !cancelEntireBooking) {
        if (usesInputReductionForPartialCancel(selectedBooking)) {
          const { key } = getReductionFieldMeta(selectedBooking);
          reducedInputValues = { [key]: cancelReducedValue };
        } else {
          slotIdsPayload = cancelSlotIds;
        }
      }

      const response = await apiClient.userCancelBooking(
        backendId,
        true, // Always refund
        cancelNotes || undefined,
        slotIdsPayload,
        reducedInputValues
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
      setCancelSlotIds([]);
      setCancelEntireBooking(true);
      setCancelPreview(null);
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
      const backendId = getRealBookingId(selectedBooking);
      if (backendId == null) {
        toast.error("This booking cannot be rescheduled right now.");
        setActionLoading(false);
        return;
      }
      const response = await apiClient.userRescheduleBooking(
        backendId,
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
                    <SelectItem value="DISRUPTION_PENDING">Awaiting choice (disruption)</SelectItem>
                  <SelectItem value="UNDER_MAINTENANCE">Under maintenance</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    <SelectItem value="ABSENT">Operator Unavailable</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                    <SelectItem value="BOOKING_NOT_UTILIZED">Booking Not Utilized</SelectItem>
                    <SelectItem value="WAITLISTED">WAITLISTED</SelectItem>
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
                          {isWaitlistedEntry(booking) ? (
                            <button
                              type="button"
                              onClick={() => showWaitlistDetail(booking)}
                              className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-500 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                            >
                              {booking.virtual_booking_id || booking.waitlist_code || "Waitlisted"}
                              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => showBookingDetail(booking)}
                              className={`inline-flex items-center gap-1.5 hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded ${
                                booking.status.toUpperCase() === "COMPLETED"
                                  ? "text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                                  : "text-primary hover:text-primary/80"
                              }`}
                            >
                              {booking.virtual_booking_id || `${booking.equipment_code}-#${booking.booking_id}`}
                              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={booking.equipment_name}>
                          {booking.equipment_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {isWaitlistedEntry(booking)
                            ? (booking.created_at ? new Date(booking.created_at).toLocaleString() : "—")
                            : formatBookingStartDate(booking.start_time)}
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
                            {!isWaitlistedEntry(booking) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => showBookingDetail(booking)}
                              >
                                View
                              </Button>
                            )}
                            {!isWaitlistedEntry(booking) &&
                              booking.status.toUpperCase() === "COMPLETED" &&
                              booking.has_results === true && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={resultsLoadingId === booking.booking_id}
                                onClick={() => handleResultsClick(booking)}
                              >
                                {resultsLoadingId === booking.booking_id ? "…" : "Results"}
                              </Button>
                            )}
                            {!isAccountsFinanceUser &&
                              !isLabOperatorUser &&
                              (!currentUserType ||
                                !["external", "rnd", "industry", "other"].includes(String(currentUserType).toLowerCase())) &&
                              canCancelOrReschedule(booking.status) &&
                              canReschedule(booking) && (
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
                            {canShowTableCancelButton(booking) && (
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
                                  showBookingDetail(booking);
                                  setRatingDraft((prev) => ({ ...prev, [getBookingKey(booking)]: { stars: 0, feedback: "" } }));
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
              if (isWaitlistedEntry(overrideBooking)) {
                return (
                  <BookingDetailCard
                    booking={overrideBooking as unknown as BookingDetailCardBooking}
                    onClose={closeDetail}
                    onUpdated={() => fetchBookings(undefined, page)}
                    isOperator={isLabOperatorUser}
                    isManagerOrAdmin={isAdminOrOIC()}
                    currentUserType={currentUserType}
                    currentUserId={user?.id}
                    backLabel="Back to list"
                    showPrintButton
                    onUserCancelClick={
                      isLabOperatorUser || isAccountsFinanceUser
                        ? undefined
                        : (b) => openCancelDialog(b as unknown as Booking)
                    }
                  />
                );
              }
              return (
                <BookingDetailCard
                  booking={overrideBooking as BookingDetailCardBooking}
                  onClose={closeDetail}
                  onUpdated={() => fetchBookings(undefined, page)}
                  isOperator={isLabOperatorUser}
                  isManagerOrAdmin={isAdminOrOIC()}
                    currentUserType={currentUserType}
                  currentUserId={user?.id}
                  backLabel="Back to list"
                  showPrintButton
                  onUserCancelClick={
                    isLabOperatorUser || isAccountsFinanceUser
                      ? undefined
                      : (b) => openCancelDialog(b as Booking)
                  }
                />
              );
            })()}
          </>
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
                {(resultsDialogBooking?.oic_contacts?.length ?? 0) > 0 ? (
                  <ul className="text-sm space-y-2 list-none pl-0">
                    {resultsDialogBooking!.oic_contacts!.map((c) => (
                      <li key={c.user_id} className="border rounded-md p-2">
                        <div className="font-medium">{c.name}</div>
                        {c.phone ? <div>Mobile: {c.phone}</div> : null}
                        {c.email ? <div>Email: {c.email}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No OIC contact listed for this equipment. Please use institute helpdesk.
                  </p>
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

        {/* Results download dialog */}
        <Dialog
          open={resultsDialogOpen}
          onOpenChange={(open) => {
            setResultsDialogOpen(open);
            if (!open) setResultsDialogBooking(null);
          }}
        >
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
                  disabled={zipDownloadInProgress}
                  onClick={async () => {
                    setZipDownloadInProgress(true);
                    setZipDownloadProgress(8);
                    const err = await apiClient.downloadBookingResultsZip(
                      resultsDialogBookingId,
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
              )}
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
        <AlertDialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            // Keep dialog open while cancellation request is in progress so progress bar stays visible.
            if (actionLoading) return;
            setCancelDialogOpen(open);
            if (!open) {
              setCancelSlotIds([]);
              setCancelSlotsLoading(false);
              setCancelEntireBooking(true);
              setCancelPreview(null);
            }
          }}
        >
          <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>{selectedBooking && isWaitlistedEntry(selectedBooking) ? "Cancel Waitlisted Booking" : "Cancel Booking"}</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedBooking && isWaitlistedEntry(selectedBooking)
                  ? "Are you sure you want to cancel this waitlisted booking? This action cannot be undone."
                  : selectedBooking && !cancelEntireBooking && usesInputReductionForPartialCancel(selectedBooking)
                    ? `Reduce ${getReductionFieldMeta(selectedBooking).label.toLowerCase()} to release unused slots. Unused slots will be made available again.`
                    : selectedBooking && !cancelEntireBooking && (selectedBooking.daily_slots?.length ?? 0) > 1
                      ? "Select the slot(s) you want to cancel. Checked slots will be cancelled. This action cannot be undone."
                      : "Are you sure you want to cancel this booking? This action cannot be undone."}
                {actionLoading && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Processing cancellation request...</span>
                      <span>{cancelProgress}%</span>
                    </div>
                    <Progress value={cancelProgress} className="h-2" />
                  </div>
                )}
                {selectedBooking && (
                  <div className="mt-2 text-sm">
                    <p><strong>Equipment:</strong> {selectedBooking.equipment_name}</p>
                    {isWaitlistedEntry(selectedBooking) ? (
                      <p><strong>Queue Position:</strong> {selectedBooking.waitlist_code || `WL${selectedBooking.waitlist_position ?? "—"}`}</p>
                    ) : (
                      <p><strong>Total Charge:</strong> ₹{Number(selectedBooking.total_charge).toFixed(2)}</p>
                    )}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {selectedBooking && !isWaitlistedEntry(selectedBooking) && (() => {
                const slotCount = selectedBooking.daily_slots?.length ?? 0;
                const inputReduction = usesInputReductionForPartialCancel(selectedBooking);
                const { key, label } = getReductionFieldMeta(selectedBooking);
                const currentReduction = getCurrentReductionValue(selectedBooking, key);
                const canOfferPartialCancel = inputReduction
                  ? currentReduction > 1 || slotCount > 1
                  : slotCount > 1;

                return (
                  <>
                    {canOfferPartialCancel ? (
                      <div className="flex items-start gap-3 rounded-md border p-3">
                        <Checkbox
                          id="cancel-partial-only"
                          checked={!cancelEntireBooking}
                          disabled={actionLoading || cancelSlotsLoading}
                          onCheckedChange={(checked) => {
                            const partial = Boolean(checked);
                            setCancelEntireBooking(!partial);
                            if (partial) {
                              if (inputReduction && currentReduction > 1) {
                                setCancelReducedValue(currentReduction - 1);
                              } else if (!inputReduction) {
                                setCancelSlotIds([]);
                              }
                            }
                          }}
                          className="mt-0.5"
                        />
                        <label htmlFor="cancel-partial-only" className="text-sm leading-snug cursor-pointer">
                          <span className="font-medium">Partial cancellation only</span>
                          <span className="block text-muted-foreground mt-0.5">
                            {inputReduction
                              ? `Keep part of the booking by reducing ${label.toLowerCase()}.`
                              : "Release only some slots; the rest stay booked."}
                          </span>
                        </label>
                      </div>
                    ) : null}

                    {!cancelEntireBooking && inputReduction ? (
                      <div className="space-y-2">
                        <Label htmlFor="cancel-reduced-value">
                          Revised {label} (current: {currentReduction})
                        </Label>
                        <Input
                          id="cancel-reduced-value"
                          type="number"
                          min={1}
                          max={Math.max(1, currentReduction - 1)}
                          value={cancelReducedValue}
                          disabled={actionLoading || cancelSlotsLoading || cancelPreviewLoading}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (Number.isFinite(n)) setCancelReducedValue(n);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Slots required will be recalculated from the reduced value; extra slots are released.
                        </p>
                        {cancelPreview && cancelPreview.slots_to_release_count > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {cancelPreview.slots_to_release_count} slot(s) will be released;{" "}
                            {cancelPreview.slots_to_keep_count} will remain booked.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {!cancelEntireBooking && !inputReduction && slotCount > 0 ? (
                      <div className="space-y-2">
                        <Label>Slots to cancel</Label>
                        {cancelSlotsLoading ? (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            Loading slots…
                          </div>
                        ) : (
                          <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                            {[...(selectedBooking.daily_slots ?? [])]
                              .sort(
                                (a, b) =>
                                  new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
                              )
                              .map((slot) => {
                                const allowStartedSlots = isAdminOrOIC();
                                const started = slotHasStarted(slot);
                                const slotDisabled = !allowStartedSlots && started;
                                const checked = cancelSlotIds.includes(slot.id);
                                const slotLabel = shouldShowTimeDisplay(selectedBooking)
                                  ? `${new Date(slot.start_datetime).toLocaleString()} – ${new Date(slot.end_datetime).toLocaleTimeString()}`
                                  : new Date(slot.start_datetime).toLocaleDateString();
                                return (
                                  <label
                                    key={slot.id}
                                    htmlFor={`cancel-slot-${slot.id}`}
                                    className={`flex items-start gap-3 p-3 cursor-pointer ${
                                      slotDisabled ? "bg-muted/60 text-muted-foreground cursor-not-allowed" : ""
                                    }`}
                                  >
                                    <Checkbox
                                      id={`cancel-slot-${slot.id}`}
                                      checked={checked}
                                      disabled={slotDisabled || actionLoading || cancelSlotsLoading}
                                      onCheckedChange={(value) => {
                                        if (slotDisabled) return;
                                        setCancelSlotIds((prev) =>
                                          value
                                            ? [...prev, slot.id]
                                            : prev.filter((id) => id !== slot.id)
                                        );
                                      }}
                                      className="mt-0.5"
                                    />
                                    <span className="text-sm leading-snug">
                                      {slotLabel}
                                      {slotDisabled ? (
                                        <span className="block text-xs text-muted-foreground mt-0.5">
                                          Already started — cannot be cancelled
                                        </span>
                                      ) : null}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        )}
                        {!cancelSlotsLoading && !isAdminOrOIC() && (selectedBooking.daily_slots ?? []).some((s) => slotHasStarted(s)) ? (
                          <p className="text-xs text-muted-foreground">
                            Slots that have already started cannot be cancelled. Contact the Officer in Charge or admin if you need help.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                );
              })()}
              {selectedBooking && !isWaitlistedEntry(selectedBooking) && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <p className="font-medium text-blue-900 mb-1">Refund Information</p>
                  <p className="text-blue-800">
                    {(() => {
                      if (cancelSlotsLoading || cancelPreviewLoading) {
                        return "Calculating refund…";
                      }
                      if (!cancelEntireBooking && cancelPreview) {
                        const refundAmount = Number(cancelPreview.refund_amount);
                        if (cancelPreview.slots_to_release_count > 0) {
                          return `₹${refundAmount.toFixed(2)} will be refunded to your wallet. Revised charge: ₹${Number(cancelPreview.new_charge).toFixed(2)}.`;
                        }
                        return `₹${refundAmount.toFixed(2)} will be refunded to your wallet (revised inputs, same slots). Revised charge: ₹${Number(cancelPreview.new_charge).toFixed(2)}.`;
                      }
                      const allSlots = selectedBooking.daily_slots ?? [];
                      const refundAmount = cancelEntireBooking
                        ? Number(selectedBooking.total_charge)
                        : calculateCancelRefundAmount(selectedBooking, cancelSlotIds);
                      if (!cancelEntireBooking && !usesInputReductionForPartialCancel(selectedBooking) && cancelSlotIds.length === 0) {
                        return "Select at least one slot to see the refund amount.";
                      }
                      if (!cancelEntireBooking && usesInputReductionForPartialCancel(selectedBooking)) {
                        const { key, label } = getReductionFieldMeta(selectedBooking);
                        const current = getCurrentReductionValue(selectedBooking, key);
                        if (cancelReducedValue >= current) {
                          return `Enter a ${label.toLowerCase()} less than ${current} to preview the refund.`;
                        }
                      }
                      if (cancelEntireBooking) {
                        return `The booking will be cancelled and ₹${refundAmount.toFixed(2)} will be refunded to your wallet immediately.`;
                      }
                      return `₹${refundAmount.toFixed(2)} will be refunded to your wallet for the selected slot(s). The remaining slot(s) stay booked.`;
                    })()}
                  </p>
                </div>
              )}
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
                onClick={(e) => {
                  // Prevent AlertDialogAction's default auto-close behavior.
                  e.preventDefault();
                  handleCancelConfirm();
                }}
                disabled={
                  actionLoading ||
                  cancelSlotsLoading ||
                  cancelPreviewLoading ||
                  (!!selectedBooking &&
                    !isWaitlistedEntry(selectedBooking) &&
                    !cancelEntireBooking &&
                    (() => {
                      const slotCount = selectedBooking.daily_slots?.length ?? 0;
                      if (slotCount === 0) return false;
                      if (usesInputReductionForPartialCancel(selectedBooking)) {
                        const { key } = getReductionFieldMeta(selectedBooking);
                        const current = getCurrentReductionValue(selectedBooking, key);
                        return cancelReducedValue >= current || cancelReducedValue < 1 || !cancelPreview;
                      }
                      return cancelSlotIds.length === 0;
                    })())
                }
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
                  <span>
                    <strong>{selectedBooking.equipment_name}</strong> – Select the same number of consecutive slots in the week below.
                    {selectedBooking.maintenance_reschedule_extra_week ? (
                      <span className="block mt-2 text-amber-800 dark:text-amber-200">
                        Extended week navigation is enabled for this reschedule (after equipment maintenance or operator unavailability).
                      </span>
                    ) : null}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <RescheduleSlotPicker
                equipmentId={selectedBooking.equipment}
                maintenanceExtraWeekBookingId={
                  selectedBooking.maintenance_reschedule_extra_week ||
                  selectedBooking.status?.toUpperCase() === "DISRUPTION_PENDING"
                    ? getRealBookingId(selectedBooking) ?? undefined
                    : undefined
                }
                booking={{
                  booking_id: getRealBookingId(selectedBooking) ?? 0,
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

      </main>
    </div>
  );
};

export default MyBookings;