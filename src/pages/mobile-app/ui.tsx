/**
 * The app's design system: every app screen is built from these pieces, on the portal's colour tokens (so light and dark
 * follow the phone). Spacing is 4/8/12/16/24; cards are 16px radius; touch targets are at least 44px.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronRight, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingTone } from "@/lib/bookingJourney";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<BookingTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-subtle text-info-subtle-foreground",
  success: "bg-success-subtle text-success-subtle-foreground",
  warning: "bg-warning-subtle text-warning-subtle-foreground",
  danger: "bg-destructive-subtle text-destructive-subtle-foreground",
};

export function StatusPill({ tone, children, className }: { tone: BookingTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE_CLASS[tone], className)}>
      <span className="truncate">{children}</span>
    </span>
  );
}

type ScreenProps = {
  title: string;
  subtitle?: string;
  /** Show Back; the path is used when the app has no earlier page (opened from a link or a notification). */
  backTo?: string;
  actions?: ReactNode;
  /** Pinned above the phone's navigation bar: the screen's main action. */
  footer?: ReactNode;
  /** Below the title, still pinned while scrolling: tabs, search. */
  toolbar?: ReactNode;
  children: ReactNode;
};

export function AppScreen({ title, subtitle, backTo, actions, footer, toolbar, children }: ScreenProps) {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(backTo ?? "/app", { replace: true });
  };
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-1 px-2">
          {backTo ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <div className={cn("min-w-0 flex-1 leading-tight", !backTo && "pl-2")}>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
        {toolbar ? <div className="mx-auto w-full max-w-3xl px-4 pb-3">{toolbar}</div> : null}
      </header>
      <main className={cn("mx-auto w-full max-w-3xl flex-1 px-4 py-4", footer && "pb-28")}>{children}</main>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border/70 bg-card shadow-sm", className)}>{children}</div>;
}

/** Horizontal choice of one value; scrolls sideways instead of wrapping when there are many. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            o.value === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground active:bg-muted",
          )}
        >
          {o.label}
          {o.count ? <span className="ml-1.5 opacity-80">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <p className="mt-4 font-semibold text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <EmptyState
      icon={offline ? <WifiOff className="h-6 w-6" aria-hidden /> : <AlertCircle className="h-6 w-6" aria-hidden />}
      title={offline ? "You are offline" : "This could not be loaded"}
      hint={offline ? "Check your connection and try again." : message || "Please try again."}
      action={
        onRetry ? (
          <Button variant="outline" className="h-11" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

/** Placeholder rows shaped like the content, so the screen does not jump when it arrives. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A tappable settings-style row. */
export function RowContent({ icon, label, hint, trailing }: { icon?: ReactNode; label: string; hint?: string; trailing?: ReactNode }) {
  return (
    <>
      {icon ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {trailing}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
}

export const ROW_CLASS =
  "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
