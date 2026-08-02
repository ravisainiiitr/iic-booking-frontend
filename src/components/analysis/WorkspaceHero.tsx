import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock3, MonitorSmartphone, Rocket } from "lucide-react";
import { useEffect, useState } from "react";

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(" : ");
}

export function WorkspaceStatusStrip({
  remainingSeconds,
  environmentLabel,
  environmentReady,
  queued,
  heroMode = "default",
}: {
  remainingSeconds?: number | null;
  environmentLabel?: string;
  environmentReady?: boolean;
  queued?: boolean;
  heroMode?: "ready" | "queued" | "running" | "results" | "default";
}) {
  const [remaining, setRemaining] = useState<number | null>(
    typeof remainingSeconds === "number" ? remainingSeconds : null
  );

  useEffect(() => {
    setRemaining(typeof remainingSeconds === "number" ? remainingSeconds : null);
  }, [remainingSeconds]);

  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((r) => (r == null ? r : Math.max(0, r - 1))), 1000);
    return () => window.clearInterval(id);
  }, [remaining == null]);

  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-12 lg:gap-4">
      <Card className="border-slate-200/80 shadow-md lg:col-span-3 dark:border-border">
        <CardContent className="flex items-center gap-3 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock3 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Session timer
            </p>
            <p className="text-xs text-muted-foreground">
              {remaining != null ? "Session will expire in" : "Starts when analysis begins"}
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight xl:text-3xl",
                remaining != null && remaining <= 300 && "text-amber-600"
              )}
            >
              {remaining != null ? formatHMS(remaining) : "— : — : —"}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              HH&nbsp;&nbsp;MM&nbsp;&nbsp;SS
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-3 lg:col-span-6">
        <WorkspaceReadyBanner mode={heroMode} />
      </div>

      <Card className="border-slate-200/80 shadow-md lg:col-span-3 dark:border-border">
        <CardContent className="flex items-center gap-3 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
            <MonitorSmartphone className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Analysis Environment
            </p>
            <p className="truncate text-sm font-semibold leading-snug xl:text-base">
              {environmentLabel || "Analysis Environment"}
            </p>
            <Badge
              className={cn(
                "mt-2",
                environmentReady && "bg-emerald-500 hover:bg-emerald-500",
                queued && !environmentReady && "bg-amber-500 hover:bg-amber-500",
                !environmentReady && !queued && "bg-muted text-muted-foreground hover:bg-muted"
              )}
            >
              {environmentReady ? "Available For You" : queued ? "Queued" : "Preparing"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkspaceReadyBanner({
  mode,
}: {
  mode: "ready" | "queued" | "running" | "results" | "default";
}) {
  const copy = {
    ready: {
      title: "Analysis Environment is Ready!",
      subtitle: "Review your booking details and input data, then open the Analysis Environment.",
    },
    queued: {
      title: "Analysis Environment Currently Unavailable",
      subtitle:
        "All environments are busy. You are in the execution queue and will start automatically.",
    },
    running: {
      title: "Analysis Session in Progress",
      subtitle: "Your Analysis Environment is active. Save your work and click End Analysis when finished.",
    },
    results: {
      title: "Results Ready",
      subtitle: "Processed results are available for download from your Booking Details page.",
    },
    default: {
      title: "Remote Analysis Workspace",
      subtitle: "Choose input data and launch when an Analysis Environment is available.",
    },
  }[mode];

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[#0b3d91] via-[#1a56b8] to-sky-600 p-6 text-white shadow-lg">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-sky-300/20" aria-hidden />
      <div className="relative flex h-full items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
          <Rocket className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{copy.title}</h2>
          <p className="mt-1.5 max-w-3xl text-sm text-white/85 sm:text-[15px]">{copy.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
