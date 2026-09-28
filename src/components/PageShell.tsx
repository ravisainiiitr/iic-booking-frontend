import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/DashboardHeader";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";

/** Consistent authenticated page chrome. */
export function PageShell({
  children,
  className,
  withHeader = true,
}: {
  children: ReactNode;
  className?: string;
  withHeader?: boolean;
}) {
  const embedded = useEmbeddedMode();
  return (
    <div className={cn("page-shell", embedded && "min-h-0", className)}>
      {withHeader && !embedded ? <DashboardHeader /> : null}
      {children}
    </div>
  );
}

/**
 * Renders only on the full page. Inside the dashboard workspace the workspace frame already
 * shows the page title, description and a Dashboard button, so page intro banners are hidden.
 */
export function StandaloneOnly({ children }: { children: ReactNode }) {
  const embedded = useEmbeddedMode();
  return embedded ? null : <>{children}</>;
}

/** Button classes for controls placed on the navy PageHero background. */
export const heroButtonClass = {
  primary: "bg-white text-primary shadow-sm hover:bg-white/90 hover:text-primary",
  secondary: "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white",
  icon: "text-white/80 hover:bg-white/10 hover:text-white",
};

/** Navy Ocean page intro banner used across wallet, catalog, admin hubs. */
export function PageHero({
  title,
  description,
  children,
  className,
  compact = false,
  icon,
  badges,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Section-page header: smaller padding and type, with actions beside the title. */
  compact?: boolean;
  icon?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  if (compact) {
    return (
      <header
        className={cn(
          "rounded-xl bg-gradient-to-br from-primary via-[hsl(215_62%_22%)] to-slate-950 px-4 py-4 text-white shadow-md shadow-primary/15 sm:px-5",
          className
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 sm:flex" aria-hidden>
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                {badges}
              </div>
              {description ? <p className="mt-0.5 max-w-3xl text-sm text-white/85">{description}</p> : null}
              {meta ? <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/75">{meta}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div> : null}
        </div>
        {children}
      </header>
    );
  }
  return (
    <div
      className={cn(
        "mb-6 rounded-2xl bg-gradient-to-br from-primary via-[hsl(215_62%_22%)] to-slate-950 p-6 sm:p-8 text-white shadow-xl shadow-primary/25",
        className
      )}
    >
      {children}
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-2 text-white/85 text-sm sm:text-base max-w-2xl">{description}</p> : null}
    </div>
  );
}

/** Clickable admin/settings tile. */
export function SettingsTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-elegant)] hover:border-primary/30 dark:hover:border-primary/50 hover:-translate-y-0.5"
    >
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-sky-200 group-hover:bg-primary/90 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}
