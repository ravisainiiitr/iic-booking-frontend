import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import type { TemplateHealth, TemplateHealthIssue } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 6;

/** Scroll to and focus the input an issue is about (sample set 1 ids are the field key, extra sets are prefixed). */
export function focusTemplateField(field: string | null | undefined, set?: number | null) {
  if (!field || typeof document === "undefined") return;
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(field) : field;
  const candidates =
    field === "preferred_slot"
      ? ['[data-template-section="preferred-slot"]']
      : [
          ...(set && set > 1 ? [`#sample-set-${set - 2}-${escaped}`] : []),
          `#${escaped}`,
          `[id^="${escaped}-"]`,
        ];
  for (const selector of candidates) {
    let el: HTMLElement | null = null;
    try {
      el = document.querySelector<HTMLElement>(selector);
    } catch {
      el = null;
    }
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus?.({ preventScroll: true });
      return;
    }
  }
}

const tone = (s: TemplateHealthIssue["severity"]) =>
  s === "error"
    ? "text-destructive"
    : s === "warning"
      ? "text-amber-800 dark:text-amber-300"
      : "text-muted-foreground";

/**
 * Advice for the template being edited: what would fail or change when it is used to book. Only advice;
 * saving is still allowed except where the server refuses it.
 */
export function TemplateHealthAdvice({ health, checking }: { health: TemplateHealth | null; checking: boolean }) {
  const issues = (health?.issues ?? []).filter((i) => i.severity !== "info" || i.code === "field_removed");
  if (!health && !checking) return null;
  if (health && !issues.length) {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400" role="status">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        These details are within this equipment's current limits.
        {checking ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      </p>
    );
  }
  if (!health) {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking these details against the current limits…
      </p>
    );
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <div
      className={cn(
        "mb-4 rounded-lg border px-3 py-2.5 text-sm",
        errors
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-300/70 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10"
      )}
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className={cn("h-4 w-4", errors ? "text-destructive" : "text-amber-600")} aria-hidden />
        {errors
          ? `${errors} thing${errors === 1 ? "" : "s"} would stop this template from booking`
          : "Before you save"}
        {checking ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden /> : null}
      </p>
      <ul className="mt-1.5 space-y-1">
        {issues.slice(0, MAX_SHOWN).map((issue, i) => (
          <li key={`${issue.code}-${issue.field ?? ""}-${issue.set ?? ""}-${i}`} className={cn("flex items-start gap-1.5 text-xs", tone(issue.severity))}>
            {issue.severity === "error" ? (
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              {issue.message}
              {issue.field && issue.code !== "field_removed" ? (
                <button
                  type="button"
                  className="ml-1.5 font-medium underline underline-offset-2 hover:no-underline"
                  onClick={() => focusTemplateField(issue.field, issue.set)}
                >
                  Go to field
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {issues.length > MAX_SHOWN ? (
        <p className="mt-1 text-xs text-muted-foreground">+{issues.length - MAX_SHOWN} more</p>
      ) : null}
      {health.light ? (
        <p className="mt-1 text-xs text-muted-foreground">Quota and wallet are checked again after new slots open.</p>
      ) : null}
    </div>
  );
}
