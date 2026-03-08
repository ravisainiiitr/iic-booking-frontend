import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Trash2, X, Calculator } from "lucide-react";
import { format } from "date-fns";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";

/** Format date string for display; returns fallback if invalid. */
function formatDateSafe(
  dateStr: string | null | undefined,
  formatStr: string = "dd MMM yyyy",
  fallback: string = "—"
): string {
  if (dateStr == null || String(dateStr).trim() === "") return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

type LogRow = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  requested_at: string | null;
  outcome: string;
  failure_reason: string;
  number_of_samples: number;
  slots_requested: number;
  duration_minutes: number | null;
  booking_id: number | null;
  /** Display ID: virtual_booking_id (e.g. SEM202600001) or equipment_code-booking_id */
  display_booking_id?: string | null;
  additional_info?: {
    input_values?: Record<string, unknown>;
    selected_parameters?: unknown;
  } | null;
};

const PAGE_SIZE = 50;

type EquipmentOption = { equipment_id: number; name: string; code: string };
type UserOption = { id: number; name: string; email: string };
type DepartmentOption = { id: number; name: string; code: string };

const BookingAttemptLogs = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [list, setList] = useState<LogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [internalDepartments, setInternalDepartments] = useState<DepartmentOption[]>([]);
  const [externalDepartments, setExternalDepartments] = useState<DepartmentOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [userSearchText, setUserSearchText] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [departmentType, setDepartmentType] = useState<"ALL" | "INTERNAL" | "EXTERNAL">("ALL");
  const [departmentSearchText, setDepartmentSearchText] = useState("");
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);
  const [additionalInfoRow, setAdditionalInfoRow] = useState<LogRow | null>(null);
  const [additionalInfoData, setAdditionalInfoData] = useState<{
    input_values?: Record<string, unknown>;
    selected_parameters?: unknown;
  } | null>(null);
  const [deleteConfirmLogId, setDeleteConfirmLogId] = useState<number | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);
  const [quotaBreakdownLogId, setQuotaBreakdownLogId] = useState<number | null>(null);
  const [quotaBreakdownOpen, setQuotaBreakdownOpen] = useState(false);
  const [quotaBreakdownLoading, setQuotaBreakdownLoading] = useState(false);
  const [quotaBreakdownData, setQuotaBreakdownData] = useState<{
    period_start: string;
    period_end: string;
    quota_type: string;
    quota_scope: string;
    limit_minutes: number;
    total_minutes: number;
    summary_message: string;
    events: Array<{
      date: string;
      booking_id: number;
      equipment_name: string;
      equipment_code: string;
      total_time_minutes: number;
      user_name: string;
    }>;
  } | null>(null);
  const [bookingDetailPopup, setBookingDetailPopup] = useState<BookingDetailCardBooking | null>(null);
  const [loadingBookingDetail, setLoadingBookingDetail] = useState(false);
  const [filters, setFilters] = useState({
    equipment_id: "",
    user_id: "",
    department_id: "",
    outcome: "ALL" as "ALL" | "SUCCESS" | "FAILED",
    date_from: "",
    date_to: "",
    failure_reason_contains: "",
  });

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  // Admin, manager, operator, finance can access (match backend check_operator_permission + finance)
  const canAccess =
    apiClient.isAdminPanelUser(user?.user_type) ||
    userTypeStr === "admin" ||
    userTypeStr === "manager" ||
    userTypeStr === "operator" ||
    userTypeStr === "finance";
  const canDeleteLog = userTypeStr === "admin";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("Only Admin and Officer in charge can access Booking Attempt Log.");
      navigate("/dashboard");
      return;
    }
    fetchList();
  }, [navigate, isAuthenticated, user, canAccess, authLoading, offset]);

  // Load equipment, user, and department options for filter dropdowns (once when user has access)
  // Backend restricts equipment list to OIC's/operator's mapped equipments for managers/operators
  useEffect(() => {
    if (!canAccess || !user) return;
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      apiClient.getEquipments().then((res) => {
        if (cancelled) return [];
        const data = (res as { data?: { equipments?: EquipmentOption[] } }).data ?? (res as { equipments?: EquipmentOption[] });
        const arr = data?.equipments ?? [];
        return Array.isArray(arr) ? arr.map((e: any) => ({ equipment_id: e.equipment_id ?? e.id, name: e.name ?? e.code ?? "", code: e.code ?? "" })) : [];
      }),
      apiClient.getUsers().then((res) => {
        if (cancelled) return [];
        const err = (res as { error?: string }).error;
        if (err) return [];
        const data = (res as { data?: any[] }).data ?? res;
        const arr = Array.isArray(data) ? data : [];
        return arr.map((u: any) => ({ id: u.id ?? u.user_id, name: u.name ?? u.full_name ?? "", email: u.email ?? "" }));
      }),
      apiClient.getDepartments(undefined, true).then((res) => {
        if (cancelled) return { internal: [] as DepartmentOption[], external: [] as DepartmentOption[] };
        const err = (res as { error?: string }).error;
        if (err) return { internal: [], external: [] };
        const data = (res as { data?: { grouped?: { internal?: any[]; external?: any[] } } }).data ?? (res as { grouped?: { internal?: any[]; external?: any[] } });
        const grouped = data?.grouped ?? {};
        const mapDept = (d: any) => ({ id: d.id, name: d.name ?? "", code: d.code ?? "" });
        return {
          internal: Array.isArray(grouped.internal) ? grouped.internal.map(mapDept) : [],
          external: Array.isArray(grouped.external) ? grouped.external.map(mapDept) : [],
        };
      }),
    ])
      .then(([equipments, users, groupedDepts]) => {
        if (!cancelled) {
          setEquipmentOptions(equipments);
          setUserOptions(users);
          setInternalDepartments(groupedDepts.internal);
          setExternalDepartments(groupedDepts.external);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEquipmentOptions([]);
          setUserOptions([]);
          setInternalDepartments([]);
          setExternalDepartments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => { cancelled = true; };
  }, [canAccess, user]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiClient.listBookingAttemptLogs({
        equipment_id: filters.equipment_id ? Number(filters.equipment_id) : undefined,
        user_id: filters.user_id ? Number(filters.user_id) : undefined,
        department_id: filters.department_id ? Number(filters.department_id) : undefined,
        outcome: filters.outcome !== "ALL" ? filters.outcome : undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        failure_reason_contains: filters.failure_reason_contains || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if ((res as { error?: string }).error) {
        toast.error((res as { error: string }).error);
        setList([]);
        setTotalCount(0);
        return;
      }
      // API returns { data: { results, total_count, limit, offset } }; support both wrapped and unwrapped
      const payload = (res as { data?: { results?: LogRow[]; total_count?: number } }).data ?? (res as { results?: LogRow[]; total_count?: number });
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const total = typeof payload?.total_count === "number" ? payload.total_count : 0;
      setList(results);
      setTotalCount(total);
    } catch (e) {
      toast.error("Failed to load booking attempt log");
      setList([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setOffset(0);
    fetchList();
  };

  const openAdditionalInfo = (row: LogRow) => {
    setAdditionalInfoRow(row);
    setAdditionalInfoData(row.additional_info ?? null);
    setAdditionalInfoOpen(true);
  };

  const handleDeleteLog = async (logId: number) => {
    setDeletingLogId(logId);
    try {
      await apiClient.deleteBookingAttemptLog(logId);
      setList((prev) => prev.filter((r) => r.id !== logId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success("Log entry deleted.");
      setDeleteConfirmLogId(null);
    } catch {
      toast.error("Failed to delete log entry.");
    } finally {
      setDeletingLogId(null);
    }
  };

  const isQuotaFailure = (row: LogRow) =>
    row.outcome === "FAILED" && /quota check failed/i.test(row.failure_reason || "");

  const openQuotaBreakdown = async (logId: number) => {
    setQuotaBreakdownLogId(logId);
    setQuotaBreakdownData(null);
    setQuotaBreakdownOpen(true);
    setQuotaBreakdownLoading(true);
    try {
      const res = await apiClient.getBookingAttemptLogQuotaBreakdown(logId);
      if ((res as { error?: string }).error) {
        toast.error((res as { error: string }).error);
        setQuotaBreakdownOpen(false);
        return;
      }
      // API returns { data: breakdown }; use payload from res.data when present
      const payload = (res as { data?: Record<string, unknown> }).data ?? (res as Record<string, unknown>);
      setQuotaBreakdownData({
        period_start: (payload.period_start as string) ?? "",
        period_end: (payload.period_end as string) ?? "",
        quota_type: (payload.quota_type as string) ?? "",
        quota_scope: (payload.quota_scope as string) ?? "",
        limit_minutes: typeof payload.limit_minutes === "number" ? payload.limit_minutes : 0,
        total_minutes: typeof payload.total_minutes === "number" ? payload.total_minutes : 0,
        summary_message: (payload.summary_message as string) ?? "",
        events: Array.isArray(payload.events) ? payload.events : [],
      });
    } catch {
      toast.error("Failed to load quota calculation details.");
      setQuotaBreakdownOpen(false);
    } finally {
      setQuotaBreakdownLoading(false);
    }
  };

  const openBookingDetailPopup = async (bookingId: number) => {
    setLoadingBookingDetail(true);
    setBookingDetailPopup(null);
    try {
      const res = await apiClient.getBookings({ booking_id: bookingId, limit: 1 });
      const data = (res as { data?: { bookings?: unknown[] } }).data ?? (res as { bookings?: unknown[] });
      const booking = Array.isArray(data?.bookings) ? data.bookings[0] : null;
      if (booking && typeof booking === "object" && "booking_id" in booking) {
        setBookingDetailPopup(booking as BookingDetailCardBooking);
      } else {
        toast.error("Booking not found or you don't have permission to view it.");
      }
    } catch {
      toast.error("Failed to load booking details.");
    } finally {
      setLoadingBookingDetail(false);
    }
  };

  const selectedUser = filters.user_id
    ? userOptions.find((u) => String(u.id) === filters.user_id) ?? null
    : null;
  const searchLower = userSearchText.trim().toLowerCase();
  const filteredUsers = searchLower
    ? userOptions.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(searchLower)) ||
          (u.email && u.email.toLowerCase().includes(searchLower))
      )
    : userOptions;

  const departmentOptionsByType =
    departmentType === "INTERNAL"
      ? internalDepartments
      : departmentType === "EXTERNAL"
        ? externalDepartments
        : [];
  const selectedDepartment = filters.department_id
    ? [...internalDepartments, ...externalDepartments].find((d) => String(d.id) === filters.department_id) ?? null
    : null;
  const deptSearchLower = departmentSearchText.trim().toLowerCase();
  const filteredDepartments = deptSearchLower
    ? departmentOptionsByType.filter(
        (d) =>
          (d.name && d.name.toLowerCase().includes(deptSearchLower)) ||
          (d.code && d.code.toLowerCase().includes(deptSearchLower))
      )
    : departmentOptionsByType;

  // Access denied: only when we're done loading auth and user is set but cannot access
  const showAccessDenied = !authLoading && user !== null && !canAccess;

  // When access denied, show dedicated card and back button
  if (showAccessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", color: "#0f172a" }}>
        <header style={{ borderBottom: "1px solid #e2e8f0", padding: "1rem 1.5rem", backgroundColor: "#fff" }}>
          <div className="container mx-auto flex items-center justify-between">
            <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Booking Attempt Log</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>
                Only Admin and Officer in charge can view the Booking Attempt Log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Always render the main page shell so something is always visible (no blank screen)
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20"
      style={{ minHeight: "100vh", backgroundColor: "var(--background, #f8fafc)", color: "var(--foreground, #0f172a)" }}
    >
      <header style={{ borderBottom: "1px solid #e2e8f0", padding: "1rem 1.5rem", backgroundColor: "#fff" }}>
        <div className="container mx-auto flex items-center justify-between">
          <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Booking Attempt Log</span>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8" style={{ display: "block" }}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Booking Attempt Log</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive log of every booking submit (success and failure). Officer in charge sees only their equipments.
            </p>
          </div>
        </div>

        <Card className="border shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Filter by equipment, user, outcome, date range, department, or failure reason.</CardDescription>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <Label htmlFor="equipment_filter">Equipment name</Label>
                <select
                  id="equipment_filter"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={filters.equipment_id}
                  onChange={(e) => setFilters((f) => ({ ...f, equipment_id: e.target.value }))}
                  disabled={loadingOptions}
                >
                  <option value="">All equipments</option>
                  {equipmentOptions.map((eq) => (
                    <option key={eq.equipment_id} value={String(eq.equipment_id)}>
                      {eq.name} ({eq.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Label htmlFor="user_search">User name</Label>
                <div className="mt-1 relative">
                  <Input
                    id="user_search"
                    type="text"
                    placeholder="Search by name or email"
                    value={selectedUser ? `${selectedUser.name || selectedUser.email}${selectedUser.name && selectedUser.email ? ` (${selectedUser.email})` : ""}` : userSearchText}
                    onChange={(e) => {
                      setUserSearchText(e.target.value);
                      if (filters.user_id) setFilters((f) => ({ ...f, user_id: "" }));
                    }}
                    onFocus={() => setUserDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                    disabled={loadingOptions}
                    className="pr-8"
                  />
                  {selectedUser && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setFilters((f) => ({ ...f, user_id: "" }));
                        setUserSearchText("");
                      }}
                      aria-label="Clear user"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {userDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-auto">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                      onClick={() => {
                        setFilters((f) => ({ ...f, user_id: "" }));
                        setUserSearchText("");
                        setUserDropdownOpen(false);
                      }}
                    >
                      All users
                    </button>
                    {filteredUsers.slice(0, 50).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => {
                          setFilters((f) => ({ ...f, user_id: String(u.id) }));
                          setUserSearchText("");
                          setUserDropdownOpen(false);
                        }}
                      >
                        {u.name || u.email}
                        {u.name && u.email ? ` (${u.email})` : ""}
                      </button>
                    ))}
                    {filteredUsers.length > 50 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Showing first 50. Refine search to narrow.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <Label>User department</Label>
                <div className="mt-1 flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="department_type"
                      checked={departmentType === "ALL"}
                      onChange={() => {
                        setDepartmentType("ALL");
                        setFilters((f) => ({ ...f, department_id: "" }));
                        setDepartmentSearchText("");
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">All</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="department_type"
                      checked={departmentType === "INTERNAL"}
                      onChange={() => {
                        setDepartmentType("INTERNAL");
                        setFilters((f) => ({ ...f, department_id: "" }));
                        setDepartmentSearchText("");
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Internal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="department_type"
                      checked={departmentType === "EXTERNAL"}
                      onChange={() => {
                        setDepartmentType("EXTERNAL");
                        setFilters((f) => ({ ...f, department_id: "" }));
                        setDepartmentSearchText("");
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">External</span>
                  </label>
                </div>
                {(departmentType === "INTERNAL" || departmentType === "EXTERNAL") && (
                  <div className="relative mt-2">
                    <Input
                      type="text"
                      placeholder="Search department by name or code"
                      value={selectedDepartment ? `${selectedDepartment.name}${selectedDepartment.code ? ` (${selectedDepartment.code})` : ""}` : departmentSearchText}
                      onChange={(e) => {
                        setDepartmentSearchText(e.target.value);
                        if (filters.department_id) setFilters((f) => ({ ...f, department_id: "" }));
                      }}
                      onFocus={() => setDepartmentDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setDepartmentDropdownOpen(false), 200)}
                      disabled={loadingOptions}
                      className="pr-8"
                    />
                    {selectedDepartment && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setFilters((f) => ({ ...f, department_id: "" }));
                          setDepartmentSearchText("");
                        }}
                        aria-label="Clear department"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {departmentDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-auto">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                          onClick={() => {
                            setFilters((f) => ({ ...f, department_id: "" }));
                            setDepartmentSearchText("");
                            setDepartmentDropdownOpen(false);
                          }}
                        >
                          All departments
                        </button>
                        {filteredDepartments.slice(0, 50).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                            onClick={() => {
                              setFilters((f) => ({ ...f, department_id: String(d.id) }));
                              setDepartmentSearchText("");
                              setDepartmentDropdownOpen(false);
                            }}
                          >
                            {d.name} {d.code ? `(${d.code})` : ""}
                          </button>
                        ))}
                        {filteredDepartments.length > 50 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Showing first 50. Refine search to narrow.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label>Outcome</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={filters.outcome}
                  onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value as "ALL" | "SUCCESS" | "FAILED" }))}
                >
                  <option value="ALL">All</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              <div>
                <Label htmlFor="date_from">Date from</Label>
                <Input
                  id="date_from"
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="date_to">Date to</Label>
                <Input
                  id="date_to"
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="failure_reason">Failure reason contains</Label>
                <Input
                  id="failure_reason"
                  type="text"
                  placeholder="Search in failure reason"
                  value={filters.failure_reason_contains}
                  onChange={(e) => setFilters((f) => ({ ...f, failure_reason_contains: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters}>
                  <Search className="h-4 w-4 mr-2" />
                  Apply filters
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Log entries</CardTitle>
            <CardDescription>
              Total: {totalCount}. Showing {totalCount === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Failure reason</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-muted-foreground">Checking access…</span>
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No log entries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateSafe(row.requested_at, "dd MMM yyyy, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline focus:outline-none focus:underline cursor-pointer"
                            onClick={() => openAdditionalInfo(row)}
                          >
                            <div className="font-medium">{row.user_name}</div>
                            <div className="text-xs text-muted-foreground">{row.user_email}</div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>{row.equipment_name}</div>
                          <div className="text-xs text-muted-foreground">{row.equipment_code}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              row.outcome === "SUCCESS"
                                ? "bg-green-600"
                                : "bg-red-600"
                            }
                          >
                            {row.outcome}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground" title={row.failure_reason || undefined}>
                          {row.outcome === "FAILED" && row.failure_reason ? row.failure_reason : "—"}
                        </TableCell>
                        <TableCell>
                          {row.booking_id != null ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto font-mono text-sm"
                              onClick={() => openBookingDetailPopup(row.booking_id!)}
                            >
                              {row.display_booking_id ?? `${row.equipment_code}-#${row.booking_id}`}
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isQuotaFailure(row) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openQuotaBreakdown(row.id)}
                                disabled={quotaBreakdownLoading}
                                title="View calculation details"
                              >
                                {quotaBreakdownLoading && quotaBreakdownLogId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Calculator className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {canDeleteLog ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteConfirmLogId(row.id)}
                                disabled={deletingLogId !== null}
                                title="Delete log entry (admin only)"
                              >
                                {deletingLogId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            ) : null}
                            {!isQuotaFailure(row) && !canDeleteLog ? "—" : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {!loading && list.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= totalCount}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={additionalInfoOpen} onOpenChange={(open) => { setAdditionalInfoOpen(open); if (!open) { setAdditionalInfoRow(null); setAdditionalInfoData(null); } }}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Additional information</DialogTitle>
              <DialogDescription>
                Information provided when raising the booking request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {additionalInfoData && (additionalInfoData.input_values && Object.keys(additionalInfoData.input_values).length > 0 || (additionalInfoData.selected_parameters != null && (Array.isArray(additionalInfoData.selected_parameters) ? (additionalInfoData.selected_parameters as unknown[]).length > 0 : Object.keys(additionalInfoData.selected_parameters as object).length > 0))) ? (
                <div className="space-y-4 text-sm">
                  {additionalInfoData.input_values && Object.keys(additionalInfoData.input_values).length > 0 && (
                    <div>
                      <div className="font-medium text-foreground mb-2">Form fields</div>
                      <dl className="space-y-1.5">
                        {Object.entries(additionalInfoData.input_values).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <dt className="text-muted-foreground shrink-0">{key}:</dt>
                            <dd className="break-words">
                              {value === null || value === undefined
                                ? "—"
                                : typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {additionalInfoData.selected_parameters != null &&
                    (Array.isArray(additionalInfoData.selected_parameters)
                      ? (additionalInfoData.selected_parameters as unknown[]).length > 0
                      : Object.keys(additionalInfoData.selected_parameters as object).length > 0) && (
                    <div>
                      <div className="font-medium text-foreground mb-2">Selected parameters</div>
                      <pre className="rounded bg-muted p-3 text-xs overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(additionalInfoData.selected_parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional information was recorded for this attempt.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={quotaBreakdownOpen}
          onOpenChange={(open) => {
            setQuotaBreakdownOpen(open);
            if (!open) {
              setQuotaBreakdownLogId(null);
              setQuotaBreakdownData(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quota calculation details</DialogTitle>
              <DialogDescription>
                Date-wise events that contributed to the quota limit for this failed attempt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {quotaBreakdownLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : quotaBreakdownData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Period: </span>
                      <span className="font-medium">
                        {formatDateSafe(quotaBreakdownData.period_start, "dd MMM yyyy")} – {formatDateSafe(quotaBreakdownData.period_end, "dd MMM yyyy")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scope: </span>
                      <span className="font-medium">{quotaBreakdownData.quota_type} ({quotaBreakdownData.quota_scope})</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{quotaBreakdownData.summary_message}</p>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Booking ID</TableHead>
                          <TableHead>Equipment</TableHead>
                          <TableHead className="text-right">Time (min)</TableHead>
                          <TableHead>User</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(quotaBreakdownData.events ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                              No events in this period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (quotaBreakdownData.events ?? []).map((ev, idx) => (
                            <TableRow key={`${ev.date}-${ev.booking_id}-${idx}`}>
                              <TableCell className="whitespace-nowrap">{ev.date || "—"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="link"
                                  className="p-0 h-auto font-mono text-sm"
                                  onClick={() => openBookingDetailPopup(ev.booking_id)}
                                >
                                  {(ev as { display_booking_id?: string }).display_booking_id ?? `${ev.equipment_code}-#${ev.booking_id}`}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <div>{ev.equipment_name}</div>
                                <div className="text-xs text-muted-foreground">{ev.equipment_code}</div>
                              </TableCell>
                              <TableCell className="text-right">{ev.total_time_minutes}</TableCell>
                              <TableCell>{ev.user_name || "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No data to display.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={bookingDetailPopup !== null || loadingBookingDetail} onOpenChange={(open) => { if (!open) { setBookingDetailPopup(null); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            {loadingBookingDetail ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </div>
            ) : bookingDetailPopup ? (
              <div className="p-4">
                <BookingDetailCard
                  booking={bookingDetailPopup}
                  onClose={() => setBookingDetailPopup(null)}
                  onUpdated={() => setBookingDetailPopup(null)}
                  isOperator={canAccess}
                  currentUserId={user?.id ?? null}
                  backLabel="Close"
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmLogId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmLogId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete log entry</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this log entry. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmLogId != null) handleDeleteLog(deleteConfirmLogId);
                }}
                disabled={deletingLogId !== null}
              >
                {deletingLogId !== null ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default BookingAttemptLogs;
