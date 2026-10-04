import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Folder, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AnalysisExtraFolder, AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import { describeSync, formatBytes, plural } from "@/lib/analysisSync";
import { folderName, folderState, visibleItems } from "@/lib/pcFolders";
import { cn } from "@/lib/utils";

type Props = {
  status: AnalysisSyncStatus | null;
  /** Folder name results land in: "Processed Data" (My Research) or "Analyzed Data" (Booking Details). */
  targetLabel?: string;
  myResearchHref?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function SyncProgressPanel({ status, targetLabel = "Processed Data", myResearchHref, onRetry, retrying, className }: Props) {
  const d = describeSync(status, targetLabel);
  if (d.tone === "idle" || !status) return null;
  const kept = status.kept_files ?? [];

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="sync-progress"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        d.tone === "progress" && "border-sky-300/70 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-50",
        d.tone === "done" && "border-emerald-300/70 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50",
        d.tone === "failed" && "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {d.tone === "progress" ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600 dark:text-sky-300" aria-hidden />
        ) : d.tone === "done" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">
            {d.headline}
            {d.tone === "done" && d.detail ? <span className="font-normal opacity-90"> · {d.detail}</span> : null}
          </p>
          {d.tone !== "done" && d.detail ? <p className="opacity-90">{d.detail}</p> : null}
          {d.tone === "progress" && status.current_file ? (
            <p className="truncate text-xs opacity-75" title={status.current_file}>
              {status.current_file}
            </p>
          ) : null}
          {d.tone === "failed" && kept.length ? (
            <ul className="list-inside list-disc text-xs opacity-90">
              {kept.slice(0, 5).map((path) => (
                <li key={path} className="truncate">
                  {path}
                </li>
              ))}
              {kept.length > 5 ? <li>and {kept.length - 5} more</li> : null}
            </ul>
          ) : null}
        </div>
        {d.tone === "done" && myResearchHref ? (
          <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 bg-background">
            <Link to={myResearchHref}>
              Open in My Research <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        ) : null}
        {d.tone === "failed" && onRetry ? (
          <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 bg-background" onClick={onRetry} disabled={retrying}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            Retry now
          </Button>
        ) : null}
      </div>
      {d.tone === "progress" ? (
        d.percent != null ? (
          <Progress value={d.percent} className="mt-2.5 h-1.5" aria-label="Copy progress" />
        ) : (
          <div className="mt-2.5 h-1.5 animate-pulse rounded-full bg-sky-200 dark:bg-sky-900" aria-hidden />
        )
      ) : null}
      <ExtraFolders status={status} />
    </section>
  );
}

function ExtraFolders({ status }: { status: AnalysisSyncStatus }) {
  const folders = visibleItems(status.extra_folders);
  const wiped = status.pc_profile_wiped;
  if (!folders.length && wiped == null) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-current/10 pt-2.5">
      {folders.length ? (
        <ul className="space-y-1.5" aria-label="Chosen results" data-testid="extra-folders">
          {folders.map((f) => (
            <ExtraFolderRow key={f.path} folder={f} status={status} />
          ))}
        </ul>
      ) : null}
      {wiped != null ? (
        <p className="flex items-center gap-2 text-xs" data-testid="profile-wipe">
          {wiped ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
          )}
          {wiped
            ? "Your session account was cleared: nothing you saved is left on the Analysis PC."
            : "Some files or settings from your session are still on the Analysis PC."}
        </p>
      ) : null}
    </div>
  );
}

function ExtraFolderRow({ folder: f, status }: { folder: AnalysisExtraFolder; status: AnalysisSyncStatus }) {
  const s = folderState(f, status);
  const name = f.alias || folderName(f.path);
  const isFile = f.kind === "file";
  return (
    <li className="flex items-start gap-2 text-xs">
      {s.tone === "done" ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
      ) : s.tone === "warn" ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
      ) : isFile ? (
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      ) : (
        <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <span className="font-medium">{name}</span>
          {f.auto ? <span className="opacity-75"> (saved automatically)</span> : null}
          {f.files != null && f.alias ? (
            <span className="opacity-75">
              {" "}
              · {isFile ? formatBytes(f.bytes ?? 0) : `${plural(f.files, "file")} · ${formatBytes(f.bytes ?? 0)}`}
            </span>
          ) : null}
        </p>
        <p className="truncate opacity-75" title={f.path}>
          {s.label}
        </p>
      </div>
    </li>
  );
}
