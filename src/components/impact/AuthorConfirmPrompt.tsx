import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResearcherCard from "@/components/impact/ResearcherRecordsCard";
import { authorConfirmationsApi, type ResearcherRecords } from "@/lib/authorConfirmationsApi";
import { cn } from "@/lib/utils";

export const AUTHOR_PROMPT_SNOOZE_DAYS = 14;
const SNOOZE_KEY = "dashboard.authorPrompt.snoozedAt";

function snoozed(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && now - at < AUTHOR_PROMPT_SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function snooze(now: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now));
  } catch {
    // Storage unavailable: the prompt shows again next visit.
  }
}

/**
 * "Is this you?" on the dashboard of a faculty member whose name matched several OpenAlex author records. Confirming
 * lets the portal find their papers that acknowledge a facility. Hidden when nothing waits, and for 14 days after
 * "Later" (remembered in this browser).
 */
export default function AuthorConfirmPrompt({ userType, className = "" }: { userType?: string | null; className?: string }) {
  const [row, setRow] = useState<ResearcherRecords | null>(null);
  const [open, setOpen] = useState(false);
  const eligible = userType === "faculty";

  useEffect(() => {
    if (!eligible || snoozed(Date.now())) return;
    let cancelled = false;
    authorConfirmationsApi.mine().then((res) => {
      if (!cancelled && res.data && res.data.waiting.length) setRow(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  if (!row || !row.waiting.length) return null;

  return (
    <section
      role="region"
      aria-label="Confirm your author record"
      data-testid="author-confirm-prompt"
      className={cn("rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/40", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UserCheck className="hidden h-5 w-5 shrink-0 text-violet-700 sm:block dark:text-violet-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-violet-900 dark:text-violet-100">Help us find your papers: is this you?</p>
          <p className="text-sm text-violet-900/80 dark:text-violet-100/80">
            {row.waiting.length === 1 ? "An author" : `${row.waiting.length} authors`} in OpenAlex (a public index of scholarly
            works) share your name. Confirm yours so we can find papers that acknowledge the facilities you used.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Review
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              snooze(Date.now());
              setRow(null);
            }}
          >
            Later
          </Button>
        </div>
      </div>
      {open ? (
        <ul className="mt-3">
          <ResearcherCard row={row} self onUpdated={(next) => setRow(next.waiting.length ? next : null)} />
        </ul>
      ) : null}
    </section>
  );
}
