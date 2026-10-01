import { Clock, FlaskConical, Mail, MapPin, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { Link } from "react-router-dom";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";

const LINK_CLASS = "hover:text-primary transition-colors";
const HEADING_CLASS = "text-sm font-semibold text-foreground mb-2";
const LIST_CLASS = "space-y-1 text-sm text-muted-foreground";
const ICON_CLASS = "h-3.5 w-3.5 shrink-0 text-primary/80 dark:text-sky-300/80";

const Footer = () => {
  const { isAuthenticated } = useAuth();
  const { openGuide } = useUserGuide();
  const embedded = useEmbeddedMode();
  const isEmbed =
    embedded ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("embed") === "1");

  if (isEmbed) {
    return null;
  }

  return (
    <footer className="bg-card border-t border-border pt-5 pb-3">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-[auto_1fr_1fr_auto] lg:gap-x-12 mb-4">
          <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-base font-bold leading-tight sm:whitespace-nowrap bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Institute Equipment Booking Portal
              </span>
            </div>
            <p className="max-w-xs text-sm leading-snug text-muted-foreground">
              Book laboratory equipment across departments, centres and labs.
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className={ICON_CLASS} aria-hidden="true" />
              <span>Indian Institute of Technology Roorkee</span>
            </p>
          </div>

          <div>
            <h4 className={HEADING_CLASS}>Platform</h4>
            <ul className={LIST_CLASS}>
              <li>
                <Link to="/equipments" className={LINK_CLASS}>
                  Equipment Catalog
                </Link>
              </li>
              <li>
                <Link to="/booking-calendar" className={LINK_CLASS}>
                  Booking Calendar
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className={LINK_CLASS}>
                  User Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Rightmost on md+: its two links leave the bottom-right free for the fixed Booking Assistant button. */}
          <div className="md:order-last">
            <h4 className={HEADING_CLASS}>Resources</h4>
            <ul className={LIST_CLASS}>
              <li>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className={`${LINK_CLASS} text-left`}
                    onClick={() => openGuide({ force: true })}
                  >
                    User Guide
                  </button>
                ) : (
                  <Link to="/auth" className={LINK_CLASS}>
                    User Guide (sign in)
                  </Link>
                )}
              </li>
              <li>
                <Link to="/tickets" className={LINK_CLASS}>
                  Support Tickets
                </Link>
              </li>
            </ul>
          </div>

          <div id="contact" className="col-span-2 md:col-span-1">
            <h4 className={HEADING_CLASS}>Contact Us</h4>
            <ul className={LIST_CLASS}>
              <li className="flex items-center gap-2">
                <Phone className={ICON_CLASS} aria-hidden="true" />
                <span className="sr-only">Tel: </span>
                <a href="tel:01332284350" className={LINK_CLASS}>
                  01332-284350
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className={ICON_CLASS} aria-hidden="true" />
                <span className="sr-only">Email: </span>
                <a href="mailto:iic@iitr.ac.in" className={LINK_CLASS}>
                  iic@iitr.ac.in
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className={ICON_CLASS} aria-hidden="true" />
                <span>24/7 Online Support</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-3 pr-16 text-xs text-muted-foreground sm:pr-52">
          <p>&copy; {new Date().getFullYear()} Institute Equipment Booking Portal, IIT Roorkee. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
