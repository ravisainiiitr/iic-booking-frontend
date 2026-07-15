import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Settings, User as UserIcon, Wallet, LogOut, Package, ClipboardList, HelpCircle } from "lucide-react";
import NotificationPanel from "@/components/NotificationPanel";
import { toast } from "sonner";
import IITRBanner from "@/components/IITRBanner";

const Header = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const checkingRef = useRef(false);
  const hasCheckedRef = useRef(false);
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : '';
  const canManageBookings = ['admin', 'operator', 'manager'].includes(userTypeStr);

  useEffect(() => {
    // Only check admin status once if authenticated
    if (isAuthenticated && user && !hasCheckedRef.current && !checkingRef.current) {
      checkAdminStatus();
    } else if (!isAuthenticated) {
      setIsAdmin(false);
      hasCheckedRef.current = false;
    }
  }, [isAuthenticated, user]);

  const checkAdminStatus = async () => {
    // Prevent multiple simultaneous calls
    if (checkingRef.current || !user) {
      return;
    }

    // User type from API (e.g. "admin") grants admin panel access even if checkAdminRole fails
    if (apiClient.isAdminPanelUser(user.user_type)) {
      setIsAdmin(true);
      localStorage.setItem('is_admin', 'true');
      localStorage.setItem('admin_check_user_id', String(user.id));
      return;
    }

    try {
      checkingRef.current = true;
      hasCheckedRef.current = true;

      const cachedAdminStatus = localStorage.getItem('is_admin');
      const cachedUserId = localStorage.getItem('admin_check_user_id');

      if (cachedAdminStatus !== null && cachedUserId === String(user.id)) {
        setIsAdmin(cachedAdminStatus === 'true');
        checkingRef.current = false;
        return;
      }

      const adminCheck = await apiClient.checkAdminRole(user.id.toString());
      const isAdminValue = adminCheck.data?.is_admin === true;
      setIsAdmin(isAdminValue);

      localStorage.setItem('is_admin', String(isAdminValue));
      localStorage.setItem('admin_check_user_id', String(user.id));
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      checkingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      navigate("/");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to log out");
    }
  };

  const safeNavigate = (path: string) => {
    if (!path) return;
    if (window.location.pathname === path) return;
    navigate(path);
    // Fallback: if SPA route render doesn't happen, force navigation.
    window.setTimeout(() => {
      if (window.location.pathname !== path) {
        window.location.assign(path);
      }
    }, 80);
  };
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <IITRBanner size="sm" />
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NotificationPanel />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={user?.profile_picture ? (user?.id != null ? apiClient.getProfilePictureUrl(user.id) : user.profile_picture) : undefined} alt={user?.name || "User"} />
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
                    <DropdownMenuItem onClick={() => safeNavigate("/dashboard")}>
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => safeNavigate("/equipments")}>
                      <Package className="mr-2 h-4 w-4" />
                      <span>Browse Equipment</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => safeNavigate(canManageBookings ? "/booking-management" : "/my-bookings")}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      <span>{canManageBookings ? "Manage booking" : "My Booking"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => safeNavigate("/profile")}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => safeNavigate("/tickets")}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Support Tickets</span>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => safeNavigate("/dashboard")}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Admin</span>
                      </DropdownMenuItem>
                    )}
                    {user?.can_have_wallet && (
                      <DropdownMenuItem onClick={() => safeNavigate("/wallet")}>
                        <Wallet className="mr-2 h-4 w-4" />
                        <span>Wallet</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
