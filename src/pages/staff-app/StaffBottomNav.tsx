import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, ClipboardList, FlaskConical, Home, Menu, Phone } from "lucide-react";
import { appNavItems, type AppAudience, type AppNavKey } from "@/lib/appShell";
import { cn } from "@/lib/utils";

const ICONS: Record<AppNavKey, typeof Home> = {
  home: Home,
  equipment: FlaskConical,
  bookings: ClipboardList,
  calendar: CalendarDays,
  calls: Phone,
  more: Menu,
};

/** The app's bottom navigation; its sections depend on who is signed in (see appShell). */
export default function StaffBottomNav({ audience = "staff" }: { audience?: AppAudience }) {
  const items = appNavItems(audience);
  useEffect(() => {
    document.documentElement.classList.add("iic-staff-nav");
    return () => document.documentElement.classList.remove("iic-staff-nav");
  }, []);

  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-3xl grid-cols-5">
        {items.map(({ key, to, label }) => {
          const Icon = ICONS[key];
          return (
          <li key={to}>
            <NavLink
              to={to}
              end
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
          );
        })}
      </ul>
    </nav>
  );
}
