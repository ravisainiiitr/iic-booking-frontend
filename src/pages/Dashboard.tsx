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
import { Calendar, FileText, Package, User as UserIcon, Users, Wallet, Settings } from "lucide-react";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";
import DashboardHeader from "@/components/DashboardHeader";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated, refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showWalletOption, setShowWalletOption] = useState(false);
  
  // Check if user is operator, manager, or admin (for booking management)
  const isOperatorOrManager = user?.user_type === 'operator' || user?.user_type === 'manager' || user?.user_type === 'admin';
  // Admin panel users (admin, manager, operator, finance) see Admin Settings section
  const isAdminPanelUser = apiClient.isAdminPanelUser(user?.user_type);

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
              <CardTitle>Book Equipment</CardTitle>
              <CardDescription>
                Browse and book available laboratory equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Browse Equipment</Button>
            </CardContent>
          </Card>

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

        {isAdminPanelUser && (
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