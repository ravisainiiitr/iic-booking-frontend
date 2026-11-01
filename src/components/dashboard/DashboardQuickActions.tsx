import type { ComponentType } from "react";
import { ArrowRight, CalendarCheck, FileText, FlaskConical, ReceiptText, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShortcutEntry } from "@/components/dashboard/DashboardShortcuts";

/** The main action first, then the everyday ones, in this order when the user has them. */
const QUICK: Array<{ id: string; Icon: ComponentType<{ className?: string }> }> = [
  { id: "browse_equipment", Icon: FlaskConical },
  { id: "view_bookings", Icon: CalendarCheck },
  { id: "view_results", Icon: FileText },
  { id: "wallet_management", Icon: Wallet },
  { id: "proforma_invoice", Icon: ReceiptText },
];

/**
 * Top of the internal / external user dashboard: a greeting and the few actions used most, the first one primary.
 * Built only from buttons the user already has (``entries``), so it never opens anything new.
 */
export default function DashboardQuickActions({
  firstName,
  entries,
  onOpen,
}: {
  firstName?: string;
  entries: ShortcutEntry[];
  onOpen: (path: string, label: string) => void;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const actions = QUICK.filter((q) => byId.has(q.id)).map((q) => ({ ...q, entry: byId.get(q.id)! }));
  const [primary, ...rest] = actions;

  return (
    <section
      aria-labelledby="dashboard-welcome-title"
      className="mb-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      data-testid="dashboard-quick-actions"
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary/40" aria-hidden />
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="dashboard-welcome-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Book instruments, follow your bookings and collect your results. Everything else is in the menu.
          </p>
        </div>
        {actions.length ? (
          <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
            {primary ? (
              <Button className="h-10 gap-2 bg-brand px-4 font-semibold text-white shadow-sm hover:bg-brand/90" onClick={() => onOpen(primary.entry.path, primary.entry.label)}>
                <primary.Icon className="h-4 w-4" />
                {primary.entry.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            {rest.map(({ id, Icon, entry }) => (
              <Button key={id} variant="outline" className="h-10 gap-2" onClick={() => onOpen(entry.path, entry.label)}>
                <Icon className="h-4 w-4 text-primary dark:text-sky-300" />
                {entry.label}
              </Button>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
