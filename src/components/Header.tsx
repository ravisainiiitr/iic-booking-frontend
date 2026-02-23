import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { apiClient, type CmsMenuItem } from "@/lib/api";
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
import { Calendar, FlaskConical, ChevronDown, Settings, User as UserIcon, Wallet, LogOut, HelpCircle } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import NotificationPanel from "@/components/NotificationPanel";
import TicketForm from "@/components/TicketForm";
import { toast } from "sonner";

const Header = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuItems, setMenuItems] = useState<CmsMenuItem[] | null>(null);
  const checkingRef = useRef(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    apiClient.getCmsMenu().then((res) => {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setMenuItems(res.data);
      }
    }).catch(() => {});
  }, []);
  
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
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <img 
              src="/IITR_Logo.svg" 
              alt="IITR Logo" 
              className="h-8 w-8"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              INSTITUTE INSTRUMENTATION CENTRE - IIC
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {menuItems && menuItems.length > 0 ? (
              <>
                {menuItems.map((item) => {
                  const isTrigger = item.link_type === "trigger" || item.label.toLowerCase() === "contact us";
                  const docUrl = item.document_url;
                  const pageSlug = item.page_slug;
                  const href = docUrl
                    ? docUrl
                    : pageSlug
                      ? `/page/${pageSlug}`
                      : item.link_type === "internal_route"
                        ? item.url
                        : item.url
                          ? (item.link_type === "external_url" ? item.url : `${window.location.pathname === "/" ? "" : "/"}${item.url}`)
                          : "#";
                  if (item.children && item.children.length > 0) {
                    return (
                      <NavigationMenu key={item.id}>
                        <NavigationMenuList>
                          <NavigationMenuItem>
                            <NavigationMenuTrigger className="text-sm font-medium">
                              {item.label}
                            </NavigationMenuTrigger>
                            <NavigationMenuContent>
                              <ul className="grid w-[200px] gap-1 p-2">
                                {item.children.map((child) => {
                                  const childDocUrl = child.document_url;
                                  const childPageSlug = child.page_slug;
                                  const childHref = childDocUrl
                                    ? childDocUrl
                                    : childPageSlug
                                      ? `/page/${childPageSlug}`
                                      : child.link_type === "internal_route"
                                        ? child.url
                                        : child.url || "#";
                                  const isChildInternalRoute = child.link_type === "internal_route" && !childDocUrl && !childPageSlug;
                                  return (
                                    <li key={child.id}>
                                      <NavigationMenuLink asChild>
                                        {isChildInternalRoute ? (
                                          <a
                                            href={child.url}
                                            onClick={(e) => { e.preventDefault(); navigate(child.url); }}
                                            className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                          >
                                            {child.label}
                                          </a>
                                        ) : (
                                          <a
                                            href={childHref}
                                            onClick={childPageSlug ? (e) => { e.preventDefault(); navigate(childHref); } : undefined}
                                            className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                            {...(child.open_in_new_tab || childDocUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                          >
                                            {child.label}
                                          </a>
                                        )}
                                      </NavigationMenuLink>
                                    </li>
                                  );
                                })}
                              </ul>
                            </NavigationMenuContent>
                          </NavigationMenuItem>
                        </NavigationMenuList>
                      </NavigationMenu>
                    );
                  }
                  if (isTrigger) {
                    return (
                      <TicketForm
                        key={item.id}
                        trigger={
                          <button className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1">
                            {item.label}
                          </button>
                        }
                      />
                    );
                  }
                  if ((item.link_type === "internal_route" && !docUrl) || pageSlug) {
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(pageSlug ? `/page/${pageSlug}` : (item.url || "/"))}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {item.label}
                      </button>
                    );
                  }
                  const isAnchor = item.link_type === "internal_anchor" && href.startsWith("#") && !docUrl && !pageSlug;
                  if (isAnchor && window.location.pathname !== "/") {
                    return (
                      <button
                        key={item.id}
                        onClick={() => { navigate("/"); setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }), 100); }}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <a
                      key={item.id}
                      href={href}
                      onClick={pageSlug ? (e) => { e.preventDefault(); navigate(href); } : undefined}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      {...(item.open_in_new_tab || docUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (window.location.pathname === "/") {
                      document.getElementById("equipment")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      navigate("/");
                      setTimeout(() => document.getElementById("equipment")?.scrollIntoView({ behavior: "smooth" }), 100);
                    }
                  }}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Facilities
                </button>
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className="text-sm font-medium">Our Team</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-1 p-2">
                          {[
                            { label: "Head", anchor: "#team-head" },
                            { label: "Faculty", anchor: "#team-faculty" },
                            { label: "CAC", anchor: "#team-cac" },
                            { label: "Officers", anchor: "#team-officers" },
                            { label: "Other Staff", anchor: "#team-staff" },
                            { label: "Students", anchor: "#team-students" },
                          ].map(({ label, anchor }) => (
                            <li key={anchor}>
                              <NavigationMenuLink asChild>
                                <a href={anchor} className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                                  {label}
                                </a>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
                <a href="#outreach" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Outreach</a>
                <a href="#important-links" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Important Links</a>
                <TicketForm trigger={<button className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1">Contact Us</button>} />
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NotificationPanel />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={user?.profile_picture || undefined} alt={user?.name || "User"} />
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
                    <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Admin</span>
                      </DropdownMenuItem>
                    )}
                    {user?.can_have_wallet && (
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
