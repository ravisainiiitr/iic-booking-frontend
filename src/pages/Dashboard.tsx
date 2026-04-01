import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, FileText, Package, Settings, Clock, ArrowRight, BarChart3, TrendingUp, Layout, ClipboardList, Star, Palette, Users, Wallet, MessageSquarePlus, User, Mail, Phone, Building2, BadgeCheck, AlertCircle, IdCard, UserCheck, Send, Receipt, Wrench, ChevronRight, FolderTree, Layers, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";
import DashboardHeader from "@/components/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { TicketForm, TICKET_TYPE, QUALITY_IMPROVEMENT_SUBJECT } from "@/components/TicketForm";
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
  if (userType == null) return "—";
  const t = String(userType).toLowerCase();
  const map: Record<string, string> = {
    admin: "Admin",
    manager: "Officer In Charge",
    operator: "Lab Incharge",
    finance: "Accounts In Charge",
    student: "IITR Student",
    individual_student: "Individual Student",
    faculty: "Faculty",
    external: "Educational Institute",
    rnd: "Govt R&D Organizations",
    industry: "Industry",
    other: "Other",
  };
  return map[t] || String(userType);
}

const WALLET_BALANCE_CACHE_KEY = "wallet_balance_cache_v1";
const WALLET_BALANCE_CACHE_TTL_MS = 60 * 1000;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated, refreshUser, logout } = useAuth();
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
  const [qualityFormOpen, setQualityFormOpen] = useState(false);
  const [urgentRequestsPendingCount, setUrgentRequestsPendingCount] = useState<number>(0);
  const [loadingUrgentCount, setLoadingUrgentCount] = useState(false);
  const [facultyUrgentPendingCount, setFacultyUrgentPendingCount] = useState<number>(0);
  const [loadingFacultyUrgentCount, setLoadingFacultyUrgentCount] = useState(false);
  const [myUrgentRequestsCount, setMyUrgentRequestsCount] = useState<number>(0);
  const [loadingMyUrgentCount, setLoadingMyUrgentCount] = useState(false);
  const [externalProfileNeedsAddress, setExternalProfileNeedsAddress] = useState(false);
  const [showWalletLinkPrompt, setShowWalletLinkPrompt] = useState(false);

  // Check if user is operator, manager, or admin (for booking management)
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isLabInchargeUser = userTypeStr === "operator";
  const isOperatorOrManager = 
    userTypeStr === 'operator' || userTypeStr === 'manager' || userTypeStr === 'admin';
  
  // Admin Settings section is only visible to admins (not managers, operators, or finance)
  const isAdmin = userTypeStr === 'admin';
  const isFacultyUser = userTypeStr === "faculty";

  // Admin and OIC (manager, operator, finance) can see booking attempt log
  const canAccessBookingAttemptLog =
    apiClient.isAdminPanelUser(user?.user_type) ||
    userTypeStr === 'admin' ||
    userTypeStr === 'manager' ||
    userTypeStr === 'operator' ||
    userTypeStr === 'finance';

  const canAccessAdminTools = apiClient.isAdminPanelUser(user?.user_type) || canAccessBookingAttemptLog;

  useEffect(() => {
    if (!user?.id) return;
    const userTypeLower = String(user.user_type || "").toLowerCase();
    const shouldShowWelcome = userTypeLower === "student" || userTypeLower === "faculty";
    if (!shouldShowWelcome) return;

    const welcomeKey = `dashboard_welcome_shown_${user.id}`;
    if (localStorage.getItem(welcomeKey)) return;

    const displayName = (user.name || "").trim() || "User";
    if (userTypeLower === "faculty") {
      toast.success(`Welcome, ${displayName}.`, {
        description: "You are signed in to the IIC Booking Portal. Please review your dashboard for booking updates and pending actions.",
      });
    } else {
      toast.success(`Welcome ${displayName}!`, {
        description: "Great to have you on the IIC Booking Portal.",
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
        const isExternalUser = ["external", "rnd", "industry", "other"].includes(currentUserTypeStr);

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
        if (isCurrentUserOperatorOrManager) {
          tasks.push(fetchUrgentRequestsPendingCount().then(() => {}));
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
  }, [isAuthenticated, user, authLoading]);

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
      booked: "bg-blue-500",
      confirmed: "bg-blue-500",
      approved: "bg-blue-500",
      in_progress: "bg-green-500",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
      rejected: "bg-red-500",
    };
    return colors[statusLower] || "bg-gray-500";
  };

  const fetchPendingRatingBookings = async () => {
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
    <div className="dashboard-page min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        {externalProfileNeedsAddress && (
          <Card className="dashboard-notice-card dashboard-notice-info mb-6 border-blue-200/70 bg-blue-50/60 dark:bg-blue-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                Complete billing & shipping details
              </CardTitle>
              <CardDescription>
                To generate invoices and shipping labels for external bookings, please complete your Billing Address (GSTIN) and Shipping Address in your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate("/profile#external-billing")}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Profile
              </Button>
            </CardContent>
          </Card>
        )}
        {showWalletLinkPrompt && userTypeStr === "student" && (
          <Card className="dashboard-notice-card dashboard-notice-primary mb-6 border-2 border-blue-500/80 bg-gradient-to-r from-blue-100 via-blue-100 to-indigo-100 dark:from-blue-950/60 dark:via-blue-950/50 dark:to-indigo-950/40 shadow-lg shadow-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <AlertCircle className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                Link your wallet to continue booking
              </CardTitle>
              <CardDescription className="text-sm font-medium text-blue-900/90 dark:text-blue-100/90">
                Your IITR student account does not have a linked faculty wallet yet. Click below to go to Wallet and send a link request.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate("/wallet")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 ring-2 ring-blue-300 dark:ring-blue-700"
              >
                Go to Wallet
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Profile card – image left, details right */}
        <div className="dashboard-hero-card mb-10 overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white">
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-0">
            {/* Avatar */}
            <div className="flex justify-center sm:justify-start p-6 sm:p-8 sm:pr-0">
              <Avatar className="h-28 w-28 shrink-0 rounded-2xl border-4 border-white/40 shadow-xl ring-4 ring-white/10">
                <AvatarImage src={user?.profile_picture ? (user?.id != null ? apiClient.getProfilePictureUrl(user.id) : user.profile_picture) : undefined} alt={user?.name || "Profile"} className="object-cover" />
                <AvatarFallback className="rounded-2xl bg-white/20 text-3xl font-bold text-white">
                  {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            {/* Details – strict order: Name, Category, Department, Mobile, Email */}
            <div className="flex-1 min-w-0 px-6 pb-6 sm:px-8 sm:py-8 flex flex-col justify-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                {user?.name || "—"}
              </h2>
              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3.5 py-1 text-sm font-medium backdrop-blur-sm border border-white/20">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {getUserCategoryLabel(user?.user_type, user?.user_type_display)}
                </span>
              </div>
              <dl className={`mt-6 grid grid-cols-1 gap-4 ${(userTypeStr === "student" || userTypeStr === "individual_student" || userTypeStr === "faculty") ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-white/70">Department</dt>
                    <dd className="mt-0.5 font-medium text-white truncate" title={user?.department_name || undefined}>{user?.department_name || "—"}</dd>
                  </div>
                </div>
                {(userTypeStr === "student" || userTypeStr === "individual_student") && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wider text-white/70">Enrollment Number</dt>
                      <dd className="mt-0.5 font-medium text-white truncate" title={user?.emp_id || undefined}>{user?.emp_id || "—"}</dd>
                    </div>
                  </div>
                )}
                {userTypeStr === "faculty" && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wider text-white/70">Employee Number</dt>
                      <dd className="mt-0.5 font-medium text-white truncate" title={user?.emp_id || undefined}>{user?.emp_id || "—"}</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-white/70">Mobile</dt>
                    <dd className="mt-0.5 font-medium text-white truncate" title={user?.phone_number || user?.secondary_phone_number || undefined}>{user?.phone_number || user?.secondary_phone_number || "—"}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-white/70">Email</dt>
                    <dd className="mt-0.5 font-medium text-white truncate" title={user?.email || undefined}>{user?.email || "—"}</dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Pending rating prompt for internal (student, faculty) and external users */}
        {!isOperatorOrManager && pendingRatingBookings.length > 0 && (
          <Card className="dashboard-notice-card dashboard-notice-warning mb-8 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 shadow-md">
            <CardContent className="py-5 px-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
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
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
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

        <div className={`dashboard-uniform-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isAdmin ? "gap-8" : "gap-6"}`}>
          {!isLabInchargeUser && (<Card 
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-800 h-full"
            onClick={() => { window.location.href = `${window.location.origin}/equipments`; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `${window.location.origin}/equipments`; } }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Book Equipment</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Browse and book available laboratory equipment
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 mt-3" />
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white ring-offset-background transition-colors">
                Browse Equipment
              </span>
            </CardContent>
          </Card>)}

          {!isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => navigate("/my-bookings")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">View Bookings</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Check your current and past bookings
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">View Bookings</Button>
              </CardContent>
            </Card>
          )}

          {!isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => navigate("/proforma-invoice")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Proforma Invoice</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Get cost estimate for equipments and samples/slots before booking
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Proforma Invoice</Button>
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

          {userTypeStr === "faculty" && (
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
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
            onClick={() => setQualityFormOpen(true)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                  <MessageSquarePlus className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Feedback/Suggestions</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                      Share feedback, report issues, or suggest improvements for the booking portal
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 mt-3" />
            </CardHeader>
            <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Feedback / Suggestions</Button>
            </CardContent>
          </Card>)}
          <TicketForm
            open={qualityFormOpen}
            onOpenChange={setQualityFormOpen}
            initialValues={{
              ticket_type: TICKET_TYPE.QUALITY_IMPROVEMENT,
              subject: QUALITY_IMPROVEMENT_SUBJECT,
            }}
            hideTicketType
            onSuccess={() => setQualityFormOpen(false)}
          />

          {isOperatorOrManager && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => navigate("/booking-management")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Booking Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manage all bookings as operator or manager
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Manage Bookings</Button>
              </CardContent>
            </Card>
          )}

          {isOperatorOrManager && (
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

          {isOperatorOrManager && !isLabInchargeUser && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800"
              onClick={() => navigate("/ta-nomination-call")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">TA nomination call</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Initiate a request for faculty to nominate students to operate an equipment (semester-wise)
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Initiate TA nomination call</Button>
              </CardContent>
            </Card>
          )}

          {((isOperatorOrManager && !isLabInchargeUser) || userTypeStr === "student" || userTypeStr === "individual_student") && (
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

          {isOperatorOrManager && !isLabInchargeUser && (
            <Card
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-800"
              onClick={() => navigate("/admin-settings/rewards")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
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
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Open reward settings</Button>
              </CardContent>
            </Card>
          )}

          {canAccessBookingAttemptLog && (
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

          {canAccessAdminTools && !isLabInchargeUser && (
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

          {canAccessBookingAttemptLog && (
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

          {userTypeStr === "manager" && (
            <Card 
              className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-violet-200 dark:hover:border-violet-800"
              onClick={() => navigate("/temporary-oic")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Temporary OIC (Leave)</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Assign another OIC to manage your equipment until you resume
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Manage temporary OIC</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card
              className="overflow-hidden border-0 shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-200 dark:hover:border-amber-800"
              onClick={() => navigate("/admin-settings/wallet-recharge-parse")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">Wallet Management</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      Manual credits, imports, IMAP, and recharge history
                    </CardDescription>
                  </div>
                </div>
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mt-3" />
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">Open wallet tools</Button>
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
        </div>

        {/* Upcoming Bookings and Equipment Statistics - Side by Side */}
        {!isOperatorOrManager && (
          <section className="mt-12 space-y-8">
            <p className="dashboard-section-title text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
              Your activity
            </p>
            <div className="dashboard-uniform-cards grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Bookings Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-sky-500/10 bg-card rounded-2xl">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-sky-500/10 to-blue-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
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
                      className="text-sky-600 hover:text-sky-700 hover:bg-sky-500/10 shrink-0"
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
                                <span className="font-medium text-foreground">₹{parseFloat(booking.total_charge).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 text-sky-600 dark:text-sky-400 mb-4">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No upcoming bookings</p>
                      <p className="text-sm text-muted-foreground mt-1">Book equipment to see your sessions here</p>
                      <Button
                        variant="outline"
                        className="mt-5 border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-sky-900/20"
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
    </div>
  );
};

export default Dashboard;