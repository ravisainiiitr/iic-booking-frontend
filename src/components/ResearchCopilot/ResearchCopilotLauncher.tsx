import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { isViteCopilotEnabled } from "./softGate";

const loadCopilot = () => import("./index");
const ResearchCopilot = lazy(loadCopilot);

const FAB_CLASS =
  "fixed bottom-6 right-6 z-[9999] h-12 gap-2 rounded-full px-4 shadow-lg bg-slate-900 text-amber-100 hover:bg-slate-800 dark:bg-amber-100 dark:text-slate-900";

/**
 * Always-mounted Copilot entry point. Resolves the backend enabled flag and renders the
 * floating button; the full Copilot panel is only downloaded when the user opens it.
 */
export default function ResearchCopilotLauncher() {
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [backendEnabled, setBackendEnabled] = useState<boolean | null>(null);
  const [activated, setActivated] = useState(false);

  // Wait for auth to settle so a signed-in cold load makes one bootstrap call, not public + private.
  useEffect(() => {
    if (!isViteCopilotEnabled || authLoading || activated) return;
    let cancelled = false;
    void (async () => {
      const res = isAuthenticated
        ? await apiClient.researchCopilotBootstrap()
        : await apiClient.researchCopilotPublicBootstrap();
      if (cancelled) return;
      setBackendEnabled(res.data ? res.data.enabled !== false : false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, activated]);

  if (activated) {
    return (
      <Suspense
        fallback={
          <Button type="button" aria-label="Loading Booking Assistant" disabled className={FAB_CLASS}>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="hidden sm:inline text-sm font-semibold">Booking Assistant</span>
          </Button>
        }
      >
        <ResearchCopilot initialOpen initialBackendEnabled={backendEnabled} />
      </Suspense>
    );
  }

  const hideOnAnalysisDesktop =
    location.pathname.startsWith("/analysis-launch") ||
    location.pathname.startsWith("/analysis-workspace");
  const isEmbed = new URLSearchParams(location.search).get("embed") === "1";
  if (!isViteCopilotEnabled || backendEnabled !== true) return null;
  if (hideOnAnalysisDesktop || isEmbed) return null;

  return (
    <Button
      type="button"
      aria-label="Open Booking Assistant"
      onClick={() => setActivated(true)}
      onPointerEnter={() => void loadCopilot()}
      onFocus={() => void loadCopilot()}
      className={FAB_CLASS}
    >
      <Sparkles className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-semibold">Booking Assistant</span>
    </Button>
  );
}
