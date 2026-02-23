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
import { Calendar, FileText, Package, User as UserIcon, Users, Wallet, Settings, Clock, ArrowRight, BarChart3, TrendingUp, Layout, Menu, Home, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";
import DashboardHeader from "@/components/DashboardHeader";
import { Badge } from "@/components/ui/badge";

interface Booking {
  booking_id: number;
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
}

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
  
  // Check if user is operator, manager, or admin (for booking management)
  const userType: any = user?.user_type;
  const userTypeStr = userType ? String(userType).toLowerCase() : '';
  const isOperatorOrManager = 
    userTypeStr === 'operator' || userTypeStr === 'manager' || userTypeStr === 'admin';
  
  // Admin Settings section is only visible to admins (not managers, operators, or finance)
  const isAdmin = userTypeStr === 'admin';

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
        
        // Check if user can have wallet using the can_have_wallet field
        const userCanHaveWallet = user?.can_have_wallet === true;
        const userType: any = user?.user_type;
        
        // Determine if user is a regular student (not individual student)
        // Only regular students can request to join faculty wallets
        let isStudent = false;
        if (userType !== undefined && userType !== null) {
          if (typeof userType === "string") {
            const userTypeLower = userType.toLowerCase();
            isStudent = userTypeLower === "student"; // Only regular student, not individual_student
          } else if (typeof userType === "number") {
            isStudent = userType === 1;
          }
        }
        
        // For students without wallet access, check if they have an approved join request
        let hasApprovedRequest = false;
        if (!userCanHaveWallet && isStudent && isMounted) {
          try {
            const requestsResponse = await apiClient.getWalletJoinRequests();
            if (requestsResponse.data && requestsResponse.data.requests) {
              const approvedRequest = requestsResponse.data.requests.find(
                (req: any) => req.status === "APPROVED"
              );
              if (approvedRequest) {
                hasApprovedRequest = true;
              }
            }
          } catch (error) {
            console.error("Error checking join requests:", error);
          }
        }
        
        // Show wallet option if user has wallet OR is a student (so they can request access)
        // Also show wallet if student has approved request
        const shouldShowWallet = userCanHaveWallet || isStudent;
        const actuallyHasWallet = userCanHaveWallet || hasApprovedRequest;
        setHasWallet(actuallyHasWallet);
        setShowWalletOption(shouldShowWallet);
        
        if (actuallyHasWallet && isMounted) {
          await fetchWalletBalance();
        }
        
        // Fetch upcoming bookings for regular users (not operators/managers)
        // Check user type inside useEffect to ensure user is loaded
        const currentUserType: any = user?.user_type;
        const currentUserTypeStr = currentUserType ? String(currentUserType).toLowerCase() : '';
        const isCurrentUserOperatorOrManager = 
          currentUserTypeStr === 'operator' || currentUserTypeStr === 'manager' || currentUserTypeStr === 'admin';
        
        if (!isCurrentUserOperatorOrManager && isMounted) {
          await fetchUpcomingBookings();
          await fetchEquipmentStatistics();
        }
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
      const response = await apiClient.getWalletBalance();
      if (response.data) {
        setWalletBalance(Number(response.data.balance));
      } else {
        // Fallback to full wallet endpoint if balance endpoint fails
        const walletResponse = await apiClient.getWallet();
        if (walletResponse.data?.balance) {
          setWalletBalance(Number(walletResponse.data.balance));
        }
      }
    } catch (error) {
      // Silently handle wallet errors - user may not have wallet access
      console.log("Wallet not available for this user type");
      setHasWallet(false);
    }
  };

  const fetchUpcomingBookings = async () => {
    try {
      setLoadingBookings(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Fetch bookings starting from today onwards
      const response = await apiClient.getBookings({
        start_date: todayStr,
        ordering: 'start_time',
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
      const response = await apiClient.getBookings();
      
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome, {user?.name || user?.email}!
          </h2>
          <p className="text-muted-foreground">
            Manage your equipment bookings and account
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/equipments")}
          >
            <CardHeader>
              <Package className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Equipment</CardTitle>
              <CardDescription>
                Browse and book available laboratory equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Browse Equipment</Button>
            </CardContent>
          </Card>

          {!isOperatorOrManager && (
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/my-bookings")}
            >
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-2" />
                <CardTitle>View Bookings</CardTitle>
                <CardDescription>
                  Check your current and past bookings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="secondary">View Bookings</Button>
              </CardContent>
            </Card>
          )}

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/reports")}
          >
            <CardHeader>
              <FileText className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                View your booking history and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">View Reports</Button>
            </CardContent>
          </Card>

          {isOperatorOrManager && (
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/booking-management")}
            >
              <CardHeader>
                <Settings className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Booking Management</CardTitle>
                <CardDescription>
                  Manage all bookings as operator or manager
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">Manage Bookings</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Upcoming Bookings and Equipment Statistics - Side by Side */}
        {!isOperatorOrManager && (
          <section className="mt-12 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Bookings Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-primary/5 bg-card">
                <CardHeader className="pb-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Calendar className="h-5 w-5" />
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
                          className="group flex cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => navigate("/my-bookings")}
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No upcoming bookings</p>
                      <p className="text-sm text-muted-foreground mt-1">Book equipment to see your sessions here</p>
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse Equipment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Equipment Statistics Section */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-primary/5 bg-card">
                <CardHeader className="pb-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BarChart3 className="h-5 w-5" />
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
                      className="text-primary hover:text-primary hover:bg-primary/10 shrink-0"
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
                            <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-wider text-primary/90 font-medium">Spent</p>
                              <p className="text-lg font-bold text-primary tabular-nums">₹{stat.totalSpent.toFixed(0)}</p>
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <p className="font-medium text-foreground">No statistics yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Your usage and spending will appear here after bookings</p>
                      <Button
                        variant="outline"
                        className="mt-5"
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

        {isAdmin && (
          <>
            <section className="mt-12">
              <h3 className="text-xl font-semibold mb-4">Content Management (CMS)</h3>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Layout className="h-6 w-6" />
                    Content Management (CMS)
                  </CardTitle>
                  <CardDescription>
                    Main page and navigation: menu items (with priority) and home page hero, CTAs, and stats
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigate("/admin/section/cmsMenu")}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Menu className="h-5 w-5" />
                      <span className="font-medium">Menu & Submenu</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/section/cmsPages")}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Layout className="h-5 w-5" />
                      <span className="font-medium">Pages</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/section/cmsHome")}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Home className="h-5 w-5" />
                      <span className="font-medium">Home Page Content</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            </section>
            <section className="mt-12">
              <h3 className="text-xl font-semibold mb-4">Admin Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate("/admin")}
                >
                  <CardHeader>
                    <Settings className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-base">Equipment Management</CardTitle>
                    <CardDescription className="text-sm">
                      Manage equipment, rates & availability
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate("/user-management")}
                >
                  <CardHeader>
                    <UserIcon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-base">User Management</CardTitle>
                    <CardDescription className="text-sm">
                      Users, roles & permissions
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate("/user-groups")}
                >
                  <CardHeader>
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-base">Group Management</CardTitle>
                    <CardDescription className="text-sm">
                      User groups & equipment access
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate("/wallet")}
                >
                  <CardHeader>
                    <Wallet className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-base">Wallet Management</CardTitle>
                    <CardDescription className="text-sm">
                      Wallet, join & recharge requests
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;