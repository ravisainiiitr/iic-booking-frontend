import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bordered rate-card table shared by Equipment Profile "View charges" and the public
 * Analysis Charges page. `border-separate` keeps borders on sticky header / first-column
 * cells while scrolling; style cells with `chargesTableClasses`.
 */

type ChargesTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  /** Classes for the scroll viewport, e.g. `max-h-[70vh]` to enable the sticky header. */
  viewportClassName?: string;
  frameClassName?: string;
};

export const ChargesTable = React.forwardRef<HTMLTableElement, ChargesTableProps>(
  ({ className, viewportClassName, frameClassName, children, ...props }, ref) => (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-300 bg-card shadow-sm shadow-slate-900/[0.04] [print-color-adjust:exact] dark:border-slate-700 dark:shadow-black/30 print:shadow-none",
        frameClassName
      )}
    >
      {/* -mr-px/-mb-px tucks the last column's right border and last row's bottom border
          under the frame's clip so the outer edge is never doubled (rowspan-safe). */}
      <div
        className={cn(
          "-mb-px -mr-px overflow-auto overscroll-x-contain print:max-h-none print:overflow-visible",
          viewportClassName
        )}
      >
        <table
          ref={ref}
          className={cn("w-full border-separate border-spacing-0 text-sm", className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  )
);
ChargesTable.displayName = "ChargesTable";

export function ChargesMergedHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}
