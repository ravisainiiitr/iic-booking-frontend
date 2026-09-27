import { useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  inputPath?: string;
  className?: string;
  compact?: boolean;
};

/** Input path + analysis results guidance shown before starting RAA. */
export function AnalysisDataInfoPanel({ inputPath, className, compact }: Props) {
  const [copied, setCopied] = useState(false);
  const path = String(inputPath || "").trim();
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
    <div
      className={cn(
        "space-y-3 rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 text-sm dark:border-sky-900/40 dark:bg-sky-950/20",
        className
      )}
    >
      <div className="flex gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
              Data location on Analysis PC
            </p>
            <p className="mt-1 text-muted-foreground">
              Your selected data will be available in:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md border bg-white px-2.5 py-1.5 font-mono text-xs dark:bg-background",
                  !path && "text-muted-foreground"
                )}
                title={path || undefined}
              >
                {path || "Path will appear when your Analysis PC is allocated"}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                disabled={!canCopy}
                onClick={onCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {path ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Use this folder as the input location for your installed analysis software.
              </p>
            ) : null}
          </div>

          {!compact ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                Analysis results
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                You may save your analysis results anywhere on the Analysis PC during the session.
                When you have finished, click <strong className="text-foreground">End Session</strong>.
                After the session ends, your result files will be uploaded and will become available in{" "}
                <strong className="text-foreground">Booking Details → Analyzed Data</strong>.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
