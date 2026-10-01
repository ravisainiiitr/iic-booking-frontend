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
}

export function SortableTableHead({ children, sortKey, ordering, onSort, className, disabled }: SortableTableHeadProps) {
  const { key: activeKey, desc } = parseOrdering(ordering);
  const active = activeKey === sortKey;
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(nextOrdering(ordering, sortKey))}
        title={active ? (desc ? "Sorted descending — click for ascending" : "Sorted ascending — click for descending") : "Click to sort"}
        className={cn(
          "inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          active && "text-foreground",
        )}
      >
        <span>{children}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100 text-primary" : "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}
