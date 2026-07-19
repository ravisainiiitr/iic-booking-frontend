import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import { getRealBookingId, type BookingRef } from "@/lib/bookingRef";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ChevronLeft, ChevronRight, Star, Loader2 } from "lucide-react";
import { IstemFbrSeal } from "@/components/IstemFbrSeal";

interface Booking extends BookingRef {
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
  istem_fbr_status?: string | null;
  require_istem_fbr?: boolean;
  rating_feedback?: string | null;
  rated_at?: string | null;
  equipment_enable_charge_recalculation?: boolean;
  equipment_user_rating_enabled?: boolean;
  created_at: string;
  updated_at: string;
  charge_recalculation_pending_amount?: string | null;
}

const PAGE_SIZE = 10;

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "ALL STATUSES",
  BOOKED: "BOOKED",
  DISRUPTION_PENDING: "DISRUPTION PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  ABSENT: "OPERATOR UNAVAILABLE",
  REFUNDED: "REFUNDED",
  BOOKING_NOT_UTILIZED: "BOOKING NOT UTILIZED",
};

const BookingManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("BOOKED");
  const [selectedBookingId, setSelectedBookingId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [userNameFilter, setUserNameFilter] = useState("");
  const [supervisorNameFilter, setSupervisorNameFilter] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [istemFbrFilter, setIstemFbrFilter] = useState<string>("all");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  const [overrideBooking, setOverrideBooking] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const expandId = searchParams.get("expand");

  // Check if user is operator or manager
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isOperator = userTypeStr === 'operator';
  const isLabInchargeUser = isOperator;
  const isManagerOrAdmin = userTypeStr === 'manager' || userTypeStr === 'admin';
  const isOperatorOrManager = isOperator || isManagerOrAdmin;

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }

    if (!isOperatorOrManager) {
      toast.error("Access denied. Only operators and managers can access this page.");
      navigate("/dashboard");
      return;
    }

    fetchBookings();
    // Depend on user.id (stable), not the whole user object — AuthContext session
    // polling must not reload this list every 15s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, navigate, authLoading, isAuthenticated, user?.id, isOperatorOrManager]);

  // When landing with ?expand=booking_id (e.g. from Change slot status page), fetch that booking and show detail
  useEffect(() => {
    if (!expandId || !isAuthenticated || !user?.id || !isOperatorOrManager) return;
    const id = expandId;
    let cancelled = false;
    apiClient.getBookings({ search: id, limit: 1 }).then((res) => {
      if (cancelled || res.error) return;
      const b = res.data?.bookings?.[0];
      if (b) {
        setOverrideBooking(b);
        setDetailBooking(null);
        setSelectedBookingId(b.booking_id);
        setTimeout(() => {
          document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    });
    return () => { cancelled = true; };
  }, [expandId, isAuthenticated, user?.id, isOperatorOrManager]);

  // When a row is clicked, fetch full booking for the detail card (list_view data is lightweight and missing daily_slots, etc.)
  useEffect(() => {
    if (selectedBookingId == null) {
      setDetailBooking(null);
      setDetailLoading(false);
      return;
    }
    if (overrideBooking?.booking_id === selectedBookingId) {
      setDetailBooking(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailBooking(null);
    const selected = bookings.find((b) => b.booking_id === selectedBookingId);
    const backendId = getRealBookingId(selected) ?? (typeof selectedBookingId === "number" ? selectedBookingId : Number(selectedBookingId));
    if (backendId == null || Number.isNaN(Number(backendId))) {
      setDetailLoading(false);
      return;
    }
    apiClient.getBookings({ booking_id: backendId, limit: 1 }).then((res) => {
      if (cancelled || res.error) return;
      const b = res.data?.bookings?.[0];
      if (b) setDetailBooking(b as Booking);
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
    // Do not depend on `bookings` — list refreshes must not re-fetch / reset the open detail card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId, overrideBooking?.booking_id]);

  const fetchBookings = async (pageOverride?: number) => {
    try {
      setLoadingBookings(true);
      const currentPage = pageOverride ?? page;
      const params: any = {
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        list_view: true,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (equipmentFilter && equipmentFilter !== "all") params.equipment_id = equipmentFilter;
      if (!isLabInchargeUser && userNameFilter.trim()) params.user_name = userNameFilter.trim();
      if (!isLabInchargeUser && supervisorNameFilter.trim()) params.supervisor_name = supervisorNameFilter.trim();
      if (!isLabInchargeUser && userTypeFilter && userTypeFilter !== "all") params.user_type_filter = userTypeFilter;
      if (ratingFilter && ratingFilter !== "all") params.rating = ratingFilter;
      if (isManagerOrAdmin && istemFbrFilter && istemFbrFilter !== "all") params.istem_fbr = istemFbrFilter;
      const response = await apiClient.getBookings(params);
      if (response.data && response.data.bookings) {
        setBookings(response.data.bookings);
        setTotalCount(response.data.total_count ?? response.data.bookings.length);
      } else {
        setBookings([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to fetch bookings");
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (!isOperatorOrManager || !isAuthenticated) return;
    apiClient.getEquipments(undefined, "ACTIVE").then((res) => {
      if (res.data?.equipments) {
        setEquipmentList(
          res.data.equipments.map((e: any) => ({
            equipment_id: e.equipment_id,
            name: e.name || e.code || "",
            code: e.code || "",
          }))
        );
      }
    }).catch(() => {});
  }, [isOperatorOrManager, isAuthenticated]);

  const handleApplyFilters = () => {
    setPage(1);
    closeDetail();
    fetchBookings(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const showBookingDetail = (booking: Booking) => {
    const bookingId = booking.booking_id;
    setSelectedBookingId(bookingId);
    setTimeout(() => {
      document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const formatBookingStartDate = (startTime: string) => {
    if (!startTime) return "—";
    const d = new Date(startTime);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const time = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${dd}/${mm}/${yy} ${time}`;
  };

  const formatDuration = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const closeDetail = () => {
    setSelectedBookingId(null);
    setOverrideBooking(null);
    setDetailBooking(null);
    setSearchParams((prev) => {
      prev.delete("expand");
      return prev;
    });
  };

  if (authLoading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold">Booking Management</h1>
              <p className="text-muted-foreground mt-1">Manage all bookings as operator or manager</p>
            </div>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Search &amp; filters</CardTitle>
              <CardDescription>
                {isLabInchargeUser
                  ? "Search by Booking ID, Equipment Name, User Mobile, or Email. Set filters and click Apply."
                  : "Search by Booking ID, Equipment Name, User Name, Supervisor Name, User Mobile, or Email. Set filters and click Apply."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="lg:col-span-2 space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="Booking ID, equipment, user, email, mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-baseline justify-between gap-2">
                    <span>Status</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                      {STATUS_FILTER_LABELS[statusFilter] || statusFilter.toUpperCase()}
                    </span>
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="font-bold uppercase">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="BOOKED">Booked</SelectItem>
                      <SelectItem value="DISRUPTION_PENDING">Awaiting your choice (disruption)</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="ABSENT">Operator Unavailable</SelectItem>
                      <SelectItem value="REFUNDED">Refunded</SelectItem>
                      <SelectItem value="BOOKING_NOT_UTILIZED">Booking Not Utilized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                {!isLabInchargeUser && (<div className="space-y-2">
                  <Label htmlFor="user_name">User name</Label>
                  <Input
                    id="user_name"
                    type="text"
                    placeholder="Filter by user name"
                    value={userNameFilter}
                    onChange={(e) => setUserNameFilter(e.target.value)}
                  />
                </div>)}
                {!isLabInchargeUser && (<div className="space-y-2">
                  <Label htmlFor="supervisor_name">Supervisor name</Label>
                  <Input
                    id="supervisor_name"
                    type="text"
                    placeholder="Filter by supervisor name"
                    value={supervisorNameFilter}
                    onChange={(e) => setSupervisorNameFilter(e.target.value)}
                  />
                </div>)}
                {!isLabInchargeUser && (<div className="space-y-2">
                  <Label>User type</Label>
                  <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      <SelectItem value="internal">Internal (students / faculty)</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>)}
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All ratings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ratings</SelectItem>
                      <SelectItem value="unrated">Unrated</SelectItem>
                      <SelectItem value="2_and_below">2 stars and below</SelectItem>
                      <SelectItem value="3_and_below">3 stars and below</SelectItem>
                      <SelectItem value="4_and_below">4 stars and below</SelectItem>
                      <SelectItem value="5">5 stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isManagerOrAdmin && (
                  <div className="space-y-2">
                    <Label>I-STEM FBR</Label>
                    <Select value={istemFbrFilter} onValueChange={setIstemFbrFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All I-STEM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All I-STEM</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="unverified">Unverified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Select value={equipmentFilter || "all"} onValueChange={setEquipmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All equipment</SelectItem>
                      {(equipmentList || []).map((eq) => (
                        <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                          {eq.name} ({eq.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleApplyFilters} className="w-full md:w-auto">
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loadingBookings ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading bookings…</span>
              </div>
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Concise table view */}
            <Card className="overflow-hidden border shadow-sm">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                  <span>Bookings</span>
                  <span className="font-bold uppercase tracking-wide text-primary">
                    {STATUS_FILTER_LABELS[statusFilter] || statusFilter.toUpperCase()}
                  </span>
                </CardTitle>
                <CardDescription>
                  Currently showing{" "}
                  <span className="font-bold uppercase text-foreground">
                    {STATUS_FILTER_LABELS[statusFilter] || statusFilter.toUpperCase()}
                  </span>{" "}
                  bookings. Click a booking ID to view full details.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Booking ID</TableHead>
                      <TableHead className="font-semibold">Equipment Name</TableHead>
                      <TableHead className="font-semibold">User Name</TableHead>
                      <TableHead className="font-semibold">Supervisor Name</TableHead>
                      <TableHead className="font-semibold">User Mobile</TableHead>
                      <TableHead className="font-semibold">User Email</TableHead>
                      <TableHead className="font-semibold">Booking Start Date</TableHead>
                      <TableHead className="font-semibold">Duration</TableHead>
                      <TableHead className="font-semibold">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.booking_id} className="group">
                        <TableCell className="font-medium">
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
                            <IstemFbrSeal
                              requireIstemFbr={booking.require_istem_fbr}
                              istemFbrStatus={booking.istem_fbr_status}
                            />
                            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={booking.equipment_name}>
                          {booking.equipment_name}
                        </TableCell>
                        <TableCell>{booking.user_name || "—"}</TableCell>
                        <TableCell>{booking.wallet_owner_name || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{booking.user_phone || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={booking.user_email}>
                          {booking.user_email || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatBookingStartDate(booking.start_time)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDuration(booking.total_time_minutes)}
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
                      </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
              {totalCount > 0 && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-t bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Showing {rangeStart}–{rangeEnd} of {totalCount} booking{totalCount !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        closeDetail();
                      }}
                      disabled={!hasPrevPage}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage((p) => p + 1);
                        closeDetail();
                      }}
                      disabled={!hasNextPage}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Detailed view – shown only when a booking ID is clicked */}
            {selectedBookingId != null && (() => {
              if (detailLoading) {
                return (
                  <Card id="booking-detail-section" className="border shadow-sm">
                    <CardContent className="py-12">
                      <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading booking details…</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              const booking = overrideBooking ?? detailBooking ?? bookings.find((b) => b.booking_id === selectedBookingId);
              if (!booking) return null;
              return (
                <BookingDetailCard
                  booking={booking as BookingDetailCardBooking}
                  onClose={closeDetail}
                  onUpdated={fetchBookings}
                  isOperator={isOperator}
                  isManagerOrAdmin={isManagerOrAdmin}
                  currentUserType={userTypeStr}
                  currentUserId={user?.id}
                  backLabel="Back to list"
                  showPrintButton
                />
              );
            })()}
          </>
        )}

      </main>
    </div>
  );
};

export default BookingManagement;
