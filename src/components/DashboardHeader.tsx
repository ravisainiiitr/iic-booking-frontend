import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as UserIcon, Wallet, LogOut, Home, HelpCircle, Settings } from "lucide-react";
import NotificationPanel from "@/components/NotificationPanel";

const DashboardHeader = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser, logout } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showWalletOption, setShowWalletOption] = useState(false);
  const isAdminPanelUser = apiClient.isAdminPanelUser(user?.user_type);
  
  // Refs to prevent multiple simultaneous API calls
  const balanceFetchingRef = useRef(false);
  const joinRequestsFetchingRef = useRef(false);

  // Listen for balance updates from wallet page
  useEffect(() => {
    const handleBalanceUpdate = (event: StorageEvent) => {
      if (event.key === 'wallet_balance' && event.newValue) {
        const newBalance = Number(event.newValue);
        setWalletBalance(newBalance);
        setHasWallet(true);
      }
    };

    // Listen for storage events (when balance is updated in another tab/window)
    window.addEventListener('storage', handleBalanceUpdate);

    // Also listen for custom events (when balance is updated in same tab)
    const handleCustomBalanceUpdate = (event: CustomEvent) => {
      if (event.detail?.balance !== undefined) {
        const newBalance = Number(event.detail.balance);
        setWalletBalance(newBalance);
        setHasWallet(true);
      }
    };

    window.addEventListener('walletBalanceUpdated', handleCustomBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleBalanceUpdate);
      window.removeEventListener('walletBalanceUpdated', handleCustomBalanceUpdate as EventListener);
    };
  }, []);

  // Refresh balance when component becomes visible (e.g., navigating back from wallet page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasWallet) {
        // Always refresh balance when page becomes visible
        fetchWalletBalance();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasWallet]);

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      if (!isAuthenticated || !user) {
        return;
      }

      try {
        // Check if user can have wallet
        const userCanHaveWallet = user?.can_have_wallet === true;
        const userType: any = user?.user_type;
        
        // Determine if user is a student
        let isStudent = false;
        if (userType !== undefined && userType !== null) {
          if (typeof userType === "string") {
            isStudent = userType.toLowerCase() === "student";
          } else if (typeof userType === "number") {
            isStudent = userType === 1;
          }
        }
        
        // Show wallet option if user has wallet OR is a student (so they can request access)
        const shouldShowWallet = userCanHaveWallet || isStudent;
        setShowWalletOption(shouldShowWallet);
        
        // Fetch wallet balance if user has wallet access
        if (userCanHaveWallet && isMounted) {
          await fetchWalletBalance();
        }
        
        // Check join requests only for students without wallet (async, non-blocking)
        if (!userCanHaveWallet && isStudent && isMounted && !joinRequestsFetchingRef.current) {
          checkJoinRequests();
        }
      } catch (error) {
        // Silently handle errors
      }
    };

    const checkJoinRequests = async () => {
      if (!isMounted || joinRequestsFetchingRef.current) return;
      joinRequestsFetchingRef.current = true;
      
      try {
        // Check cache first
        const cachedRequests = localStorage.getItem('wallet_join_requests');
        const cachedTimestamp = localStorage.getItem('wallet_join_requests_timestamp');
        const now = Date.now();
        const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for join requests
        
        if (cachedRequests && cachedTimestamp && (now - parseInt(cachedTimestamp)) < CACHE_DURATION) {
          try {
            const requests = JSON.parse(cachedRequests);
            if (requests && isMounted) {
              const approvedRequest = requests.find((req: any) => req.status === "APPROVED");
              if (approvedRequest) {
                setHasWallet(true);
                await fetchWalletBalance();
                joinRequestsFetchingRef.current = false;
                return;
              }
            }
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }
        
        const requestsResponse = await apiClient.getWalletJoinRequests();
        if (requestsResponse.data && requestsResponse.data.requests && isMounted) {
          // Cache the response
          localStorage.setItem('wallet_join_requests', JSON.stringify(requestsResponse.data.requests));
          localStorage.setItem('wallet_join_requests_timestamp', String(now));
          
          const approvedRequest = requestsResponse.data.requests.find(
            (req: any) => req.status === "APPROVED"
          );
          if (approvedRequest) {
            setHasWallet(true);
            await fetchWalletBalance();
          }
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        joinRequestsFetchingRef.current = false;
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated]);

  const fetchWalletBalance = async () => {
    // Prevent multiple simultaneous calls
    if (balanceFetchingRef.current) {
      return;
    }
    
    balanceFetchingRef.current = true;
    
    try {
      const response = await apiClient.getWalletBalance();
      
      // Check if response.data exists and has balance
      if (response.data && response.data.balance !== undefined) {
        const balance = Number(response.data.balance);
        setWalletBalance(balance);
        // Set hasWallet to true when balance is successfully fetched
        setHasWallet(true);
      } else if (response.data && typeof response.data === 'object' && 'balance' in response.data) {
        // Handle case where balance might be directly in response.data
        const balance = Number(response.data.balance);
        setWalletBalance(balance);
        setHasWallet(true);
      } else {
        // Fallback to full wallet endpoint if balance endpoint fails
        const walletResponse = await apiClient.getWallet();
        if (walletResponse.data?.balance !== undefined) {
          const balance = Number(walletResponse.data.balance);
          setWalletBalance(balance);
          // Set hasWallet to true when balance is successfully fetched
          setHasWallet(true);
        } else {
          // No wallet found
          setHasWallet(false);
        }
      }
    } catch (error) {
      // Silently handle wallet errors
      setHasWallet(false);
    } finally {
      balanceFetchingRef.current = false;
    }
  };


  const handleSignOut = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/dashboard")}
        >
          <img 
            src="/IITR_Logo.svg" 
            alt="IITR Logo" 
            className="h-10 w-10"
          />
          <h1 className="text-2xl font-bold">
            INSTITUTE INSTRUMENTATION CENTRE - IIC
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm font-medium"
            title="Home"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </button>
          <NotificationPanel />
          {hasWallet && (
            <div className="text-sm">
              <span className="text-muted-foreground">Balance:</span>{" "}
              <span className="font-semibold">₹{walletBalance.toFixed(2)}</span>
            </div>
          )}
          {showWalletOption && !hasWallet && (
            <div className="text-sm text-muted-foreground">
              Request Wallet Access
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
              {isAdminPanelUser && (
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/tickets")}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Support Tickets</span>
              </DropdownMenuItem>
              {showWalletOption && (
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
  );
};

export default DashboardHeader;

