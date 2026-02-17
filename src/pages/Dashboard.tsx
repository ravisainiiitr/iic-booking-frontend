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
import { Calendar, FileText, Package, User as UserIcon, Users, Wallet, Settings, Clock, ArrowRight, BarChart3, TrendingUp } from "lucide-react";
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
          <section className="mt-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Bookings Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Upcoming Bookings</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/my-bookings")}
                    className="flex items-center gap-2"
                  >
                    View All
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {loadingBookings ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : upcomingBookings.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <Card
                        key={booking.booking_id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate("/my-bookings")}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base mb-1">
                                {booking.equipment_name}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {booking.equipment_code}
                              </CardDescription>
                            </div>
                            <Badge
                              className={`${getStatusColor(booking.status)} text-white text-xs`}
                            >
                              {booking.status_display}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{formatDateTime(booking.start_time)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Duration: </span>
                            <span className="font-medium">{booking.total_hours} hour{booking.total_hours !== 1 ? 's' : ''}</span>
                          </div>
                          {booking.total_charge && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Charge: </span>
                              <span className="font-medium">₹{parseFloat(booking.total_charge).toFixed(2)}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No upcoming bookings</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse Equipment
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Equipment Statistics Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Equipment Statistics</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/reports")}
                    className="flex items-center gap-2"
                  >
                    View Full Report
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {loadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : equipmentStats.length > 0 ? (
                  <div className="space-y-4">
                    {equipmentStats.map((stat, index) => (
                      <Card key={stat.equipment_id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  #{index + 1}
                                </Badge>
                                <CardTitle className="text-base">
                                  {stat.equipment_name}
                                </CardTitle>
                              </div>
                              <CardDescription className="text-xs">
                                {stat.equipment_code}
                              </CardDescription>
                            </div>
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Bookings</p>
                              <p className="text-lg font-semibold">{stat.bookingCount}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Hours</p>
                              <p className="text-lg font-semibold">{stat.totalHours.toFixed(1)}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                            <p className="text-xl font-bold text-primary">
                              ₹{stat.totalSpent.toFixed(2)}
                            </p>
                          </div>
                          {stat.bookingCount > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Average per Booking</p>
                              <p className="text-sm font-medium">
                                ₹{(stat.totalSpent / stat.bookingCount).toFixed(2)} / {(stat.totalHours / stat.bookingCount).toFixed(1)}h
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No booking statistics available</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Start booking equipment to see your usage statistics
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => navigate("/equipments")}
                      >
                        Browse Equipment
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </section>
        )}

        {isAdmin && (
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
        )}
      </main>
    </div>
  );
};

export default Dashboard;