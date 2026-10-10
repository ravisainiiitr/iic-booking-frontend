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
  /**
   * Leading S.No. column numbering body rows in display order. Turn off for tables that already
   * number their rows or where numbering means nothing (key/value layouts, grids, tiny breakdowns).
   */
  serial?: boolean;
  /** Number of the first row, e.g. (page - 1) * pageSize + 1 on paginated lists. */
  serialStart?: number;
  /** Put S.No. after the first column instead of before it, for leading selection checkboxes. */
  serialAfterFirstColumn?: boolean;
}

type TableSection = "head" | "body" | "foot";

const SerialContext = React.createContext<{ enabled: boolean; afterFirst: boolean }>({ enabled: false, afterFirst: false });
const SectionContext = React.createContext<TableSection>("body");

const SERIAL_CELL = "data-serial";
const SERIAL_HEAD = "data-serial-head";

/**
 * Serial cells are rendered empty and numbered here, so numbering follows whatever order and
 * filtering the page renders. Rows with a spanning cell (empty states, skeletons, expanded
 * details) are not data rows and stay blank.
 */
function numberSerialCells(table: HTMLTableElement, start: number) {
  let next = start;
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      const cell = Array.from(row.cells).find((c) => c.hasAttribute(SERIAL_CELL));
      if (!cell) continue;
      const isDataRow = !Array.from(row.cells).some((c) => c.colSpan > 1);
      const text = isDataRow ? String(next++) : "";
      if (cell.textContent !== text) cell.textContent = text;
    }
  }
  const heads = table.tHead
    ? Array.from(table.tHead.rows)
        .map((row) => Array.from(row.cells).find((c) => c.hasAttribute(SERIAL_HEAD)))
        .filter((c): c is HTMLTableCellElement => Boolean(c))
    : [];
  if (heads.length > 1) {
    if (heads[0].rowSpan !== heads.length) heads[0].rowSpan = heads.length;
    for (const extra of heads.slice(1)) extra.style.display = "none";
  }
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
  (
    {
      className,
      stickyFirstColumn,
      stackOnMobile,
      scrollPane,
      containerProps,
      serial = true,
      serialStart = 1,
      serialAfterFirstColumn = false,
      ...props
    },
    ref,
  ) => {
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

    React.useLayoutEffect(() => {
      const table = tableRef.current;
      if (!serial || !table) return;
      numberSerialCells(table, serialStart);
      const observer = new MutationObserver(() => numberSerialCells(table, serialStart));
      observer.observe(table, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, [serial, serialStart]);

    const serialContext = React.useMemo(
      () => ({ enabled: serial, afterFirst: serialAfterFirstColumn }),
      [serial, serialAfterFirstColumn],
    );

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
        <SerialContext.Provider value={serialContext}>
          <table ref={setRefs} className={cn("ui-table w-full caption-bottom text-sm", className)} {...props} />
        </SerialContext.Provider>
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <SectionContext.Provider value="head">
      <thead ref={ref} className={cn("sticky top-0 z-10", className)} {...props} />
    </SectionContext.Provider>
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <SectionContext.Provider value="body">
      <tbody ref={ref} className={className} {...props} />
    </SectionContext.Provider>
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <SectionContext.Provider value="foot">
      <tfoot ref={ref} className={cn("bg-muted/50 font-medium", className)} {...props} />
    </SectionContext.Provider>
  ),
);
TableFooter.displayName = "TableFooter";

const SERIAL_WIDTH = "w-[3.25rem] min-w-[3.25rem] px-1";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, children, ...props }, ref) => {
    const { enabled, afterFirst } = React.useContext(SerialContext);
    const section = React.useContext(SectionContext);
    let cells: React.ReactNode = children;
    if (enabled) {
      const serialCell =
        section === "head" ? (
          <TableHead key="__serial" {...{ [SERIAL_HEAD]: "" }} className={cn(SERIAL_WIDTH, "whitespace-nowrap")}>
            S.No.
          </TableHead>
        ) : (
          <TableCell
            key="__serial"
            {...{ [SERIAL_CELL]: "" }}
            className={cn(SERIAL_WIDTH, "whitespace-nowrap tabular-nums")}
          />
        );
      const list = React.Children.toArray(children);
      const first = list[0];
      const firstSpans =
        React.isValidElement<{ colSpan?: number }>(first) && Number(first.props.colSpan ?? 1) > 1;
      cells = afterFirst && !firstSpans ? [...list.slice(0, 1), serialCell, ...list.slice(1)] : [serialCell, ...list];
    }
    return (
      <tr
        ref={ref}
        className={cn("transition-colors duration-150 data-[state=selected]:bg-primary/5", className)}
        {...props}
      >
        {cells}
      </tr>
    );
  },
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
    <td ref={ref} className={cn("px-4 py-3 text-center align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
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
