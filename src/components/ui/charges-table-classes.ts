import { cn } from "@/lib/utils";

const cellBorder = "border-b border-r border-slate-200 dark:border-slate-700/80";

/** Cell/row classes for `ChargesTable`; every cell draws only its right and bottom edge. */
export const chargesTableClasses = {
  th: cn(
    "sticky top-0 z-20 border-b border-r border-b-slate-300 border-r-slate-200 bg-slate-100 px-4 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase leading-tight tracking-[0.07em] text-slate-600 sm:text-xs",
    "dark:border-b-slate-600 dark:border-r-slate-700/80 dark:bg-slate-800 dark:text-slate-300 print:static"
  ),
  /** Sticky-left header cell (corner): must sit above both sticky axes. */
  thStickyLeft: "z-30",
  row: "transition-colors duration-150 hover:bg-sky-50/70 dark:hover:bg-sky-400/[0.06] print:break-inside-avoid",
  zebra: "bg-slate-50/70 dark:bg-white/[0.025]",
  td: cn(cellBorder, "px-4 py-2.5 align-middle text-foreground"),
  /** Row-header (first column) cell: opaque tint so it also works as a sticky column. */
  rowHeader:
    "bg-slate-50 font-medium text-slate-900 dark:bg-[hsl(215_32%_13%)] dark:text-slate-100",
  stickyLeft: "sticky left-0 z-10 print:static",
  amount: "whitespace-nowrap text-center font-semibold tabular-nums",
  /** Cell merged across options (colspan) or parameters (rowspan). */
  merged:
    "bg-sky-50/80 text-center align-middle shadow-[inset_3px_0_0_hsl(var(--primary)/0.35)] dark:bg-sky-400/[0.07]",
  /** Separator under the last row of an equipment group (Analysis Charges). */
  groupEnd: "border-b-2 border-b-slate-300 dark:border-b-slate-600",
  muted: "text-muted-foreground",
} as const;
