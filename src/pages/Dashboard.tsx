import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { getUserTypeDisplayName, isExternalBookingUserType } from "@/lib/userTypes";
import { hasRbacPermission } from "@/lib/rbac";
import { hasAdminPanelAccess } from "@/lib/adminPanelAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, FileText, Package, Settings, Clock, ArrowRight, BarChart3, TrendingUp, Layout, ClipboardList, Star, Palette, Users, Wallet, MessageSquarePlus, User, Mail, Phone, Building2, BadgeCheck, AlertCircle, IdCard, UserCheck, Send, Receipt, Wrench, ChevronRight, ChevronLeft, FolderTree, Layers, CreditCard, Banknote, Loader2, Undo2, Globe2, CalendarDays, PackageOpen, Archive, ChevronDown, ChevronUp, FlaskConical, LifeBuoy, GitBranch, BookOpen, ShieldCheck } from "lucide-react";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";
import DashboardHeader from "@/components/DashboardHeader";
import ClickableProfileAvatar from "@/components/ClickableProfileAvatar";
import PortalFeedbackDialog from "@/components/PortalFeedbackDialog";
import { formatUserDisplayName } from "@/lib/displayName";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import { LabOperatorWeekCalendarGrid } from "@/components/LabOperatorWeekCalendarGrid";
import type { LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBookingKey, type BookingRef } from "@/lib/bookingRef";

interface Booking extends BookingRef {
  user: number;
  user_email: string;
  user_name: string;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  status: string;
  status_display: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  total_charge: string;
  created_at: string;
  updated_at: string;
  rating?: number | null;
  rating_feedback?: string | null;
  equipment_user_rating_enabled?: boolean;
}

/** Map user_type to display category (e.g. IITR Student, Faculty). Use user_type_display from API when present (alias). */
function getUserCategoryLabel(userType: number | string | undefined | null, userTypeDisplay?: string | null): string {
  if (userTypeDisplay != null && String(userTypeDisplay).trim() !== "") return String(userTypeDisplay).trim();
  return getUserTypeDisplayName(userType == null ? null : String(userType));
}

const WALLET_BALANCE_CACHE_KEY = "wallet_balance_cache_v1";
const WALLET_BALANCE_CACHE_TTL_MS = 60 * 1000;

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type LabOperatorDashBooking = {
  booking_id: number;
  booking_ref: string;
  virtual_booking_id?: string;
  equipment_code: string;
  equipment_name: string;
  user_name: string;
  status: string;
  status_display?: string;
  start_time: string | null;
  end_time: string | null;
};

type LabDashPeriod = "today" | "week" | "month" | "year" | "custom";

type LabDashPanel =
  | null
  | { key: "overall"; segment: "BOOKED" | "COMPLETED" }
  | { key: "external"; segment: "BOOKED" | "COMPLETED" }
  | { key: "not_util"; segment: "AVAILABLE" | "MARKED" }
  | { key: "sample_return"; segment: "AVAILABLE" | "RETURNED" }
  | { key: "dispose"; segment: "AVAILABLE" | "DISPOSED" };

function filterLabDashRowsByStatus(rows: LabOperatorDashBooking[] | undefined, status: string): LabOperatorDashBooking[] {
  const u = status.toUpperCase();
  return (rows ?? []).filter((r) => String(r.status).toUpperCase() === u);
}

type LabDashRowsDash = {
  overall_booking_rows: LabOperatorDashBooking[];
  external_booking_rows: LabOperatorDashBooking[];
  pending_not_utilized_bookings: LabOperatorDashBooking[];
  not_utilized_marked_bookings?: LabOperatorDashBooking[];
  pending_sample_returned_bookings: LabOperatorDashBooking[];
  sample_returned_done_bookings?: LabOperatorDashBooking[];
  pending_dispose_bookings: LabOperatorDashBooking[];
  sample_disposed_done_bookings?: LabOperatorDashBooking[];
};

function labDashPanelRows(dash: LabDashRowsDash, panel: NonNullable<LabDashPanel>): LabOperatorDashBooking[] {
  switch (panel.key) {
    case "overall":
      return filterLabDashRowsByStatus(dash.overall_booking_rows, panel.segment);
    case "external":
      return filterLabDashRowsByStatus(dash.external_booking_rows, panel.segment);
    case "not_util":
      return panel.segment === "AVAILABLE"
        ? dash.pending_not_utilized_bookings
        : dash.not_utilized_marked_bookings ?? [];
    case "sample_return":
      return panel.segment === "AVAILABLE"
        ? dash.pending_sample_returned_bookings
        : dash.sample_returned_done_bookings ?? [];
    case "dispose":
      return panel.segment === "AVAILABLE"
        ? dash.pending_dispose_bookings
        : dash.sample_disposed_done_bookings ?? [];
    default:
      return [];
  }
}

type LabHeroEquipmentStatusVariant =
  | "operational"
  | "under_maintenance"
  | "scheduled"
  | "other"
  | "neutral";

function labHeroInstrumentPanelClass(v: LabHeroEquipmentStatusVariant) {
  switch (v) {
    case "operational":
      return {
        shell:
          "border-emerald-200/55 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950 shadow-xl shadow-emerald-950/45 ring-2 ring-emerald-300/35",
        badge: "bg-white text-emerald-900 shadow-md",
      };
    case "under_maintenance":
      return {
        shell:
          "border-red-200/55 bg-gradient-to-br from-red-600 via-red-700 to-red-950 shadow-xl shadow-red-950/45 ring-2 ring-red-300/35",
        badge: "bg-white text-red-900 shadow-md",
      };
    case "scheduled":
      return {
        shell:
          "border-amber-200/50 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-950 shadow-xl shadow-amber-950/40 ring-2 ring-amber-300/35",
        badge: "bg-white text-amber-950 shadow-md font-extrabold",
      };
    case "other":
      return {
        shell:
          "border-teal-200/40 bg-gradient-to-br from-teal-800 via-slate-900 to-slate-950 shadow-xl ring-2 ring-teal-400/25",
        badge: "bg-white/95 text-teal-900 shadow-md",
      };
    default:
      return {
        shell:
          "border-white/35 bg-gradient-to-br from-slate-800/90 via-slate-900 to-slate-950 shadow-xl shadow-black/30 ring-2 ring-white/15 backdrop-blur-sm",
        badge: "bg-white/95 text-slate-900 shadow-md",
      };
  }
}

function labDashPanelTitle(panel: NonNullable<LabDashPanel>): string {
  switch (panel.key) {
    case "overall":
      return panel.segment === "BOOKED" ? "Overall — Pending (booked)" : "Overall — Completed";
    case "external":
      return panel.segment === "BOOKED" ? "External — Pending (booked)" : "External — Completed";
    case "not_util":
      return panel.segment === "AVAILABLE"
        ? "Available to mark not utilized"
        : "Already marked not utilized";
    case "sample_return":
      return panel.segment === "AVAILABLE"
        ? "Sample pickup — completed bookings (mark returned)"
        : "Sample pickup — already marked returned";
    case "dispose":
      return panel.segment === "AVAILABLE" ? "Available to mark disposed" : "Already marked disposed";
    default:
      return "";
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated, refreshUser, logout } = useAuth();
  const { openGuide, guide: userGuide } = useUserGuide();

  const handleProfileAvatarUploaded = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showWalletOption, setShowWalletOption] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [equipmentStats, setEquipmentStats] = useState<Array<{
    equipment_id: number;
    equipment_code: string;
    equipment_name: string;
    bookingCount: number;
    totalHours: number;
    totalSpent: number;
  }>>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [pendingRatingBookings, setPendingRatingBookings] = useState<Booking[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [urgentRequestsPendingCount, setUrgentRequestsPendingCount] = useState<number>(0);
  const [loadingUrgentCount, setLoadingUrgentCount] = useState(false);
  const [facultyUrgentPendingCount, setFacultyUrgentPendingCount] = useState<number>(0);
  const [loadingFacultyUrgentCount, setLoadingFacultyUrgentCount] = useState(false);
  const [myUrgentRequestsCount, setMyUrgentRequestsCount] = useState<number>(0);
  const [loadingMyUrgentCount, setLoadingMyUrgentCount] = useState(false);
  const [externalProfileNeedsAddress, setExternalProfileNeedsAddress] = useState(false);
  const [showWalletLinkPrompt, setShowWalletLinkPrompt] = useState(false);
  const [labOperatorDashLoading, setLabOperatorDashLoading] = useState(false);
  const [labOperatorDash, setLabOperatorDash] = useState<{
    today: string;
    week_start: string;
    week_end: string;
    filter_period: string;
    filter_date_start: string;
    filter_date_end: string;
    overall_booking_total: number;
    overall_booking_booked_total: number;
    overall_booking_completed: number;
    overall_booking_rows: LabOperatorDashBooking[];
    external_booking_total: number;
    external_booking_booked_total: number;
    external_booking_completed: number;
    external_booking_rows: LabOperatorDashBooking[];
    not_utilized_marked_total: number;
    not_utilized_available_total: number;
    not_utilized_focus_booking_id: number | null;
    sample_returned_done_total: number;
    sample_available_to_return_total: number;
    sample_return_focus_booking_id: number | null;
    sample_disposed_done_total: number;
    sample_available_to_dispose_total: number;
    sample_dispose_focus_booking_id: number | null;
    days: Array<{ date: string; is_today: boolean; bookings: LabOperatorDashBooking[] }>;
    pending_sample_returned_count: number;
    pending_sample_returned_bookings: LabOperatorDashBooking[];
    pending_dispose_count: number;
    pending_dispose_bookings: LabOperatorDashBooking[];
    pending_not_utilized_count: number;
    pending_not_utilized_bookings: LabOperatorDashBooking[];
    not_utilized_marked_bookings?: LabOperatorDashBooking[];
    sample_returned_done_bookings?: LabOperatorDashBooking[];
    sample_disposed_done_bookings?: LabOperatorDashBooking[];
    equipment_ids: number[];
    equipment_summaries: Array<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      equipment_status?: string;
      equipment_status_display?: string;
    }>;
    current_oic?: { id: number; name: string; email: string } | null;
  } | null>(null);
  /** When null, backend uses the calendar week that contains “today”. */
  const [labOperatorWeekStart, setLabOperatorWeekStart] = useState<string | null>(null);
  const [labDashPeriod, setLabDashPeriod] = useState<LabDashPeriod>("today");
  const [labDashCustomFrom, setLabDashCustomFrom] = useState("");
  const [labDashCustomTo, setLabDashCustomTo] = useState("");
  const [labDashPanel, setLabDashPanel] = useState<LabDashPanel>(null);
  const labDashPanelListRef = useRef<HTMLDivElement | null>(null);
  const [labSlotByEquipment, setLabSlotByEquipment] = useState<Record<number, LabWeekCalendarSlotsPayload>>({});
  const [labSlotsLoading, setLabSlotsLoading] = useState(false);
  const [labSlotsRefresh, setLabSlotsRefresh] = useState(0);
  const [labCalendarBookedOnly, setLabCalendarBookedOnly] = useState(false);
  /** Week slot grid: collapsed by default to reduce noise and avoid loading slots until needed. */
  const [labWeekCalendarExpanded, setLabWeekCalendarExpanded] = useState(false);
  const [labDashSelectedBookingId, setLabDashSelectedBookingId] = useState<number | null>(null);
  const [labDashDetailBooking, setLabDashDetailBooking] = useState<BookingDetailCardBooking | null>(null);
  const [labDashDetailLoading, setLabDashDetailLoading] = useState(false);
  /** Lab dashboard metrics scope: all assigned equipment or one instrument. */
  const [labDashEquipmentFilter, setLabDashEquipmentFilter] = useState<number | "all">("all");
  const [daAdditionRequests, setDaAdditionRequests] = useState<
    Array<{ id: number; code: string; name: string; status: string; status_display?: string }>
  >([]);
  const [daAdditionRequestsLoading, setDaAdditionRequestsLoading] = useState(false);

  // Check if user is operator, manager, or admin (for booking management)
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isLabInchargeUser = userTypeStr === "operator";
  /** OIC (manager): keeps extra dashboard tools; lab-style hero + lab dashboard also shown. */
  const isOicUser = userTypeStr === "manager";
  /** Department Account In-charge: focused dashboard only (recharge, external bookings, reports). */
  const isAccountsInChargeUser = userTypeStr === "finance";
  /** Same weekly metrics, instrument hero, and week calendar as Lab Incharge. */
  const showsLabStyleDashboard = isLabInchargeUser || isOicUser;
  const isOperatorOrManager = 
    userTypeStr === 'operator' || userTypeStr === 'manager' || userTypeStr === 'admin';
  
  // Admin Settings section is visible to Main Admin always, and to other roles only when the
  // Main Administrator has configured Admin Panel access for their user type + department.
  const isAdmin = userTypeStr === 'admin';
  const canSeeAdminSettingsCard =
    !isAccountsInChargeUser && (isAdmin || hasAdminPanelAccess(user));
  const isDeptAdmin = userTypeStr === 'dept_admin';
  const isExternalRelations = userTypeStr === 'external_relations';
  const isOrgAdmin = userTypeStr === 'org_admin';
  const canManageDeptRbac = isAdmin;
  const canVerifyExternalOrgs = isAdmin || isExternalRelations || hasRbacPermission(user, "external.org.verify");
  const isFacultyUser = userTypeStr === "faculty";
  const isInternalFacultyUser =
    isFacultyUser && String(user?.department_type ?? "").toLowerCase() === "internal";
  const showFacultyUrgentWalletCard = isFacultyUser && !isInternalFacultyUser;

  useEffect(() => {
    if (!isDeptAdmin || !isAuthenticated || authLoading) return;
    let cancelled = false;
    setDaAdditionRequestsLoading(true);
    apiClient
      .adminListEquipmentAdditionRequests("ALL")
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data?.results || []) as Array<{
          id: number;
          code: string;
          name: string;
          status: string;
          status_display?: string;
        }>;
        setDaAdditionRequests(rows.slice(0, 8));
      })
      .finally(() => {
        if (!cancelled) setDaAdditionRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDeptAdmin, isAuthenticated, authLoading, user?.id]);

  // OIC dashboard cards: Admin always; manager only when enabled in Django admin for that user.
  const canSeeOicTaNomination =
    isAdmin || (isOicUser && user?.oic_enable_ta_nomination === true);
  const canSeeOicTaDutyAssignments =
    isAdmin || (isOicUser && user?.oic_enable_ta_duty_assignments === true);
  const canSeeOicLeaveManagement =
    isAdmin || (isOicUser && user?.oic_enable_leave_management === true);
  const canSeeOicRewardConfig =
    isAdmin || (isOicUser && user?.oic_enable_reward_config === true);
  const canSeeOicMultiMode = isAdmin || isOicUser;
  // Students still need TA duty assignments without OIC flags.
  const canSeeTaDutyAssignmentsCard =
    canSeeOicTaDutyAssignments ||
    userTypeStr === "student" ||
    userTypeStr === "individual_student";

  // Admin and OIC (manager, operator) can see booking attempt log — not Account In-charge
  const canAccessBookingAttemptLog =
    !isAccountsInChargeUser &&
    (apiClient.isAdminPanelUser(user?.user_type) ||
      userTypeStr === "admin" ||
      userTypeStr === "manager" ||
      userTypeStr === "operator");

  const canAccessAdminTools = apiClient.isAdminPanelUser(user?.user_type) || canAccessBookingAttemptLog;

  const labEquipmentSummariesForScope = useMemo(() => {
    const list = labOperatorDash?.equipment_summaries ?? [];
    if (labDashEquipmentFilter === "all") return list;
    return list.filter((e) => e.equipment_id === labDashEquipmentFilter);
  }, [labOperatorDash?.equipment_summaries, labDashEquipmentFilter]);


  const labHeroEquipmentTitle = useMemo(() => {
    const sums = labOperatorDash?.equipment_summaries ?? [];
    if (sums.length === 0) {
      if (labOperatorDashLoading) return "Loading…";
      return "";
    }
    if (labDashEquipmentFilter === "all") {
      if (sums.length === 1) return sums[0].equipment_name || sums[0].equipment_code || "Equipment";
      return `${sums.length} assigned instruments`;
    }
    const one = sums.find((e) => e.equipment_id === labDashEquipmentFilter);
    return one?.equipment_name || one?.equipment_code || "Equipment";
  }, [labOperatorDash?.equipment_summaries, labDashEquipmentFilter, labOperatorDashLoading]);

  const labHeroEquipmentStatus = useMemo((): {
    variant: LabHeroEquipmentStatusVariant;
    label: string;
  } | null => {
    const sums = labOperatorDash?.equipment_summaries ?? [];
    if (sums.length === 0) {
      return labOperatorDashLoading ? { variant: "neutral", label: "" } : null;
    }
    let eq: (typeof sums)[0] | null = null;
    if (labDashEquipmentFilter === "all") {
      if (sums.length === 1) eq = sums[0];
      else return { variant: "neutral", label: `${sums.length} instruments` };
    } else {
      eq = sums.find((e) => e.equipment_id === labDashEquipmentFilter) ?? null;
    }
    if (!eq) return { variant: "neutral", label: `${sums.length} instruments` };
    const code = String(eq.equipment_status || "").toUpperCase();
    const label = (eq.equipment_status_display || "").trim() || "Unknown";
    if (code === "ACTIVE") return { variant: "operational", label };
    if (code === "REPAIR" || code === "INACTIVE") return { variant: "under_maintenance", label };
    if (code === "MAINTENANCE") return { variant: "scheduled", label };
    return { variant: "other", label };
  }, [labOperatorDash?.equipment_summaries, labDashEquipmentFilter, labOperatorDashLoading]);

  /** Stable key for assigned equipment list; when it changes, re-apply default first instrument for multi-assign. */
  const labEquipmentSummariesKey = useMemo(() => {
    const ids = (labOperatorDash?.equipment_summaries ?? []).map((e) => e.equipment_id);
    return [...ids].sort((a, b) => a - b).join(",");
  }, [labOperatorDash?.equipment_summaries]);

  const labEquipmentSummariesKeyRef = useRef("");
  useEffect(() => {
    const sums = labOperatorDash?.equipment_summaries ?? [];
    if (sums.length < 2 || !labEquipmentSummariesKey) return;

    if (labEquipmentSummariesKeyRef.current !== labEquipmentSummariesKey) {
      labEquipmentSummariesKeyRef.current = labEquipmentSummariesKey;
      setLabDashEquipmentFilter(sums[0].equipment_id);
      return;
    }

    if (
      labDashEquipmentFilter !== "all" &&
      typeof labDashEquipmentFilter === "number" &&
      !sums.some((e) => e.equipment_id === labDashEquipmentFilter)
    ) {
      setLabDashEquipmentFilter(sums[0].equipment_id);
    }
  }, [labEquipmentSummariesKey, labDashEquipmentFilter, labOperatorDash?.equipment_summaries]);

  const labAssignedEquipmentList = labOperatorDash?.equipment_summaries ?? [];
  const labHeroEquipmentIndex = useMemo(() => {
    const list = labOperatorDash?.equipment_summaries ?? [];
    if (list.length === 0) return 0;
    if (typeof labDashEquipmentFilter !== "number") return 0;
    const idx = list.findIndex((e) => e.equipment_id === labDashEquipmentFilter);
    return idx >= 0 ? idx : 0;
  }, [labOperatorDash?.equipment_summaries, labDashEquipmentFilter]);

  const cycleLabHeroEquipment = useCallback(
    (direction: -1 | 1) => {
      const list = labOperatorDash?.equipment_summaries ?? [];
      if (list.length < 2) return;
      let idx =
        typeof labDashEquipmentFilter === "number"
          ? list.findIndex((e) => e.equipment_id === labDashEquipmentFilter)
          : 0;
      if (idx < 0) idx = 0;
      const next = (idx + direction + list.length) % list.length;
      setLabDashEquipmentFilter(list[next].equipment_id);
    },
    [labOperatorDash?.equipment_summaries, labDashEquipmentFilter]
  );

  useEffect(() => {
    if (!user?.id) return;
    const userTypeLower = String(user.user_type || "").toLowerCase();
    const shouldShowWelcome = userTypeLower === "student" || userTypeLower === "faculty";
    if (!shouldShowWelcome) return;

    const welcomeKey = `dashboard_welcome_shown_${user.id}`;
    if (localStorage.getItem(welcomeKey)) return;

    const displayName = formatUserDisplayName(user);
    if (userTypeLower === "faculty") {
      toast.success(`Welcome, ${displayName}.`, {
        description: "You are signed in to the Institute Equipment Booking Portal. Please review your dashboard for booking updates and pending actions.",
      });
    } else {
      toast.success(`Welcome ${displayName}!`, {
        description: "Great to have you on the Institute Equipment Booking Portal.",
      });
    }
    localStorage.setItem(welcomeKey, "1");
  }, [user?.id, user?.name, user?.user_type]);

  useEffect(() => {
    if (!showWalletLinkPrompt || !user?.id) return;
    const promptKey = `wallet_link_prompt_shown_${user.id}`;
    if (sessionStorage.getItem(promptKey)) return;

    toast.warning("Wallet not linked yet", {
      description: "Link your faculty wallet to continue with bookings that require wallet access.",
      action: {
        label: "Link wallet",
        onClick: () => navigate("/wallet"),
      },
      duration: 10000,
    });
    sessionStorage.setItem(promptKey, "1");
  }, [showWalletLinkPrompt, user?.id, navigate]);

  // Sample submission deadline approaching — toast once per login session
  useEffect(() => {
    if (!isAuthenticated || authLoading || !user?.id) return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.getApproachingSampleSubmissionDeadlines();
      if (cancelled || res.error || !res.data?.items?.length) return;
      for (const item of res.data.items) {
        const toastKey = `sample_submission_deadline_toast_${user.id}_${item.booking_id}`;
        if (sessionStorage.getItem(toastKey)) continue;
        const remaining = Math.max(0, item.remaining_seconds || 0);
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const remainingLabel =
          hours > 0 ? `${hours}h ${mins}m` : `${mins} minute(s)`;
        const deadlineLabel = item.deadline_at
          ? new Date(item.deadline_at).toLocaleString()
          : "soon";
        toast.warning("Sample submission deadline approaching", {
          description: `${item.equipment_name} (Booking #${item.virtual_booking_id}): submit by ${deadlineLabel} (${remainingLabel} left).`,
          action: {
            label: "View booking",
            onClick: () =>
              navigate(item.link || `/my-bookings?booking=${item.virtual_booking_id}`),
          },
          duration: 14000,
        });
        sessionStorage.setItem(toastKey, "1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, user?.id, navigate]);

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    const checkAuthAndLoadData = async () => {
      // Check authentication using AuthContext
      if (!isAuthenticated) {
        if (!hasRedirected) {
          hasRedirected = true;
          navigate("/auth");
        }
        setLoading(false);
        return;
      }

      // If user is authenticated but user data is not loaded yet, wait for it
      if (authLoading) {
        return;
      }

      if (!user) {
        // Try to refresh user data
        await refreshUser();
        if (!isMounted) return;

        // If still no user after refresh, redirect to auth
        if (!user) {
          if (!hasRedirected) {
            hasRedirected = true;
            navigate("/auth");
          }
          setLoading(false);
          return;
        }
        }

      try {
        const userCanHaveWallet = user?.can_have_wallet === true;
        const currentUserType: any = user?.user_type;
        const currentUserTypeStr = currentUserType ? String(currentUserType).toLowerCase() : "";
        const isCurrentUserOperatorOrManager =
          currentUserTypeStr === "operator" || currentUserTypeStr === "manager" || currentUserTypeStr === "admin";
        const isStudent = currentUserTypeStr === "student" || currentUserTypeStr === "individual_student";
        const isIitrStudent = currentUserTypeStr === "student";
        const isExternalUser = isExternalBookingUserType(currentUserTypeStr);

        // Determine what to show (before any await)
        const shouldShowWallet = userCanHaveWallet || isStudent;
        setShowWalletOption(!!shouldShowWallet);

        // Run all data fetches in parallel (no await chain)
        const tasks: Promise<void>[] = [];

        if (userCanHaveWallet || (isStudent && !userCanHaveWallet)) {
          if (isStudent && !userCanHaveWallet) {
            tasks.push(
              apiClient.getWalletJoinRequests().then((requestsResponse) => {
                if (!isMounted) return;
                const hasApprovedWalletJoin = requestsResponse.data?.requests?.some((req: any) => req.status === "APPROVED");
                if (hasApprovedWalletJoin) {
                  setHasWallet(true);
                  setShowWalletLinkPrompt(false);
                  fetchWalletBalance().catch(() => setHasWallet(false));
                } else if (isIitrStudent) {
                  setHasWallet(false);
                  setShowWalletLinkPrompt(true);
                }
              }).catch(() => {
                if (!isMounted) return;
                if (isIitrStudent) setShowWalletLinkPrompt(true);
              })
            );
          } else if (userCanHaveWallet) {
            tasks.push(fetchWalletBalance().then(() => {}).catch(() => setHasWallet(false)));
            setHasWallet(true);
            setShowWalletLinkPrompt(false);
          }
        }

        if (!isCurrentUserOperatorOrManager) {
          tasks.push(
            fetchUpcomingBookings().then(() => {}),
            fetchEquipmentStatistics().then(() => {}),
            fetchPendingRatingBookings().then(() => {})
          );
        }
        if (isCurrentUserOperatorOrManager && currentUserTypeStr !== "operator") {
          tasks.push(fetchUrgentRequestsPendingCount().then(() => {}));
        }
        const facultyDeptInternal =
          String(user?.department_type ?? "").toLowerCase() === "internal";
        if (currentUserTypeStr === "faculty" && !facultyDeptInternal) {
          tasks.push(fetchFacultyUrgentPendingCount().then(() => {}));
        }
        if (isStudent) {
          tasks.push(fetchMyUrgentRequestsCount().then(() => {}));
        }

        if (isExternalUser) {
          tasks.push(
            apiClient
              .getExternalBillingProfileMe()
              .then((r) => {
                if (!isMounted) return;
                const d = r.data;
                if (r.error || !d) {
                  setExternalProfileNeedsAddress(true);
                  return;
                }

                const missing = (v: unknown) => String(v ?? "").trim() === "";
                const billingMissing =
                  missing(d.billing_name) ||
                  missing(d.billing_address_line1) ||
                  missing(d.billing_city) ||
                  missing(d.billing_state) ||
                  missing(d.billing_pincode) ||
                  missing(d.billing_country);

                const shippingMissing = d.shipping_same_as_billing
                  ? false
                  : missing(d.shipping_name) ||
                    missing(d.shipping_phone) ||
                    missing(d.shipping_address_line1) ||
                    missing(d.shipping_city) ||
                    missing(d.shipping_state) ||
                    missing(d.shipping_pincode) ||
                    missing(d.shipping_country);

                setExternalProfileNeedsAddress(billingMissing || shippingMissing);
              })
              .catch(() => {
                if (!isMounted) return;
                setExternalProfileNeedsAddress(true);
              })
          );
        }
        if (!isIitrStudent) {
          setShowWalletLinkPrompt(false);
        }

        setLoading(false);
        await Promise.all(tasks);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        if (!hasRedirected && isMounted) {
          hasRedirected = true;
          navigate("/auth");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuthAndLoadData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, authLoading]);

  useEffect(() => {
    if (!showsLabStyleDashboard || !user?.id) return;
    if (labDashPeriod === "custom" && (!labDashCustomFrom.trim() || !labDashCustomTo.trim())) {
      return;
    }
    let cancelled = false;
    setLabOperatorDashLoading(true);
    apiClient
      .getLabOperatorDashboard({
        weekStart: labOperatorWeekStart ?? undefined,
        period: labDashPeriod,
        dateFrom: labDashPeriod === "custom" ? labDashCustomFrom : undefined,
        dateTo: labDashPeriod === "custom" ? labDashCustomTo : undefined,
        equipmentId: labDashEquipmentFilter === "all" ? undefined : labDashEquipmentFilter,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          setLabOperatorDash(null);
          return;
        }
        setLabOperatorDash(res.data);
      })
      .catch(() => {
        if (!cancelled) setLabOperatorDash(null);
      })
      .finally(() => {
        if (!cancelled) setLabOperatorDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    showsLabStyleDashboard,
    user?.id,
    labOperatorWeekStart,
    labDashPeriod,
    labDashCustomFrom,
    labDashCustomTo,
    labDashEquipmentFilter,
  ]);

  const selectLabBookingForDetail = useCallback((bookingId: number) => {
    setLabDashSelectedBookingId(bookingId);
    setTimeout(() => {
      document.getElementById("lab-booking-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, []);

  const clearLabBookingDetail = useCallback(() => {
    setLabDashSelectedBookingId(null);
    setLabDashDetailBooking(null);
  }, []);

  const labDashKpiClassName =
    "group relative overflow-hidden text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm ring-1 ring-black/[0.03] transition-all duration-200 hover:-translate-y-px hover:border-teal-400/40 hover:shadow-md dark:ring-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0";

  const refreshLabOperatorHome = useCallback(async () => {
    const res = await apiClient.getLabOperatorDashboard({
      weekStart: labOperatorWeekStart ?? undefined,
      period: labDashPeriod,
      dateFrom: labDashPeriod === "custom" ? labDashCustomFrom : undefined,
      dateTo: labDashPeriod === "custom" ? labDashCustomTo : undefined,
      equipmentId: labDashEquipmentFilter === "all" ? undefined : labDashEquipmentFilter,
    });
    if (res.data) setLabOperatorDash(res.data);
    setLabSlotsRefresh((t) => t + 1);
  }, [labOperatorWeekStart, labDashPeriod, labDashCustomFrom, labDashCustomTo, labDashEquipmentFilter]);

  const toggleLabDashPanel = useCallback((next: NonNullable<LabDashPanel>) => {
    setLabDashPanel((p) => (p?.key === next.key && p.segment === next.segment ? null : next));
  }, []);

  useEffect(() => {
    if (!labDashPanel) return;
    const t = window.setTimeout(() => {
      labDashPanelListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [labDashPanel]);

  useEffect(() => {
    clearLabBookingDetail();
    setLabDashPanel(null);
  }, [
    labOperatorDash?.week_start,
    labOperatorWeekStart,
    labDashPeriod,
    labDashCustomFrom,
    labDashCustomTo,
    labDashEquipmentFilter,
    clearLabBookingDetail,
  ]);

  useEffect(() => {
    if (!showsLabStyleDashboard || !labOperatorDash?.week_start || !labOperatorDash?.week_end) {
      setLabSlotByEquipment({});
      return;
    }
    if (!labWeekCalendarExpanded) {
      setLabSlotByEquipment({});
      setLabSlotsLoading(false);
      return;
    }
    const summaries = labEquipmentSummariesForScope;
    if (summaries.length === 0) {
      setLabSlotByEquipment({});
      return;
    }
    let cancelled = false;
    setLabSlotsLoading(true);
    Promise.all(
      summaries.map((eq) =>
        apiClient.getEquipmentSlots(eq.equipment_id, labOperatorDash.week_start, labOperatorDash.week_end, {
          applyWeeklyViewTimeFilter: true,
        })
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<number, LabWeekCalendarSlotsPayload> = {};
        summaries.forEach((eq, i) => {
          const res = results[i];
          if (res.data) next[eq.equipment_id] = res.data as LabWeekCalendarSlotsPayload;
        });
        setLabSlotByEquipment(next);
      })
      .catch(() => {
        if (!cancelled) setLabSlotByEquipment({});
      })
      .finally(() => {
        if (!cancelled) setLabSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    showsLabStyleDashboard,
    labOperatorDash?.week_start,
    labOperatorDash?.week_end,
    labSlotsRefresh,
    labEquipmentSummariesForScope.map((e) => e.equipment_id).join(","),
    labWeekCalendarExpanded,
    labDashEquipmentFilter,
  ]);

  useEffect(() => {
    if (!showsLabStyleDashboard || labDashSelectedBookingId == null) {
      setLabDashDetailBooking(null);
      setLabDashDetailLoading(false);
      return;
    }
    let cancelled = false;
    setLabDashDetailLoading(true);
    setLabDashDetailBooking(null);
    apiClient
      .getBookings({ booking_id: labDashSelectedBookingId, limit: 1 })
      .then((res) => {
        if (cancelled || res.error) return;
        const b = res.data?.bookings?.[0];
        if (b) setLabDashDetailBooking(b as BookingDetailCardBooking);
      })
      .finally(() => {
        if (!cancelled) setLabDashDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showsLabStyleDashboard, labDashSelectedBookingId]);

  const fetchWalletBalance = async () => {
    try {
      const cached = localStorage.getItem(WALLET_BALANCE_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { balance?: number; ts?: number };
          if (
            typeof parsed?.balance === "number" &&
            typeof parsed?.ts === "number" &&
            Date.now() - parsed.ts < WALLET_BALANCE_CACHE_TTL_MS
          ) {
            setWalletBalance(parsed.balance);
            setHasWallet(true);
            return;
          }
        } catch {
          // Ignore malformed cache.
        }
      }

      const response = await apiClient.getWalletBalance();
      if (response.data) {
        const balance = Number(response.data.balance);
        setWalletBalance(balance);
        localStorage.setItem(
          WALLET_BALANCE_CACHE_KEY,
          JSON.stringify({ balance, ts: Date.now() })
        );
      } else {
        // Fallback to full wallet endpoint if balance endpoint fails
        const walletResponse = await apiClient.getWallet();
        if (walletResponse.data?.balance) {
          const balance = Number(walletResponse.data.balance);
          setWalletBalance(balance);
          localStorage.setItem(
            WALLET_BALANCE_CACHE_KEY,
            JSON.stringify({ balance, ts: Date.now() })
          );
        }
      }
    } catch (error) {
      // Silently handle wallet errors - user may not have wallet access
      console.log("Wallet not available for this user type");
      setHasWallet(false);
    }
  };

  const fetchUrgentRequestsPendingCount = async () => {
    setLoadingUrgentCount(true);
    try {
      const res = await apiClient.listUrgentBookingRequests({ status: "PENDING", limit: 1, offset: 0 });
      if (res.data && typeof (res.data as { total_count?: number }).total_count === "number") {
        setUrgentRequestsPendingCount((res.data as { total_count: number }).total_count);
      } else {
        setUrgentRequestsPendingCount(0);
      }
    } catch {
      setUrgentRequestsPendingCount(0);
    } finally {
      setLoadingUrgentCount(false);
    }
  };

  const fetchFacultyUrgentPendingCount = async () => {
    setLoadingFacultyUrgentCount(true);
    try {
      const res = await apiClient.listUrgentRequestsWalletPending({ limit: 1, offset: 0 });
      if (res.data && typeof (res.data as { total_count?: number }).total_count === "number") {
        setFacultyUrgentPendingCount((res.data as { total_count: number }).total_count);
      } else {
        setFacultyUrgentPendingCount(0);
      }
    } catch {
      setFacultyUrgentPendingCount(0);
    } finally {
      setLoadingFacultyUrgentCount(false);
    }
  };

  const fetchMyUrgentRequestsCount = async () => {
    setLoadingMyUrgentCount(true);
    try {
      const res = await apiClient.listMyUrgentBookingRequests({ limit: 1, offset: 0 });
      if (res.data && typeof (res.data as { total_count?: number }).total_count === "number") {
        setMyUrgentRequestsCount((res.data as { total_count: number }).total_count);
      } else {
        setMyUrgentRequestsCount(0);
      }
    } catch {
      setMyUrgentRequestsCount(0);
    } finally {
      setLoadingMyUrgentCount(false);
    }
  };

  const fetchUpcomingBookings = async () => {
    try {
      setLoadingBookings(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Fetch bookings starting from today onwards; limit to reduce payload
      const response = await apiClient.getBookings({
        start_date: todayStr,
        ordering: "start_time",
        limit: 10,
      });
      
      if (response.error) {
        console.error("Error fetching upcoming bookings:", response.error);
        setUpcomingBookings([]);
        return;
      }
      
      if (response.data && response.data.bookings) {
        // Filter out cancelled and completed bookings, and only show future bookings
        const now = new Date();
        const upcoming = response.data.bookings.filter((booking: Booking) => {
          const statusLower = booking.status.toLowerCase();
          if (statusLower === 'cancelled' || statusLower === 'completed') {
            return false;
          }
          // Only show bookings that haven't started yet
          const startTime = new Date(booking.start_time);
          return startTime > now;
        });
        
        // Limit to 5 most upcoming bookings
        setUpcomingBookings(upcoming.slice(0, 5));
      } else {
        setUpcomingBookings([]);
      }
    } catch (error: any) {
      console.error("Error fetching upcoming bookings:", error);
      setUpcomingBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      booked: "bg-teal-600",
      confirmed: "bg-teal-600",
      approved: "bg-teal-600",
      in_progress: "bg-green-500",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
      rejected: "bg-red-500",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const fetchPendingRatingBookings = async () => {
    // Staff and Department Administrators are not rating-eligible.
    if (isOperatorOrManager || isDeptAdmin) {
      setPendingRatingBookings([]);
      return;
    }
    try {
      const response = await apiClient.getBookings({ status: "COMPLETED", limit: 50 });
      if (response.error || !response.data?.bookings) {
        setPendingRatingBookings([]);
        return;
      }
      const pending = response.data.bookings.filter(
        (b: Booking) =>
          (b.rating == null || b.rating === undefined) &&
          (b.equipment_user_rating_enabled !== false) &&
          (!isFacultyUser || (user?.id != null && Number(b.user) === Number(user.id)))
      );
      setPendingRatingBookings(pending);
    } catch {
      setPendingRatingBookings([]);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchEquipmentStatistics = async () => {
    try {
      setLoadingStats(true);
      const response = await apiClient.getBookings({
        limit: 50,
        ordering: "-start_time",
      });
      
      if (response.error) {
        console.error("Error fetching bookings for statistics:", response.error);
        setEquipmentStats([]);
        return;
      }
      
      if (response.data && response.data.bookings) {
        const bookings = response.data.bookings;
        
        // Aggregate by equipment
        const equipmentMap = new Map<number, {
          equipment_id: number;
          equipment_code: string;
          equipment_name: string;
          bookingCount: number;
          totalHours: number;
          totalSpent: number;
        }>();
        
        bookings.forEach((booking: Booking) => {
          const equipmentId = booking.equipment;
          
          if (!equipmentMap.has(equipmentId)) {
            equipmentMap.set(equipmentId, {
              equipment_id: equipmentId,
              equipment_code: booking.equipment_code,
              equipment_name: booking.equipment_name,
              bookingCount: 0,
              totalHours: 0,
              totalSpent: 0,
            });
          }
          
          const stats = equipmentMap.get(equipmentId)!;
          stats.bookingCount += 1;
          stats.totalHours += Number(booking.total_hours || 0);
          stats.totalSpent += Number(booking.total_charge || 0);
        });
        
        // Convert to array and sort by booking count (descending)
        const statsArray = Array.from(equipmentMap.values())
          .sort((a, b) => b.bookingCount - a.bookingCount)
          .slice(0, 5); // Top 5 equipment
        
        setEquipmentStats(statsArray);
      } else {
        setEquipmentStats([]);
      }
    } catch (error: any) {
      console.error("Error fetching equipment statistics:", error);
      setEquipmentStats([]);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/auth");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page page-shell">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        {externalProfileNeedsAddress && (
          <Card className="dashboard-notice-card dashboard-notice-info mb-6 border-teal-200/70 bg-teal-50/60 dark:bg-teal-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Complete billing & shipping details
              </CardTitle>
              <CardDescription>
                To generate invoices and shipping labels for external bookings, please complete your Billing Address (GSTIN) and Shipping Address in your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate("/profile#external-billing")}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                Go to Profile
              </Button>
            </CardContent>
          </Card>
        )}
        {showWalletLinkPrompt && userTypeStr === "student" && (
          <Card className="dashboard-notice-card dashboard-notice-primary mb-6 border-2 border-teal-500/80 bg-gradient-to-r from-teal-50 via-teal-50 to-cyan-50 dark:from-teal-950/60 dark:via-teal-950/50 dark:to-cyan-950/40 shadow-lg shadow-teal-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2 text-teal-900 dark:text-teal-100">
                <AlertCircle className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                Link your wallet to continue booking
              </CardTitle>
              <CardDescription className="text-sm font-medium text-teal-900/90 dark:text-teal-100/90">
                Your IITR student account does not have a linked faculty wallet yet. Click below to go to Wallet and send a link request.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate("/wallet")}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-6 py-2.5 ring-2 ring-teal-300 dark:ring-teal-700"
              >
                Go to Wallet
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Profile hero — layered gradient, glass contact strip, status-tinted instrument card for Lab Incharge & OIC */}
        <div className="dashboard-hero-card relative mb-10 overflow-hidden rounded-3xl border border-white/25 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-950 text-white shadow-2xl shadow-teal-950/40 ring-1 ring-white/20">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_90%_at_0%_-30%,rgba(255,255,255,0.2),transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_100%_100%,rgba(45,212,191,0.28),transparent_55%)]"
            aria-hidden
          />
          <div
            className={cn(
              "relative flex flex-col lg:flex-row",
              showsLabStyleDashboard ? "lg:items-center" : "lg:items-stretch"
            )}
          >
            {!showsLabStyleDashboard && (
              <div className="flex justify-center border-b border-white/15 bg-white/[0.07] px-6 py-8 backdrop-blur-sm lg:w-[12rem] lg:shrink-0 lg:flex-col lg:items-center lg:justify-center lg:border-b-0 lg:border-r lg:border-white/15 lg:py-10">
                <ClickableProfileAvatar
                  userId={user?.id}
                  userName={user?.name}
                  userEmail={user?.email}
                  hasProfilePicture={Boolean(user?.profile_picture)}
                  onUploaded={handleProfileAvatarUploaded}
                  avatarClassName="h-28 w-28 shrink-0 rounded-2xl border-[3px] border-white/55 shadow-xl shadow-black/25 ring-4 ring-white/15"
                  fallbackClassName="rounded-2xl bg-white/25 text-3xl font-bold text-white"
                  overlayRoundedClassName="rounded-2xl"
                />
              </div>
            )}
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col",
                showsLabStyleDashboard ? "px-4 py-4 sm:px-5 sm:py-4" : "px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8"
              )}
            >
              {showsLabStyleDashboard ? (
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                  <div className="flex min-w-0 flex-1 flex-row items-center gap-3 sm:gap-4">
                    <ClickableProfileAvatar
                      userId={user?.id}
                      userName={user?.name}
                      userEmail={user?.email}
                      hasProfilePicture={Boolean(user?.profile_picture)}
                      onUploaded={handleProfileAvatarUploaded}
                      avatarClassName="h-16 w-16 shrink-0 rounded-full border-2 border-white/50 shadow-md shadow-black/20 ring-2 ring-white/15 sm:h-[4.5rem] sm:w-[4.5rem]"
                      fallbackClassName="rounded-full bg-white/25 text-lg font-bold text-white sm:text-xl"
                      overlayRoundedClassName="rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-2xl">
                        {formatUserDisplayName(user) || "—"}
                      </h2>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/95 backdrop-blur-sm">
                          <BadgeCheck className="h-3 w-3 shrink-0 opacity-90" />
                          {getUserCategoryLabel(user?.user_type, user?.user_type_display)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5 text-[13px] leading-snug text-white/80 sm:text-sm">
                        <div className="flex items-start gap-2 min-w-0">
                          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" strokeWidth={2} />
                          <span className="min-w-0 break-all [overflow-wrap:anywhere]" title={user?.email || undefined}>
                            {user?.email || "—"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 min-w-0">
                          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" strokeWidth={2} />
                          <span className="min-w-0 [overflow-wrap:anywhere]" title={user?.department_name || undefined}>
                            {user?.department_name || "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-white/45" strokeWidth={2} />
                          <span className="min-w-0 tabular-nums [overflow-wrap:anywhere]" title={user?.phone_number || user?.secondary_phone_number || undefined}>
                            {user?.phone_number || user?.secondary_phone_number || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 w-full lg:max-w-[min(100%,28rem)] lg:flex-1 xl:max-w-xl">
                    {(() => {
                      const statusUi = labHeroEquipmentStatus;
                      const variant = statusUi?.variant ?? "neutral";
                      const vis = labHeroInstrumentPanelClass(variant);
                      const multiAssigned = labAssignedEquipmentList.length > 1;
                      return (
                        <div className={cn("overflow-hidden rounded-xl border-2 shadow-lg", vis.shell)}>
                          <div className="px-4 py-3 sm:px-5 sm:py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/25 pb-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/20 ring-1 ring-white/25">
                                  <FlaskConical className="h-4 w-4 text-white" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 leading-tight">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/85">Assigned equipment</p>
                                  <p className="text-[11px] text-white/55">
                                    {isOicUser ? "Officer In Charge" : "Lab Incharge"}
                                    {multiAssigned
                                      ? ` · ${labHeroEquipmentIndex + 1} of ${labAssignedEquipmentList.length}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                              {isLabInchargeUser && labOperatorDash?.current_oic?.name ? (
                                <div className="min-w-0 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5">
                                  <div className="flex min-w-0 items-baseline gap-2">
                                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/75 sm:text-xs">
                                      Current Officer in Charge
                                    </span>
                                    <span
                                      className="min-w-0 truncate text-[13px] font-extrabold text-white sm:text-sm"
                                      title={labOperatorDash.current_oic.email}
                                    >
                                      {labOperatorDash.current_oic.name}
                                    </span>
                                  </div>
                                  {statusUi?.label ? (
                                    <div className="mt-1 flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-white/70">
                                        Operational Status
                                      </span>
                                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", vis.badge)}>
                                        {statusUi.label}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {statusUi?.label && !isLabInchargeUser ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]",
                                    vis.badge
                                  )}
                                >
                                  {statusUi.label}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 pt-2.5">
                              {multiAssigned ? (
                                <button
                                  type="button"
                                  aria-label="Previous assigned equipment"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-black/15 text-white transition hover:bg-black/30"
                                  onClick={() => cycleLabHeroEquipment(-1)}
                                >
                                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                                </button>
                              ) : null}
                              <p className="min-w-0 flex-1 text-base font-bold leading-snug tracking-tight text-white [text-wrap:pretty] sm:text-lg">
                                {labHeroEquipmentTitle || (labOperatorDashLoading ? "…" : "—")}
                              </p>
                              {multiAssigned ? (
                                <button
                                  type="button"
                                  aria-label="Next assigned equipment"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-black/15 text-white transition hover:bg-black/30"
                                  onClick={() => cycleLabHeroEquipment(1)}
                                >
                                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0">
                    <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
                      {formatUserDisplayName(user) || "—"}
                    </h2>
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/20 px-4 py-1.5 text-sm font-medium shadow-inner shadow-black/10 backdrop-blur-md">
                        <BadgeCheck className="h-4 w-4 shrink-0 opacity-95" />
                        {getUserCategoryLabel(user?.user_type, user?.user_type_display)}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {!showsLabStyleDashboard && (
              <dl
                className={cn(
                  "mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-white/15 bg-black/20 p-4 shadow-inner backdrop-blur-md sm:gap-4",
                  userTypeStr === "student" || userTypeStr === "individual_student" || userTypeStr === "faculty"
                    ? "sm:grid-cols-2 lg:grid-cols-4"
                    : "sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Department</dt>
                    <dd className="mt-0.5 font-semibold text-white [overflow-wrap:anywhere]" title={user?.department_name || undefined}>
                      {user?.department_name || "—"}
                    </dd>
                  </div>
                </div>
                {(userTypeStr === "student" || userTypeStr === "individual_student") && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Enrollment Number</dt>
                      <dd className="mt-0.5 font-semibold text-white [overflow-wrap:anywhere]" title={user?.emp_id || undefined}>
                        {user?.emp_id || "—"}
                      </dd>
                    </div>
                  </div>
                )}
                {userTypeStr === "faculty" && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Employee Number</dt>
                      <dd className="mt-0.5 font-semibold text-white [overflow-wrap:anywhere]" title={user?.emp_id || undefined}>
                        {user?.emp_id || "—"}
                      </dd>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Mobile</dt>
                    <dd
                      className="mt-0.5 font-semibold text-white [overflow-wrap:anywhere]"
                      title={user?.phone_number || user?.secondary_phone_number || undefined}
                    >
                      {user?.phone_number || user?.secondary_phone_number || "—"}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Email</dt>
                    <dd className="mt-0.5 font-semibold text-white break-all [overflow-wrap:anywhere]" title={user?.email || undefined}>
                      {user?.email || "—"}
                    </dd>
                  </div>
                </div>
              </dl>
              )}
            </div>
          </div>
        </div>

        {false && showsLabStyleDashboard && (
          <Card className="mb-10 overflow-hidden rounded-2xl border-border/60 shadow-lg shadow-teal-950/[0.06] dark:shadow-none">
            <CardHeader className="relative border-b border-border/60 bg-gradient-to-br from-teal-700/[0.08] via-background to-background pb-6 pt-6 sm:pt-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">
                    <Layout className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Lab dashboard</CardTitle>
                    <CardDescription className="text-sm leading-relaxed max-w-xl">
                      Counts, queues, and weekly schedules for{" "}
                      {isOicUser ? "equipment you manage as OIC" : "your equipment"}
                      {(labOperatorDash?.equipment_summaries ?? []).length > 1
                        ? ". Use the instrument selector to focus metrics and the week view on one machine."
                        : "."}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
                  {labOperatorDash && (labOperatorDash.equipment_summaries ?? []).length > 1 && (
                    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[14rem]">
                      <Label
                        htmlFor="lab-dash-equipment-scope"
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Instrument
                      </Label>
                      <Select
                        value={labDashEquipmentFilter === "all" ? "all" : String(labDashEquipmentFilter)}
                        onValueChange={(v) => {
                          if (v === "all") setLabDashEquipmentFilter("all");
                          else setLabDashEquipmentFilter(Number(v));
                        }}
                      >
                        <SelectTrigger id="lab-dash-equipment-scope" className="h-10 w-full bg-background/80">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All assigned instruments</SelectItem>
                          {(labOperatorDash.equipment_summaries ?? []).map((eq) => (
                            <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                              {eq.equipment_code ? `${eq.equipment_code} · ${eq.equipment_name}` : eq.equipment_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="shrink-0 bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 sm:self-end"
                    size="sm"
                    onClick={() => navigate("/booking-management")}
                  >
                    Booking management
                    <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-10 p-6 sm:p-8">
              {labOperatorDashLoading && !labOperatorDash ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
                  <p className="text-sm font-medium">Loading lab dashboard…</p>
                </div>
              ) : labOperatorDash ? (
                <>
                  <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label
                        htmlFor="lab-dash-period"
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Booking overview and follow-up range
                      </Label>
                      <Select
                        value={labDashPeriod}
                        onValueChange={(v) => {
                          const p = v as LabDashPeriod;
                          setLabDashPeriod(p);
                          if (p === "custom") {
                            const d = format(new Date(), "yyyy-MM-dd");
                            setLabDashCustomFrom((f) => f || d);
                            setLabDashCustomTo((t) => t || d);
                          }
                        }}
                      >
                        <SelectTrigger id="lab-dash-period" className="h-10 w-full max-w-xs">
                          <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">Weekly (same as calendar week)</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                          <SelectItem value="custom">Custom dates</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {labDashPeriod === "custom" && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="lab-dash-from" className="text-xs">
                            From
                          </Label>
                          <Input
                            id="lab-dash-from"
                            type="date"
                            className="w-[11rem]"
                            value={labDashCustomFrom}
                            onChange={(e) => setLabDashCustomFrom(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="lab-dash-to" className="text-xs">
                            To
                          </Label>
                          <Input
                            id="lab-dash-to"
                            type="date"
                            className="w-[11rem]"
                            value={labDashCustomTo}
                            onChange={(e) => setLabDashCustomTo(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs tabular-nums text-muted-foreground lg:text-right">
                      Applied: {format(parseISO(labOperatorDash.filter_date_start), "MMM d, yyyy")} –{" "}
                      {format(parseISO(labOperatorDash.filter_date_end), "MMM d, yyyy")}
                    </p>
                  </div>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Booking overview
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Click <span className="font-medium text-foreground">Pending (booked)</span> or{" "}
                      <span className="font-medium text-foreground">Completed</span> to open that list. Click a booking
                      ID to view details below (same page).
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "overall" ? "ring-2 ring-teal-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "overall" ? "rotate-180" : ""}`}
                        />
                        <CalendarDays className="pointer-events-none absolute right-10 top-3 h-10 w-10 text-teal-500/[0.12] transition-opacity group-hover:text-teal-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          Overall Booking Pending
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-teal-700 dark:text-teal-300">
                          {labOperatorDash.overall_booking_booked_total}/{labOperatorDash.overall_booking_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Booked / total
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "BOOKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-teal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "BOOKED"
                                ? "border-teal-500/50 bg-teal-500/[0.06] ring-1 ring-teal-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                              {labOperatorDash.overall_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "COMPLETED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.overall_booking_completed}
                            </p>
                          </button>
                        </div>
                        <p className="mt-3 text-[11px] font-normal text-muted-foreground/90">
                          Total = booked + completed in range
                        </p>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "external" ? "ring-2 ring-cyan-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "external" ? "rotate-180" : ""}`}
                        />
                        <Globe2 className="pointer-events-none absolute right-10 top-3 h-10 w-10 text-cyan-500/[0.12] group-hover:text-cyan-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          External bookings
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-cyan-700 dark:text-cyan-300">
                          {labOperatorDash.external_booking_booked_total}/{labOperatorDash.external_booking_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Booked / total
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "BOOKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "BOOKED"
                                ? "border-cyan-500/50 bg-cyan-500/[0.06] ring-1 ring-cyan-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
                              {labOperatorDash.external_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "COMPLETED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.external_booking_completed}
                            </p>
                          </button>
                        </div>
                        <p className="mt-3 text-[11px] font-normal text-muted-foreground/90">
                          External users · total = booked + completed in range
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Follow-up queues
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Click <span className="font-medium text-foreground">Available</span> or{" "}
                      <span className="font-medium text-foreground">Done</span> (already marked) for each queue.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "not_util" ? "ring-2 ring-amber-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "not_util" ? "rotate-180" : ""}`}
                        />
                        <AlertCircle className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-amber-500/[0.12] group-hover:text-amber-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Booking available to be marked as not utilized
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">
                          {labOperatorDash.not_utilized_available_total}/
                          {labOperatorDash.not_utilized_available_total + labOperatorDash.not_utilized_marked_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already marked)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-amber-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "AVAILABLE"
                                ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                              {labOperatorDash.not_utilized_available_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "MARKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "MARKED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Marked
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.not_utilized_marked_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "sample_return" ? "ring-2 ring-teal-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "sample_return" ? "rotate-180" : ""}`}
                        />
                        <PackageOpen className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-teal-500/[0.12] group-hover:text-teal-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample pickup (completed bookings)
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-teal-700 dark:text-teal-300">
                          {labOperatorDash.sample_available_to_return_total}/
                          {labOperatorDash.sample_available_to_return_total + labOperatorDash.sample_returned_done_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Awaiting return / total (awaiting + already returned)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-teal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "AVAILABLE"
                                ? "border-teal-500/50 bg-teal-500/[0.06] ring-1 ring-teal-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Awaiting return
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                              {labOperatorDash.sample_available_to_return_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "RETURNED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "RETURNED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Returned
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.sample_returned_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "dispose" ? "ring-2 ring-rose-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "dispose" ? "rotate-180" : ""}`}
                        />
                        <Archive className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-rose-500/[0.12] group-hover:text-rose-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample Available to be Disposed
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-rose-700 dark:text-rose-300">
                          {labOperatorDash.sample_available_to_dispose_total}/
                          {labOperatorDash.sample_available_to_dispose_total + labOperatorDash.sample_disposed_done_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already disposed)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-rose-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "AVAILABLE"
                                ? "border-rose-500/50 bg-rose-500/[0.06] ring-1 ring-rose-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                              {labOperatorDash.sample_available_to_dispose_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "DISPOSED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "DISPOSED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Disposed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.sample_disposed_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {labDashPanel && (
                    <div
                      ref={labDashPanelListRef}
                      id="lab-dash-panel-list"
                      className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm scroll-mt-24"
                    >
                      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                        <p className="text-sm font-semibold">{labDashPanelTitle(labDashPanel)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {labDashPanel.key === "overall" || labDashPanel.key === "external"
                            ? "Up to 400 rows · Click a booking ID for details below"
                            : "Up to 100 rows · Click a booking ID for details below"}
                        </p>
                      </div>
                      <div className="overflow-x-auto p-2 sm:p-4">
                        {(() => {
                          const rows = labDashPanelRows(labOperatorDash, labDashPanel);
                          if (rows.length === 0) {
                            return (
                              <p className="py-8 text-center text-sm text-muted-foreground">No rows for this view.</p>
                            );
                          }
                          return (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  <TableHead className="font-semibold whitespace-nowrap">Booking ID</TableHead>
                                  <TableHead className="font-semibold">Equipment</TableHead>
                                  <TableHead className="font-semibold">User</TableHead>
                                  <TableHead className="font-semibold">Status</TableHead>
                                  <TableHead className="font-semibold whitespace-nowrap">Start</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row) => (
                                  <TableRow key={`${labDashPanel.key}-${labDashPanel.segment}-${row.booking_id}`}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => selectLabBookingForDetail(row.booking_id)}
                                        className={`inline-flex items-center gap-1.5 rounded font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                          String(row.status).toUpperCase() === "COMPLETED"
                                            ? "text-green-600 hover:text-green-700 dark:text-green-500"
                                            : "text-primary hover:text-primary/80"
                                        }`}
                                      >
                                        {row.virtual_booking_id || row.booking_ref}
                                      </button>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={row.equipment_name}>
                                      {row.equipment_name}
                                    </TableCell>
                                    <TableCell className="max-w-[160px] truncate">{row.user_name || "—"}</TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                      {row.status_display || row.status}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                                      {row.start_time
                                        ? format(parseISO(row.start_time), "MMM d, yyyy h:mm a")
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <section className="space-y-4">
                    {!labWeekCalendarExpanded ? (
                      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Calendar className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground">Week calendar</h3>
                            <p className="text-xs text-muted-foreground">
                              Slot grids load when expanded. Week shown:{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {format(parseISO(labOperatorDash.week_start), "MMM d")} –{" "}
                                {format(parseISO(labOperatorDash.week_end), "MMM d, yyyy")}
                              </span>
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 shrink-0 gap-2 self-stretch sm:self-center border-dashed"
                          onClick={() => setLabWeekCalendarExpanded(true)}
                        >
                          <ChevronDown className="h-4 w-4 opacity-80" />
                          Expand week calendar
                        </Button>
                      </div>
                    ) : (
                      <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                        </span>
                        Week calendar
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 shrink-0"
                        onClick={() => setLabWeekCalendarExpanded(false)}
                      >
                        <ChevronUp className="h-4 w-4 opacity-80" />
                        Minimize
                      </Button>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-muted/50 to-muted/20 dark:from-muted/20 dark:to-background p-4 sm:p-6 min-h-[min(520px,70vh)]">
                      {(labOperatorDashLoading || labSlotsLoading) && (
                        <div
                          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/95 dark:bg-background/95 backdrop-blur-sm px-6 py-10"
                          aria-busy="true"
                          aria-live="polite"
                        >
                          <Loader2 className="h-10 w-10 animate-spin text-primary shrink-0" />
                          <p className="text-sm font-medium text-foreground text-center max-w-md">
                            Loading slot availability for this week…
                          </p>
                          <Progress
                            value={100}
                            className="h-2 w-full max-w-md [&>div]:w-full [&>div]:animate-pulse [&>div]:origin-left"
                          />
                        </div>
                      )}
                      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center justify-center gap-1 rounded-full border border-border/80 bg-background/80 px-1 py-1 shadow-sm sm:order-2 sm:flex-1 sm:justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-full px-3"
                            onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, -7))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="min-w-[10rem] text-center text-sm font-semibold tabular-nums sm:min-w-[12rem]">
                            {format(parseISO(labOperatorDash.week_start), "MMM d")} –{" "}
                            {format(parseISO(labOperatorDash.week_end), "MMM d, yyyy")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-full px-3"
                            onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, 7))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:order-1 sm:justify-start">
                          <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5">
                            <Switch
                              id="lab-calendar-booked-only"
                              checked={labCalendarBookedOnly}
                              onCheckedChange={setLabCalendarBookedOnly}
                            />
                            <Label htmlFor="lab-calendar-booked-only" className="cursor-pointer text-sm font-medium">
                              Booked slots only
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setLabOperatorWeekStart(null)}
                            className="h-9 gap-1.5 rounded-full border-dashed"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Reset to current week
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-10">
                        {labEquipmentSummariesForScope.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            {isOicUser
                              ? "No equipment assigned to your OIC account."
                              : "No equipment assigned to your operator account."}
                          </p>
                        ) : (
                          labEquipmentSummariesForScope.map((eq) => (
                            <LabOperatorWeekCalendarGrid
                              key={eq.equipment_id}
                              weekStartIso={labOperatorDash.week_start}
                              equipmentTitle={`${eq.equipment_code} · ${eq.equipment_name}`}
                              slotsPayload={labSlotByEquipment[eq.equipment_id] ?? null}
                              onBookedSlotClick={selectLabBookingForDetail}
                              bookedSlotsOnly={labCalendarBookedOnly}
                            />
                          ))
                        )}
                      </div>
                    </div>
                      </>
                    )}
                  </section>

                  {(isLabInchargeUser || isOicUser || isAdmin) && (
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Team calendar</p>
                          <p className="text-xs text-muted-foreground">
                            View department-wide operator leave schedule for planning and reassignment.
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="bg-teal-700 text-white hover:bg-teal-800 shrink-0"
                          onClick={() => navigate("/team-calendar")}
                        >
                          Open team calendar
                          <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {labDashSelectedBookingId != null && (
                    <div
                      id="lab-booking-detail-section"
                      className="mt-8 scroll-mt-8 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6"
                    >
                      {labDashDetailLoading ? (
                        <Card className="border shadow-sm">
                          <CardContent className="py-12">
                            <div className="flex items-center justify-center gap-3 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <span>Loading booking details…</span>
                            </div>
                          </CardContent>
                        </Card>
                      ) : labDashDetailBooking ? (
                        <BookingDetailCard
                          booking={labDashDetailBooking}
                          onClose={clearLabBookingDetail}
                          onUpdated={refreshLabOperatorHome}
                          isOperator={isLabInchargeUser}
                          isManagerOrAdmin={isOicUser || isAdmin}
                          currentUserType={userTypeStr}
                          currentUserId={user?.id}
                          backLabel="Back to dashboard"
                          showPrintButton
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Could not load this booking.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6">Could not load lab dashboard.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending rating prompt for bookable end-users only (not staff / Dept Admin / Account In-charge) */}
        {!isOperatorOrManager && !isDeptAdmin && !isAccountsInChargeUser && pendingRatingBookings.length > 0 && (
          <Card className="dashboard-notice-card dashboard-notice-warning mb-8 border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 shadow-md">
            <CardContent className="py-5 px-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-700 dark:text-teal-400">
                  <Star className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    You have {pendingRatingBookings.length} completed booking{pendingRatingBookings.length !== 1 ? "s" : ""} pending your rating
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Please submit your rating and feedback so we can improve our service.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/my-bookings?pending_rating=1")}
                  className="bg-teal-700 hover:bg-teal-800 text-white shrink-0"
                >
                  Submit rating
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="dashboard-section-title text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
          {isAdmin ? "Quick access" : "Get started"}
        </p>

        {isAccountsInChargeUser ? (
        <div className="dashboard-uniform-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800 h-full"
            onClick={() => navigate("/admin-settings/wallet-recharge-requests")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                  <Banknote className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Wallet Recharge Requests</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Review received recharge requests and approve them
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                Review &amp; approve
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800 h-full"
            onClick={() => navigate("/my-bookings")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                  <Globe2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External Booking Requests</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Manage external sample bookings (hold and forward to laboratory)
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">
                Manage external bookings
              </Button>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
            onClick={() => { window.location.href = `${window.location.origin}/reports`; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `${window.location.origin}/reports`; } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Reports</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    View booking and financial reports
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white ring-offset-background transition-colors">
                View Reports
              </span>
            </CardContent>
          </Card>
        </div>
        ) : (
        <div className={`dashboard-uniform-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isAdmin ? "gap-8" : "gap-6"}`}>
          {isLabInchargeUser && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800 h-full"
              onClick={() => navigate("/leave-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Operator Availability</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Intimate periods when you are unavailable for equipment operations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/leave-management");
                  }}
                >
                  Intimate Unavailability
                </Button>
              </CardContent>
            </Card>
          )}
          {canSeeOicLeaveManagement && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800 h-full"
              onClick={() => navigate("/oic-leave-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Leave Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review operator leave / unavailability intimations and apply for self
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/oic-leave-management");
                  }}
                >
                  Open leave management
                </Button>
              </CardContent>
            </Card>
          )}
          {isAdmin && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800 h-full"
              onClick={() => navigate("/team-calendar")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Team Calendar</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Department operator leave schedule
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/team-calendar");
                  }}
                >
                  Open calendar
                </Button>
              </CardContent>
            </Card>
          )}
          {!isLabInchargeUser && (<Card 
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800 h-full"
            onClick={() => { window.location.href = `${window.location.origin}/equipments`; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `${window.location.origin}/equipments`; } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Book Equipment</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Browse and book available laboratory equipment
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-teal-700 hover:bg-teal-800 text-white ring-offset-background transition-colors">
                Browse Equipment
              </span>
            </CardContent>
          </Card>)}

          {!isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/my-bookings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">View Bookings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Check your current and past bookings
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">View Bookings</Button>
              </CardContent>
            </Card>
          )}

          {!isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/proforma-invoice")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Proforma Invoice</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Get cost estimate for equipments and samples/slots before booking
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Proforma Invoice</Button>
              </CardContent>
            </Card>
          )}

          {!isOperatorOrManager && showWalletOption && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => navigate("/wallet")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {hasWallet ? `Balance: ₹${walletBalance.toFixed(2)} · View transactions and recharge` : "Request access or manage your wallet"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                  {hasWallet ? "Open Wallet" : "Wallet"}
                </Button>
              </CardContent>
            </Card>
          )}

          {showFacultyUrgentWalletCard && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => navigate("/urgent-requests-wallet")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Urgent booking requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review and approve urgent booking requests from students under your supervision
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-rose-500 to-red-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingFacultyUrgentCount ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : facultyUrgentPendingCount > 0 ? (
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    {facultyUrgentPendingCount} pending request{facultyUrgentPendingCount !== 1 ? "s" : ""}
                  </p>
                ) : null}
                <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white">Manage urgent requests</Button>
              </CardContent>
            </Card>
          )}

          {(userTypeStr === "student" || userTypeStr === "individual_student") && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => navigate("/my-urgent-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Urgent booking request</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Submit an urgent request or view the status of your submitted requests
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingMyUrgentCount ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : myUrgentRequestsCount > 0 ? (
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {myUrgentRequestsCount} request{myUrgentRequestsCount !== 1 ? "s" : ""} submitted
                  </p>
                ) : null}
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={(e) => { e.stopPropagation(); navigate("/my-urgent-requests"); }}>
                  Open urgent booking request
                </Button>
              </CardContent>
            </Card>
          )}

          {(userTypeStr === "student" || userTypeStr === "individual_student") && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/my-nomination-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Nomination requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manage TA/equipment operating nominations and submit your resume for review
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Manage nomination requests</Button>
              </CardContent>
            </Card>
          )}

          {(userTypeStr === "faculty" || userTypeStr === "student" || userTypeStr === "individual_student") &&
            userGuide && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openGuide({ force: true })}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">User Guide</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Step-by-step guide for using the booking portal
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGuide({ force: true });
                  }}
                >
                  Open user guide
                </Button>
              </CardContent>
            </Card>
          )}

          {userTypeStr === "faculty" && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/student-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Student Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Students for whom you are the supervisor
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={(e) => { e.stopPropagation(); navigate("/student-management"); }}
                >
                  View students
                </Button>
              </CardContent>
            </Card>
          )}


          <Card 
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
            onClick={() => { window.location.href = `${window.location.origin}/reports`; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `${window.location.origin}/reports`; } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Reports</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    View your booking history and statistics
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white ring-offset-background transition-colors">
                View Reports
              </span>
            </CardContent>
          </Card>

          {!isLabInchargeUser && (<Card 
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
            onClick={() => setFeedbackOpen(true)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                  <Star className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Rate Your Experience</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                      Rate the portal, ease of booking, and share suggestions — you can update anytime
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
            </CardHeader>
            <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Give Feedback</Button>
            </CardContent>
          </Card>)}

          {isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/booking-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Booking Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manage all bookings as operator or manager
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Manage Bookings</Button>
              </CardContent>
            </Card>
          )}

          {isOperatorOrManager && !isLabInchargeUser && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => navigate("/urgent-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Urgent requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review and approve or reject urgent booking requests
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-rose-500 to-red-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingUrgentCount ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : urgentRequestsPendingCount > 0 ? (
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    {urgentRequestsPendingCount} pending request{urgentRequestsPendingCount !== 1 ? "s" : ""}
                  </p>
                ) : null}
                <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white">Manage urgent requests</Button>
              </CardContent>
            </Card>
          )}

          {canSeeOicTaNomination && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/ta-nomination-call")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA nomination call</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Initiate a request for faculty to nominate students to operate an equipment (semester-wise)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Initiate TA nomination call</Button>
              </CardContent>
            </Card>
          )}

          {canSeeTaDutyAssignmentsCard && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/ta-assignments")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA duty assignments</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Allocate TA duties and track assignment-to-reward workflow
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                  Open TA assignments
                </Button>
              </CardContent>
            </Card>
          )}

          {canSeeOicRewardConfig && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/admin-settings/rewards")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-cyan-800 text-white shadow-lg">
                    <Star className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Reward config
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Per equipment</Badge>
                    </CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Configure TA reward earning and redemption policy per equipment
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-700 to-cyan-700 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open reward settings</Button>
              </CardContent>
            </Card>
          )}

          {(isAdmin || isOicUser) && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-cyan-200 dark:hover:border-cyan-800"
              onClick={() => navigate("/oic/accessories")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Accessories</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Enable or disable equipment accessories and additional accessories
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">Manage accessories</Button>
              </CardContent>
            </Card>
          )}

          {(isAdmin || isOicUser) && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/oic/print-materials")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <PackageOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">3D Print Materials</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Add, edit, enable, or disable filament materials for PRINT_3D equipment
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Manage materials</Button>
              </CardContent>
            </Card>
          )}

          {(isAdmin || isOicUser) && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/oic/quota-configurations")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-lg">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Quota Configurations</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Weekly and monthly quotas for equipment groups you manage
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Manage quotas</Button>
              </CardContent>
            </Card>
          )}

          {canSeeOicMultiMode && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/oic/multi-mode")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">
                    <GitBranch className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Multi-Mode Equipment</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Schedule modes and set each mode&apos;s operate days via Change slot status
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Manage modes</Button>
              </CardContent>
            </Card>
          )}

          {canAccessBookingAttemptLog && (!showsLabStyleDashboard || isOicUser) && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => navigate("/booking-attempt-logs")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Booking attempt log</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      View booking submit attempts (success and failure)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">View log</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => navigate("/manage/external-user-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">External User Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Verify external departments/organizations and external users
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Open verification
                </Button>
              </CardContent>
            </Card>
          )}

          {canVerifyExternalOrgs && !isAdmin && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => navigate("/manage/external-user-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">External organization verification</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review KYC and approve or reject external organizations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Open verification
                </Button>
              </CardContent>
            </Card>
          )}

          {canManageDeptRbac && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-800"
              onClick={() =>
                navigate(
                  isAdmin ? "/admin/department-administration" : "/manage/department-administration"
                )
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-slate-700 text-white shadow-lg">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Department Administration</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {isAdmin
                        ? "Manage department staff modules and permission caps"
                        : "Manage OIC, Lab In Charge, Accounts In Charge (department finances), and Faculty Credit Facility"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-slate-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  Open
                </Button>
              </CardContent>
            </Card>
          )}

          {isOrgAdmin && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
              onClick={() => navigate("/organization/users")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-teal-700 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Organization users</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Add and activate members in your external organization
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-slate-600 to-teal-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-slate-700 hover:bg-slate-800 text-white">
                  Manage members
                </Button>
              </CardContent>
            </Card>
          )}

          {canAccessBookingAttemptLog && (!showsLabStyleDashboard || isOicUser) && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => navigate("/equipment-waitlist")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment waitlist</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      View and clear waitlist queue per equipment; notify when slots free
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">View waitlist</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/equipment-lifecycle")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment lifecycle &amp; expenses</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Purchase, warranty, AMC, expenses, accessories, write-off workflow
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Open lifecycle hub</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => navigate("/procurement-workflow")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Procurement Workflow</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Office verification, store approval, head approval and purchase closure
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">Open procurement flow</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-lime-200 dark:hover:border-lime-800"
              onClick={() => navigate("/inventory-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-emerald-600 text-white shadow-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Inventory Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manage item requests, stock transactions, and issued assets
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-lime-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-lime-600 hover:bg-lime-700 text-white">Open inventory tools</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card 
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-pink-200 dark:hover:border-pink-800"
              onClick={() => navigate("/content-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg">
                    <Layout className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Content Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Menu, pages, home content and hero images (CMS)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white">Manage content</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/admin-settings/support")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                    <LifeBuoy className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Support Tickets</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review tickets, attachments, comments; mark resolved and notify users
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open tickets</Button>
              </CardContent>
            </Card>
          )}

          {isDeptAdmin && (
            <Card className="overflow-hidden border-0 shadow-md col-span-full sm:col-span-2 lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment addition status</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Track Pending / Approved / Rejected requests for your department
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 mt-3" />
              </CardHeader>
              <CardContent className="space-y-3">
                {daAdditionRequestsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : daAdditionRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No addition requests yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {daAdditionRequests.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="font-medium truncate">
                          {r.code} — {r.name}
                        </span>
                        <Badge variant="outline">{r.status_display || r.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate("/admin/equipment-addition-requests")}
                >
                  View all requests
                </Button>
              </CardContent>
            </Card>
          )}

          {canSeeAdminSettingsCard && (
            <Card 
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-cyan-200 dark:hover:border-cyan-800"
              onClick={() => navigate("/admin-settings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Admin Settings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Equipment, users, groups and wallet management
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">Open settings</Button>
              </CardContent>
            </Card>
          )}


          {isAdmin && (
            <Card 
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => navigate("/calendar-colors")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
                    <Palette className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Calendar colors</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Customize weekly window colors for slot states and holidays
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white">Customize colors</Button>
              </CardContent>
            </Card>
          )}

          {!isLabInchargeUser && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => navigate("/tickets")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <MessageSquarePlus className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Support Tickets</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Report issues, ask the lab, or track support conversations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open Support</Button>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {showsLabStyleDashboard && (
          <Card className="mb-10 overflow-hidden rounded-2xl border-border/60 shadow-lg shadow-teal-950/[0.06] dark:shadow-none">
            <CardHeader className="relative border-b border-border/60 bg-gradient-to-br from-teal-700/[0.08] via-background to-background pb-6 pt-6 sm:pt-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">
                    <Layout className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Lab dashboard</CardTitle>
                    <CardDescription className="text-sm leading-relaxed max-w-xl">
                      Counts, queues, and weekly schedules for{" "}
                      {isOicUser ? "equipment you manage as OIC" : "your equipment"}
                      {(labOperatorDash?.equipment_summaries ?? []).length > 1
                        ? ". Use the instrument selector to focus metrics and the week view on one machine."
                        : "."}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
                  {labOperatorDash && (labOperatorDash.equipment_summaries ?? []).length > 1 && (
                    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[14rem]">
                      <Label
                        htmlFor="lab-dash-equipment-scope"
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Instrument
                      </Label>
                      <Select
                        value={labDashEquipmentFilter === "all" ? "all" : String(labDashEquipmentFilter)}
                        onValueChange={(v) => {
                          if (v === "all") setLabDashEquipmentFilter("all");
                          else setLabDashEquipmentFilter(Number(v));
                        }}
                      >
                        <SelectTrigger id="lab-dash-equipment-scope" className="h-10 w-full bg-background/80">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All assigned instruments</SelectItem>
                          {(labOperatorDash.equipment_summaries ?? []).map((eq) => (
                            <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                              {eq.equipment_code ? `${eq.equipment_code} · ${eq.equipment_name}` : eq.equipment_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="shrink-0 bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 sm:self-end"
                    size="sm"
                    onClick={() => navigate("/booking-management")}
                  >
                    Booking management
                    <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-10 p-6 sm:p-8">
              {labOperatorDashLoading && !labOperatorDash ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
                  <p className="text-sm font-medium">Loading lab dashboard…</p>
                </div>
              ) : labOperatorDash ? (
                <>
                  <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label
                        htmlFor="lab-dash-period"
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Booking overview and follow-up range
                      </Label>
                      <Select
                        value={labDashPeriod}
                        onValueChange={(v) => {
                          const p = v as LabDashPeriod;
                          setLabDashPeriod(p);
                          if (p === "custom") {
                            const d = format(new Date(), "yyyy-MM-dd");
                            setLabDashCustomFrom((f) => f || d);
                            setLabDashCustomTo((t) => t || d);
                          }
                        }}
                      >
                        <SelectTrigger id="lab-dash-period" className="h-10 w-full max-w-xs">
                          <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">Weekly (same as calendar week)</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                          <SelectItem value="custom">Custom dates</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {labDashPeriod === "custom" && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="lab-dash-from" className="text-xs">
                            From
                          </Label>
                          <Input
                            id="lab-dash-from"
                            type="date"
                            className="w-[11rem]"
                            value={labDashCustomFrom}
                            onChange={(e) => setLabDashCustomFrom(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="lab-dash-to" className="text-xs">
                            To
                          </Label>
                          <Input
                            id="lab-dash-to"
                            type="date"
                            className="w-[11rem]"
                            value={labDashCustomTo}
                            onChange={(e) => setLabDashCustomTo(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs tabular-nums text-muted-foreground lg:text-right">
                      Applied: {format(parseISO(labOperatorDash.filter_date_start), "MMM d, yyyy")} –{" "}
                      {format(parseISO(labOperatorDash.filter_date_end), "MMM d, yyyy")}
                    </p>
                  </div>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Booking overview
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Click <span className="font-medium text-foreground">Pending (booked)</span> or{" "}
                      <span className="font-medium text-foreground">Completed</span> to open that list. Click a booking
                      ID to view details below (same page).
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "overall" ? "ring-2 ring-teal-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "overall" ? "rotate-180" : ""}`}
                        />
                        <CalendarDays className="pointer-events-none absolute right-10 top-3 h-10 w-10 text-teal-500/[0.12] transition-opacity group-hover:text-teal-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          Overall Booking Pending
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-teal-700 dark:text-teal-300">
                          {labOperatorDash.overall_booking_booked_total}/{labOperatorDash.overall_booking_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Booked / total
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "BOOKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-teal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "BOOKED"
                                ? "border-teal-500/50 bg-teal-500/[0.06] ring-1 ring-teal-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                              {labOperatorDash.overall_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "COMPLETED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.overall_booking_completed}
                            </p>
                          </button>
                        </div>
                        <p className="mt-3 text-[11px] font-normal text-muted-foreground/90">
                          Total = booked + completed in range
                        </p>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "external" ? "ring-2 ring-cyan-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "external" ? "rotate-180" : ""}`}
                        />
                        <Globe2 className="pointer-events-none absolute right-10 top-3 h-10 w-10 text-cyan-500/[0.12] group-hover:text-cyan-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          External bookings
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-cyan-700 dark:text-cyan-300">
                          {labOperatorDash.external_booking_booked_total}/{labOperatorDash.external_booking_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Booked / total
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "BOOKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "BOOKED"
                                ? "border-cyan-500/50 bg-cyan-500/[0.06] ring-1 ring-cyan-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
                              {labOperatorDash.external_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "COMPLETED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.external_booking_completed}
                            </p>
                          </button>
                        </div>
                        <p className="mt-3 text-[11px] font-normal text-muted-foreground/90">
                          External users · total = booked + completed in range
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Follow-up queues
                    </h3>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Click <span className="font-medium text-foreground">Available</span> or{" "}
                      <span className="font-medium text-foreground">Done</span> (already marked) for each queue.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "not_util" ? "ring-2 ring-amber-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "not_util" ? "rotate-180" : ""}`}
                        />
                        <AlertCircle className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-amber-500/[0.12] group-hover:text-amber-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Booking available to be marked as not utilized
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">
                          {labOperatorDash.not_utilized_available_total}/
                          {labOperatorDash.not_utilized_available_total + labOperatorDash.not_utilized_marked_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already marked)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-amber-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "AVAILABLE"
                                ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                              {labOperatorDash.not_utilized_available_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "MARKED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "MARKED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Marked
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.not_utilized_marked_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "sample_return" ? "ring-2 ring-teal-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "sample_return" ? "rotate-180" : ""}`}
                        />
                        <PackageOpen className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-teal-500/[0.12] group-hover:text-teal-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample pickup (completed bookings)
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-teal-700 dark:text-teal-300">
                          {labOperatorDash.sample_available_to_return_total}/
                          {labOperatorDash.sample_available_to_return_total + labOperatorDash.sample_returned_done_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Awaiting return / total (awaiting + already returned)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-teal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "AVAILABLE"
                                ? "border-teal-500/50 bg-teal-500/[0.06] ring-1 ring-teal-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Awaiting return
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
                              {labOperatorDash.sample_available_to_return_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "RETURNED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "RETURNED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Returned
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.sample_returned_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "dispose" ? "ring-2 ring-rose-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-5 w-5 text-muted-foreground transition-transform ${labDashPanel?.key === "dispose" ? "rotate-180" : ""}`}
                        />
                        <Archive className="pointer-events-none right-8 top-2 h-9 w-9 absolute text-rose-500/[0.12] group-hover:text-rose-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample Available to be Disposed
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-rose-700 dark:text-rose-300">
                          {labOperatorDash.sample_available_to_dispose_total}/
                          {labOperatorDash.sample_available_to_dispose_total + labOperatorDash.sample_disposed_done_total}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already disposed)
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "AVAILABLE" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-rose-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "AVAILABLE"
                                ? "border-rose-500/50 bg-rose-500/[0.06] ring-1 ring-rose-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                              {labOperatorDash.sample_available_to_dispose_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "DISPOSED" })}
                            className={`rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "DISPOSED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Disposed
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground/90">
                              {labOperatorDash.sample_disposed_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {labDashPanel && (
                    <div
                      ref={labDashPanelListRef}
                      id="lab-dash-panel-list"
                      className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm scroll-mt-24"
                    >
                      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                        <p className="text-sm font-semibold">{labDashPanelTitle(labDashPanel)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {labDashPanel.key === "overall" || labDashPanel.key === "external"
                            ? "Up to 400 rows · Click a booking ID for details below"
                            : "Up to 100 rows · Click a booking ID for details below"}
                        </p>
                      </div>
                      <div className="overflow-x-auto p-2 sm:p-4">
                        {(() => {
                          const rows = labDashPanelRows(labOperatorDash, labDashPanel);
                          if (rows.length === 0) {
                            return <p className="py-8 text-center text-sm text-muted-foreground">No rows for this view.</p>;
                          }
                          return (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  <TableHead className="font-semibold whitespace-nowrap">Booking ID</TableHead>
                                  <TableHead className="font-semibold">Equipment</TableHead>
                                  <TableHead className="font-semibold">User</TableHead>
                                  <TableHead className="font-semibold">Status</TableHead>
                                  <TableHead className="font-semibold whitespace-nowrap">Start</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row) => (
                                  <TableRow key={`${labDashPanel.key}-${labDashPanel.segment}-${row.booking_id}`}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => selectLabBookingForDetail(row.booking_id)}
                                        className={`inline-flex items-center gap-1.5 rounded font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                          String(row.status).toUpperCase() === "COMPLETED"
                                            ? "text-green-600 hover:text-green-700 dark:text-green-500"
                                            : "text-primary hover:text-primary/80"
                                        }`}
                                      >
                                        {row.virtual_booking_id || row.booking_ref}
                                      </button>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={row.equipment_name}>
                                      {row.equipment_name}
                                    </TableCell>
                                    <TableCell className="max-w-[160px] truncate">{row.user_name || "—"}</TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                      {row.status_display || row.status}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                                      {row.start_time ? format(parseISO(row.start_time), "MMM d, yyyy h:mm a") : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <section className="space-y-4">
                    {!labWeekCalendarExpanded ? (
                      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Calendar className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground">Week calendar</h3>
                            <p className="text-xs text-muted-foreground">
                              Slot grids load when expanded. Week shown:{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {format(parseISO(labOperatorDash.week_start), "MMM d")} –{" "}
                                {format(parseISO(labOperatorDash.week_end), "MMM d, yyyy")}
                              </span>
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 shrink-0 gap-2 self-stretch sm:self-center border-dashed"
                          onClick={() => setLabWeekCalendarExpanded(true)}
                        >
                          <ChevronDown className="h-4 w-4 opacity-80" />
                          Expand week calendar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                            </span>
                            Week calendar
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0"
                            onClick={() => setLabWeekCalendarExpanded(false)}
                          >
                            Collapse
                          </Button>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5 space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, -7))}
                              >
                                <ChevronLeft className="h-4 w-4 mr-1 opacity-80" />
                                Previous week
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, 7))}
                              >
                                Next week
                                <ChevronRight className="h-4 w-4 ml-1 opacity-80" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9"
                                onClick={() => setLabOperatorWeekStart(null)}
                              >
                                This week
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={labCalendarBookedOnly}
                                  onCheckedChange={(v) => setLabCalendarBookedOnly(Boolean(v))}
                                  id="lab-calendar-booked-only"
                                />
                                <Label htmlFor="lab-calendar-booked-only" className="text-xs">
                                  Booked only
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={() => setLabSlotsRefresh((x) => x + 1)}
                                disabled={labSlotsLoading}
                              >
                                {labSlotsLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Refreshing…
                                  </>
                                ) : (
                                  "Refresh"
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {labEquipmentSummariesForScope.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No equipment in scope.</p>
                            ) : (
                              labEquipmentSummariesForScope.map((eq) => (
                                <LabOperatorWeekCalendarGrid
                                  key={eq.equipment_id}
                                  weekStartIso={labOperatorDash.week_start}
                                  equipmentTitle={`${eq.equipment_code} · ${eq.equipment_name}`}
                                  slotsPayload={labSlotByEquipment[eq.equipment_id] ?? null}
                                  onBookedSlotClick={selectLabBookingForDetail}
                                  bookedSlotsOnly={labCalendarBookedOnly}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </section>

                  {(isLabInchargeUser || isOicUser || isAdmin) && (
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Team calendar</p>
                          <p className="text-xs text-muted-foreground">
                            View department-wide operator leave schedule for planning and reassignment.
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="bg-teal-700 text-white hover:bg-teal-800 shrink-0"
                          onClick={() => navigate("/team-calendar")}
                        >
                          Open team calendar
                          <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {labDashSelectedBookingId != null && (
                    <div
                      id="lab-booking-detail-section"
                      className="mt-8 scroll-mt-8 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6"
                    >
                      {labDashDetailLoading ? (
                        <Card className="border shadow-sm">
                          <CardContent className="py-12">
                            <div className="flex items-center justify-center gap-3 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <span>Loading booking details…</span>
                            </div>
                          </CardContent>
                        </Card>
                      ) : labDashDetailBooking ? (
                        <BookingDetailCard
                          booking={labDashDetailBooking}
                          onClose={clearLabBookingDetail}
                          onUpdated={refreshLabOperatorHome}
                          isOperator={isLabInchargeUser}
                          isManagerOrAdmin={isOicUser || isAdmin}
                          currentUserType={userTypeStr}
                          currentUserId={user?.id}
                          backLabel="Back to dashboard"
                          showPrintButton
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Could not load this booking.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6">Could not load lab dashboard.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upcoming Bookings and Equipment Statistics - Side by Side */}
        {!isOperatorOrManager && !isAccountsInChargeUser && (
          <section className="mt-12 space-y-8">
            <p className="dashboard-section-title text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
              Your activity
            </p>
            <div className="dashboard-uniform-cards grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Bookings Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-teal-500/10 bg-card rounded-2xl">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-teal-500/10 to-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
                        <CardDescription className="text-sm">Your scheduled equipment sessions</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/my-bookings")}
                      className="text-teal-700 hover:text-teal-800 hover:bg-teal-500/10 shrink-0"
                    >
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingBookings ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-9 w-9 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : upcomingBookings.length > 0 ? (
                    <ul className="divide-y divide-border/60">
                      {upcomingBookings.map((booking) => (
                        <li
                          key={booking.booking_id}
                          className="group flex cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => navigate(`/my-bookings?booking=${encodeURIComponent(getBookingKey(booking))}`)}
                        >
                          <div className={`w-1 shrink-0 self-stretch ${getStatusColor(booking.status)} opacity-80`} />
                          <div className="flex-1 min-w-0 py-4 px-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">
                                  {booking.equipment_name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{booking.equipment_code}</p>
                              </div>
                              <Badge className={`${getStatusColor(booking.status)} text-white text-xs shrink-0`}>
                                {booking.status_display}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDateTime(booking.start_time)}
                              </span>
                              <span>{booking.total_hours} hr{booking.total_hours !== 1 ? 's' : ''}</span>
                              {booking.total_charge && (
                                <span className="font-medium text-foreground">₹{Math.round(parseFloat(booking.total_charge))}</span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 text-teal-700 dark:text-teal-400 mb-4">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No upcoming bookings</p>
                      <p className="text-sm text-muted-foreground mt-1">Book equipment to see your sessions here</p>
                      <Button
                        variant="outline"
                        className="mt-5 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:hover:bg-teal-900/20"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse Equipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Equipment Statistics Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-emerald-500/10 bg-card rounded-2xl">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                        <BarChart3 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Equipment Statistics</CardTitle>
                        <CardDescription className="text-sm">Your usage and spending by equipment</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/reports")}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                    >
                      View Report
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingStats ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-9 w-9 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : equipmentStats.length > 0 ? (
                    <ul className="divide-y divide-border/60">
                      {equipmentStats.map((stat, index) => (
                        <li key={stat.equipment_id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">{stat.equipment_name}</p>
                              <p className="text-xs text-muted-foreground">{stat.equipment_code}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bookings</p>
                              <p className="text-lg font-bold text-foreground tabular-nums">{stat.bookingCount}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Hours</p>
                              <p className="text-lg font-bold text-foreground tabular-nums">{stat.totalHours.toFixed(1)}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center border border-emerald-200/50 dark:border-emerald-800/50">
                              <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">Spent</p>
                              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">₹{stat.totalSpent.toFixed(0)}</p>
                            </div>
                          </div>
                          {stat.bookingCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              ~₹{(stat.totalSpent / stat.bookingCount).toFixed(0)} per booking · {(stat.totalHours / stat.bookingCount).toFixed(1)}h avg
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400 mb-4">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No statistics yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Your usage and spending will appear here after bookings</p>
                      <Button
                        variant="outline"
                        className="mt-5 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse Equipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

      </main>
      <PortalFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
};

export default Dashboard;