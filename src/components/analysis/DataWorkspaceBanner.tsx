import { useState, type ReactNode } from "react";
import { Check, Copy, FolderInput, FolderOutput, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataWorkspaceInfo = {
  data_root?: string;
  input_path?: string;
  output_path?: string;
  input_hint?: string;
  output_hint?: string;
  cleanup_status?: string;
  disk_free_bytes?: number | null;
};

type Props = {
  data?: DataWorkspaceInfo | null;
  className?: string;
  compact?: boolean;
  /** When true, show Data Root row (default true). */
  showDataRoot?: boolean;
};

function PathRow({
  label,
  path,
  hint,
  icon,
  compact,
}: {
  label: string;
  path: string;
  hint?: string;
  icon: ReactNode;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(path);

  const onCopy = async () => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 truncate rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-800 dark:border-border dark:bg-muted/40 dark:text-foreground",
            !path && "text-muted-foreground",
            compact && "py-1 text-[11px]"
          )}
          title={path || undefined}
        >
          {path || "Path will appear when the Analysis PC is ready"}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("shrink-0 gap-1.5 px-2.5 shadow-sm", compact ? "h-7" : "h-8")}
          disabled={!canCopy}
          onClick={onCopy}
          aria-label={`Copy ${label} path`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {hint ? (
        <p className="text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Compact DATA WORKSPACE panel for Analysis Workspace / Launch (R9). */
export function DataWorkspaceBanner({ data, className, compact, showDataRoot = true }: Props) {
  const inputPath = String(data?.input_path || "").trim();
  const outputPath = String(data?.output_path || "").trim();
  const dataRoot = String(data?.data_root || "").trim();
  const inputHint = "Place files you want to analyze here.";
  const outputHint = "Save analysis results here.";
  const rootHint = "Session workspace.";

  return (
    <section
      className={cn(
        "rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-slate-50/80 shadow-sm dark:border-sky-900/40 dark:from-sky-950/30 dark:via-background dark:to-background",
        compact ? "px-3 py-2.5" : "px-4 py-3.5",
        className
      )}
      aria-label="Data workspace"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-sky-900 dark:text-sky-200">
          Data Workspace
        </h2>
        {data?.cleanup_status && data.cleanup_status !== "idle" ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-muted dark:text-muted-foreground">
            {data.cleanup_status}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "grid gap-3",
          showDataRoot && !compact ? "lg:grid-cols-3" : "lg:grid-cols-2",
          compact && showDataRoot ? "md:grid-cols-3" : compact ? "md:grid-cols-2" : null
        )}
      >
        <PathRow
          label="Input"
          path={inputPath}
          hint={compact ? undefined : inputHint}
          icon={<FolderInput className="h-3.5 w-3.5" />}
          compact={compact}
        />
        <PathRow
          label="Output"
          path={outputPath}
          hint={compact ? undefined : outputHint}
          icon={<FolderOutput className="h-3.5 w-3.5" />}
          compact={compact}
        />
        {showDataRoot ? (
          <PathRow
            label="Data Root"
            path={dataRoot}
            hint={compact ? undefined : rootHint}
            icon={<HardDrive className="h-3.5 w-3.5" />}
            compact={compact}
          />
        ) : null}
      </div>
    </section>
  );
}
