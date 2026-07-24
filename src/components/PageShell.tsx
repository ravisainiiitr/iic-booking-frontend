import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/DashboardHeader";

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
  return (
    <div className={cn("page-shell", className)}>
      {withHeader ? <DashboardHeader /> : null}
      {children}
    </div>
  );
}

/** Teal gradient page intro banner used across wallet, catalog, admin hubs. */
export function PageHero({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 sm:p-8 text-white shadow-xl",
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
