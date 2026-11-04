import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { impactApi } from "@/lib/impactApi";
import { cn } from "@/lib/utils";

/** User types that publish research and can claim papers on My publications. */
export const ORCID_PROMPT_USER_TYPES = new Set([
  "student",
  "individual_student",
  "faculty",
  "external",
  "rnd",
  "other",
]);

export const ORCID_PROMPT_SNOOZE_DAYS = 30;
const SNOOZE_KEY = "dashboard.orcidPrompt.snoozedAt";

function snoozed(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && now - at < ORCID_PROMPT_SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function snooze(now: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now));
  } catch {
    // Storage unavailable (private window): the banner simply shows again next visit.
  }
}

/**
 * Dashboard banner for researchers who have not saved an ORCID iD yet: saving one lets the portal find their papers
 * every week. Hidden once an iD is saved, and for 30 days after "Not now" (remembered in this browser).
 */
export default function OrcidPromptBanner({ userType, className = "" }: { userType?: string | null; className?: string }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const eligible = Boolean(userType && ORCID_PROMPT_USER_TYPES.has(userType));

  useEffect(() => {
    if (!eligible || snoozed(Date.now())) return;
    let cancelled = false;
    impactApi.myOrcid().then((res) => {
      if (!cancelled && res.data && !res.data.orcid) setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  if (!show) return null;

  const dismiss = () => {
    snooze(Date.now());
    setShow(false);
  };

  return (
    <section
      role="region"
      aria-label="Add your ORCID iD"
      data-testid="orcid-prompt-banner"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center dark:border-sky-800 dark:bg-sky-950/40",
        className,
      )}
    >
      <Sparkles className="hidden h-5 w-5 shrink-0 text-sky-700 sm:block dark:text-sky-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sky-900 dark:text-sky-100">Add your ORCID iD and we will find your papers</p>
        <p className="text-sm text-sky-900/80 dark:text-sky-100/80">
          Every week we look up your new papers in OpenAlex (a public index of scholarly works) so you can link them to the
          equipment you used. Only your ORCID iD is sent, and nothing is claimed without you.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={() => navigate("/my-publications#find-my-papers")}>
          Add ORCID iD
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </section>
  );
}
