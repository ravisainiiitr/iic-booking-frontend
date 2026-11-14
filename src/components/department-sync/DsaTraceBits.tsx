import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { DsaHealth, DsaVersionStatus } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { CheckState, TraceCheck } from "./dsaTrace";
import { cleanVersion } from "./dsaTrace";

export const HEALTH_STYLE: Record<DsaHealth, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  critical: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  offline: "border-zinc-700 bg-zinc-800 text-zinc-50 dark:border-zinc-600 dark:bg-zinc-700",
  unknown: "border-border bg-muted text-muted-foreground",
};

export const HEALTH_DOT: Record<DsaHealth, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  offline: "bg-zinc-500",
  unknown: "bg-muted-foreground/50",
};

export const HEALTH_LABEL: Record<DsaHealth, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
  unknown: "Never reported",
};

export function HealthBadge({ health, className }: { health: DsaHealth; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap font-medium", HEALTH_STYLE[health] || HEALTH_STYLE.unknown, className)}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH_DOT[health] || HEALTH_DOT.unknown)} aria-hidden />
      {HEALTH_LABEL[health] || health}
    </Badge>
  );
}

const CHECK_TONE: Record<CheckState, string> = {
  pass: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  fail: "text-red-600 dark:text-red-400",
  unknown: "text-muted-foreground",
};

const CHECK_LABEL: Record<CheckState, string> = { pass: "OK", warn: "Warning", fail: "Failing", unknown: "Not reported" };

export function CheckIcon({ state, className }: { state: CheckState; className?: string }) {
  const Icon = state === "pass" ? CheckCircle2 : state === "warn" ? AlertTriangle : state === "fail" ? XCircle : CircleDashed;
  return <Icon className={cn("h-4 w-4 shrink-0", CHECK_TONE[state], className)} aria-label={CHECK_LABEL[state]} />;
}

export function CodeChip({ code, onClick, active }: { code: string; onClick?: () => void; active?: boolean }) {
  const cls = cn(
    "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none tracking-tight",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/60 text-foreground/80",
    onClick && "cursor-pointer hover:border-primary/60",
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={`Filter by ${code}`}>
      {code}
    </button>
  ) : (
    <span className={cls}>{code}</span>
  );
}

export function VersionPill({ version, latest, status }: { version?: string; latest?: string; status?: DsaVersionStatus }) {
  const v = cleanVersion(version) || "?";
  if (status === "outdated") {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900"
        title={`Latest published is ${latest}`}
      >
        v{v} <span aria-hidden>→</span> {latest}
      </span>
    );
  }
  if (status === "current" || status === "ahead") {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900"
        title={status === "ahead" ? `Newer than the published ${latest}` : "Latest published version"}
      >
        v{v} {status === "ahead" ? "· pre-release" : "· latest"}
      </span>
    );
  }
  return <span className="whitespace-nowrap text-xs text-muted-foreground">v{v}</span>;
}

export function Crumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
          {it.onClick ? (
            <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={it.onClick}>
              {it.label}
            </button>
          ) : (
            <span className="font-medium" aria-current="page">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Requirement checklist, grouped. Each row: status icon, requirement, the fact, codes, and the fix. */
export function TraceChecklist({ checks, onCode }: { checks: TraceCheck[]; onCode?: (code: string) => void }) {
  const groups = Array.from(new Set(checks.map((c) => c.group)));
  return (
    <div className="gap-3 lg:columns-2" aria-label="Requirement checklist">
      {groups.map((g) => (
        <section key={g} className="mb-3 break-inside-avoid rounded-xl border border-border/60 bg-card">
          <h4 className="border-b border-border/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g}
          </h4>
          <ul className="divide-y divide-border/50">
            {checks
              .filter((c) => c.group === g)
              .map((c) => (
                <li key={c.key} className="flex gap-2.5 px-3 py-2.5" data-testid={`check-${c.key}`} data-state={c.state}>
                  <CheckIcon state={c.state} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{c.label}</span>
                      {(c.codes || []).map((code) => (
                        <CodeChip key={code} code={code} onClick={onCode ? () => onCode(code) : undefined} />
                      ))}
                    </div>
                    <p className="break-words text-xs text-muted-foreground">{c.fact}</p>
                    {c.fix && c.state !== "pass" ? (
                      <p className="mt-0.5 text-xs text-foreground/80">
                        <span className="font-medium">Fix: </span>
                        {c.fix}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
  active,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
  testId?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {tone ? <span className={cn("h-2 w-2 rounded-full", tone)} aria-hidden /> : null}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums leading-none">{value}</div>
      {hint ? <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );
  const cls = cn(
    "rounded-xl border bg-card p-3 text-left shadow-sm transition-colors",
    active ? "border-primary ring-1 ring-primary" : "border-border/60",
    onClick && "hover:border-primary/50",
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={active} data-testid={testId}>
      {body}
    </button>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

export function Fact({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm", mono && "font-mono text-xs")}>{children ?? "—"}</dd>
    </div>
  );
}
