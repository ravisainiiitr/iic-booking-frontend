import { FlaskConical } from "lucide-react";
import TicketForm from "@/components/TicketForm";
import { useAuth } from "@/contexts/AuthContext";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { Link } from "react-router-dom";

const Footer = () => {
  const { isAuthenticated } = useAuth();
  const { openGuide } = useUserGuide();

  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Institute Equipment Booking Portal
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              IIT Roorkee&apos;s institute-wide platform for booking laboratory equipment across departments, centres, and laboratories.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/equipments" className="hover:text-primary transition-colors">
                  Equipment Catalog
                </Link>
              </li>
              <li>
                <Link to="/equipments" className="hover:text-primary transition-colors">
                  Booking Calendar
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-primary transition-colors">
                  User Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className="hover:text-primary transition-colors text-left"
                    onClick={() => openGuide({ force: true })}
                  >
                    User Guide
                  </button>
                ) : (
                  <Link to="/auth" className="hover:text-primary transition-colors">
                    User Guide (sign in)
                  </Link>
                )}
              </li>
              <li>
                <Link to="/tickets" className="hover:text-primary transition-colors">
                  Support Tickets
                </Link>
              </li>
              <li>
                <TicketForm
                  trigger={
                    <button type="button" className="hover:text-primary transition-colors flex items-center gap-1">
                      Support
                    </button>
                  }
                />
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Email: iicbooking@iitr.ac.in</li>
              <li>Hours: 24/7 Online Support</li>
              <li>Indian Institute of Technology Roorkee</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Institute Equipment Booking Portal, IIT Roorkee. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
