import { useCallback, useEffect, lazy, Suspense } from "react";
import {
  MemoryRouter,
  useLocation,
  UNSAFE_NavigationContext as NavigationContext,
} from "react-router-dom";
import { EmbeddedModeProvider } from "@/contexts/EmbeddedModeContext";
import { Loader2 } from "lucide-react";

const AppRoutes = lazy(() => import("@/routes/AppRoutes"));

function WorkspaceExitGuard({ onClose }: { onClose: () => void }) {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (path === "/dashboard" || path.startsWith("/dashboard/")) {
      onClose();
    }
  }, [location.pathname, onClose]);

  return null;
}

type DashboardWorkspaceProps = {
  initialPath: string;
  onClose: () => void;
};

/**
 * Renders dashboard menu destinations in-panel (same React tree) instead of an iframe.
 * Browser URL stays on /dashboard; navigations stay inside MemoryRouter.
 *
 * React Router 6 forbids nesting routers. We temporarily clear NavigationContext so
 * MemoryRouter can mount as an independent in-panel router.
 */
export default function DashboardWorkspace({
  initialPath,
  onClose,
}: DashboardWorkspaceProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const entry = initialPath.startsWith("/") ? initialPath : `/${initialPath}`;

  return (
    <EmbeddedModeProvider onClose={handleClose}>
      {/* Detach from BrowserRouter so MemoryRouter is allowed */}
      <NavigationContext.Provider value={null as never}>
        <MemoryRouter initialEntries={[entry]}>
          <WorkspaceExitGuard onClose={handleClose} />
          <div className="embedded-workspace min-h-[70vh] max-h-[calc(100vh-10rem)] overflow-y-auto bg-background rounded-b-xl [&_.page-shell]:min-h-0 [&_.page-shell]:py-0 [&_.dashboard-page]:min-h-0">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              }
            >
              <AppRoutes />
            </Suspense>
          </div>
        </MemoryRouter>
      </NavigationContext.Provider>
    </EmbeddedModeProvider>
  );
}