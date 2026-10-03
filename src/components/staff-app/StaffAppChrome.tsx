import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { isStaffAppNavPath, useStaffAppShell } from "@/lib/staffApp";

const StaffBottomNav = lazy(() => import("@/pages/staff-app/StaffBottomNav"));

/** App-only bottom navigation for Officers In Charge and Lab Operators (never loaded on the website). */
export default function StaffAppChrome() {
  const { pathname } = useLocation();
  const staffShell = useStaffAppShell();
  if (!staffShell || !isStaffAppNavPath(pathname)) return null;
  return (
    <Suspense fallback={null}>
      <StaffBottomNav />
    </Suspense>
  );
}
