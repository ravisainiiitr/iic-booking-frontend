import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { nextOrdering, parseOrdering } from "@/lib/tableOrdering";

interface SortableTableHeadProps {
  children: ReactNode;
  sortKey: string;
  ordering: string | null | undefined;
  onSort: (ordering: string) => void;
  className?: string;
  disabled?: boolean;
  /** Full heading when the visible one is shortened: shown on hover and read by screen readers. */
  title?: string;
  /** Let the heading end in "…" when the column is narrower than it. */
  truncate?: boolean;
}

export function SortableTableHead({
  children,
  sortKey,
  ordering,
  onSort,
  className,
  disabled,
  title,
  truncate,
}: SortableTableHeadProps) {
  const { key: activeKey, desc } = parseOrdering(ordering);
  const active = activeKey === sortKey;
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  const hint = active ? (desc ? "Sorted descending — click for ascending" : "Sorted ascending — click for descending") : "Click to sort";
  return (
    <TableHead
      className={className}
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      aria-label={title}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(nextOrdering(ordering, sortKey))}
        title={title ? `${title} (${hint.charAt(0).toLowerCase()}${hint.slice(1)})` : hint}
        aria-label={title}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded uppercase tracking-wide hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          active && "text-foreground",
        )}
      >
        <span className={cn(truncate && "min-w-0 truncate")}>{children}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100 text-primary" : "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}
