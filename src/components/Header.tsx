import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar, FlaskConical, ChevronDown, Settings } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import NotificationPanel from "@/components/NotificationPanel";

const Header = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const token = apiClient.getToken();
    if (token) {
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.data) {
        const adminCheck = await apiClient.checkAdminRole(userResponse.data.id);
        setIsAdmin(!!adminCheck.data);
      }
    }
  };
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              IIC Booking
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Home
            </a>
            <a href="#facilities" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Facilities
            </a>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-sm font-medium">
                    Our Team
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-head" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            Head
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-faculty" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            Faculty
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-cac" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            CAC
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-officers" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            Officers
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-staff" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            Other Staff
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <a href="#team-students" className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                            Students
                          </a>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <a href="#booking" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Booking
            </a>
            <a href="#outreach" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Outreach
            </a>
            <a href="#important-links" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Important Links
            </a>
            <a href="#contact-us" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Contact Us
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <NotificationPanel />
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
