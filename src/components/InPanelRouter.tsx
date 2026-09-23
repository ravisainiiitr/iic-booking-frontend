import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createPath,
  parsePath,
  resolvePath,
  NavigationType,
  Routes,
  Route,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_RouteContext as RouteContext,
  type Location,
  type Navigator,
  type To,
} from "react-router-dom";
import { EmbeddedModeProvider } from "@/contexts/EmbeddedModeContext";

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

type InPanelRouterProps = {
  /** Absolute path including query, e.g. `/book-equipment?equipment_id=1&mode=calculate&embed=1` */
  initialPath: string;
  onClose: () => void;
  children: ReactNode;
  /** When navigation leaves this path prefix, call onClose (default: any non-matching pathname). */
  stayPathname?: string;
};

/**
 * Host a page subtree inside an already-routed page without nesting `<Router>`
 * (forbidden by React Router 6). Same pattern as DashboardWorkspace.
 */
export function InPanelRouter({
  initialPath,
  onClose,
  children,
  stayPathname,
}: InPanelRouterProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const entry = initialPath.startsWith("/") ? initialPath : `/${initialPath}`;
  const stay =
    stayPathname ||
    parsePath(entry).pathname ||
    "/";

  const [location, setLocation] = useState<Location>(() => toLocation(entry));
  const stackRef = useRef<Location[]>([toLocation(entry)]);
  const indexRef = useRef(0);

  useEffect(() => {
    const next = toLocation(entry);
    stackRef.current = [next];
    indexRef.current = 0;
    setLocation(next);
  }, [entry]);

  const navigator = useMemo<Navigator>(() => {
    const commit = (next: Location, replace: boolean) => {
      if (next.pathname !== stay) {
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
        if (nextIndex < 0 || nextIndex >= stackRef.current.length) {
          if (delta < 0) handleClose();
          return;
        }
        indexRef.current = nextIndex;
        const next = stackRef.current[nextIndex];
        if (next.pathname !== stay) {
          handleClose();
          return;
        }
        setLocation(next);
      },
    };
  }, [location.pathname, location.key, handleClose, stay]);

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

  return (
    <EmbeddedModeProvider onClose={handleClose}>
      <NavigationContext.Provider value={navigationContext}>
        <LocationContext.Provider value={locationContext}>
          <RouteContext.Provider value={routeContext}>{children}</RouteContext.Provider>
        </LocationContext.Provider>
      </NavigationContext.Provider>
    </EmbeddedModeProvider>
  );
}

/** Convenience: mount a single route element at `path` inside an in-panel navigator. */
export function InPanelRoute({
  initialPath,
  path,
  element,
  onClose,
}: {
  initialPath: string;
  path: string;
  element: ReactNode;
  onClose: () => void;
}) {
  return (
    <InPanelRouter initialPath={initialPath} onClose={onClose} stayPathname={path}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </InPanelRouter>
  );
}
