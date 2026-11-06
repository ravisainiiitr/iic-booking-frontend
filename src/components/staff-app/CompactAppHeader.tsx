import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useNotifications } from "@/contexts/NotificationContext";
import iitrLogo128 from "@/assets/iitr-logo-128.webp";

/** The header of website pages opened inside the app: Back, the IITR mark and notifications, on one slim line. */
export default function CompactAppHeader() {
  const { unreadCount } = useNotifications();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-3">
        <BackButton className="h-11 w-11 rounded-full border-0 p-0" />
        <Link to="/app" aria-label="Home" className="flex min-w-0 flex-1 items-center gap-2">
          <img src={iitrLogo128} width={28} height={28} alt="" className="h-7 w-7 shrink-0 object-contain" />
          <span className="truncate text-sm font-semibold text-foreground">IIT Roorkee Equipment Booking</span>
        </Link>
        <Link to="/app/notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted">
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden /> : null}
        </Link>
      </div>
    </header>
  );
}
