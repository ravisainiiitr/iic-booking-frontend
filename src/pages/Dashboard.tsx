import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { apiClient, type DashboardMenuLayout } from "@/lib/api";
import { localDateStamp } from "@/lib/localDate";
import { getUserTypeDisplayName, isEndUserBookingType, isExternalBookingUserType } from "@/lib/userTypes";
import { hasRbacPermission } from "@/lib/rbac";
import { formatSampleSummary, type SampleSummary } from "@/lib/sampleCount";
import { formatBookingDateTime } from "@/lib/bookingDates";
import { hasAdminPanelAccess } from "@/lib/adminPanelAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, FileText, Package, Settings, Clock, ArrowRight, BarChart3, TrendingUp, Layout, ClipboardList, Star, Palette, Users, Wallet, MessageSquarePlus, User, Mail, Phone, Building2, BadgeCheck, AlertCircle, IdCard, UserCheck, Send, Receipt, Wrench, ChevronRight, ChevronLeft, FolderTree, Layers, CreditCard, Banknote, Loader2, Undo2, Globe2, CalendarDays, PackageOpen, Archive, ChevronDown, ChevronUp, FlaskConical, LifeBuoy, GitBranch, BookOpen, ShieldCheck, Monitor, Server, HardDrive, Download, Megaphone, Menu, LayoutDashboard, FileCheck2, Share2, RotateCcw, ArrowLeft, BookmarkCheck, GraduationCap, Presentation, School, CalendarCheck2, RefreshCw, ToggleRight } from "lucide-react";
import { moduleAvailable } from "@/lib/departmentModulesApi";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { useProcurementAvailability } from "@/pages/procurement/useProcurementAvailability";
import WalletFundReceiptFollowUpAlert from "@/components/wallet/WalletFundReceiptFollowUpAlert";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";
import DashboardHeader from "@/components/DashboardHeader";
import PendingActionsSummary from "@/components/PendingActions/PendingActionsSummary";
import { TemplateAttentionNotice } from "@/components/booking-templates/TemplateAttentionNotice";
import { LoginTipCard } from "@/components/LoginTip/LoginTipCard";
import { pickNextSampleReminder, type SampleDeadlineItem } from "@/lib/loginTips";
import BookingsAwaitingCompletionCard from "@/components/dashboard/BookingsAwaitingCompletionCard";
import {
  BOOKINGS_AWAITING_COMPLETION_KEY,
  showsBookingsAwaitingCompletion,
} from "@/components/dashboard/awaitingCompletion";
import ResultsOverdueCard from "@/components/dashboard/ResultsOverdueCard";
import AndroidAppCard from "@/components/staff-app/AndroidAppCard";
import { useMyResearchAvailability } from "@/components/my-research/useMyResearchAvailability";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { TrainingBadgeChips } from "@/components/training/TrainingBadgeChips";
import DashboardWorkspace from "@/components/DashboardWorkspace";
import ClickableProfileAvatar from "@/components/ClickableProfileAvatar";
import PortalFeedbackDialog from "@/components/PortalFeedbackDialog";
import DepartmentBrochureDialog from "@/components/DepartmentBrochureDialog";
import { formatUserDisplayName, formatWelcomeGreeting } from "@/lib/displayName";
import { BookingDetailCard, type BookingDetailCardBooking } from "@/components/BookingDetailCard";
import { EXTERNAL_BOOKED_COLOR, LabOperatorWeekCalendarGrid } from "@/components/LabOperatorWeekCalendarGrid";
import { NextWeekOpeningCountdown } from "@/components/booking/NextWeekOpeningCountdown";
import { LabCalendarColorConfig } from "@/components/LabCalendarColorConfig";
import {
  LabCalendarSlotActions,
  isDashboardSelectableSlot,
  type LabCalendarSlotApplyOptions,
  type LabCalendarSlotOperation,
} from "@/components/dashboard/LabCalendarSlotActions";
import {
  mergeDisruptionEvents,
  useDisruptionPrompt,
  type DisruptionPromptOutcome,
} from "@/components/disruptions/useDisruptionPrompt";
import {
  canViewDisruptions,
  DISRUPTIONS_CHANGED_EVENT,
  dismissDisruptionBanner,
  isDisruptionBannerDismissed,
  type DisruptionAttention,
  type DisruptionEventIds,
} from "@/lib/disruptions";
import { DisruptionAttentionBanner } from "@/components/disruptions/DisruptionAttentionBanner";
import { slotOperationLabel } from "@/lib/slotOperations";
import type { LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";
import { slotCalendarLegend, slotCalendarPalette } from "@/lib/slotCalendarDisplay";
import { SlotCalendarLegend } from "@/components/slot-calendar/SlotWeekGrid";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DateInput } from "@/components/ui/date-input";
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
import { DashboardMenuTree, type DashboardMenuEntry } from "@/components/dashboard/DashboardMenuTree";
import { activateOnEnterOrSpace } from "@/components/dashboard/menuItemA11y";
import {
  LAB_OPERATOR_DASHBOARD_MENU_ORDER,
  facultyDashboardMenuOrder,
  normalizeMenuLayout,
  sectionMenuOrder,
} from "@/components/dashboard/dashboardMenuLayout";
import { ADMIN_MENU_SECTIONS } from "@/components/dashboard/adminMenuSections";
import { useWorkspaceTitleOverride } from "@/lib/workspaceTitle";
import { useWorkspaceResume } from "@/lib/workspaceResume";
import { useRememberedOpen } from "@/lib/rememberedOpen";
import { WorkspaceChromeProvider } from "@/components/WorkspaceHeaderActions";
import { prefetchEquipmentCatalog } from "@/lib/catalogCache";

const ADMIN_MENU_SECTION_ORDER = sectionMenuOrder(ADMIN_MENU_SECTIONS);
const AdminOverview = lazy(() => import("@/components/dashboard/AdminOverview"));

function normalizeMenuPath(path: string): string {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

/** OIC menu order below the Dashboard button; other visible items follow, Admin settings last. */
const OIC_DASHBOARD_MENU_ORDER = [
  "browse_equipment",
  "booking_management",
  "urgent_requests",
  "multi_mode_equipment",
  "change_slot_status",
  "equipment_waitlist",
  "equipment_settings",
  "booking_attempt_log",
  "reports_statistics",
  "accessories",
  "publication_claims",
  "ta_duty_assignments",
  "notice_board_requests",
  "rate_your_experience",
  "support_tickets",
];

/** Workspace header copy; pages hide their own hero when embedded, so this is the only title shown. */
const WORKSPACE_PAGE_META: Record<string, { title: string; description?: string }> = {
  "/booking-management": { title: "View Booking", description: "Review and manage bookings for your equipment." },
  "/urgent-requests": { title: "Urgent Booking", description: "Type B urgent requests (50% surcharge) awaiting your decision." },
  "/multi-mode-equipment": {
    title: "Multi-mode equipment",
    description: "Choose an instrument's modes and plan which mode can be booked on which days.",
  },
  "/equipment-waitlist": { title: "Equipment Waitlist", description: "Users waiting for a slot on your equipment." },
  "/change-slot-status": {
    title: "Change Slot Status",
    description: "Choose the equipment at the top, then mark its slots available, blocked or under maintenance.",
  },
  "/oic/equipment-settings": {
    title: "Equipment Configuration",
    description: "Important instruction, slot visibility, usage quotas, and booking and sample timings for your equipment.",
  },
  "/booking-attempt-logs": { title: "Booking Attempt Log" },
  "/my-booking-attempts": {
    title: "My booking attempts",
    description: "Your unsuccessful booking attempts and why they failed.",
  },
  "/booking-templates": {
    title: "Booking Templates",
    description: "Saved sample details, booking options and preferred slots for quick booking.",
  },
  "/reports": { title: "Reports & Statistics" },
  "/oic/accessories": { title: "Accessories" },
  "/oic/print-materials": { title: "Fabrication Materials" },
  "/publication-claims": { title: "Publication Claims" },
  "/ta-assignments": { title: "TA Duty Assignments" },
  "/ta-nomination-call": { title: "TA Nomination Call" },
  "/rewards": { title: "TA Reward Points", description: "Points earned from TA duties and their redemptions." },
  "/notice-board-requests": { title: "Notice Board Requests" },
  "/repeat-sample-requests": { title: "Repeat Sample Requests" },
  "/tickets": { title: "Support Tickets" },
  "/admin-settings": { title: "Admin Settings" },
  "/admin-settings/feedback": {
    title: "Experience Ratings",
    description: "Ratings and suggestions users shared through “Rate your experience”.",
  },
  "/admin/wallet-ledger": {
    title: "Wallet Ledger",
    description: "Wallet owners, sub-wallet balances and transactions, with manual credit and debit.",
  },
  "/admin-settings/wallet-payment-modes": {
    title: "Wallet Payment Modes",
    description: "Wallet options overall and per department, email recipients, direct wallet recharge and credit caps.",
  },
  "/admin/registration-requests": {
    title: "Registration Requests",
    description: "Self-registrations awaiting approval; IITR requests are approved by the faculty member named.",
  },
  "/registration-approvals": {
    title: "Registration Approvals",
    description: "Confirm users who named you as their IITR supervisor and extend their access.",
  },
  "/calendar-colors": { title: "Calendar Colours" },
  "/leave-management": { title: "Intimate Unavailability" },
  "/oic-leave-management": { title: "OIC Leave Management" },
  "/disruptions": {
    title: "Disruption history",
    description: "Every maintenance, operator absence and other disruption, with reasons, actions taken and service reports.",
  },
  "/equipment-flash-messages": {
    title: "Equipment flash messages",
    description: "Short timed messages at the top of an equipment's page and booking page.",
  },
  "/oic-substitute": {
    title: "OIC Substitute",
    description: "Let another OIC of your department manage your equipment for a period, with a full history.",
  },
  "/admin/legacy-user-sync": {
    title: "Legacy User Sync",
    description: "Map a user to their old booking portal account, test sync, then confirm wallet and booking sync.",
  },
  "/training/nominations": { title: "Training & Demos", description: "Nominate your students for equipment training calls." },
  "/training/demo-requests": { title: "Demonstration Requests", description: "Request equipment demonstrations for your class or group." },
  "/training/oic": { title: "Training Workspace", description: "Demonstration requests, nomination calls, sessions, attendance and certifications." },
  "/training/attendance": { title: "Training Attendance", description: "Mark attendance for training sessions and demonstrations." },
  "/my-trainings": { title: "My Trainings", description: "Your training applications, sessions and certifications." },
  "/training/duty": { title: "Operator Duty", description: "Allocate certified operators fairly, track confirmations and hours operated." },
  "/my-duty": { title: "My Operator Duty", description: "Confirm duty, check in and out, and see your hours." },
  "/admin-settings/training": { title: "Training Policy" },
};

/** Main / Department Administrator title for /urgent-requests (OICs keep "Urgent Booking"). */
const ADMIN_URGENT_REQUESTS_META = {
  title: "Urgent Requests",
  description: "All urgent requests (Type A and Type B) by department and equipment.",
};

function getWorkspacePageMeta(path: string): { title: string; description?: string } | null {
  const clean = (path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return WORKSPACE_PAGE_META[clean] ?? null;
}

function formatWorkspaceTitle(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^(oic|ta|id)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

interface Booking extends BookingRef {
  user: number;
  user_email: string;
  user_name: string;
  equipment: number;
  equipment_code: string;
  equipment_name: string;
  status: string;
  status_display: string;
  /** Stored status, or RESULTS_PENDING / RESULT_OVERDUE (derived by the backend). */
  list_status?: string;
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

/** Normalize role codes / labels for Accounts In Charge detection (API may send code or display text). */
function normalizeRoleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isAccountsInChargeRole(user: {
  user_type?: unknown;
  user_type_display?: unknown;
  user_type_alias?: unknown;
} | null | undefined): boolean {
  const code = normalizeRoleKey(user?.user_type);
  const display = normalizeRoleKey(user?.user_type_display);
  const alias = normalizeRoleKey(user?.user_type_alias);
  const blob = `${code}|${display}|${alias}`;
  return (
    code === "finance" ||
    display === "finance" ||
    blob.includes("finance") ||
    blob.includes("accountsincharge") ||
    blob.includes("accountincharge")
  );
}

const WALLET_BALANCE_CACHE_KEY = "wallet_balance_cache_v2";
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
  sample_summary?: SampleSummary | null;
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

/** Distinct row styling so completed bookings stand out on OIC / Lab Operator dashboards. */
function labDashBookingRowClassName(status: string | undefined): string {
  if (String(status || "").toUpperCase() === "COMPLETED") {
    return "bg-emerald-50/95 hover:bg-emerald-100/95 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/55 border-l-4 border-l-emerald-500";
  }
  return "";
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
  // Sign-in toasts wait until What's New is closed so they never cover its buttons.
  const { hasGuide: userGuide, postLoginBusy } = useUserGuide();

  const handleProfileAvatarUploaded = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showWalletOption, setShowWalletOption] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [sampleDeadlines, setSampleDeadlines] = useState<
    Array<SampleDeadlineItem & { equipment_name: string; remaining_seconds: number; link: string; virtual_booking_id: string }>
  >([]);
  const nextSampleReminder = useMemo(
    () => pickNextSampleReminder(upcomingBookings, sampleDeadlines),
    [upcomingBookings, sampleDeadlines]
  );
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
  /** In-dashboard workspace: open menu destinations on the right without full page switch. */
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState<string>("");
  /** Current in-workspace route (changes when the embedded page navigates internally). */
  const [workspaceCurrentPath, setWorkspaceCurrentPath] = useState<string>("");
  /** Remount MemoryRouter when a menu item opens a new section. */
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [brochureDialogOpen, setBrochureDialogOpen] = useState(false);
  const [urgentRequestsPendingCount, setUrgentRequestsPendingCount] = useState<number>(0);
  const [loadingUrgentCount, setLoadingUrgentCount] = useState(false);
  const [repeatSamplePendingCount, setRepeatSamplePendingCount] = useState<number>(0);
  const [facultyUrgentPendingCount, setFacultyUrgentPendingCount] = useState<number>(0);
  const [loadingFacultyUrgentCount, setLoadingFacultyUrgentCount] = useState(false);
  const [myUrgentRequestsCount, setMyUrgentRequestsCount] = useState<number>(0);
  const [loadingMyUrgentCount, setLoadingMyUrgentCount] = useState(false);
  const [publicationClaimsPendingCount, setPublicationClaimsPendingCount] = useState<number>(0);
  const [loadingPublicationClaimsCount, setLoadingPublicationClaimsCount] = useState(false);
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
  /** Calendar colours the lab changed (live preview before saving); the rest come from the calendar settings. */
  const [labBookingLegendColors, setLabBookingLegendColors] = useState<Record<string, string>>({});
  /** OIC: equipment whose slots this user may change (own and active temporary-OIC equipment), as on Change slot status. */
  const [labManageableEquipmentIds, setLabManageableEquipmentIds] = useState<ReadonlySet<number>>(() => new Set());
  const [labSelectedSlotIds, setLabSelectedSlotIds] = useState<Record<number, number[]>>({});
  const [labSlotActionBusy, setLabSlotActionBusy] = useState(false);
  /** Week slot grid: expanded by default for Lab Operator and OIC (slots load only when expanded). */
  const [labWeekCalendarExpanded, setLabWeekCalendarExpanded] = useState(() =>
    ["operator", "manager"].includes(String(user?.user_type ?? "").toLowerCase())
  );
  const labWeekCalendarRoleDefaultAppliedRef = useRef(false);
  const [labDashSelectedBookingId, setLabDashSelectedBookingId] = useState<number | null>(null);
  const [labDashDetailBooking, setLabDashDetailBooking] = useState<BookingDetailCardBooking | null>(null);
  const [labDashDetailLoading, setLabDashDetailLoading] = useState(false);
  /** Lab dashboard metrics scope: all assigned equipment or one instrument. */
  const [labDashEquipmentFilter, setLabDashEquipmentFilter] = useState<number | "all">("all");

  // Check if user is operator, manager, or admin (for booking management)
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isLabInchargeUser = userTypeStr === "operator";
  /** OIC (manager): keeps extra dashboard tools; lab-style hero + lab dashboard also shown. */
  const isOicUser = userTypeStr === "manager";
  /** Department Account In-charge: focused dashboard only (recharge, external bookings, reports). */
  const isAccountsInChargeUser = isAccountsInChargeRole(user);
  /** Same weekly metrics, instrument hero, and week calendar as Lab Operator. */
  const showsLabStyleDashboard = isLabInchargeUser || isOicUser;
  const [labColorsOpen, setLabColorsOpen] = useRememberedOpen("lab-dash-calendar-colours", user?.id, false);
  /** Collapsed by default for Lab Operators; OICs keep it open until they collapse it. */
  const [labOverviewOpen, setLabOverviewOpen] = useRememberedOpen(
    "lab-dash-booking-overview",
    user?.id,
    !isLabInchargeUser,
  );

  const prefetchBrowseCatalog = useCallback(() => {
    if (!isLabInchargeUser) prefetchEquipmentCatalog(user);
  }, [user, isLabInchargeUser]);

  // Warm "Browse and Book Equipment" once the dashboard's own requests have settled.
  useEffect(() => {
    if (!user?.id || isLabInchargeUser) return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => prefetchBrowseCatalog(), { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetchBrowseCatalog, 1500);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLabInchargeUser]);

  useEffect(() => {
    if (!userTypeStr || labWeekCalendarRoleDefaultAppliedRef.current) return;
    labWeekCalendarRoleDefaultAppliedRef.current = true;
    setLabWeekCalendarExpanded(userTypeStr === "operator" || userTypeStr === "manager");
  }, [userTypeStr]);

  const isOperatorOrManager = 
    userTypeStr === 'operator' || userTypeStr === 'manager' || userTypeStr === 'admin';
  
  // Admin Settings section is visible to Main Admin always, and to other roles only when the
  // Main Administrator has configured Admin Panel access for their user type + department.
  const isAdmin = userTypeStr === 'admin';
  const canSeeAdminSettingsCard =
    !isAccountsInChargeUser && (isAdmin || hasAdminPanelAccess(user));
  const isDeptAdmin = userTypeStr === 'dept_admin';
  const { available: showProcurementAssets } = useProcurementAvailability(Boolean(user));
  const remoteAnalysisAvailable = moduleAvailable(user?.department_modules, "remote_analysis");
  /** Main / Department Administrator: sectioned sidebar and the administration overview on the home page. */
  const usesAdminMenuSections = isAdmin || isDeptAdmin;
  const isExternalRelations = userTypeStr === 'external_relations';
  const isOrgAdmin = userTypeStr === 'org_admin';
  const canManageDeptRbac = isAdmin;
  const canVerifyExternalOrgs = isAdmin || isExternalRelations || hasRbacPermission(user, "external.org.verify");
  const isFacultyUser = userTypeStr === "faculty";
  const isInternalFacultyUser =
    isFacultyUser && String(user?.department_type ?? "").toLowerCase() === "internal";
  const showFacultyUrgentWalletCard = isFacultyUser;
  const canReceiveSharedData =
    userTypeStr === "student" || userTypeStr === "individual_student" || isInternalFacultyUser;
  const { available: myResearchAvailable } = useMyResearchAvailability(Boolean(user) && canReceiveSharedData);
  const { menu: trainingMenu } = useTrainingAvailability(Boolean(user));
  const [newResultsCount, setNewResultsCount] = useState(0);
  useEffect(() => {
    if (!user || isOperatorOrManager) return;
    let cancelled = false;
    apiClient.getResultsInbox().then((res) => {
      if (!cancelled && !res.error && res.data) setNewResultsCount(res.data.new_count);
    });
    return () => {
      cancelled = true;
    };
  }, [user, isOperatorOrManager]);

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
  // Nomination requests and TA duty assignments are dashboard menu entries for OIC and Admin only.
  const canSeeNominationRequestsCard = isAdmin || isOicUser;
  const canSeeTaDutyAssignmentsCard = canSeeOicTaDutyAssignments;

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

  useEffect(() => {
    if (!user?.id || postLoginBusy) return;
    const userTypeLower = String(user.user_type || "").toLowerCase();
    const shouldShowWelcome = userTypeLower === "student" || userTypeLower === "faculty";
    if (!shouldShowWelcome) return;

    const welcomeKey = `dashboard_welcome_shown_${user.id}`;
    if (localStorage.getItem(welcomeKey)) return;

    const displayName = formatUserDisplayName(user);
    if (userTypeLower === "faculty") {
      toast.success(formatWelcomeGreeting(displayName), {
        description: "You are signed in to the Institute Equipment Booking Portal. Please review your dashboard for booking updates and pending actions.",
      });
    } else {
      toast.success(`Welcome ${displayName}!`, {
        description: "Great to have you on the Institute Equipment Booking Portal.",
      });
    }
    localStorage.setItem(welcomeKey, "1");
  }, [user?.id, user?.name, user?.user_type, postLoginBusy]);

  useEffect(() => {
    if (!showWalletLinkPrompt || !user?.id || postLoginBusy) return;
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
  }, [showWalletLinkPrompt, user?.id, navigate, postLoginBusy]);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !user?.id) return;
    let cancelled = false;
    (async () => {
      const res = await apiClient.getApproachingSampleSubmissionDeadlines();
      if (cancelled || res.error || !res.data?.items?.length) return;
      setSampleDeadlines(res.data.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, user?.id]);

  // Sample submission deadline approaching — toast once per login session
  useEffect(() => {
    if (!user?.id || postLoginBusy || sampleDeadlines.length === 0) return;
    for (const item of sampleDeadlines) {
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
  }, [user?.id, postLoginBusy, sampleDeadlines, navigate]);

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    const checkAuthAndLoadData = async () => {
      // Check authentication using AuthContext
      if (!isAuthenticated) {
        // Stored session still being verified: redirecting now bounces signed-in users via /auth.
        if (authLoading) return;
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
        if ((isCurrentUserOperatorOrManager && currentUserTypeStr !== "operator") || currentUserTypeStr === "dept_admin") {
          tasks.push(fetchUrgentRequestsPendingCount().then(() => {}));
        }
        if (isCurrentUserOperatorOrManager) {
          tasks.push(fetchRepeatSamplePendingCount().then(() => {}));
        }
        const facultyDeptInternal =
          String(user?.department_type ?? "").toLowerCase() === "internal";
        if (
          isCurrentUserOperatorOrManager ||
          currentUserTypeStr === "admin" ||
          (currentUserTypeStr === "faculty" && !facultyDeptInternal)
        ) {
          tasks.push(fetchPublicationClaimsPendingCount().then(() => {}));
        }
        if (currentUserTypeStr === "faculty") {
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
    "group relative overflow-hidden text-left rounded-xl border border-border/60 bg-card p-3 shadow-sm ring-1 ring-black/[0.03] transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-md dark:ring-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0";

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
    Promise.all([
      Promise.all(
        summaries.map((eq) =>
          apiClient.getEquipmentSlots(eq.equipment_id, labOperatorDash.week_start, labOperatorDash.week_end, {
            applyWeeklyViewTimeFilter: true,
          })
        )
      ),
      apiClient.getLabDashboardCalendarColors(),
    ])
      .then(([results, prefsRes]) => {
        if (cancelled) return;
        const byEquipment = prefsRes.data?.by_equipment || {};
        const next: Record<number, LabWeekCalendarSlotsPayload> = {};
        summaries.forEach((eq, i) => {
          const res = results[i];
          if (!res.data) return;
          const payload = res.data as LabWeekCalendarSlotsPayload;
          const overrides = byEquipment[String(eq.equipment_id)];
          if (overrides && Object.keys(overrides).length > 0) {
            next[eq.equipment_id] = {
              ...payload,
              calendar_colors: {
                ...(payload.calendar_colors || {}),
                slot_colors: {
                  ...(payload.calendar_colors?.slot_colors || {}),
                  ...overrides,
                },
                holiday_default: payload.calendar_colors?.holiday_default || "",
                saturday_color: payload.calendar_colors?.saturday_color,
                sunday_color: payload.calendar_colors?.sunday_color,
              },
            };
          } else {
            next[eq.equipment_id] = payload;
          }
        });
        setLabSlotByEquipment(next);
        if (typeof labDashEquipmentFilter === "number") {
          const overrides = byEquipment[String(labDashEquipmentFilter)];
          if (overrides) {
            setLabBookingLegendColors((prev) => ({ ...prev, ...overrides }));
          }
        }
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

  const applyLabBookingColors = useCallback((equipmentId: number, slotColors: Record<string, string>) => {
    setLabBookingLegendColors((prev) => ({ ...prev, ...slotColors }));
    setLabSlotByEquipment((prev) => {
      const payload = prev[equipmentId];
      if (!payload) return prev;
      return {
        ...prev,
        [equipmentId]: {
          ...payload,
          calendar_colors: {
            ...(payload.calendar_colors || {}),
            slot_colors: {
              ...(payload.calendar_colors?.slot_colors || {}),
              ...slotColors,
            },
            holiday_default: payload.calendar_colors?.holiday_default || "",
            saturday_color: payload.calendar_colors?.saturday_color,
            sunday_color: payload.calendar_colors?.sunday_color,
          },
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!isOicUser || !labWeekCalendarExpanded) return;
    let cancelled = false;
    apiClient
      .getSlotStatusPicker()
      .then((res) => {
        if (cancelled || res.error || !res.data) return;
        setLabManageableEquipmentIds(new Set(res.data.equipment.map((e) => e.equipment_id)));
      })
      .catch(() => {
        if (!cancelled) setLabManageableEquipmentIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isOicUser, labWeekCalendarExpanded]);

  useEffect(() => {
    setLabSelectedSlotIds({});
  }, [labOperatorDash?.week_start, labDashEquipmentFilter, labCalendarBookedOnly, labWeekCalendarExpanded]);

  const toggleLabSlotSelection = useCallback((equipmentId: number, slotId: number) => {
    setLabSelectedSlotIds((prev) => {
      const current = prev[equipmentId] ?? [];
      const next = current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId];
      return { ...prev, [equipmentId]: next };
    });
  }, []);

  const labSelectedSlotCount = Object.values(labSelectedSlotIds).reduce((n, ids) => n + ids.length, 0);

  const disruptionPrompt = useDisruptionPrompt();
  const askForSlotStatusChange = disruptionPrompt.askForSlotStatusChange;
  const [disruptionAttention, setDisruptionAttention] = useState<DisruptionAttention | null>(null);
  const [disruptionBannerDismissed, setDisruptionBannerDismissed] = useState(() => isDisruptionBannerDismissed());

  useEffect(() => {
    if (!canViewDisruptions(userTypeStr)) {
      setDisruptionAttention(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      apiClient
        .getDisruptionAttention()
        .then((res) => {
          if (!cancelled && !res.error && res.data) setDisruptionAttention(res.data);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener(DISRUPTIONS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(DISRUPTIONS_CHANGED_EVENT, load);
    };
  }, [userTypeStr]);

  const applyLabSlotStatus = useCallback(
    async (status: LabCalendarSlotOperation, options: LabCalendarSlotApplyOptions) => {
      const batches = Object.entries(labSelectedSlotIds).filter(([, ids]) => ids.length > 0);
      if (batches.length === 0) return;
      const summaries = labOperatorDash?.equipment_summaries ?? [];
      let outcome: DisruptionPromptOutcome | null;
      try {
        outcome = await askForSlotStatusChange({
          status,
          statusLabel: slotOperationLabel(status),
          batches: batches.map(([equipmentId, ids]) => ({
            equipmentId: Number(equipmentId),
            equipmentName: summaries.find((e) => e.equipment_id === Number(equipmentId))?.equipment_name ?? null,
            slot_ids: ids,
          })),
          canAttachReport: canViewDisruptions(userTypeStr),
        });
      } catch {
        outcome = null;
      }
      if (outcome === null) return;
      setLabSlotActionBusy(true);
      let updated = 0;
      const failures: string[] = [];
      const events: DisruptionEventIds[] = [];
      for (const [equipmentId, ids] of batches) {
        try {
          const res = await apiClient.adminEquipmentBulkSlotStatus(Number(equipmentId), {
            status,
            slot_ids: ids,
            source: "dashboard_calendar",
            ...outcome.fields,
            ...(status === "BLOCKED" ? { blocked_label: options.blockedLabel } : {}),
            ...(status === "RESERVED_EXTERNAL" && options.externalReference
              ? { external_reference: options.externalReference }
              : {}),
          });
          if (res.error) failures.push(res.error);
          else {
            updated += res.data?.updated ?? ids.length;
            if (res.data?.disruption_events) events.push(res.data.disruption_events);
          }
        } catch (e) {
          failures.push(e instanceof Error ? e.message : "Failed to update slots");
        }
      }
      setLabSlotActionBusy(false);
      if (updated > 0) toast.success(`Updated ${updated} slot${updated === 1 ? "" : "s"}.`);
      if (failures.length > 0) toast.error(failures[0]);
      if (updated > 0) await outcome.afterApply(mergeDisruptionEvents(events));
      setLabSelectedSlotIds({});
      setLabSlotsRefresh((x) => x + 1);
    },
    [labSelectedSlotIds, labOperatorDash?.equipment_summaries, askForSlotStatusChange, userTypeStr],
  );

  const labColorConfigEquipmentId = useMemo(() => {
    if (typeof labDashEquipmentFilter === "number") return labDashEquipmentFilter;
    if (labEquipmentSummariesForScope.length === 1) return labEquipmentSummariesForScope[0].equipment_id;
    return null;
  }, [labDashEquipmentFilter, labEquipmentSummariesForScope]);

  const labColorConfigEquipmentLabel = useMemo(() => {
    if (labColorConfigEquipmentId == null) return undefined;
    const eq =
      labEquipmentSummariesForScope.find((e) => e.equipment_id === labColorConfigEquipmentId) ||
      (labOperatorDash?.equipment_summaries ?? []).find((e) => e.equipment_id === labColorConfigEquipmentId);
    if (!eq) return undefined;
    return eq.equipment_name || eq.equipment_code;
  }, [labColorConfigEquipmentId, labEquipmentSummariesForScope, labOperatorDash?.equipment_summaries]);

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

  const fetchRepeatSamplePendingCount = async () => {
    try {
      const res = await apiClient.listRepeatSampleRequests({ status: "PENDING" });
      setRepeatSamplePendingCount(res.data?.repeat_sample_requests?.length ?? 0);
    } catch {
      setRepeatSamplePendingCount(0);
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

  const fetchPublicationClaimsPendingCount = async () => {
    setLoadingPublicationClaimsCount(true);
    try {
      const res = await apiClient.getPublicationClaimsPendingCount();
      if (res.data && typeof res.data.pending_count === "number") {
        setPublicationClaimsPendingCount(res.data.pending_count);
      } else {
        setPublicationClaimsPendingCount(0);
      }
    } catch {
      setPublicationClaimsPendingCount(0);
    } finally {
      setLoadingPublicationClaimsCount(false);
    }
  };

  const fetchUpcomingBookings = async () => {
    try {
      setLoadingBookings(true);
      const todayStr = localDateStamp();
      
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
      pending: "bg-amber-700",
      results_pending: "bg-amber-700",
      result_overdue: "bg-red-700",
      booked: "bg-brand",
      confirmed: "bg-brand",
      approved: "bg-brand",
      in_progress: "bg-green-700",
      completed: "bg-gray-600",
      cancelled: "bg-red-600",
      rejected: "bg-red-600",
    };
    return colors[statusLower] || "bg-gray-600";
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

  const formatDateTime = (dateString: string | null | undefined) =>
    formatBookingDateTime(dateString, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }, 'en-US');

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

  const openWorkspace = useCallback((to: string, title?: string) => {
    let path = String(to || "").trim();
    if (!path) return;
    if (/^https?:\/\//i.test(path)) {
      try {
        const u = new URL(path);
        path = `${u.pathname}${u.search}`;
      } catch {
        return;
      }
    }
    if (!path.startsWith("/")) path = `/${path}`;
    setMobileMenuOpen(false);
    setWorkspacePath(path);
    setWorkspaceCurrentPath(path.split(/[?#]/)[0]);
    setWorkspaceTitle(title || path.replace(/^\//, "").replace(/[-_/]/g, " "));
    setWorkspaceEpoch((n) => n + 1);
  }, []);

  const closeWorkspace = useCallback(() => {
    setMobileMenuOpen(false);
    setWorkspacePath(null);
    setWorkspaceTitle("");
    setWorkspaceCurrentPath("");
  }, []);

  useWorkspaceResume({ workspacePath, workspaceCurrentPath, workspaceTitle, openWorkspace });

  const workspaceBackRef = useRef<(() => void) | null>(null);
  const workspaceTitleOverride = useWorkspaceTitleOverride();
  const [workspaceCanGoBack, setWorkspaceCanGoBack] = useState(false);
  const [workspaceActionsSlot, setWorkspaceActionsSlot] = useState<HTMLDivElement | null>(null);
  const [workspaceBannerSlot, setWorkspaceBannerSlot] = useState<HTMLDivElement | null>(null);
  const workspaceGoBack = useCallback(() => {
    if (workspaceCanGoBack && workspaceBackRef.current) workspaceBackRef.current();
    else closeWorkspace();
  }, [workspaceCanGoBack, closeWorkspace]);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event?.data?.type === "iic-close-dashboard-embed") {
        closeWorkspace();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const canCustomizeDashboardMenu = isOicUser || isAdmin;
  const [dashboardMenuLayout, setDashboardMenuLayout] = useState<DashboardMenuLayout | null>(null);
  const [hasFabricationEquipment, setHasFabricationEquipment] = useState(false);

  useEffect(() => {
    if (!user?.id || !canCustomizeDashboardMenu) {
      setDashboardMenuLayout(null);
      return;
    }
    let cancelled = false;
    void apiClient.getDashboardMenuLayout().then((res) => {
      if (!cancelled && res.data) setDashboardMenuLayout(normalizeMenuLayout(res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, canCustomizeDashboardMenu]);

  useEffect(() => {
    if (!user?.id || !(isOicUser || isDeptAdmin)) {
      setHasFabricationEquipment(false);
      return;
    }
    let cancelled = false;
    void apiClient.getFabricationMaterialEquipment().then((res) => {
      if (!cancelled) setHasFabricationEquipment(Boolean(res.data?.has_fabrication_equipment));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isOicUser, isDeptAdmin]);

  const saveDashboardMenuLayout = useCallback(async (layout: DashboardMenuLayout) => {
    const res = await apiClient.saveDashboardMenuLayout(layout);
    if (res.error || !res.data) return res.error || "Could not save the menu.";
    setDashboardMenuLayout(normalizeMenuLayout(res.data));
    toast.success("Menu saved");
    return null;
  }, []);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeWorkspacePath = workspaceCurrentPath || workspacePath || "";
  const activeMenuPath = workspacePath ? activeWorkspacePath : null;
  // These pages show their own title with Back beside it, so the workspace header row would repeat them.
  const workspacePageHasOwnTitleRow = /^\/(urgent-requests-wallet|my-urgent-requests)\/?([?#]|$)/.test(activeWorkspacePath);
  const hideWorkspaceHeader = /^\/equipments?(\/|$)/.test(activeWorkspacePath) || workspacePageHasOwnTitleRow;
  const workspaceBackButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={workspaceGoBack}
      aria-label="Go back"
      title={workspaceCanGoBack ? "Back to the previous page" : "Back to the dashboard"}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back
    </Button>
  );
  const workspaceMetaPath =
    getWorkspacePageMeta(workspaceCurrentPath || workspacePath || "") != null
      ? workspaceCurrentPath || workspacePath || ""
      : workspacePath || "";
  const workspaceMeta =
    usesAdminMenuSections && normalizeMenuPath(workspaceMetaPath) === "/urgent-requests"
      ? ADMIN_URGENT_REQUESTS_META
      : getWorkspacePageMeta(workspaceMetaPath);
  const dashboardHomeButton = (
    <Button
      type="button"
      variant={workspacePath ? "outline" : "default"}
      className="w-full justify-start gap-2 font-semibold"
      aria-current={workspacePath ? undefined : "page"}
      onClick={closeWorkspace}
    >
      <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
      Dashboard
    </Button>
  );
  const downloadBrochureButton = isLabInchargeUser ? null : (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/5"
      onClick={() => setBrochureDialogOpen(true)}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      Download brochure
    </Button>
  );

  // Department Administrators also have "View Booking" (/my-bookings); keep the two labels distinct.
  const bookingManagementLabel = isDeptAdmin ? "Manage bookings" : "View Booking";
  /** Admins see every urgent request; OICs keep "Urgent booking" for their Type B decisions. */
  const urgentRequestsLabel = usesAdminMenuSections ? "Urgent Requests" : "Urgent booking";

  const dashboardMenuEntries: DashboardMenuEntry[] = [
    {
      id: "browse_equipment",
      label: "Browse and Book Equipment",
      path: "/equipments",
      visible: Boolean(!isLabInchargeUser),
      render: () => (
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-2 border-primary/45 shadow-md shadow-primary/15 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/70 h-full ring-1 ring-primary/25"
            onPointerEnter={prefetchBrowseCatalog}
            onFocus={prefetchBrowseCatalog}
            onClick={() => { openWorkspace("/equipments"); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWorkspace("/equipments"); } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Browse and Book Equipment</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Browse and book available laboratory equipment
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-brand hover:bg-brand/90 text-white ring-offset-background transition-colors">
                Browse and Book Equipment
              </span>
            </CardContent>
          </Card>
      ),
    },
    {
      id: "operator_availability",
      label: "Intimate Unavailability",
      path: "/leave-management",
      visible: Boolean(isLabInchargeUser),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
              onClick={() => openWorkspace("/leave-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Intimate Unavailability</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Intimate periods when you are unavailable for equipment operations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/leave-management");
                  }}
                >
                  Intimate Unavailability
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "leave_management",
      label: "Leave management",
      path: "/oic-leave-management",
      visible: Boolean(canSeeOicLeaveManagement),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
              onClick={() => openWorkspace("/oic-leave-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Leave management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review operator leave / unavailability intimations and apply for self
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/oic-leave-management");
                  }}
                >
                  Open leave management
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "oic_substitute",
      label: "OIC Substitute",
      path: "/oic-substitute",
      visible: Boolean(isOicUser || isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
              onClick={() => openWorkspace("/oic-substitute")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">OIC Substitute</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {isAdmin
                        ? "All OIC substitutions, their reasons and history"
                        : "Let an OIC of your department manage your equipment while you are away"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/oic-substitute");
                  }}
                >
                  Open OIC Substitute
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "wallet_recharge_requests",
      label: "Wallet recharge requests",
      path: "/admin-settings/wallet-recharge-requests",
      visible: Boolean((isAdmin || isDeptAdmin)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800 h-full"
              onClick={() => openWorkspace("/admin-settings/wallet-recharge-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet recharge requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Complete list — verify physical receipts, user details, and remarks
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/admin-settings/wallet-recharge-requests");
                  }}
                >
                  Open list
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "wallet_payment_modes",
      label: "Wallet payment modes",
      path: "/admin-settings/wallet-payment-modes",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
              onClick={() => openWorkspace("/admin-settings/wallet-payment-modes")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet payment modes</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Wallet options per department, email recipients and direct wallet recharge
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/admin-settings/wallet-payment-modes");
                  }}
                >
                  Manage modes
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "wallet_ledger",
      label: "Wallet ledger",
      path: "/admin/wallet-ledger",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800 h-full"
              onClick={() => openWorkspace("/admin/wallet-ledger")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet ledger</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Wallet owners, balances and transactions — credit or debit a wallet
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-violet-700 hover:bg-violet-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/admin/wallet-ledger");
                  }}
                >
                  Open ledger
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "team_calendar",
      label: "Team calendar",
      path: "/team-calendar",
      visible: Boolean((isAdmin || isDeptAdmin)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
              onClick={() => openWorkspace("/team-calendar")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Team calendar</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Spot department absences at a glance
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/team-calendar");
                  }}
                >
                  Open calendar
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "view_bookings",
      label: "View Booking",
      path: "/my-bookings",
      visible: Boolean(!isOperatorOrManager),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/my-bookings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">View Booking</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Check your current and past bookings
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">View bookings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "booking_templates",
      label: "Booking Templates",
      path: "/booking-templates",
      visible: Boolean(!isOperatorOrManager),
      render: () => (
          <Card
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-cyan-200 dark:hover:border-cyan-800"
              onClick={() => openWorkspace("/booking-templates")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWorkspace("/booking-templates"); } }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-700 text-white shadow-lg">
                    <BookmarkCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Booking Templates</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Saved sample details and preferred slots for one-click booking
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-cyan-500 to-sky-600 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-700 hover:bg-sky-800 text-white">Open templates</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "view_results",
      label: "View results",
      path: "/my-results",
      visible: Boolean(!isOperatorOrManager),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-green-200 dark:hover:border-green-800"
              onClick={() => openWorkspace("/my-results")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">View results</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Download results of your bookings, newest first
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {newResultsCount > 0 ? (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {newResultsCount} new result{newResultsCount !== 1 ? "s" : ""} available
                  </p>
                ) : null}
                <Button className="w-full bg-green-700 hover:bg-green-800 text-white">View results</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "shared_with_me",
      label: "Shared with me",
      path: "/shared-data",
      visible: Boolean(!isOperatorOrManager && canReceiveSharedData && !myResearchAvailable),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/shared-data")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                    <Share2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Shared with me</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Research data shared with you by IIT Roorkee colleagues
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Open shared data</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "my_research",
      label: "My Research",
      path: "/my-research",
      visible: Boolean(!isOperatorOrManager && myResearchAvailable),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => openWorkspace("/my-research")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg">
                    <FlaskConical className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">My Research</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Your projects, research groups, tasks and results shared with you
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Open My Research</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "my_trainings",
      label: "My Trainings",
      path: "/my-trainings",
      visible: trainingMenu("my_trainings"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/my-trainings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">My Trainings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Training applications, upcoming sessions and your equipment certifications
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open My Trainings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "my_duty",
      label: "My operator duty",
      path: "/my-duty",
      visible: trainingMenu("my_duty"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/my-duty")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">My operator duty</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Confirm duty, check in and out, and see the hours you have operated
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open My operator duty</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "urgent_booking_requests",
      label: "Urgent booking requests",
      path: "/urgent-requests-wallet",
      visible: Boolean(showFacultyUrgentWalletCard),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => openWorkspace("/urgent-requests-wallet")}
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
      ),
    },
    {
      id: "urgent_booking_request",
      label: "Urgent booking request",
      path: "/my-urgent-requests",
      visible: Boolean((userTypeStr === "student" || userTypeStr === "individual_student")),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/my-urgent-requests")}
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
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white" onClick={(e) => { e.stopPropagation(); openWorkspace("/my-urgent-requests"); }}>
                  Open urgent booking request
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "proforma_invoice",
      label: "Proforma invoice",
      path: "/proforma-invoice",
      visible: Boolean(!isOperatorOrManager),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/proforma-invoice")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Proforma invoice</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Get cost estimate for equipments and samples/slots before booking
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Proforma invoice</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "wallet_management",
      label: "Wallet management",
      path: "/wallet",
      visible: Boolean(!isOperatorOrManager && showWalletOption),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/wallet")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {hasWallet ? `Balance: ₹${walletBalance.toFixed(2)} · View transactions and recharge` : "Request access or manage your wallet"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">
                  {hasWallet ? "Open Wallet" : "Wallet"}
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "my_publications",
      label: "My publications",
      path: "/my-publications",
      visible: Boolean((userTypeStr === "student" ||
            userTypeStr === "individual_student" ||
            userTypeStr === "faculty" ||
            userTypeStr === "external" ||
            userTypeStr === "rnd" ||
            userTypeStr === "institute" ||
            userTypeStr === "startup_incubated_iitr" ||
            userTypeStr === "external_startup_msme" ||
            userTypeStr === "other") && !myResearchAvailable),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/my-publications")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">My publications</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Submit journal references that used IIC instruments; approved entries appear on equipment Publications
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Open My Publications</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "ta_reward_points",
      label: "TA reward points",
      path: "/rewards",
      visible: Boolean(userTypeStr === "student"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/rewards", "TA Reward Points")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Star className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA reward points</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Points earned from TA duties, their value and redemptions against bookings
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">View reward points</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "nomination_requests",
      label: "Nomination requests",
      path: "/ta-nomination-call",
      visible: canSeeNominationRequestsCard,
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/ta-nomination-call")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Nomination requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review TA/equipment operating nominations and resumes received from students
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Manage nomination requests</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "training_workspace",
      label: "Training workspace",
      path: "/training/oic",
      visible: trainingMenu("training_workspace"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/training/oic")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <School className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Training workspace</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Demonstration requests, nomination calls, sessions, attendance and certifications
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open training workspace</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "operator_duty",
      label: "Operator duty",
      path: "/training/duty",
      visible: trainingMenu("operator_duty"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/training/duty")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <CalendarCheck2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Operator duty</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Allocate certified operators fairly, track confirmations and hours operated live
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open operator duty</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "training_attendance",
      label: "Training attendance",
      path: "/training/attendance",
      visible: trainingMenu("training_attendance"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/training/attendance")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <CalendarCheck2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Training attendance</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Mark attendance for training sessions and demonstrations on your equipment
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Mark attendance</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "ta_duty_assignments",
      label: "TA duty assignments",
      path: "/ta-assignments",
      visible: Boolean(canSeeTaDutyAssignmentsCard),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/ta-assignments")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-emerald-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA duty assignments</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Allocate TA duties and track assignment-to-reward workflow
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary/50 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">
                  Open TA assignments
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "reports_statistics",
      label: "Reports & Statistics",
      path: "/reports",
      visible: Boolean(!isLabInchargeUser),
      render: () => (
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
            onClick={() => { openWorkspace("/reports"); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWorkspace("/reports"); } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Reports &amp; Statistics</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    View your booking history and statistics
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
            </CardHeader>
            <CardContent>
              <span
                data-dashboard-card-action
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white ring-offset-background transition-colors"
              >
                View Reports
              </span>
            </CardContent>
          </Card>
      ),
    },
    {
      id: "user_guide",
      label: "User guide",
      path: "/user-guide",
      visible: Boolean(isEndUserBookingType(userTypeStr) && userGuide),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/user-guide", "User guide")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">User guide</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Step-by-step guide for using the booking portal
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/user-guide", "User guide");
                  }}
                >
                  Open user guide
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "student_management",
      label: "Student management",
      path: "/student-management",
      visible: Boolean(userTypeStr === "faculty"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/student-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Student management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Students for whom you are the supervisor
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-brand hover:bg-brand/90 text-white"
                  onClick={(e) => { e.stopPropagation(); openWorkspace("/student-management"); }}
                >
                  View students
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "training_events",
      label: "Training & Demos",
      path: "/training/nominations",
      visible: trainingMenu("training_events"),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/training/nominations")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Training &amp; Demos</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Nominate students for equipment training and request demonstrations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={(e) => { e.stopPropagation(); openWorkspace("/training/nominations"); }}
                >
                  Nominations
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); openWorkspace("/training/demo-requests"); }}
                >
                  <Presentation className="mr-1.5 h-4 w-4" />
                  Demo requests
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "rate_your_experience",
      label: "Rate your experience",
      visible: Boolean(!isLabInchargeUser),
      render: () => (
          <Card
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
            onClick={() => setFeedbackOpen(true)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                  <Star className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Rate your experience</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                      Rate the portal, ease of booking, and share suggestions — you can update anytime
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
            </CardHeader>
            <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Give Feedback</Button>
            </CardContent>
          </Card>
      ),
    },
    {
      id: "support_tickets",
      label: "Support tickets",
      path: "/tickets",
      // Main Administrator works tickets from the admin queue ("support_tickets_2") instead.
      visible: !isAdmin,
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/tickets")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <MessageSquarePlus className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Support tickets</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Report issues, ask the lab, or track support conversations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open Support</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "booking_management",
      label: bookingManagementLabel,
      path: "/booking-management",
      visible: Boolean((isOperatorOrManager || isDeptAdmin)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/booking-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{bookingManagementLabel}</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manage bookings as Lab Operator, Officer In-charge, Department Administrator, or Admin
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">View Booking</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "urgent_requests",
      label: urgentRequestsLabel,
      path: "/urgent-requests",
      visible: Boolean((isOperatorOrManager && !isLabInchargeUser) || isDeptAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => openWorkspace("/urgent-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{urgentRequestsLabel}</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {usesAdminMenuSections
                        ? "All urgent requests by department and equipment"
                        : "Review and approve or reject urgent booking requests"}
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
      ),
    },
    {
      id: "repeat_sample_requests",
      label: "Repeat samples",
      path: "/repeat-sample-requests",
      visible: Boolean(isOicUser || isAdmin || isDeptAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => openWorkspace("/repeat-sample-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                    <RotateCcw className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Repeat samples</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Complimentary repeat samples arranged for users from their booking
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {repeatSamplePendingCount > 0 ? (
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                    {repeatSamplePendingCount} pending request{repeatSamplePendingCount !== 1 ? "s" : ""}
                  </p>
                ) : null}
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">View repeat samples</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "notice_board_requests",
      label: "Notice board requests",
      path: "/notice-board-requests",
      visible: Boolean((isOicUser || isAdmin)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/notice-board-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Notice board requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Submit notices for approval; complete expiry for equipment unavailability drafts
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">Manage notice requests</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "publication_claims",
      label: "Publication claims",
      path: "/publication-claims",
      visible: Boolean((isAdmin || isOicUser || (isFacultyUser && !isInternalFacultyUser))),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/publication-claims")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Publication claims</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {userTypeStr === "faculty"
                        ? "Review publication claims from your students"
                        : "Review external user-submitted journal references for your instruments"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingPublicationClaimsCount ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : publicationClaimsPendingCount > 0 ? (
                  <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
                    {publicationClaimsPendingCount} pending claim
                    {publicationClaimsPendingCount !== 1 ? "s" : ""}
                  </p>
                ) : null}
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Review publication claims</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "ta_nomination_call",
      label: "TA nomination call",
      path: "/ta-nomination-call",
      visible: Boolean(canSeeOicTaNomination),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/ta-nomination-call")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA nomination call</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Initiate a request for faculty to nominate students to operate an equipment (semester-wise)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Initiate TA nomination call</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "reward_config",
      label: "Reward config",
      path: "/admin-settings/rewards",
      visible: Boolean(canSeeOicRewardConfig),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/admin-settings/rewards")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
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
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open reward settings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "accessories",
      label: "Accessories",
      path: "/oic/accessories",
      visible: Boolean((isAdmin || isOicUser)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/oic/accessories")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Accessories</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Enable or disable equipment accessories and additional accessories
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Manage accessories</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "3d_print_materials",
      label: "Fabrication materials",
      path: "/oic/print-materials",
      visible: Boolean(isAdmin || ((isOicUser || isDeptAdmin) && hasFabricationEquipment)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/oic/print-materials")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <PackageOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Fabrication materials</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      3D print materials, laser cutting sheets, own-material charges and lab notification emails
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Manage materials</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "equipment_settings",
      label: "Equipment Configuration",
      path: "/oic/equipment-settings",
      visible: Boolean(isAdmin || isOicUser),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/oic/equipment-settings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment Configuration</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Important instruction, slot visibility, usage quotas, and booking and sample deadlines
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Manage settings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "multi_mode_equipment",
      label: "Multi-mode equipment",
      path: "/multi-mode-equipment",
      visible: Boolean(canSeeOicMultiMode),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/multi-mode-equipment")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-emerald-600 text-white shadow-lg">
                    <GitBranch className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Multi-mode equipment</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Pick an instrument&apos;s modes and plan which mode runs on which days
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary/50 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Manage modes</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "change_slot_status",
      label: "Change slot status",
      path: "/change-slot-status",
      visible: Boolean(isAdmin || isOicUser),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/change-slot-status")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-emerald-600 text-white shadow-lg">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Change slot status</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {isAdmin
                        ? "Mark slots available, blocked or under maintenance; switch department and equipment at the top"
                        : "Mark slots available, blocked or under maintenance; switch between your equipment at the top"}
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary/50 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "disruption_history",
      label: "Disruption history",
      path: "/disruptions",
      visible: Boolean(isAdmin || isOicUser || isDeptAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-orange-200 dark:hover:border-orange-800"
              onClick={() => openWorkspace("/disruptions")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Disruption history</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Maintenance, operator absence and other disruptions with reasons, actions taken and reports
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {disruptionAttention && disruptionAttention.reason_missing > 0 ? (
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {disruptionAttention.reason_missing} without a reason
                  </p>
                ) : null}
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">Open</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "equipment_flash_messages",
      label: "Equipment flash messages",
      path: "/equipment-flash-messages",
      visible: Boolean(isAdmin || isOicUser || isDeptAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/equipment-flash-messages")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment flash messages</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Short timed messages at the top of an equipment&apos;s page and booking page
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-700 hover:bg-sky-800 text-white">Open</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "booking_attempt_log",
      label: "Booking attempt log",
      path: "/booking-attempt-logs",
      visible: Boolean(canAccessBookingAttemptLog && (!showsLabStyleDashboard || isOicUser)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/booking-attempt-logs")}
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
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">View log</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "registration_requests",
      label: "Registration requests",
      path: "/admin/registration-requests",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/admin/registration-requests")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-brand text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Registration requests</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Approve self-registrations, send IITR requests to the faculty named, and see the full log
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">
                  Review requests
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "external_user_management",
      label: "External user management",
      path: "/manage/external-user-management",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => openWorkspace("/manage/external-user-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">External user management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Verify external departments/organizations and external users
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white">
                  Open verification
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "external_organization_verification",
      label: "External organization verification",
      path: "/manage/external-user-management",
      visible: Boolean(canVerifyExternalOrgs && !isAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => openWorkspace("/manage/external-user-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">External organization verification</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review KYC and approve or reject external organizations
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white">
                  Open verification
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "department_administration",
      label: "Department administration",
      path: isAdmin ? "/admin/department-administration" : "/manage/department-administration",
      visible: Boolean(canManageDeptRbac),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-800"
              onClick={() =>
                openWorkspace(
                  isAdmin ? "/admin/department-administration" : "/manage/department-administration",
                  "Department administration"
                )
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-slate-700 text-white shadow-lg">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Department administration</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {isAdmin
                        ? "Manage department staff modules and permission caps"
                        : "Manage OIC, Lab Operator, Accounts In Charge (department finances), and Faculty Credit Facility"}
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
      ),
    },
    {
      id: "organization_users",
      label: "Organization users",
      path: "/organization/users",
      visible: Boolean(isOrgAdmin),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
              onClick={() => openWorkspace("/organization/users")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-brand text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Organization users</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Add and activate members in your external organization
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-slate-600 to-primary mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-slate-700 hover:bg-slate-800 text-white">
                  Manage members
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "equipment_waitlist",
      label: "Equipment waitlist",
      path: "/equipment-waitlist",
      visible: Boolean(canAccessBookingAttemptLog && (!showsLabStyleDashboard || isOicUser)),
      render: () => (
          <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800"
              onClick={() => openWorkspace("/equipment-waitlist")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment waitlist</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      View and clear waitlist queue per equipment; notify when slots free
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white">View waitlist</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "equipment_lifecycle_expenses",
      label: "Equipment lifecycle & expenses",
      path: "/equipment-lifecycle",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/equipment-lifecycle")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-accent text-white shadow-lg">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Equipment lifecycle &amp; expenses</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Purchase, warranty, AMC, expenses, accessories, write-off workflow
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open lifecycle hub</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "procurement_workflow",
      label: "Procurement workflow",
      path: "/procurement-workflow",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/procurement-workflow")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Procurement workflow</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Office verification, store approval, head approval and purchase closure
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">Open procurement flow</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "procurement_assets",
      label: "Procurement & Assets",
      path: "/procurement",
      visible: showProcurementAssets,
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/procurement")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">
                    <PackageOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Procurement &amp; Assets</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Purchase requests, approvals, small purchases, bills, assets, stock and AMC
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open Procurement &amp; Assets</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "inventory_management",
      label: "Inventory management",
      path: "/inventory-management",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-lime-200 dark:hover:border-lime-800"
              onClick={() => openWorkspace("/inventory-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-emerald-600 text-white shadow-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Inventory management</CardTitle>
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
      ),
    },
    {
      id: "remote_analysis",
      label: "Remote analysis",
      path: "/remote-analysis",
      visible:
        Boolean(isAdmin || isDeptAdmin || isOicUser || hasRbacPermission(user, "remote_analysis.view") || hasRbacPermission(user, "remote_analysis.manage")) &&
        (isAdmin || remoteAnalysisAvailable),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => openWorkspace("/remote-analysis")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Remote analysis</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Workstation registry, catalog, equipment↔software, inventory, and remote commands
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 mt-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Open remote analysis</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWorkspace("/remote-analysis/software-catalog");
                    }}
                  >
                    Software catalog
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWorkspace("/remote-analysis/equipment-software");
                    }}
                  >
                    Eq ↔ Software
                  </Button>
                </div>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "department_sync_agents",
      label: "Department sync agents",
      path: "/department-sync",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/department-sync")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg">
                    <Server className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Department sync agents</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Agents, assignments, profiles, commands, heartbeats, workspaces, and sync logs
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white">Open department sync</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "laboratory_infrastructure",
      label: "Laboratory infrastructure",
      path: "/laboratory-infrastructure",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-teal-200 dark:hover:border-teal-800"
              onClick={() => openWorkspace("/laboratory-infrastructure")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white shadow-lg">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Laboratory infrastructure</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Fleet monitoring, diagnostics, repair, alerts, and lifecycle for DSA, Equipment PCs, and Analysis PCs
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/laboratory-infrastructure");
                  }}
                >
                  Open Fleet Dashboard
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "acceptance_test_dashboard",
      label: "Acceptance test dashboard",
      path: "/test-dashboard",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/test-dashboard")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Acceptance test dashboard</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Phase 2.5 SAT coverage — module health, pass/fail drill-down (Main Admin)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkspace("/test-dashboard");
                  }}
                >
                  Open Test Dashboard
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "deployment_center",
      label: "Deployment center",
      path: "/deployment-center",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => openWorkspace("/deployment-center")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-white shadow-lg">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Deployment center</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      DSA, Remote Analysis Agent, and Equipment PC Wizard — versions, SHA-256, ticket downloads
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                  <Download className="mr-2 h-4 w-4" />
                  Open Deployment Center
                </Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "content_management",
      label: "Content management",
      path: "/content-management",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-pink-200 dark:hover:border-pink-800"
              onClick={() => openWorkspace("/content-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg">
                    <Layout className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Content management</CardTitle>
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
      ),
    },
    {
      id: "support_tickets_2",
      label: "Support tickets",
      path: "/admin-settings/support",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/admin-settings/support")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                    <LifeBuoy className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Support tickets</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Review tickets, attachments, comments; mark resolved and notify users
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open tickets</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "experience_ratings",
      label: "Experience ratings",
      path: "/admin-settings/feedback",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => openWorkspace("/admin-settings/feedback")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Star className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Experience ratings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      View “Rate your experience” ratings and comments shared by users
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">View ratings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "admin_settings",
      label: "Admin settings",
      path: "/admin-settings",
      visible: Boolean(canSeeAdminSettingsCard),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/admin-settings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-accent to-brand text-white shadow-lg">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Admin settings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Equipment, users, groups and wallet management
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-accent to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open settings</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "department_modules",
      label: "Department modules",
      path: "/admin/department-modules",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
              onClick={() => openWorkspace("/admin/department-modules")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-brand text-white shadow-lg">
                    <ToggleRight className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Department modules</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      DSA, Remote Analysis, Training and Procurement per department: on, off or test users only
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-primary/50 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-brand hover:bg-brand/90 text-white">Open department modules</Button>
              </CardContent>
            </Card>
      ),
    },
    {
      id: "calendar_colors",
      label: "Calendar colors",
      path: "/calendar-colors",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-200 dark:hover:border-rose-800"
              onClick={() => openWorkspace("/calendar-colors")}
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
      ),
    },
    {
      id: "legacy_user_sync",
      label: "Legacy user sync",
      path: "/admin/legacy-user-sync",
      visible: Boolean(isAdmin),
      render: () => (
          <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-800"
              onClick={() => openWorkspace("/admin/legacy-user-sync")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                    <Server className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Legacy user sync</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Map a user to the old booking portal, test and sync wallet balance and legacy bookings
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Open legacy sync</Button>
              </CardContent>
            </Card>
      ),
    },
  ];

  const visibleMenuPaths = new Set(
    dashboardMenuEntries.filter((e) => e.visible && e.path).map((e) => normalizeMenuPath(e.path as string)),
  );
  const canOpenMenuPath = (path: string) => visibleMenuPaths.has(normalizeMenuPath(path));
  const showAdminOverview = usesAdminMenuSections && !workspacePath;
  // Dashboard home only, between the page header card and the first section; each renders nothing when empty.
  // The administration overview lists pending actions under its own "Needs attention".
  const loginTip = <LoginTipCard user={user} nextSampleReminder={nextSampleReminder} />;
  const dashboardNotices = (
    <>
      <PendingActionsSummary excludeKeys={[BOOKINGS_AWAITING_COMPLETION_KEY]} />
      {loginTip}
    </>
  );

  const dashboardMenuDefaultOrder = isOicUser
    ? [
        ...OIC_DASHBOARD_MENU_ORDER,
        ...dashboardMenuEntries
          .map((entry) => entry.id)
          .filter((id) => id !== "admin_settings" && !OIC_DASHBOARD_MENU_ORDER.includes(id)),
        "admin_settings",
      ]
    : isFacultyUser
      ? facultyDashboardMenuOrder(dashboardMenuEntries.map((entry) => entry.id))
      : isLabInchargeUser
        ? LAB_OPERATOR_DASHBOARD_MENU_ORDER
        : usesAdminMenuSections
          ? ADMIN_MENU_SECTION_ORDER
          : [];

  const labLegendPayload = labSlotByEquipment[labEquipmentSummariesForScope[0]?.equipment_id ?? -1];
  const labLegendPalette = slotCalendarPalette({
    ...labLegendPayload?.calendar_colors,
    slot_colors: { ...(labLegendPayload?.calendar_colors?.slot_colors || {}), ...labBookingLegendColors },
  });
  const labCalendarLegend = [
    {
      label: "Internal booked",
      color: labLegendPalette.slotColors.BOOKED_INTERNAL || labLegendPalette.slotColors.BOOKED,
    },
    { label: "External booked", color: labLegendPalette.slotColors.BOOKED_EXTERNAL || EXTERNAL_BOOKED_COLOR },
    ...slotCalendarLegend(labLegendPalette).filter((item) => item.label !== "Booked"),
  ];

  /** One set of week controls for the whole calendar, shown beside the first equipment name. */
  const labWeekCalendarControls = labOperatorDash ? (
    <>
      <div
        role="group"
        aria-label="Week"
        className="inline-flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-full rounded-none px-2.5 text-xs"
          onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, -7))}
        >
          <ChevronLeft className="mr-0.5 h-4 w-4 opacity-80" />
          Previous week
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-full rounded-none border-x border-input px-2.5 text-xs"
          onClick={() => setLabOperatorWeekStart(null)}
        >
          This week
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-full rounded-none px-2.5 text-xs"
          onClick={() => setLabOperatorWeekStart(addDaysIso(labOperatorDash.week_start, 7))}
        >
          Next week
          <ChevronRight className="ml-0.5 h-4 w-4 opacity-80" />
        </Button>
      </div>
      <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-sm">
        <Switch
          id="lab-calendar-booked-only"
          checked={labCalendarBookedOnly}
          onCheckedChange={(v) => setLabCalendarBookedOnly(Boolean(v))}
        />
        <Label htmlFor="lab-calendar-booked-only" className="cursor-pointer text-xs">
          Booked only
        </Label>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => setLabSlotsRefresh((x) => x + 1)}
        disabled={labSlotsLoading}
      >
        {labSlotsLoading ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-3.5 w-3.5 opacity-80" />
        )}
        {labSlotsLoading ? "Refreshing…" : "Refresh"}
      </Button>
    </>
  ) : null;

  const renderDashboardMenu = () => (
    <>
        {dashboardHomeButton}
        {isAccountsInChargeUser ? (
        <>
        <div className="dashboard-uniform-cards flex flex-col gap-2">
          <Card
            role="button"
            tabIndex={0}
            aria-current={activeMenuPath?.startsWith("/admin-settings/wallet-recharge-requests") ? "page" : undefined}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800 h-full"
            onClick={() => openWorkspace("/admin-settings/wallet-recharge-requests")}
            onKeyDown={activateOnEnterOrSpace}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                  <Banknote className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Wallet recharge requests</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Verify physical receipts, review user details, and mark verified
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">
                Review &amp; verify
              </Button>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            aria-current={activeMenuPath?.startsWith("/my-bookings") ? "page" : undefined}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
            onClick={() => openWorkspace("/my-bookings")}
            onKeyDown={activateOnEnterOrSpace}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                  <Globe2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External booking requests</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Manage external sample bookings (hold and forward to laboratory)
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-brand hover:bg-brand/90 text-white">
                Manage external bookings
              </Button>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            aria-current={activeMenuPath?.startsWith("/reports") ? "page" : undefined}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
            onClick={() => { openWorkspace("/reports"); }}
            onKeyDown={activateOnEnterOrSpace}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Reports &amp; Statistics</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    View booking and financial reports
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
            </CardHeader>
            <CardContent>
              <span
                data-dashboard-card-action
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white ring-offset-background transition-colors"
              >
                View Reports
              </span>
            </CardContent>
          </Card>
        </div>
        {downloadBrochureButton}
        </>
        ) : (
        <DashboardMenuTree
          entries={dashboardMenuEntries}
          defaultOrder={dashboardMenuDefaultOrder}
          layout={dashboardMenuLayout}
          canCustomize={canCustomizeDashboardMenu}
          activePath={activeMenuPath}
          onSaveLayout={saveDashboardMenuLayout}
          footer={downloadBrochureButton}
          sections={usesAdminMenuSections ? ADMIN_MENU_SECTIONS : undefined}
        />
        )}
    </>
  );

  return (
    <div className="dashboard-page page-shell">
      <DashboardHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="dashboard-main-wide mx-auto w-full max-w-none px-4 py-5 focus:outline-none sm:px-6 lg:px-8"
      >
        {isAdmin || isAccountsInChargeUser ? (
          <WalletFundReceiptFollowUpAlert
            onReview={(path) => openWorkspace(path, "Wallet recharge requests")}
          />
        ) : null}
        {externalProfileNeedsAddress && (
          <Card className="dashboard-notice-card dashboard-notice-info mb-6 border-primary/70 bg-primary/5 dark:bg-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary dark:text-sky-300" />
                Complete billing & shipping details
              </CardTitle>
              <CardDescription>
                To generate invoices and shipping labels for external bookings, please complete your Billing Address (GSTIN) and Shipping Address in your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate("/profile#external-billing")}
                className="bg-brand hover:bg-brand/90 text-white"
              >
                Go to Profile
              </Button>
            </CardContent>
          </Card>
        )}
        {showAdminOverview ? null : <TemplateAttentionNotice userId={user?.id} className="mb-4" />}
        {showsLabStyleDashboard ? <ResultsOverdueCard className="mb-4" /> : null}
        {showsBookingsAwaitingCompletion(user?.user_type) ? <BookingsAwaitingCompletionCard className="mb-4" /> : null}
        {showsLabStyleDashboard ? <AndroidAppCard className="mb-4" /> : null}
        {/* Profile hero — compact for standard users; Lab Operator & OIC keep richer instrument layout */}
        <div
          className={cn(
            "dashboard-hero-card relative overflow-hidden border border-white/25 bg-gradient-to-br from-brand via-brand to-slate-950 text-white shadow-2xl shadow-primary/40 ring-1 ring-white/20",
            "mb-5 rounded-2xl"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_90%_at_0%_-30%,rgba(255,255,255,0.2),transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_100%_100%,rgba(29,111,163,0.32),transparent_55%)]"
            aria-hidden
          />
          <div className="relative flex flex-col lg:flex-row lg:items-center">
              <div className="flex justify-center border-b border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm lg:w-[6.75rem] lg:shrink-0 lg:flex-col lg:items-center lg:justify-center lg:border-b-0 lg:border-r lg:border-white/15 lg:px-3 lg:py-3">
                <ClickableProfileAvatar
                  userId={user?.id}
                  userName={user?.name}
                  userEmail={user?.email}
                  hasProfilePicture={Boolean(user?.profile_picture)}
                  onUploaded={handleProfileAvatarUploaded}
                  avatarClassName="h-14 w-14 shrink-0 rounded-xl border-2 border-white/55 shadow-lg shadow-black/25 ring-2 ring-white/15 sm:h-16 sm:w-16"
                  fallbackClassName="rounded-xl bg-white/25 text-lg font-bold text-white sm:text-xl"
                  overlayRoundedClassName="rounded-xl"
                />
              </div>
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col",
                "px-4 py-3 sm:px-5 sm:py-3.5"
              )}
            >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">
                    {formatUserDisplayName(user) || "—"}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/20 px-3 py-1 text-xs font-semibold shadow-inner shadow-black/10 backdrop-blur-md">
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 opacity-95" />
                    {getUserCategoryLabel(user?.user_type, user?.user_type_display)}
                  </span>
                  <TrainingBadgeChips userId={user?.id} onDark />
                </div>
              <dl
                className={cn(
                  "mt-3 grid grid-cols-1 gap-2.5 sm:gap-3",
                  userTypeStr === "student" || userTypeStr === "individual_student" || userTypeStr === "faculty"
                    ? "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]"
                    : "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.5fr)]"
                )}
              >
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 shadow-inner shadow-black/10 backdrop-blur-md">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75 leading-none">Department</dt>
                    <dd className="mt-1 text-sm font-semibold leading-snug text-white sm:text-[15px] [overflow-wrap:anywhere]" title={user?.department_name || undefined}>
                      {user?.department_name || "—"}
                    </dd>
                  </div>
                </div>
                {(userTypeStr === "student" || userTypeStr === "individual_student") && (
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 shadow-inner shadow-black/10 backdrop-blur-md">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75 leading-none">Enrollment Number</dt>
                      <dd className="mt-1 text-sm font-semibold leading-snug text-white sm:text-[15px] [overflow-wrap:anywhere]" title={user?.emp_id || undefined}>
                        {user?.emp_id || "—"}
                      </dd>
                    </div>
                  </div>
                )}
                {userTypeStr === "faculty" && (
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 shadow-inner shadow-black/10 backdrop-blur-md">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75 leading-none">Employee Number</dt>
                      <dd className="mt-1 text-sm font-semibold leading-snug text-white sm:text-[15px] [overflow-wrap:anywhere]" title={user?.emp_id || undefined}>
                        {user?.emp_id || "—"}
                      </dd>
                    </div>
                  </div>
                )}
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 shadow-inner shadow-black/10 backdrop-blur-md">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75 leading-none">Mobile</dt>
                    <dd
                      className="mt-1 text-sm font-semibold leading-snug text-white sm:text-[15px] [overflow-wrap:anywhere]"
                      title={user?.phone_number || user?.secondary_phone_number || undefined}
                    >
                      {user?.phone_number || user?.secondary_phone_number || "—"}
                    </dd>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 shadow-inner shadow-black/10 backdrop-blur-md">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75 leading-none">Email</dt>
                    <dd className="mt-1 text-sm font-semibold leading-snug text-white sm:text-[15px] [overflow-wrap:anywhere]" title={user?.email || undefined}>
                      {user?.email || "—"}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {showWalletLinkPrompt && userTypeStr === "student" && (
          <Card className="dashboard-notice-card dashboard-notice-primary mb-6 border-2 border-primary/80 bg-gradient-to-r from-primary/5 via-primary/5 to-accent/5 dark:from-primary/20 dark:via-primary/15 dark:to-accent/10 shadow-lg shadow-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2 text-primary dark:text-sky-100">
                <AlertCircle className="h-5 w-5 text-primary dark:text-sky-200" />
                Link your wallet to continue booking
              </CardTitle>
              <CardDescription className="text-sm font-medium text-primary/90 dark:text-foreground/90">
                Your IITR student account does not have a linked faculty wallet yet. Click below to go to Wallet and send a link request.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => openWorkspace("/wallet")}
                className="bg-brand hover:bg-brand/90 text-white font-bold px-6 py-2.5 ring-2 ring-primary/40 dark:ring-primary/50"
              >
                Go to Wallet
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending rating prompt for bookable end-users only (not staff / Dept Admin / Account In-charge) */}
        {!isOperatorOrManager && !isDeptAdmin && !isAccountsInChargeUser && pendingRatingBookings.length > 0 && (
          <Card className="dashboard-notice-card dashboard-notice-warning mb-6 border-primary/25 bg-primary/5 dark:border-primary/40 dark:bg-primary/15 shadow-md">
            <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary dark:text-sky-300">
                  <Star className="h-6 w-6" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-semibold text-foreground">
                    You have {pendingRatingBookings.length} completed booking{pendingRatingBookings.length !== 1 ? "s" : ""} pending your rating
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Please submit your rating and feedback so we can improve our service.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/my-bookings?pending_rating=1")}
                  className="bg-brand hover:bg-brand/90 text-white shrink-0"
                >
                  Submit rating
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-3 items-start">
          <div className="lg:hidden sticky top-16 z-30 -mx-1 mb-2">
            <Button
              ref={mobileMenuButtonRef}
              type="button"
              variant="outline"
              className="w-full min-h-11 justify-start gap-2 shadow-sm"
              aria-haspopup="dialog"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-4 w-4 shrink-0" aria-hidden />
              Dashboard menu
            </Button>
          </div>

          <aside className="hidden lg:block lg:col-span-3 xl:col-span-2 order-1 min-w-0 max-w-full lg:max-w-[16.5rem] xl:max-w-none">
            <div className="sticky top-6 space-y-2">
              <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/50">
                <div className="h-0.5 w-full bg-gradient-to-r from-primary to-accent" />
                <CardContent className="px-2.5 pb-3 pt-3">
                  <nav aria-label="Dashboard menu" className="dashboard-menu-nav space-y-1.5">
        {renderDashboardMenu()}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </aside>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent
              side="left"
              className="flex w-[min(100vw-1.5rem,20rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-sm"
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                mobileMenuButtonRef.current?.focus();
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Dashboard menu</SheetTitle>
                <SheetDescription>Dashboard navigation</SheetDescription>
              </SheetHeader>
              <nav
                aria-label="Dashboard menu"
                className="dashboard-menu-nav space-y-1.5 px-2.5 pb-8 pt-3"
                onClickCapture={(e) => {
                  const t = e.target as HTMLElement | null;
                  if (t?.closest("[data-menu-keep-open]")) return;
                  if (t?.closest('.cursor-pointer, button, a, [role="button"]')) {
                    queueMicrotask(() => setMobileMenuOpen(false));
                  }
                }}
              >
        {renderDashboardMenu()}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="lg:col-span-9 xl:col-span-10 order-2 min-w-0 space-y-4">
            {workspacePath ? (
              <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
                {!hideWorkspaceHeader && (
                  <>
                    <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary/50" />
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/50 px-4 py-2.5">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold tracking-tight sm:text-lg">
                          {workspaceTitleOverride || workspaceMeta?.title || formatWorkspaceTitle(workspaceTitle) || "Workspace"}
                        </CardTitle>
                        {workspaceMeta?.description && !workspaceTitleOverride ? (
                          <CardDescription className="truncate text-xs">{workspaceMeta.description}</CardDescription>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div ref={setWorkspaceActionsSlot} className="flex items-center gap-2 empty:hidden" />
                        {workspaceBackButton}
                      </div>
                    </CardHeader>
                  </>
                )}
                {hideWorkspaceHeader && !workspacePageHasOwnTitleRow && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/50 px-3 py-1.5">
                    <div
                      ref={setWorkspaceBannerSlot}
                      className="order-last flex min-w-0 basis-full items-center empty:hidden sm:order-none sm:basis-0 sm:flex-1"
                    />
                    {workspaceBackButton}
                  </div>
                )}
                <CardContent className="p-0 sm:p-0">
                  <WorkspaceChromeProvider
                    value={{
                      actionsSlot: hideWorkspaceHeader ? null : workspaceActionsSlot,
                      backButton: workspaceBackButton,
                      bannerSlot: hideWorkspaceHeader && !workspacePageHasOwnTitleRow ? workspaceBannerSlot : null,
                    }}
                  >
                    <DashboardWorkspace
                      key={workspaceEpoch}
                      initialPath={workspacePath}
                      onClose={closeWorkspace}
                      onPathChange={setWorkspaceCurrentPath}
                      backRef={workspaceBackRef}
                      onCanGoBackChange={setWorkspaceCanGoBack}
                    />
                  </WorkspaceChromeProvider>
                </CardContent>
              </Card>
            ) : (
              <>
            {!disruptionBannerDismissed && disruptionAttention?.enabled ? (
              <DisruptionAttentionBanner
                count={disruptionAttention.reason_missing}
                onOpen={() => openWorkspace("/disruptions?reason_missing=1")}
                onDismiss={() => {
                  dismissDisruptionBanner();
                  setDisruptionBannerDismissed(true);
                }}
              />
            ) : null}
            {showAdminOverview ? (
              <Suspense
                fallback={
                  <Card className="border-border/70 shadow-sm">
                    <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                      Loading administration overview…
                    </CardContent>
                  </Card>
                }
              >
                <AdminOverview
                  onOpen={(path) => openWorkspace(path)}
                  canOpen={canOpenMenuPath}
                  notices={loginTip}
                />
              </Suspense>
            ) : !showsLabStyleDashboard && (
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary/50" />
              <CardHeader className="pb-3">
                <CardTitle className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</CardTitle>
                <CardDescription>
                  {isAccountsInChargeUser
                    ? "Accounts tools and reports are listed in the menu. Open an item to continue."
                    : showsLabStyleDashboard
                      ? "Lab counts, queues, and schedules appear below. Use the menu for day-to-day tools."
                      : "Your bookings and usage appear below. Use the menu to book equipment, manage wallet, and more."}
                </CardDescription>
              </CardHeader>
            </Card>
            )}
            {showAdminOverview ? null : dashboardNotices}

        {showsLabStyleDashboard && (
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg shadow-primary/10 dark:shadow-none">
            <CardHeader className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-background to-background px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15 dark:text-sky-200">
                    <Layout className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Lab dashboard</CardTitle>
                    <CardDescription className="text-xs leading-snug">
                      Counts, queues, and weekly schedules for{" "}
                      {isOicUser ? "equipment you manage as OIC" : "your equipment"}.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  {labOperatorDash && (labOperatorDash.equipment_summaries ?? []).length > 1 && (
                    <div className="w-full sm:w-auto sm:min-w-[15rem]">
                      <Label htmlFor="lab-dash-equipment-scope" className="sr-only">
                        Instrument
                      </Label>
                      <Select
                        value={labDashEquipmentFilter === "all" ? "all" : String(labDashEquipmentFilter)}
                        onValueChange={(v) => {
                          if (v === "all") setLabDashEquipmentFilter("all");
                          else setLabDashEquipmentFilter(Number(v));
                        }}
                      >
                        <SelectTrigger id="lab-dash-equipment-scope" className="h-9 w-full bg-background/80">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All assigned instruments</SelectItem>
                          {(labOperatorDash.equipment_summaries ?? []).map((eq) => (
                            <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                              {eq.equipment_name || eq.equipment_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
                    size="sm"
                    onClick={() => navigate("/booking-management")}
                  >
                    View Booking
                    <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-4">
              {labOperatorDashLoading && !labOperatorDash ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading lab dashboard…</p>
                </div>
              ) : labOperatorDash ? (
                <>
                  <section className="space-y-2">
                    {!labWeekCalendarExpanded ? (
                      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold tracking-tight text-foreground">Week calendar</h3>
                            <p className="text-xs text-muted-foreground">
                              Week of{" "}
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
                          className="h-8 shrink-0 gap-1.5 self-start sm:self-center"
                          onClick={() => setLabWeekCalendarExpanded(true)}
                        >
                          <ChevronDown className="h-4 w-4 opacity-80" />
                          Expand
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                            </span>
                            Week calendar
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() => setLabWeekCalendarExpanded(false)}
                          >
                            Collapse
                          </Button>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-3">
                          <div className="grid grid-cols-1 gap-4">
                            {labEquipmentSummariesForScope.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No equipment in scope.</p>
                            ) : (
                              labEquipmentSummariesForScope.map((eq, index) => (
                                <LabOperatorWeekCalendarGrid
                                  key={eq.equipment_id}
                                  weekStartIso={labOperatorDash.week_start}
                                  equipmentTitle={eq.equipment_name || eq.equipment_code}
                                  slotsPayload={labSlotByEquipment[eq.equipment_id] ?? null}
                                  onBookedSlotClick={selectLabBookingForDetail}
                                  bookedSlotsOnly={labCalendarBookedOnly}
                                  selection={
                                    isOicUser && labManageableEquipmentIds.has(eq.equipment_id)
                                      ? {
                                          selectedIds: new Set(labSelectedSlotIds[eq.equipment_id] ?? []),
                                          canSelect: isDashboardSelectableSlot,
                                          onToggle: (slot) => toggleLabSlotSelection(eq.equipment_id, slot.id),
                                        }
                                      : undefined
                                  }
                                  headerActions={
                                    <>
                                      <NextWeekOpeningCountdown equipmentId={eq.equipment_id} audience="staff" />
                                      {index === 0 ? labWeekCalendarControls : null}
                                    </>
                                  }
                                />
                              ))
                            )}
                          </div>
                          {isOicUser &&
                          !labCalendarBookedOnly &&
                          labEquipmentSummariesForScope.some((eq) => labManageableEquipmentIds.has(eq.equipment_id)) ? (
                            <LabCalendarSlotActions
                              selectedCount={labSelectedSlotCount}
                              busy={labSlotActionBusy}
                              onApply={(status, options) => void applyLabSlotStatus(status, options)}
                              onClear={() => setLabSelectedSlotIds({})}
                            />
                          ) : null}
                          {disruptionPrompt.element}
                          <SlotCalendarLegend items={labCalendarLegend} className="border-t-0 pt-0" />
                          <LabCalendarColorConfig
                            equipmentId={labColorConfigEquipmentId}
                            equipmentLabel={labColorConfigEquipmentLabel}
                            onColorsChange={setLabBookingLegendColors}
                            onSaved={applyLabBookingColors}
                            open={labColorsOpen}
                            onOpenChange={setLabColorsOpen}
                          />
                        </div>
                      </>
                    )}
                  </section>

                  <section className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
                    <button
                      type="button"
                      aria-expanded={labOverviewOpen}
                      aria-controls="lab-dash-overview"
                      onClick={() => setLabOverviewOpen(!labOverviewOpen)}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <BarChart3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                          Booking overview and follow-up range
                        </span>
                      </span>
                      {!labOverviewOpen && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          Pending {labOperatorDash.overall_booking_booked_total} · External pending{" "}
                          {labOperatorDash.external_booking_booked_total} · Not utilized{" "}
                          {labOperatorDash.not_utilized_available_total} · To dispose{" "}
                          {labOperatorDash.sample_available_to_dispose_total}
                        </span>
                      )}
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${labOverviewOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                  {labOverviewOpen && (
                  <div id="lab-dash-overview" className="space-y-3 border-t border-border/50 p-3">
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Label
                        htmlFor="lab-dash-period"
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Range
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
                        <SelectTrigger id="lab-dash-period" className="h-8 w-[15rem]">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="lab-dash-from" className="text-xs">
                            From
                          </Label>
                          <DateInput
                            id="lab-dash-from"
                            className="w-[10rem]" inputClassName="h-8"
                            value={labDashCustomFrom}
                            onChange={(e) => setLabDashCustomFrom(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="lab-dash-to" className="text-xs">
                            To
                          </Label>
                          <DateInput
                            id="lab-dash-to"
                            className="w-[10rem]" inputClassName="h-8"
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

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <section className="space-y-2">
                    <h3
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      title="Click Pending (booked) or Completed to open that list; click a booking ID to view its details."
                    >
                      Booking overview
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "overall" ? "ring-2 ring-primary/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-transform ${labDashPanel?.key === "overall" ? "rotate-180" : ""}`}
                        />
                        <CalendarDays className="pointer-events-none absolute right-9 top-2.5 h-8 w-8 text-primary-foreground0/[0.12] transition-opacity group-hover:text-primary-foreground0/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          Internal Pending Bookings
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary dark:text-sky-200">
                          {labOperatorDash.overall_booking_booked_total - labOperatorDash.external_booking_booked_total}/{labOperatorDash.overall_booking_total}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Pending Bookings / Total
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "BOOKED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-primary/90/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "BOOKED"
                                ? "border-primary/50 bg-primary/50/[0.06] ring-1 ring-primary/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-primary dark:text-sky-200">
                              {labOperatorDash.overall_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "overall", segment: "COMPLETED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "overall" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.overall_booking_completed}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "external" ? "ring-2 ring-accent/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-transform ${labDashPanel?.key === "external" ? "rotate-180" : ""}`}
                        />
                        <Globe2 className="pointer-events-none absolute right-9 top-2.5 h-8 w-8 text-accent/[0.12] group-hover:text-accent/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-14 leading-snug">
                          External bookings
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-accent dark:text-sky-300">
                          {labOperatorDash.external_booking_booked_total}/{labOperatorDash.external_booking_total}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Pending Bookings / Total
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "BOOKED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "BOOKED"
                                ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Pending (booked)
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-accent dark:text-sky-300">
                              {labOperatorDash.external_booking_booked_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "external", segment: "COMPLETED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-emerald-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              labDashPanel?.key === "external" && labDashPanel.segment === "COMPLETED"
                                ? "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Completed
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                              {labOperatorDash.external_booking_completed}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      title="Click Available or the done count of each queue to open that list."
                    >
                      Follow-up queues
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "not_util" ? "ring-2 ring-amber-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground transition-transform ${labDashPanel?.key === "not_util" ? "rotate-180" : ""}`}
                        />
                        <AlertCircle className="pointer-events-none right-8 top-2 h-8 w-8 absolute text-amber-500/[0.12] group-hover:text-amber-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Booking available to be marked as not utilized
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">
                          {labOperatorDash.not_utilized_available_total}/
                          {labOperatorDash.not_utilized_available_total + labOperatorDash.not_utilized_marked_total}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already marked)
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "AVAILABLE" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-amber-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "AVAILABLE"
                                ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">
                              {labOperatorDash.not_utilized_available_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "not_util", segment: "MARKED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "not_util" && labDashPanel.segment === "MARKED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Marked
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-foreground/90">
                              {labOperatorDash.not_utilized_marked_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`hidden ${labDashKpiClassName} ${labDashPanel?.key === "sample_return" ? "ring-2 ring-primary/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground transition-transform ${labDashPanel?.key === "sample_return" ? "rotate-180" : ""}`}
                        />
                        <PackageOpen className="pointer-events-none right-8 top-2 h-8 w-8 absolute text-primary-foreground0/[0.12] group-hover:text-primary-foreground0/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample pickup (completed bookings)
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary dark:text-sky-200">
                          {labOperatorDash.sample_available_to_return_total}/
                          {labOperatorDash.sample_available_to_return_total + labOperatorDash.sample_returned_done_total}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Awaiting return / total (awaiting + already returned)
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "AVAILABLE" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-primary/90/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "AVAILABLE"
                                ? "border-primary/50 bg-primary/50/[0.06] ring-1 ring-primary/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Awaiting return
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-primary dark:text-sky-200">
                              {labOperatorDash.sample_available_to_return_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "sample_return", segment: "RETURNED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "sample_return" && labDashPanel.segment === "RETURNED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Returned
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-foreground/90">
                              {labOperatorDash.sample_returned_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                      <div
                        className={`${labDashKpiClassName} ${labDashPanel?.key === "dispose" ? "ring-2 ring-rose-500/35" : ""}`}
                      >
                        <ChevronDown
                          className={`pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground transition-transform ${labDashPanel?.key === "dispose" ? "rotate-180" : ""}`}
                        />
                        <Archive className="pointer-events-none right-8 top-2 h-8 w-8 absolute text-rose-500/[0.12] group-hover:text-rose-500/20" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pr-10 leading-snug">
                          Sample Available to be Disposed
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-rose-700 dark:text-rose-300">
                          {labOperatorDash.sample_available_to_dispose_total}/
                          {labOperatorDash.sample_available_to_dispose_total + labOperatorDash.sample_disposed_done_total}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Current / total (available + already disposed)
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "AVAILABLE" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-rose-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "AVAILABLE"
                                ? "border-rose-500/50 bg-rose-500/[0.06] ring-1 ring-rose-500/30"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-rose-700 dark:text-rose-300">
                              {labOperatorDash.sample_available_to_dispose_total}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLabDashPanel({ key: "dispose", segment: "DISPOSED" })}
                            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              labDashPanel?.key === "dispose" && labDashPanel.segment === "DISPOSED"
                                ? "border-foreground/25 bg-muted/40 ring-1 ring-foreground/15"
                                : "border-border/60 bg-background/40"
                            }`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Disposed
                            </p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-foreground/90">
                              {labOperatorDash.sample_disposed_done_total}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                  </div>

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
                                  <TableRow
                                    key={`${labDashPanel.key}-${labDashPanel.segment}-${row.booking_id}`}
                                    className={labDashBookingRowClassName(row.status)}
                                  >
                                    <TableCell className="font-medium whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => selectLabBookingForDetail(row.booking_id)}
                                        className={`inline-flex items-center gap-1.5 rounded font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                          String(row.status).toUpperCase() === "COMPLETED"
                                            ? "text-emerald-800 hover:text-emerald-900 dark:text-emerald-300"
                                            : "text-primary hover:text-primary/80"
                                        }`}
                                      >
                                        {row.virtual_booking_id || row.booking_ref}
                                      </button>
                                      {formatSampleSummary(row.sample_summary) && (
                                        <span className="block text-xs font-normal text-muted-foreground">
                                          {formatSampleSummary(row.sample_summary)}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={row.equipment_name}>
                                      {row.equipment_name}
                                    </TableCell>
                                    <TableCell className="max-w-[160px] truncate">{row.user_name || "—"}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {String(row.status).toUpperCase() === "COMPLETED" ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">
                                          {row.status_display || row.status}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">{row.status_display || row.status}</span>
                                      )}
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
                  </div>
                  )}
                  </section>

                  {(isOicUser || isAdmin || isDeptAdmin) && (
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Team calendar</p>
                          <p className="text-xs text-muted-foreground">
                            Spot department absences quickly for planning and reassignment.
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="bg-brand text-white hover:bg-brand/90 shrink-0"
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
                      className="mt-6 scroll-mt-8 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6"
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
        {!isOperatorOrManager && (
          <section className="mt-6 space-y-5">
            <p className="dashboard-section-title text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Your activity
            </p>
            <div className="dashboard-uniform-cards grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Bookings Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-primary/10 bg-card rounded-2xl">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand/50 to-brand-accent text-white shadow-lg">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Upcoming bookings</CardTitle>
                        <CardDescription className="text-sm">
                          {isDeptAdmin
                            ? "Upcoming sessions on your department’s equipment"
                            : "Your scheduled equipment sessions"}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/my-bookings")}
                      className="text-primary hover:text-primary hover:bg-primary/10 shrink-0"
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
                          className="group relative flex cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => navigate(`/my-bookings?booking=${encodeURIComponent(getBookingKey(booking))}`)}
                        >
                          <div className={`w-1 shrink-0 self-stretch ${getStatusColor(booking.status)} opacity-80`} />
                          <div className="flex-1 min-w-0 py-4 px-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">
                                  {/* Stretched over the row so the whole row stays clickable with one tab stop. */}
                                  <button
                                    type="button"
                                    data-row-link
                                    className="block w-full truncate text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/my-bookings?booking=${encodeURIComponent(getBookingKey(booking))}`);
                                    }}
                                  >
                                    {booking.equipment_name}
                                  </button>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{booking.equipment_code}</p>
                              </div>
                              <Badge className={`${getStatusColor(booking.list_status || booking.status)} text-white text-xs shrink-0`}>
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 text-primary dark:text-sky-300 mb-4">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No upcoming bookings</p>
                      <p className="text-sm text-muted-foreground mt-1">Book equipment to see your sessions here</p>
                      <Button
                        variant="outline"
                        className="mt-5 border-primary/25 text-primary hover:bg-primary/5 dark:border-primary/40 dark:hover:bg-primary/15"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse and Book Equipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Equipment Statistics Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-emerald-500/10 bg-card rounded-2xl">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-emerald-500/10 to-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-brand text-white shadow-lg">
                        <BarChart3 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Equipment statistics</CardTitle>
                        <CardDescription className="text-sm">
                          {isDeptAdmin
                            ? "Usage and spending for your department’s equipment"
                            : "Your usage and spending by equipment"}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/reports")}
                      className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-300 dark:hover:text-emerald-200 shrink-0"
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-primary/10 dark:from-emerald-900/30 dark:to-primary/30 text-emerald-600 dark:text-emerald-400 mb-4">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No statistics yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Your usage and spending will appear here after bookings</p>
                      <Button
                        variant="outline"
                        className="mt-5 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse and Book Equipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}
              </>
            )}
          </div>
        </div>

      </main>
      <PortalFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <DepartmentBrochureDialog open={brochureDialogOpen} onOpenChange={setBrochureDialogOpen} />
    </div>
  );
};

export default Dashboard;