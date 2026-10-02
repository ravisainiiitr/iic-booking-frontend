import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { ASSISTANT_OFFER_HELP_EVENT, normalizeHelpCode, type AssistantHelpDetail } from "@/lib/assistantHelp";
import { AssistantHelpPrompt } from "./AssistantHelpPrompt";
import { isViteCopilotEnabled } from "./softGate";

const loadCopilot = () => import("./index");
const ResearchCopilot = lazy(loadCopilot);

const FAB_CLASS =
  "fixed bottom-6 right-6 z-[9999] h-12 gap-2 rounded-full px-4 shadow-lg bg-slate-900 text-amber-100 hover:bg-slate-800 dark:bg-amber-100 dark:text-slate-900";

const HELP_PROMPT_MS = 45_000;
/** Don't re-offer the same help (same failure on the same equipment) for a while after "No thanks". */
const HELP_SNOOZE_MS = 10 * 60_000;

const offerKey = (d: AssistantHelpDetail) => `${d.code}:${d.equipmentId ?? ""}`;

export type AssistantHelpRequest = { id: number; detail: AssistantHelpDetail };

/**
 * Always-mounted Copilot entry point. Resolves the backend enabled flag and renders the
 * floating button; the full Copilot panel is only downloaded when the user opens it.
 * Also shows the "Need help?" prompt when a page reports a booking failure.
 */
export default function ResearchCopilotLauncher() {
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [backendEnabled, setBackendEnabled] = useState<boolean | null>(null);
  const [activated, setActivated] = useState(false);
  const [helpOffer, setHelpOffer] = useState<AssistantHelpDetail | null>(null);
  const [helpRequest, setHelpRequest] = useState<AssistantHelpRequest | null>(null);
  const helpSeq = useRef(0);
  const snoozed = useRef<{ key: string; until: number } | null>(null);

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

  useEffect(() => {
    if (!isViteCopilotEnabled || !isAuthenticated) return;
    const onOffer = (e: Event) => {
      const detail = (e as CustomEvent<AssistantHelpDetail>).detail;
      if (!detail) return;
      const offer = { ...detail, code: normalizeHelpCode(detail.code) };
      const s = snoozed.current;
      if (s && s.key === offerKey(offer) && Date.now() < s.until) return;
      setHelpOffer(offer);
    };
    window.addEventListener(ASSISTANT_OFFER_HELP_EVENT, onOffer);
    return () => window.removeEventListener(ASSISTANT_OFFER_HELP_EVENT, onOffer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!helpOffer) return;
    const t = window.setTimeout(() => setHelpOffer(null), HELP_PROMPT_MS);
    return () => window.clearTimeout(t);
  }, [helpOffer]);

  useEffect(() => {
    setHelpOffer(null);
  }, [location.pathname]);

  const acceptHelp = () => {
    if (!helpOffer) return;
    helpSeq.current += 1;
    setHelpRequest({ id: helpSeq.current, detail: helpOffer });
    setHelpOffer(null);
    setActivated(true);
  };

  const hideOnAnalysisDesktop =
    location.pathname.startsWith("/analysis-launch") ||
    location.pathname.startsWith("/analysis-workspace");
  const isEmbed = new URLSearchParams(location.search).get("embed") === "1";
  const promptVisible = isAuthenticated && !hideOnAnalysisDesktop && !isEmbed && (activated || backendEnabled === true);
  const dismissHelp = () => {
    if (helpOffer) snoozed.current = { key: offerKey(helpOffer), until: Date.now() + HELP_SNOOZE_MS };
    setHelpOffer(null);
  };
  const prompt = helpOffer && promptVisible ? (
    <AssistantHelpPrompt detail={helpOffer} onAccept={acceptHelp} onDismiss={dismissHelp} />
  ) : null;

  if (activated) {
    return (
      <>
        {prompt}
        <Suspense
          fallback={
            <Button type="button" aria-label="Loading Booking Assistant" disabled className={FAB_CLASS}>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="hidden sm:inline text-sm font-semibold">Booking Assistant</span>
            </Button>
          }
        >
          <ResearchCopilot initialOpen initialBackendEnabled={backendEnabled} helpRequest={helpRequest} />
        </Suspense>
      </>
    );
  }

  if (!isViteCopilotEnabled || backendEnabled !== true) return null;
  if (hideOnAnalysisDesktop || isEmbed) return null;

  return (
    <>
      {prompt}
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
    </>
  );
}
