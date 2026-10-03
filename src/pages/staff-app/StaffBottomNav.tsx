import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, ClipboardList, Home, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/app", label: "Today", icon: Home, end: true },
  { to: "/booking-management", label: "Bookings", icon: ClipboardList, end: true },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays, end: true },
  { to: "/app/more", label: "More", icon: Menu, end: true },
] as const;

export default function StaffBottomNav() {
  useEffect(() => {
    document.documentElement.classList.add("iic-staff-nav");
    return () => document.documentElement.classList.remove("iic-staff-nav");
  }, []);

  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-3xl grid-cols-4">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", isActive && "bg-primary/10")}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
