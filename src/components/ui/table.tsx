import * as React from "react";

import { cn } from "@/lib/utils";

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Below md, keep the first column in view while the table scrolls sideways. */
  stickyFirstColumn?: boolean;
  /** Below md, show each row as a card, labelling every cell with its column heading. */
  stackOnMobile?: boolean;
  /** Scroll inside a viewport-high box (header stays on top, sideways scrollbar always in view). */
  scrollPane?: boolean;
  /** Extra props for the scrolling wrapper, e.g. an aria-label or data-testid. */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
}

const AUTO_LABEL = "data-auto-label";

/**
 * Stacked rows lose their visual headers, so each cell gets its column heading as data-label
 * (rendered by CSS). Explicit roles keep table semantics once CSS changes the display type.
 */
function labelCellsByColumn(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
  const headings = headerRow ? Array.from(headerRow.cells, (th) => th.textContent?.trim() ?? "") : [];
  table.setAttribute("role", "table");
  for (const section of [table.tHead, ...Array.from(table.tBodies), table.tFoot]) {
    if (!section) continue;
    section.setAttribute("role", "rowgroup");
    for (const row of Array.from(section.rows)) {
      row.setAttribute("role", "row");
      let column = 0;
      for (const cell of Array.from(row.cells)) {
        cell.setAttribute("role", cell.tagName === "TH" ? (section === table.tHead ? "columnheader" : "rowheader") : "cell");
        if (section !== table.tHead && (!cell.hasAttribute("data-label") || cell.hasAttribute(AUTO_LABEL))) {
          const heading = cell.colSpan > 1 ? "" : (headings[column] ?? "");
          cell.setAttribute("data-label", heading);
          cell.setAttribute(AUTO_LABEL, "");
        }
        column += cell.colSpan || 1;
      }
    }
  }
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, stickyFirstColumn, stackOnMobile, scrollPane, containerProps, ...props }, ref) => {
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLTableElement | null) => {
        tableRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    React.useEffect(() => {
      const table = tableRef.current;
      if (!stackOnMobile || !table) return;
      labelCellsByColumn(table);
      const observer = new MutationObserver(() => labelCellsByColumn(table));
      observer.observe(table, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, [stackOnMobile]);

    return (
      <div
        {...containerProps}
        className={cn(
          "ui-table-frame relative w-full overflow-auto",
          stickyFirstColumn && "table-sticky-first",
          stackOnMobile && "table-stack-mobile",
          scrollPane && "table-scroll-pane",
          containerProps?.className,
        )}
      >
        <table ref={setRefs} className={cn("ui-table w-full caption-bottom text-sm", className)} {...props} />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("sticky top-0 z-10", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={className} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("bg-muted/50 font-medium", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("transition-colors duration-150 data-[state=selected]:bg-primary/5", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 py-2.5 text-center align-middle text-xs font-semibold uppercase tracking-[0.06em] [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
