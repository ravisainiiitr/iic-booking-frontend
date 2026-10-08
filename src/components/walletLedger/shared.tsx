import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import type { LedgerOption } from "@/lib/api";
import { CATEGORY_TONE, formatLedgerAmount, LEDGER_PAGE_SIZES } from "@/lib/walletLedger";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LedgerOption[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SortHeader({
  label,
  sortKey,
  ordering,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  ordering: string;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = ordering.replace(/^-/, "") === sortKey;
  const desc = ordering.startsWith("-");
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TableHead className={className} aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

export function SummaryStat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", tone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SignedAmount({ type, amount }: { type: "credit" | "debit"; amount: string }) {
  const credit = type === "credit";
  return (
    <span
      className={cn(
        "whitespace-nowrap font-medium tabular-nums",
        credit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      )}
    >
      <span className="sr-only">{credit ? "Credit " : "Debit "}</span>
      {credit ? "+" : "−"} {formatLedgerAmount(amount)}
    </span>
  );
}

export function TypeBadge({ type }: { type: "credit" | "debit" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        type === "credit"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {type === "credit" ? "Credit" : "Debit"}
    </Badge>
  );
}

export function CategoryBadge({ category, label }: { category: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", CATEGORY_TONE[category] ?? CATEGORY_TONE.other)}>
      {label}
    </Badge>
  );
}

export function LedgerPagination({
  page,
  pageSize,
  total,
  noun,
  loading,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  loading: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        {total === 0
          ? `0 ${noun}`
          : `${((page - 1) * pageSize + 1).toLocaleString("en-IN")}–${Math.min(page * pageSize, total).toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} ${noun}`}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span id={`${noun}-rows-label`} className="whitespace-nowrap text-muted-foreground">
            Rows per page
          </span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[4.75rem]" aria-labelledby={`${noun}-rows-label`} data-testid="rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEDGER_PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Next page"
          disabled={page >= pages || loading}
          onClick={() => onPage(Math.min(pages, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
