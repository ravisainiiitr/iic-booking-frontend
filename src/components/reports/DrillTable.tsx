import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr } from "@/lib/reportDrilldown";
import { reportColor } from "./palette";

export interface DrillTableRow {
  key: string | number;
  label: ReactNode;
  sublabel?: ReactNode;
  bookings: number;
  users?: number;
  revenue: number;
  /** Drill-down path; the row opens it. */
  to?: string;
}

/**
 * A revenue breakdown (by user category, department, equipment, month …) whose every row opens the users and
 * bookings behind it. Share is of this table's total.
 */
export function DrillTable({
  rows,
  labelHeader,
  emptyText = "No revenue in this period",
  showUsers = true,
  showTotal = true,
  swatches = false,
}: {
  rows: DrillTableRow[];
  labelHeader: string;
  emptyText?: string;
  showUsers?: boolean;
  showTotal?: boolean;
  /** Colour dot per row matching the chart next to the table. */
  swatches?: boolean;
}) {
  const navigate = useNavigate();
  const total = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const bookings = rows.reduce((s, r) => s + (Number(r.bookings) || 0), 0);
  const cols = showUsers ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>{labelHeader}</TableHead>
            <TableHead className="text-center">Bookings</TableHead>
            {showUsers ? <TableHead className="text-center">Users</TableHead> : null}
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow
                key={r.key}
                className={r.to ? "cursor-pointer hover:bg-primary/5" : undefined}
                onClick={r.to ? () => navigate(r.to as string) : undefined}
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {swatches ? (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: reportColor(i) }} />
                    ) : null}
                    <span className="min-w-0">
                      {r.to ? (
                        <Link
                          to={r.to}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                      {r.sublabel ? <span className="block text-xs font-normal text-muted-foreground">{r.sublabel}</span> : null}
                    </span>
                    {r.to ? <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{r.bookings}</TableCell>
                {showUsers ? <TableCell className="text-center tabular-nums">{r.users ?? "—"}</TableCell> : null}
                <TableCell className="text-right font-medium tabular-nums">{formatInr(r.revenue)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {total > 0 ? `${((Number(r.revenue) / total) * 100).toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {showTotal && rows.length > 1 ? (
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-center tabular-nums">{bookings}</TableCell>
              {showUsers ? <TableCell /> : null}
              <TableCell className="text-right tabular-nums">{formatInr(total)}</TableCell>
              <TableCell className="text-right text-muted-foreground">100%</TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
