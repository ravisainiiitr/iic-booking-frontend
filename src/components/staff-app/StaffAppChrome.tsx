import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { isAppNavPath, useAppAudience } from "@/lib/appShell";

const StaffBottomNav = lazy(() => import("@/pages/staff-app/StaffBottomNav"));

/** App-only bottom navigation (never loaded on the website). */
export default function StaffAppChrome() {
  const { pathname } = useLocation();
  const audience = useAppAudience();
  if (!audience || !isAppNavPath(pathname, audience)) return null;
  return (
    <Suspense fallback={null}>
      <StaffBottomNav audience={audience} />
    </Suspense>
  );
}
