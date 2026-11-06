import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { appAudienceRefused, APP_NOT_AVAILABLE_PATH, APP_SIGN_IN_PATH } from "@/lib/nativeApp";
import { appAudienceFor } from "@/lib/appShell";

const AppSignIn = lazy(() => import("./AppSignIn"));
const AppSetupLock = lazy(() => import("./AppSetupLock"));
const AppNotAvailable = lazy(() => import("./AppNotAvailable"));
const StaffToday = lazy(() => import("./StaffToday"));
const StaffCalendar = lazy(() => import("./StaffCalendar"));
const StaffMore = lazy(() => import("./StaffMore"));
const AppHome = lazy(() => import("@/pages/mobile-app/AppHome"));
const AppEquipment = lazy(() => import("@/pages/mobile-app/AppEquipment"));
const AppEquipmentDetail = lazy(() => import("@/pages/mobile-app/AppEquipmentDetail"));
const AppBookings = lazy(() => import("@/pages/mobile-app/AppBookings"));
const AppBookingDetail = lazy(() => import("@/pages/mobile-app/AppBookingDetail"));
const AppCalls = lazy(() => import("@/pages/mobile-app/AppCalls"));
const AppNotifications = lazy(() => import("@/pages/mobile-app/AppNotifications"));

function Spinner() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Signed-in app pages. */
function SignedIn({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  if (appAudienceRefused()) return <Navigate to={APP_NOT_AVAILABLE_PATH} replace />;
  if (loading && !user) return <Spinner />;
  if (!isAuthenticated) return <Navigate to={APP_SIGN_IN_PATH} replace />;
  return <>{children}</>;
}

/** Home differs by role: lab staff see Today, administrators their dashboard, everyone else the booking home. */
function Home() {
  const { user } = useAuth();
  const audience = appAudienceFor(user?.user_type);
  if (audience === "admin") return <Navigate to="/dashboard" replace />;
  return audience === "staff" ? <StaffToday /> : <AppHome />;
}

/** The calendar is the lab's own working view. */
function StaffOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (appAudienceFor(user?.user_type) !== "staff") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function StaffAppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="sign-in" element={<AppSignIn />} />
        <Route path="setup-lock" element={<AppSetupLock />} />
        <Route path="not-available" element={<AppNotAvailable />} />
        <Route index element={<SignedIn><Home /></SignedIn>} />
        <Route path="calendar" element={<SignedIn><StaffOnly><StaffCalendar /></StaffOnly></SignedIn>} />
        <Route path="more" element={<SignedIn><StaffMore /></SignedIn>} />
        <Route path="equipment" element={<SignedIn><AppEquipment /></SignedIn>} />
        <Route path="equipment/:id" element={<SignedIn><AppEquipmentDetail /></SignedIn>} />
        <Route path="bookings" element={<SignedIn><AppBookings /></SignedIn>} />
        <Route path="bookings/:id" element={<SignedIn><AppBookingDetail /></SignedIn>} />
        <Route path="calls" element={<SignedIn><AppCalls /></SignedIn>} />
        <Route path="notifications" element={<SignedIn><AppNotifications /></SignedIn>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
