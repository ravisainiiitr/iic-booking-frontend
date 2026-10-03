import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import { appEntryPath, isNativeApp } from "@/lib/nativeApp";
import { isStaffAppNavPath, useStaffAppShell } from "@/lib/staffApp";
import { cn } from "@/lib/utils";

/** Pages where a Back button makes no sense (entry points and sign-in flows). */
function isBackExcludedPath(pathname: string, staffShell = false): boolean {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/analysis-workspace/") ||
    (staffShell && isStaffAppNavPath(pathname))
  );
}

// Number of mounted header Back buttons; the floating fallback shows only when none is mounted.
let mountedBackButtons = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getMountedCount = () => mountedBackButtons;

function useRegisterBackButton(active: boolean) {
  useEffect(() => {
    if (!active) return;
    mountedBackButtons += 1;
    listeners.forEach((l) => l());
    return () => {
      mountedBackButtons -= 1;
      listeners.forEach((l) => l());
    };
  }, [active]);
}

function useGoBack() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return () => {
    // React Router stores the history index; 0 means this tab has no earlier in-app page.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else if (isNativeApp()) navigate(appEntryPath(isAuthenticated));
    else navigate(isAuthenticated ? "/dashboard" : "/");
  };
}

type BackButtonProps = {
  className?: string;
};

/** Browser-style Back for page headers. Hidden on the home page, dashboard and sign-in pages. */
export function BackButton({ className }: BackButtonProps) {
  const { pathname } = useLocation();
  const embedded = useEmbeddedMode();
  const goBack = useGoBack();
  const staffShell = useStaffAppShell();
  const visible = !embedded && !isBackExcludedPath(pathname, staffShell);
  useRegisterBackButton(visible);
  if (!visible) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={goBack}
      className={cn("shrink-0 gap-1.5 font-medium", className)}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Back</span>
    </Button>
  );
}

/** Floating Back for pages that render without a shared header. */
export function GlobalBackButton() {
  const { pathname, search } = useLocation();
  const goBack = useGoBack();
  const headerButtons = useSyncExternalStore(subscribe, getMountedCount, getMountedCount);
  const isQueryEmbed = new URLSearchParams(search).get("embed") === "1";
  const staffShell = useStaffAppShell();
  const wanted = headerButtons === 0 && !isQueryEmbed && !isBackExcludedPath(pathname, staffShell);
  // Lazy pages mount their header a moment after navigation; wait so the fallback does not flash.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    if (!wanted) return;
    const t = window.setTimeout(() => setShow(true), 600);
    return () => window.clearTimeout(t);
  }, [wanted, pathname]);
  if (!wanted || !show) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={goBack}
      className="fixed bottom-4 left-4 z-40 gap-1.5 rounded-full bg-card/95 font-medium shadow-lg backdrop-blur print:hidden"
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back
    </Button>
  );
}

export default BackButton;
