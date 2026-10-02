import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatSampleSummary, type SampleSummary } from "@/lib/sampleCount";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { StandaloneOnly } from "@/components/PageShell";
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
import { ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { IstemFbrSeal } from "@/components/IstemFbrSeal";
import { BookingListFilterBar } from "@/components/BookingListFilterBar";
import { SortableTableHead } from "@/components/SortableTableHead";
import { formatBookingDateTimeShort } from "@/lib/bookingDates";

interface Booking extends BookingRef {
  virtual_booking_id?: string | null;
  sample_summary?: SampleSummary | null;
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

const BookingManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const expandId = searchParams.get("expand");
  const [statusFilter, setStatusFilter] = useState<string>(() => (expandId ? "all" : "BOOKED"));
  const fetchSeqRef = useRef(0);
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
  const [istemFbrFilter, setIstemFbrFilter] = useState<string>("all");
  const [ordering, setOrdering] = useState<string>("");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  const [overrideBooking, setOverrideBooking] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Check if user is operator, manager, admin, or department administrator
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isOperator = userTypeStr === 'operator';
  const isLabInchargeUser = isOperator;
  const isDeptAdmin = userTypeStr === 'dept_admin';
  const isManagerOrAdmin =
    userTypeStr === 'manager' || userTypeStr === 'admin' || isDeptAdmin;
  const isOperatorOrManager = isOperator || isManagerOrAdmin;

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }

    if (!isOperatorOrManager) {
      toast.error("Access denied. Only Lab Operator, Officer In-charge, Department Administrators, and Admins can access this page.");
      navigate("/dashboard");
      return;
    }

    fetchBookings();
    // Depend on user.id (stable), not the whole user object — AuthContext session
    // polling must not reload this list every 15s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, navigate, authLoading, isAuthenticated, user?.id, isOperatorOrManager]);

  // ?expand=<booking pk or display id> (repeat sample / urgent requests, Change slot status): open that booking
  // whatever its status, and list it by clearing the status filter and searching for its booking ID.
  useEffect(() => {
    if (!expandId || !isAuthenticated || !user?.id || !isOperatorOrManager) return;
    const id = expandId.trim();
    let cancelled = false;
    (async () => {
      let b: Booking | undefined;
      if (/^\d+$/.test(id)) {
        const exact = await apiClient.getBookings({ booking_id: Number(id), limit: 1 });
        if (!exact.error) b = exact.data?.bookings?.[0] as Booking | undefined;
      }
      if (!b) {
        const bySearch = await apiClient.getBookings({ search: id, limit: 1 });
        if (!bySearch.error) b = bySearch.data?.bookings?.[0] as Booking | undefined;
      }
      if (cancelled) return;
      if (!b) {
        toast.error("Booking not found or not in your scope.");
        return;
      }
      const ref = b.virtual_booking_id || String(b.booking_id);
      setStatusFilter("all");
      setSearchQuery(ref);
      setPage(1);
      void fetchBookings(1, { filters: { status: "all", search: ref } });
      setOverrideBooking(b);
      setDetailBooking(null);
      setSelectedBookingId(b.booking_id);
      setTimeout(() => {
        document.getElementById("booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchBookings = async (
    pageOverride?: number,
    opts?: { silent?: boolean; filters?: { status?: string; search?: string }; ordering?: string }
  ) => {
    const seq = ++fetchSeqRef.current;
    try {
      if (!opts?.silent) setLoadingBookings(true);
      const currentPage = pageOverride ?? page;
      const effectiveStatus = opts?.filters?.status ?? statusFilter;
      const effectiveSearch = (opts?.filters?.search ?? searchQuery).trim();
      const effectiveOrdering = opts?.ordering ?? ordering;
      const params: any = {
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        list_view: true,
      };
      if (effectiveOrdering) params.ordering = effectiveOrdering;
      if (effectiveStatus !== "all") {
        params.status = effectiveStatus;
      }
      if (effectiveSearch) {
        params.search = effectiveSearch;
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (equipmentFilter && equipmentFilter !== "all") params.equipment_id = equipmentFilter;
      if (!isLabInchargeUser && userNameFilter.trim()) params.user_name = userNameFilter.trim();
      if (!isLabInchargeUser && supervisorNameFilter.trim()) params.supervisor_name = supervisorNameFilter.trim();
      if (!isLabInchargeUser && userTypeFilter && userTypeFilter !== "all") params.user_type_filter = userTypeFilter;
      if (isManagerOrAdmin && istemFbrFilter && istemFbrFilter !== "all") params.istem_fbr = istemFbrFilter;
      const response = await apiClient.getBookings(params);
      if (seq !== fetchSeqRef.current) return;
      if (response.data && response.data.bookings) {
        setBookings(response.data.bookings);
        setTotalCount(response.data.total_count ?? response.data.bookings.length);
      } else {
        setBookings([]);
        setTotalCount(0);
      }
    } catch (error) {
      if (seq !== fetchSeqRef.current) return;
      console.error("Error fetching bookings:", error);
      toast.error("Failed to fetch bookings");
    } finally {
      if (!opts?.silent && seq === fetchSeqRef.current) setLoadingBookings(false);
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

  const [clearNonce, setClearNonce] = useState(0);
  useEffect(() => {
    if (clearNonce === 0) return;
    void fetchBookings(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearNonce]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setEquipmentFilter("all");
    setUserNameFilter("");
    setSupervisorNameFilter("");
    setUserTypeFilter("all");
    setIstemFbrFilter("all");
    setOrdering("");
    setPage(1);
    closeDetail();
    setClearNonce((n) => n + 1);
  };

  const handleSort = (next: string) => {
    setOrdering(next);
    setPage(1);
    closeDetail();
    void fetchBookings(1, { ordering: next });
  };

  const statusOptions = [
    { value: "all", label: "All status" },
    { value: "BOOKED", label: "Booked" },
    ...(!isLabInchargeUser ? [{ value: "DISRUPTION_PENDING", label: "Awaiting your choice (disruption)" }] : []),
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "ABSENT", label: "Operator Unavailable" },
    { value: "REFUNDED", label: "Refunded" },
    { value: "BOOKING_NOT_UTILIZED", label: "Booking Not Utilized" },
  ];

  const moreFiltersActiveCount =
    (!isLabInchargeUser && userNameFilter.trim() ? 1 : 0) +
    (!isLabInchargeUser && supervisorNameFilter.trim() ? 1 : 0) +
    (!isLabInchargeUser && userTypeFilter !== "all" ? 1 : 0) +
    (isManagerOrAdmin && istemFbrFilter !== "all" ? 1 : 0);

  const moreFilters =
    isLabInchargeUser && !isManagerOrAdmin ? null : (
      <>
        {!isLabInchargeUser && (
          <div className="space-y-1.5">
            <Label htmlFor="user_name">User name</Label>
            <Input
              id="user_name"
              type="text"
              placeholder="Filter by user name"
              value={userNameFilter}
              onChange={(e) => setUserNameFilter(e.target.value)}
            />
          </div>
        )}
        {!isLabInchargeUser && (
          <div className="space-y-1.5">
            <Label htmlFor="supervisor_name">Supervisor name</Label>
            <Input
              id="supervisor_name"
              type="text"
              placeholder="Filter by supervisor name"
              value={supervisorNameFilter}
              onChange={(e) => setSupervisorNameFilter(e.target.value)}
            />
          </div>
        )}
        {!isLabInchargeUser && (
          <div className="space-y-1.5">
            <Label>User type</Label>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger aria-label="User type">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="internal">Internal (students / faculty)</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isManagerOrAdmin && (
          <div className="space-y-1.5">
            <Label>I-STEM FBR</Label>
            <Select value={istemFbrFilter} onValueChange={setIstemFbrFilter}>
              <SelectTrigger aria-label="I-STEM FBR">
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
      </>
    );

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <div className="mb-4">
            <h1 className="text-3xl font-bold">View Booking</h1>
          </div>
        </StandaloneOnly>

        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="space-y-0 border-b bg-muted/30 py-3">
            <BookingListFilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={
                isLabInchargeUser
                  ? "Booking ID, equipment, email, mobile…"
                  : "Booking ID, equipment, user, email, mobile…"
              }
              status={statusFilter}
              onStatusChange={setStatusFilter}
              statusOptions={statusOptions}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
              equipment={equipmentFilter}
              onEquipmentChange={setEquipmentFilter}
              equipmentOptions={(equipmentList || []).map((eq) => ({ value: String(eq.equipment_id), label: eq.name }))}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              moreFilters={moreFilters}
              moreFiltersActiveCount={moreFiltersActiveCount}
            />
          </CardHeader>
          {loadingBookings ? (
            <CardContent className="py-12">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading bookings…</span>
              </div>
            </CardContent>
          ) : bookings.length === 0 ? (
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No bookings found</p>
            </CardContent>
          ) : (
            <>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[720px]" stackOnMobile>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-14 font-semibold">S.No.</TableHead>
                      {[
                        { key: "booking_ref", label: "Booking ID" },
                        { key: "equipment_name", label: "Equipment Name" },
                        { key: "user_name", label: "User Name" },
                        { key: "supervisor_name", label: "Supervisor Name" },
                        { key: "user_phone", label: "User Mobile" },
                        { key: "user_email", label: "User Email" },
                        { key: "start_time", label: "Booking Start Date" },
                        { key: "duration", label: "Duration" },
                      ].map((col) => (
                        <SortableTableHead
                          key={col.key}
                          sortKey={col.key}
                          ordering={ordering}
                          onSort={handleSort}
                          className="font-semibold"
                          disabled={loadingBookings}
                        >
                          {col.label}
                        </SortableTableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking, index) => (
                      <TableRow key={booking.booking_id} className="group">
                        <TableCell className="text-muted-foreground tabular-nums">{rangeStart + index}</TableCell>
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
                          {isOperator && formatSampleSummary(booking.sample_summary) && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {formatSampleSummary(booking.sample_summary)}
                            </span>
                          )}
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
                          {formatBookingDateTimeShort(booking.start_time)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDuration(booking.total_time_minutes)}
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
            </>
          )}
        </Card>

        {/* Detailed view – shown when a booking ID is clicked or opened via ?expand= (even if the list is empty) */}
        {!loadingBookings && selectedBookingId != null && (() => {
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
                  onUpdated={() => {
                    void fetchBookings(undefined, { silent: true });
                  }}
                  isOperator={isOperator}
                  isManagerOrAdmin={isManagerOrAdmin}
                  currentUserType={userTypeStr}
                  currentUserId={user?.id}
                  backLabel="Back to list"
                  showPrintButton
                />
              );
            })()}

      </main>
    </div>
  );
};

export default BookingManagement;
