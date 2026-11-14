import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash, Loader2, Mail, MessageCircle, RefreshCw, Satellite, Wallet, XCircle } from "lucide-react";
import type { ComponentType } from "react";
import { apiClient, type HealthStatus, type IntegrationHealth, type IntegrationHealthCheck } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const REFRESH_MS = 5 * 60_000;

const COMPONENTS: Array<{ key: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: "istem", label: "I-STEM", icon: Satellite },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "email", label: "Email", icon: Mail },
];

const RANK: Record<HealthStatus, number> = { off: 0, ok: 1, warn: 2, fail: 3 };

const STATUS_STYLE: Record<HealthStatus, { dot: string; text: string; label: string; icon: ComponentType<{ className?: string }> }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", label: "Working", icon: CheckCircle2 },
  warn: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", label: "Needs a look", icon: AlertTriangle },
  fail: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", label: "Failing", icon: XCircle },
  off: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Switched off", icon: CircleSlash },
};

export function componentStatus(checks: IntegrationHealthCheck[], component: string): HealthStatus {
  const own = checks.filter((c) => c.component === component);
  if (!own.length) return "off";
  return own.reduce<HealthStatus>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), "off");
}

/** "1 problem · 1 warning": failures are problems; warnings (still working, needs a follow-up) are counted apart. */
export function overallLabel(problems: IntegrationHealthCheck[]): string {
  const failing = problems.filter((c) => c.status === "fail").length;
  const warnings = problems.length - failing;
  const parts = [
    failing ? `${failing} ${failing === 1 ? "problem" : "problems"}` : "",
    warnings ? `${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "All working";
}

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/**
 * Main Administrator: whether every step a booking depends on is working (I-STEM, WhatsApp, payments, email), what is
 * failing and what to do, with "Check and fix now". Renders nothing for anyone else (the API answers 403).
 */
export default function IntegrationHealthCard({ className }: { className?: string }) {
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [hidden, setHidden] = useState(false);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.getIntegrationHealth();
    if (res.data) {
      setHealth(res.data);
      setError(null);
    } else if (res.error) {
      if (/only the main administrator/i.test(res.error)) setHidden(true);
      else setError(res.error);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    const res = await apiClient.runIntegrationHealth();
    if (res.data) {
      setHealth(res.data);
      setError(null);
    } else if (res.error) setError(res.error);
    setRunning(false);
  };

  if (hidden || (!health && !error)) return null;

  const checks = health?.checks ?? [];
  const problems = checks.filter((c) => c.status === "fail" || c.status === "warn");
  const overall = health?.overall ?? "warn";
  const style = STATUS_STYLE[overall];

  return (
    <Card className={cn("overflow-hidden rounded-2xl border-border/70 shadow-sm", className)} data-testid="integration-health">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} aria-hidden />
            System health
            <span className={cn("text-xs font-medium", style.text)} data-testid="integration-health-overall">
              {overallLabel(problems)}
            </span>
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Every booking step: I-STEM, WhatsApp, payments and email. Checked every 15 minutes
            {health ? ` · last ${timeFormat.format(new Date(health.generated_at))}` : ""}.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => void runNow()} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          Check and fix now
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {error ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {COMPONENTS.map(({ key, label, icon: Icon }) => {
            const s = componentStatus(checks, key);
            const st = STATUS_STYLE[s];
            return (
              <div key={key} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2" data-testid={`health-${key}`} data-status={s}>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                <span className={cn("flex items-center gap-1 text-xs font-medium", st.text)}>
                  <span className={cn("h-2 w-2 rounded-full", st.dot)} aria-hidden />
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
        {problems.length ? (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {problems.map((c) => {
              const st = STATUS_STYLE[c.status];
              const Icon = st.icon;
              const expanded = open === c.key;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : c.key)}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", st.text)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">{c.summary}</span>
                    </span>
                    <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                  </button>
                  {expanded ? (
                    <div className="space-y-2 px-9 pb-3 text-xs">
                      {c.items.length ? (
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {c.items.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      ) : null}
                      {c.action ? (
                        <p>
                          <span className="font-semibold">What to do: </span>
                          {c.action}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            Every paid booking reached I-STEM, every completed one has its FBR executed, and messages are going out.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
