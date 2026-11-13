import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MINIMUM_REQUIREMENTS, type Verdict } from "@/lib/analysisDevicePolicy";
import type { useDeviceCheck } from "@/hooks/use-device-check";

const ICON: Record<Verdict, ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
  warn: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />,
  block: <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />,
};

export function DeviceCheckPanel({ check, compact = false }: { check: ReturnType<typeof useDeviceCheck>; compact?: boolean }) {
  const { report, network, verdict } = check;
  const [open, setOpen] = useState(verdict !== "ok");
  useEffect(() => {
    if (verdict !== "ok") setOpen(true);
  }, [verdict]);
  const checks = network ? [...report.checks.filter((c) => c.id !== "network"), network] : report.checks;
  const headline =
    verdict === "ok"
      ? "This device is ready for a Remote Analysis session."
      : verdict === "warn"
        ? report.verdict === "ok"
          ? "This device should work, with the note below."
          : report.headline
        : report.verdict === "block"
          ? report.headline
          : "The portal cannot be reached from this connection right now.";

  return (
    <Card
      className={cn(
        "border-slate-200/80 dark:border-border",
        verdict === "warn" && "border-amber-500/40 bg-amber-500/5",
        verdict === "block" && "border-rose-500/50 bg-rose-500/5",
      )}
      data-testid="device-check"
    >
      <CardContent className={cn("space-y-3", compact ? "p-3" : "p-4")}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {network == null && verdict === "ok" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : ICON[verdict]}
            {network == null && verdict === "ok" ? "Checking this device and connection…" : headline}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open ? (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  {ICON[c.verdict]}
                  <span>
                    <span className="font-medium">{c.label}:</span> {c.detail}
                  </span>
                </li>
              ))}
            </ul>
            {report.alternatives.length && verdict !== "ok" ? (
              <div className="rounded-lg border bg-background/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you can do</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {report.alternatives.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Minimum requirements</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {MINIMUM_REQUIREMENTS.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                <li>
                  The session opens inside this browser tab. There is no app to install, and no Remote Desktop (.rdp) file:
                  Analysis PCs are reached only through the portal.
                </li>
              </ul>
            </details>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
