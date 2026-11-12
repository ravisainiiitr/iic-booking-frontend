import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, ClipboardList, FlaskConical, Home, Menu, Phone } from "lucide-react";
import { useCalls } from "@/components/calls/CallProvider";
import { apiClient } from "@/lib/api";
import { appNavItems, unseenMissedCalls, type AppAudience, type AppNavKey } from "@/lib/appShell";
import { isMissedCall } from "@/lib/callEngine";
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
  const { pathname } = useLocation();
  const { enabled: callsEnabled, state: callState } = useCalls();
  const [missed, setMissed] = useState(0);
  const callEnded = callState.phase === "ended";

  // Checked on changing section and after a call, not on a timer: the navigation should cost no battery while idle.
  useEffect(() => {
    if (!callsEnabled || pathname === "/app/calls") {
      setMissed(0);
      return;
    }
    let cancelled = false;
    void apiClient.getCallHistory().then((res) => {
      if (cancelled) return;
      setMissed(unseenMissedCalls((res.data?.results ?? []).filter(isMissedCall).map((c) => c.created_at)));
    });
    return () => {
      cancelled = true;
    };
  }, [callsEnabled, pathname, callEnded]);
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
                  <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full", isActive && "bg-primary/10")}>
                    <Icon className="h-5 w-5" aria-hidden />
                    {key === "calls" && missed > 0 ? (
                      <span className="absolute right-1.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                        {missed > 9 ? "9+" : missed}
                        <span className="sr-only"> missed calls</span>
                      </span>
                    ) : null}
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
