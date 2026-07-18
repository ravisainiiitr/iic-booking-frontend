import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Briefcase, CheckCircle2, ChevronDown, Info, Wrench, XCircle } from "lucide-react";

export type AccessoryItem = {
  id: string | number;
  name: string;
  description?: string | null;
  /** Operational status from OIC toggle. Default true when omitted. */
  isEnabled?: boolean;
};

type EquipmentAccessoriesSectionProps = {
  accessories?: AccessoryItem[];
  additionalAccessories?: AccessoryItem[];
  /** Compact layout for dialogs / inline booking panels. */
  compact?: boolean;
  className?: string;
};

function AvailableBadge() {
  return (
    <Badge className="shrink-0 border-0 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
      Available
    </Badge>
  );
}

function UnavailableBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-[10px] sm:text-xs font-semibold uppercase tracking-wide"
    >
      Unavailable
    </Badge>
  );
}

function StatusSummary({ items }: { items: AccessoryItem[] }) {
  const available = items.filter((i) => i.isEnabled !== false).length;
  const unavailable = items.length - available;
  return (
    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {available} available
      </span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        {unavailable} unavailable
      </span>
    </p>
  );
}

function AccessoryList({ items }: { items: AccessoryItem[] }) {
  const [openIds, setOpenIds] = useState<Set<string | number>>(new Set());

  const toggle = (id: string | number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Available first, then unavailable
  const ordered = [...items].sort((a, b) => {
    const ae = a.isEnabled !== false ? 0 : 1;
    const be = b.isEnabled !== false ? 0 : 1;
    return ae - be;
  });

  return (
    <ul className="space-y-2">
      {ordered.map((item) => {
        const available = item.isEnabled !== false;
        const hasDesc = Boolean(item.description?.trim());
        const open = openIds.has(item.id);
        const shell = available
          ? "border-l-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-200/70 dark:bg-emerald-950/20 dark:ring-emerald-800/40"
          : "border-l-slate-400 bg-slate-50/80 ring-1 ring-slate-200/80 opacity-90 dark:bg-slate-900/40 dark:ring-slate-700/50";

        const nameRow = (
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold leading-snug",
                  available ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.name}
              </p>
              {!available && (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Not currently operational for this equipment
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {available ? <AvailableBadge /> : <UnavailableBadge />}
              {hasDesc && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              )}
            </div>
          </div>
        );

        if (!hasDesc) {
          return (
            <li key={item.id} className={cn("rounded-lg border-l-4 px-3 py-2.5", shell)}>
              {nameRow}
            </li>
          );
        }

        return (
          <li key={item.id}>
            <Collapsible open={open} onOpenChange={() => toggle(item.id)}>
              <div className={cn("rounded-lg border-l-4", shell)}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left"
                    aria-expanded={open}
                  >
                    {nameRow}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="border-t border-border/50 px-3 pb-3 pt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </li>
        );
      })}
    </ul>
  );
}

function SectionBody({ items, emptyLabel }: { items: AccessoryItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      <StatusSummary items={items} />
      <AccessoryList items={items} />
    </div>
  );
}

const HELPER =
  "Informational only — see which accessories are currently available so you can decide whether to proceed with booking.";

/**
 * Informational Accessories / Additional Accessories status for booking & profile views.
 */
export function EquipmentAccessoriesSection({
  accessories = [],
  additionalAccessories = [],
  compact = false,
  className,
}: EquipmentAccessoriesSectionProps) {
  const hasAccessories = accessories.length > 0;
  const hasAdditional = additionalAccessories.length > 0;
  if (!hasAccessories && !hasAdditional) return null;

  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>{HELPER}</span>
        </p>
        {hasAccessories && (
          <div className="rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/80 via-background to-background p-4 dark:border-cyan-900 dark:from-cyan-950/30">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-sm">
                <Wrench className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-foreground">Accessories</h4>
                <p className="text-[11px] text-muted-foreground">Current operational status</p>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {accessories.length}
              </Badge>
            </div>
            <SectionBody items={accessories} emptyLabel="No accessories listed." />
          </div>
        )}
        {hasAdditional && (
          <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-background to-background p-4 dark:border-sky-900 dark:from-sky-950/30">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-foreground">Additional Accessories</h4>
                <p className="text-[11px] text-muted-foreground">Current operational status</p>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {additionalAccessories.length}
              </Badge>
            </div>
            <SectionBody items={additionalAccessories} emptyLabel="No additional accessories listed." />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {hasAccessories && (
        <Card className="overflow-hidden border-cyan-200/90 shadow-md ring-1 ring-cyan-500/15 dark:border-cyan-900 dark:ring-cyan-400/10">
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  Accessories
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    {accessories.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">{HELPER}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SectionBody items={accessories} emptyLabel="No accessories listed." />
          </CardContent>
        </Card>
      )}

      {hasAdditional && (
        <Card className="overflow-hidden border-sky-200/90 shadow-md ring-1 ring-sky-500/15 dark:border-sky-900 dark:ring-sky-400/10">
          <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                <Briefcase className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                  Additional Accessories
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    {additionalAccessories.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">{HELPER}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SectionBody
              items={additionalAccessories}
              emptyLabel="No additional accessories listed."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
