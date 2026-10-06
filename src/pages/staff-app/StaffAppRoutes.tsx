import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { appAudienceRefused, APP_NOT_AVAILABLE_PATH, APP_SIGN_IN_PATH } from "@/lib/nativeApp";
import { isStaffAppUserType } from "@/lib/staffApp";

const AppSignIn = lazy(() => import("./AppSignIn"));
const AppSetupLock = lazy(() => import("./AppSetupLock"));
const AppNotAvailable = lazy(() => import("./AppNotAvailable"));
const StaffToday = lazy(() => import("./StaffToday"));
const StaffCalendar = lazy(() => import("./StaffCalendar"));
const StaffMore = lazy(() => import("./StaffMore"));

function Spinner() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Signed-in staff pages. Other roles allowed into the app (e.g. administrators) use the full dashboard. */
function StaffOnly({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  if (appAudienceRefused()) return <Navigate to={APP_NOT_AVAILABLE_PATH} replace />;
  if (loading && !user) return <Spinner />;
  if (!isAuthenticated) return <Navigate to={APP_SIGN_IN_PATH} replace />;
  if (!isStaffAppUserType(user?.user_type)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function StaffAppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="sign-in" element={<AppSignIn />} />
        <Route path="setup-lock" element={<AppSetupLock />} />
        <Route path="not-available" element={<AppNotAvailable />} />
        <Route index element={<StaffOnly><StaffToday /></StaffOnly>} />
        <Route path="calendar" element={<StaffOnly><StaffCalendar /></StaffOnly>} />
        <Route path="more" element={<StaffOnly><StaffMore /></StaffOnly>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
