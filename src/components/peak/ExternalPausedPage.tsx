import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPeakClock } from "@/lib/peakWindow";

type Props = {
  message: string;
  endsAt: string | null;
  onLogout: () => void | Promise<void>;
  onCheckAgain: () => void | Promise<void>;
};

const FALLBACK_MESSAGE =
  "To give IIT Roorkee users a fair chance when new slots open, external access is paused for a few minutes. Please come back shortly.";

export default function ExternalPausedPage({ message, endsAt, onLogout, onCheckAgain }: Props) {
  const [checking, setChecking] = useState(false);
  const resumeAt = formatPeakClock(endsAt);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12 dark:from-slate-950 dark:to-slate-900">
      <section
        aria-labelledby="peak-paused-title"
        className="w-full max-w-lg rounded-2xl border border-border/70 bg-card p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock className="h-7 w-7" aria-hidden />
        </div>
        <h1 id="peak-paused-title" className="text-xl font-semibold text-foreground">
          External access is paused for a few minutes
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message || FALLBACK_MESSAGE}</p>
        {resumeAt ? (
          <p className="mt-4 text-sm font-medium text-foreground">
            Access resumes automatically at <span className="tabular-nums">{resumeAt}</span>. You do not need to sign in again.
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                await onCheckAgain();
              } finally {
                setChecking(false);
              }
            }}
          >
            <RefreshCw className={checking ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} aria-hidden />
            Check again
          </Button>
          <Button variant="ghost" onClick={() => void onLogout()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Log out
          </Button>
        </div>
      </section>
    </main>
  );
}
