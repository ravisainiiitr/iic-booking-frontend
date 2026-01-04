import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
import { Calendar, FileText, LogOut, Package, User as UserIcon, Wallet } from "lucide-react";
import { toast } from "sonner";
import NotificationPanel from "@/components/NotificationPanel";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    const checkAuthAndLoadData = async () => {
      const token = apiClient.getToken();
      if (!token) {
        if (!hasRedirected) {
          hasRedirected = true;
          navigate("/auth");
        }
        setLoading(false);
        return;
      }

      try {
        // Try to get user from localStorage first (faster)
        const storedUser = localStorage.getItem('user');
        if (storedUser && isMounted) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch (e) {
            // Invalid JSON, continue to fetch from API
          }
        }

        // Verify token and get fresh user data
        const userResponse = await apiClient.getCurrentUser();
        
        if (!isMounted) return;

        if (userResponse.error || !userResponse.data) {
          apiClient.setToken(null);
          localStorage.removeItem('user');
          if (!hasRedirected) {
            hasRedirected = true;
            navigate("/auth");
          }
          return;
        }

        setUser(userResponse.data);
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(userResponse.data));
        
        // Check if user can have wallet using the can_have_wallet field
        const userCanHaveWallet = userResponse.data?.can_have_wallet === true;
        setHasWallet(userCanHaveWallet);
        
        if (userCanHaveWallet && isMounted) {
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
  }, []);

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
    const response = await apiClient.signOut();
    if (response.error) {
      toast.error(response.error);
    } else if ('data' in response && response.data) {
      toast.success(response.data.message || "Signed out successfully");
    } else {
      toast.success("Signed out successfully");
    }
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">IIC Booking</h1>
          <div className="flex items-center gap-4">
            <NotificationPanel />
            {hasWallet && (
              <div className="text-sm">
                <span className="text-muted-foreground">Balance:</span>{" "}
                <span className="font-semibold">₹{walletBalance.toFixed(2)}</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={user?.profile_picture} alt={user?.name || "User"} />
                    <AvatarFallback>{(user?.name || user?.email || "U")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {hasWallet && (
                  <DropdownMenuItem onClick={() => navigate("/wallet")}>
                    <Wallet className="mr-2 h-4 w-4" />
                    <span>Wallet</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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
            onClick={() => navigate("/book-equipment")}
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;