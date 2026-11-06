import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * Who sees which home and bottom navigation inside the Android / iOS app. Nothing here affects the website.
 * - staff: Officers In Charge and Lab Operators (Today, their job list and calendar);
 * - admin: roles that manage the portal keep the full dashboard as their home;
 * - user: everyone who books equipment.
 */
export type AppAudience = "staff" | "admin" | "user";

const STAFF = new Set(["manager", "operator"]);
const ADMIN = new Set(["admin", "dept_admin", "finance", "external_relations", "hod", "oc_stores", "org_admin"]);

export function appAudienceFor(userType: unknown): AppAudience {
  const type = String(userType ?? "").toLowerCase();
  if (STAFF.has(type)) return "staff";
  return ADMIN.has(type) ? "admin" : "user";
}

export type AppNavKey = "home" | "equipment" | "bookings" | "calendar" | "calls" | "more";

export type AppNavItem = { key: AppNavKey; to: string; label: string };

const CALLS: AppNavItem = { key: "calls", to: "/app/calls", label: "Calls" };
const MORE: AppNavItem = { key: "more", to: "/app/more", label: "More" };

export function appNavItems(audience: AppAudience): AppNavItem[] {
  if (audience === "staff") {
    return [
      { key: "home", to: "/app", label: "Today" },
      { key: "bookings", to: "/booking-management", label: "Bookings" },
      { key: "calendar", to: "/app/calendar", label: "Calendar" },
      CALLS,
      MORE,
    ];
  }
  if (audience === "admin") {
    return [
      { key: "home", to: "/dashboard", label: "Dashboard" },
      { key: "equipment", to: "/app/equipment", label: "Equipment" },
      { key: "bookings", to: "/booking-management", label: "Bookings" },
      CALLS,
      MORE,
    ];
  }
  return [
    { key: "home", to: "/app", label: "Home" },
    { key: "equipment", to: "/app/equipment", label: "Equipment" },
    { key: "bookings", to: "/app/bookings", label: "Bookings" },
    CALLS,
    MORE,
  ];
}

/** The bottom navigation stays on the top level of each section; a detail screen or a flow gets the whole screen. */
export function isAppNavPath(pathname: string, audience: AppAudience): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return appNavItems(audience).some((item) => item.to === path);
}

/** The app audience of the signed-in user, or null on the website and before sign-in. */
export function useAppAudience(): AppAudience | null {
  const { user } = useAuth();
  if (!isNativeApp() || !user) return null;
  return appAudienceFor(user.user_type);
}
