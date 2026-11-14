import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, PauseCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { TransferView } from "@/lib/analysisTransfers";
import { cn } from "@/lib/utils";

const TONE = {
  progress: "border-sky-300/60 bg-sky-50/70 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/20 dark:text-sky-50",
  done: "border-emerald-300/60 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-50",
  paused: "border-amber-300/60 bg-amber-50/70 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-50",
  failed: "border-rose-300/60 bg-rose-50/70 text-rose-950 dark:border-rose-800/60 dark:bg-rose-950/20 dark:text-rose-50",
} as const;

/** One calm card for a large transfer: what is happening, how far along, and roughly how long is left. */
export function TransferProgressCard({
  view,
  href,
  hrefLabel,
  className,
  testId,
}: {
  view: TransferView;
  href?: string | null;
  hrefLabel?: string;
  className?: string;
  testId?: string;
}) {
  const Icon =
    view.tone === "done" ? CheckCircle2 : view.tone === "paused" ? PauseCircle : view.tone === "failed" ? AlertTriangle : Loader2;
  return (
    <div className={cn("rounded-xl border p-4 text-sm", TONE[view.tone], className)} role="status" aria-live="polite" data-testid={testId}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className={cn("h-4 w-4 shrink-0", view.tone === "progress" && "animate-spin")} aria-hidden />
        {view.title}
      </p>
      {view.detail ? <p className="mt-1 leading-relaxed opacity-90">{view.detail}</p> : null}
      {view.percent != null && view.tone !== "done" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-current opacity-60 transition-[width] duration-700" style={{ width: `${view.percent}%` }} />
        </div>
      ) : null}
      {href && view.tone === "done" ? (
        <Link to={href} className="mt-2 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
          {hrefLabel || "Open"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export default TransferProgressCard;
