import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import {
  createPath,
  parsePath,
  resolvePath,
  NavigationType,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_RouteContext as RouteContext,
  type Location,
  type Navigator,
  type To,
} from "react-router-dom";
import { EmbeddedModeProvider } from "@/contexts/EmbeddedModeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const AppRoutes = lazy(() => import("@/routes/AppRoutes"));

function toLocation(path: string, state: unknown = null): Location {
  const parsed = parsePath(path.startsWith("/") ? path : `/${path}`);
  return {
    pathname: parsed.pathname || "/",
    search: parsed.search || "",
    hash: parsed.hash || "",
    state,
    key: Math.random().toString(36).slice(2, 10),
  };
}

function resolveTo(to: To, fromPathname: string): { pathname: string; search: string; hash: string } {
  if (typeof to === "number") {
    return { pathname: fromPathname, search: "", hash: "" };
  }
  return resolvePath(typeof to === "string" ? parsePath(to) : to, fromPathname);
}

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function WorkspaceExitGuard({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (isDashboardPath(pathname)) {
      onClose();
    }
  }, [pathname, onClose]);
  return null;
}

type DashboardWorkspaceProps = {
  initialPath: string;
  onClose: () => void;
  onPathChange?: (pathname: string) => void;
};

/**
 * In-panel SPA host for dashboard menu destinations.
 * Does not mount a nested <Router> (forbidden by React Router 6).
 * Instead it supplies Navigation/Location context with an in-memory navigator
 * so child pages keep using useNavigate/Link without leaving /dashboard.
 */
export default function DashboardWorkspace({
  initialPath,
  onClose,
  onPathChange,
}: DashboardWorkspaceProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const entry = initialPath.startsWith("/") ? initialPath : `/${initialPath}`;
  const [location, setLocation] = useState<Location>(() => toLocation(entry));
  const stackRef = useRef<Location[]>([toLocation(entry)]);
  const indexRef = useRef(0);

  // Remount path when parent passes a new initialPath via key=; keep state in sync if same instance reused
  useEffect(() => {
    const next = toLocation(entry);
    stackRef.current = [next];
    indexRef.current = 0;
    setLocation(next);
  }, [entry]);

  const navigator = useMemo<Navigator>(() => {
    const commit = (next: Location, replace: boolean) => {
      if (isDashboardPath(next.pathname)) {
        handleClose();
        return;
      }
      if (replace) {
        stackRef.current[indexRef.current] = next;
      } else {
        stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
        stackRef.current.push(next);
        indexRef.current = stackRef.current.length - 1;
      }
      setLocation(next);
    };

    return {
      createHref: (to) => {
        const resolved = resolveTo(to, location.pathname);
        return createPath(resolved);
      },
      push: (to, state) => {
        const resolved = resolveTo(to, location.pathname);
        commit(
          {
            pathname: resolved.pathname,
            search: resolved.search || "",
            hash: resolved.hash || "",
            state: state ?? null,
            key: Math.random().toString(36).slice(2, 10),
          },
          false,
        );
      },
      replace: (to, state) => {
        const resolved = resolveTo(to, location.pathname);
        commit(
          {
            pathname: resolved.pathname,
            search: resolved.search || "",
            hash: resolved.hash || "",
            state: state ?? null,
            key: location.key,
          },
          true,
        );
      },
      go: (delta) => {
        const nextIndex = indexRef.current + delta;
        if (nextIndex < 0 || nextIndex >= stackRef.current.length) return;
        indexRef.current = nextIndex;
        const next = stackRef.current[nextIndex];
        if (isDashboardPath(next.pathname)) {
          handleClose();
          return;
        }
        setLocation(next);
      },
    };
  }, [location.pathname, location.key, handleClose]);

  const navigationContext = useMemo(
    () => ({
      basename: "/",
      navigator,
      static: false,
      future: { v7_relativeSplatPath: false, v7_startTransition: false },
    }),
    [navigator],
  );

  const locationContext = useMemo(
    () => ({ location, navigationType: NavigationType.Pop }),
    [location],
  );

  const routeContext = useMemo(
    () => ({ outlet: null, matches: [], isDataRoute: false as const }),
    [],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPathChange?.(location.pathname);
  }, [location.pathname, onPathChange]);

  // Keep the Book CTA / page header visible when drilling into equipment details
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    if (el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: "start" });
    }
  }, [location.pathname, location.search, location.key]);

  return (
    <EmbeddedModeProvider onClose={handleClose}>
      <NavigationContext.Provider value={navigationContext}>
        <LocationContext.Provider value={locationContext}>
          <RouteContext.Provider value={routeContext}>
            <WorkspaceExitGuard pathname={location.pathname} onClose={handleClose} />
            <div
              ref={scrollRef}
              className="embedded-workspace min-h-[calc(100vh-10rem)] scroll-mt-20 bg-background rounded-b-xl [&_.page-shell]:min-h-0 [&_.page-shell]:py-0 [&_.dashboard-page]:min-h-0"
            >
              <ErrorBoundary fallbackTitle="Workspace Error" backPath="/dashboard">
                <Suspense
                  fallback={
                    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  }
                >
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </div>
          </RouteContext.Provider>
        </LocationContext.Provider>
      </NavigationContext.Provider>
    </EmbeddedModeProvider>
  );
}