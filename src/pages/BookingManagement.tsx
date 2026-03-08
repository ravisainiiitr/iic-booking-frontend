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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ChevronLeft, ChevronRight, Star } from "lucide-react";

interface Booking {
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
}

const PAGE_SIZE = 50;

const BookingManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("BOOKED");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
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
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  const [overrideBooking, setOverrideBooking] = useState<Booking | null>(null);
  const [resultsData, setResultsData] = useState<{ exists: boolean; files: Array<{ name: string; download_url: string }> } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const expandId = searchParams.get("expand");

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

  // Fetch S3 results for the selected booking when detail view is shown
  useEffect(() => {
    if (selectedBookingId == null) {
      setResultsData(null);
      return;
    }
    let cancelled = false;
    setResultsLoading(true);
    setResultsData(null);
    apiClient
      .getBookingResults(selectedBookingId)
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
  }, [selectedBookingId]);

  // When landing with ?expand=booking_id (e.g. from Change slot status page), fetch that booking and show detail
  useEffect(() => {
    if (!expandId || !isAuthenticated || !user || !isOperatorOrManager) return;
    const id = parseInt(expandId, 10);
    if (Number.isNaN(id)) return;
    let cancelled = false;
    apiClient.getBookings({ booking_id: id, limit: 1 }).then((res) => {
      if (cancelled || res.error) return;
      const b = res.data?.bookings?.[0];
      if (b) {
        setOverrideBooking(b);
        setSelectedBookingId(id);
        setTimeout(() => {
          document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    });
    return () => { cancelled = true; };
  }, [expandId, isAuthenticated, user, isOperatorOrManager]);

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

  const fetchBookings = async (pageOverride?: number) => {
    try {
      setLoading(true);
      const currentPage = pageOverride ?? page;
      const params: any = {
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
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
      if (userNameFilter.trim()) params.user_name = userNameFilter.trim();
      if (supervisorNameFilter.trim()) params.supervisor_name = supervisorNameFilter.trim();
      if (userTypeFilter && userTypeFilter !== "all") params.user_type_filter = userTypeFilter;
      if (ratingFilter && ratingFilter !== "all") params.rating = ratingFilter;
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOperatorOrManager && !authLoading) {
      fetchBookings();
    }
  }, [page, isOperatorOrManager, authLoading]);

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

  const showBookingDetail = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setTimeout(() => {
      document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
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

  const closeDetail = () => {
    setSelectedBookingId(null);
    setOverrideBooking(null);
    setSearchParams((prev) => {
      prev.delete("expand");
      return prev;
    });
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
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold">Booking Management</h1>
              <p className="text-muted-foreground mt-1">Manage all bookings as operator or manager</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/urgent-requests")}>
              Urgent requests
            </Button>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Search &amp; filters</CardTitle>
              <CardDescription>
                Search by Booking ID, Equipment Name, User Name, Supervisor Name, User Mobile, or Email. Set filters and click Apply.
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
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="BOOKED">Booked</SelectItem>
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
                <div className="space-y-2">
                  <Label htmlFor="user_name">User name</Label>
                  <Input
                    id="user_name"
                    type="text"
                    placeholder="Filter by user name"
                    value={userNameFilter}
                    onChange={(e) => setUserNameFilter(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supervisor_name">Supervisor name</Label>
                  <Input
                    id="supervisor_name"
                    type="text"
                    placeholder="Filter by supervisor name"
                    value={supervisorNameFilter}
                    onChange={(e) => setSupervisorNameFilter(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
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
                </div>
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

        {bookings.length === 0 ? (
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
                <CardTitle className="text-lg">All Bookings</CardTitle>
                <CardDescription>Click a booking ID to view full details for that booking</CardDescription>
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
              const booking = overrideBooking ?? bookings.find((b) => b.booking_id === selectedBookingId);
              if (!booking) return null;
              return (
                <BookingDetailCard
                  booking={booking as BookingDetailCardBooking}
                  onClose={closeDetail}
                  onUpdated={fetchBookings}
                  isOperator={isOperatorOrManager}
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
