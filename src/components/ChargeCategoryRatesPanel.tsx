import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";

function GstBadge({ text }: { text: string }) {
  const t = String(text || "").trim();
  const isNone = /^no\s*gst$/i.test(t);
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto whitespace-nowrap px-2.5 py-0.5 text-xs font-medium tracking-normal",
        isNone
          ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
      )}
    >
      {t || "—"}
    </Badge>
  );
}

function AmountCell({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "left" | "right";
}) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-3 py-3.5 text-[0.95rem] font-semibold tabular-nums text-foreground sm:px-4",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left"
      )}
    >
      <span className="inline-block min-w-[4.5rem]">{children}</span>
    </TableCell>
  );
}

type PanelProps = {
  title?: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

function RatesPanelShell({ title = "Charges by user category", subtitle, children, footer }: PanelProps) {
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm shadow-black/[0.03] dark:shadow-black/20">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-card to-card px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 h-9 w-1 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {title}
            </h3>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-5 sm:text-sm">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

const headClass =
  "h-11 bg-muted/50 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:px-4 sm:text-xs";
const categoryCellClass =
  "whitespace-nowrap px-3 py-3.5 text-[0.95rem] font-semibold text-foreground sm:px-4 sm:text-base";
const rowClass = "border-border/50 hover:bg-primary/[0.03] data-[state=selected]:bg-primary/5";

type MultiParamProps = {
  presentation: ChargeCategoryPresentation;
};

export function ChargeCategoryMultiParamTable({ presentation }: MultiParamProps) {
  const optionColumns = presentation.optionColumns ?? [];
  const multiRows = presentation.multiParamRows ?? [];

  return (
    <RatesPanelShell subtitle={presentation.subtitle}>
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "min-w-[11rem] text-left")}>
              User category
            </TableHead>
            {optionColumns.map((opt) => (
              <TableHead key={opt} className={cn(headClass, "text-center")}>
                {opt}
              </TableHead>
            ))}
            <TableHead className={cn(headClass, "text-center")}>GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {multiRows.map((row, idx) => (
            <TableRow
              key={row.userType}
              className={cn(rowClass, idx % 2 === 1 && "bg-muted/25")}
            >
              <TableCell className={categoryCellClass}>{row.label}</TableCell>
              {optionColumns.map((opt) => (
                <AmountCell key={`${row.userType}-${opt}`}>
                  {row.chargesByOption[opt] ?? "—"}
                </AmountCell>
              ))}
              <TableCell className="px-3 py-3.5 text-center sm:px-4">
                <GstBadge text={row.gstLine} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RatesPanelShell>
  );
}

type SimplifiedProps = {
  presentation: ChargeCategoryPresentation;
};

export function ChargeCategorySimplifiedTable({ presentation }: SimplifiedProps) {
  return (
    <RatesPanelShell subtitle={presentation.subtitle}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "min-w-[11rem] text-left")}>
              User category
            </TableHead>
            <TableHead className={cn(headClass, "text-left")}>Charge</TableHead>
            <TableHead className={cn(headClass, "text-center")}>GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {presentation.rows.map((row, idx) => (
            <TableRow
              key={row.userType}
              className={cn(rowClass, idx % 2 === 1 && "bg-muted/25")}
            >
              <TableCell className={categoryCellClass}>{row.label}</TableCell>
              <TableCell className="px-3 py-3.5 text-[0.95rem] font-semibold leading-snug text-foreground sm:px-4 sm:text-base">
                {row.chargeLine}
              </TableCell>
              <TableCell className="px-3 py-3.5 text-center sm:px-4">
                <GstBadge text={row.gstLine} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RatesPanelShell>
  );
}

type LegacyProps = {
  subtitle: string;
  unitLabels: { primary: string; secondary: string; rateSuffix: string };
  showSecondary: boolean;
  rows: Array<{
    userType: string;
    label: string;
    primary: string;
    secondary: string;
    notes: string;
  }>;
  formatAmount: (raw: string) => string;
};

export function ChargeCategoryLegacyTable({
  subtitle,
  unitLabels,
  showSecondary,
  rows,
  formatAmount,
}: LegacyProps) {
  return (
    <RatesPanelShell
      subtitle={subtitle}
      footer="Charges are exclusive of GST @ 18% unless noted otherwise."
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(headClass, "min-w-[11rem] text-left")}>
              User category
            </TableHead>
            <TableHead className={cn(headClass, "text-right")}>{unitLabels.primary}</TableHead>
            {showSecondary && (
              <TableHead className={cn(headClass, "text-right")}>{unitLabels.secondary}</TableHead>
            )}
            <TableHead className={cn(headClass, "text-left")}>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={row.userType}
              className={cn(rowClass, idx % 2 === 1 && "bg-muted/25")}
            >
              <TableCell className={categoryCellClass}>{row.label}</TableCell>
              <AmountCell align="right">
                {row.primary !== "—" ? formatAmount(row.primary) : "—"}
              </AmountCell>
              {showSecondary && (
                <AmountCell align="right">
                  {row.secondary ? formatAmount(row.secondary) : "—"}
                </AmountCell>
              )}
              <TableCell className="px-3 py-3.5 text-sm text-muted-foreground sm:px-4 sm:text-[0.95rem]">
                {row.notes || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RatesPanelShell>
  );
}
