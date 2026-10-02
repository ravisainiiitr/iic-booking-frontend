import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ChargesMergedHint, ChargesTable } from "@/components/ui/charges-table";
import { chargesTableClasses as ct } from "@/components/ui/charges-table-classes";
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
  align?: "center" | "right";
}) {
  return (
    <td
      className={cn(
        ct.td,
        ct.amount,
        "text-[0.95rem]",
        align === "right" && "text-right"
      )}
    >
      {children}
    </td>
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
    <section className="mb-5 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm shadow-black/[0.03] dark:shadow-black/20 print:shadow-none">
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
      <div className="p-3 sm:p-4">{children}</div>
      {footer ? (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-5 sm:text-sm">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

const categoryCellClass = cn(
  ct.td,
  ct.rowHeader,
  ct.stickyLeft,
  "min-w-[11rem] whitespace-nowrap text-[0.95rem] sm:text-base"
);
const categoryHeadClass = cn(ct.th, ct.stickyLeft, ct.thStickyLeft, "min-w-[11rem]");
const rowClass = (idx: number) => cn(ct.row, idx % 2 === 1 && ct.zebra);

type MultiParamProps = {
  presentation: ChargeCategoryPresentation;
};

export function ChargeCategoryMultiParamTable({ presentation }: MultiParamProps) {
  const optionColumns = presentation.optionColumns ?? [];
  const multiRows = presentation.multiParamRows ?? [];
  const optionSpan = Math.max(optionColumns.length, 1);

  return (
    <RatesPanelShell subtitle={presentation.subtitle}>
      <ChargesTable className="min-w-[640px]">
        <thead>
          <tr>
            <th scope="col" className={categoryHeadClass}>
              User category
            </th>
            {optionColumns.map((opt) => (
              <th key={opt} scope="col" className={cn(ct.th, "min-w-[8.5rem] text-center")}>
                {opt}
              </th>
            ))}
            <th scope="col" className={cn(ct.th, "w-[9.5rem] text-center")}>
              GST
            </th>
          </tr>
        </thead>
        <tbody>
          {multiRows.map((row, idx) => (
            <tr key={row.userType} className={rowClass(idx)}>
              <th scope="row" className={cn(categoryCellClass, "text-left")}>
                {row.label}
              </th>
              {row.chargeLine ? (
                <td
                  colSpan={optionSpan}
                  className={cn(ct.td, ct.merged, "text-[0.95rem] font-semibold leading-snug tabular-nums")}
                >
                  {row.chargeLine}
                  {optionColumns.length > 1 ? <ChargesMergedHint>All options</ChargesMergedHint> : null}
                </td>
              ) : (
                optionColumns.map((opt) => (
                  <AmountCell key={`${row.userType}-${opt}`}>
                    {row.chargesByOption[opt] ?? "—"}
                  </AmountCell>
                ))
              )}
              <td className={cn(ct.td, "text-center")}>
                <GstBadge text={row.gstLine} />
              </td>
            </tr>
          ))}
        </tbody>
      </ChargesTable>
    </RatesPanelShell>
  );
}

type SimplifiedProps = {
  presentation: ChargeCategoryPresentation;
};

export function ChargeCategorySimplifiedTable({ presentation }: SimplifiedProps) {
  return (
    <RatesPanelShell subtitle={presentation.subtitle}>
      <ChargesTable className="min-w-[520px]">
        <thead>
          <tr>
            <th scope="col" className={categoryHeadClass}>
              User category
            </th>
            <th scope="col" className={cn(ct.th, "text-center")}>
              Charge
            </th>
            <th scope="col" className={cn(ct.th, "w-[9.5rem] text-center")}>
              GST
            </th>
          </tr>
        </thead>
        <tbody>
          {presentation.rows.map((row, idx) => (
            <tr key={row.userType} className={rowClass(idx)}>
              <th scope="row" className={cn(categoryCellClass, "text-left")}>
                {row.label}
              </th>
              <td className={cn(ct.td, "text-center text-[0.95rem] font-semibold leading-snug tabular-nums sm:text-base")}>
                {row.chargeLine}
              </td>
              <td className={cn(ct.td, "text-center")}>
                <GstBadge text={row.gstLine} />
              </td>
            </tr>
          ))}
        </tbody>
      </ChargesTable>
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
      <ChargesTable className="min-w-[520px]">
        <thead>
          <tr>
            <th scope="col" className={categoryHeadClass}>
              User category
            </th>
            <th scope="col" className={cn(ct.th, "text-right")}>
              {unitLabels.primary}
            </th>
            {showSecondary && (
              <th scope="col" className={cn(ct.th, "text-right")}>
                {unitLabels.secondary}
              </th>
            )}
            <th scope="col" className={ct.th}>
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.userType} className={rowClass(idx)}>
              <th scope="row" className={cn(categoryCellClass, "text-left")}>
                {row.label}
              </th>
              <AmountCell align="right">
                {row.primary !== "—" ? formatAmount(row.primary) : "—"}
              </AmountCell>
              {showSecondary && (
                <AmountCell align="right">
                  {row.secondary ? formatAmount(row.secondary) : "—"}
                </AmountCell>
              )}
              <td className={cn(ct.td, ct.muted, "text-sm sm:text-[0.95rem]")}>
                {row.notes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </ChargesTable>
    </RatesPanelShell>
  );
}
