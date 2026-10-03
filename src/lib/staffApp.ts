import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/nativeApp";

/** Roles that get the simplified app home (Today · Bookings · Calendar · More). */
const STAFF_APP_USER_TYPES = new Set(["manager", "operator"]);

export function isStaffAppUserType(userType: unknown): boolean {
  return STAFF_APP_USER_TYPES.has(String(userType ?? "").toLowerCase());
}

/** Pages that show the app's bottom navigation for Officers In Charge and Lab Operators. */
export const STAFF_APP_NAV_PATHS = ["/app", "/app/calendar", "/app/more", "/booking-management"] as const;

export function isStaffAppNavPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (STAFF_APP_NAV_PATHS as readonly string[]).includes(path);
}

/** True inside the Android app for an Officer In Charge or Lab Operator. */
export function useStaffAppShell(): boolean {
  const { user } = useAuth();
  return isNativeApp() && isStaffAppUserType(user?.user_type);
}
