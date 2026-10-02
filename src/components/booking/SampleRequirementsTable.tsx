import type { ReactNode } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatBookingInputValue,
  formattedValueKey,
  type BookingInputFieldDef,
  type BookingInputValues,
  type FormattedInputValue,
} from "@/lib/bookingInputDisplay";
import { isCommentsInputFieldKey } from "@/lib/bookingInputValues";
import { positiveCount, sampleCountFieldKey } from "@/lib/sampleCount";
import { readSampleSets, withoutSampleSets } from "@/lib/sampleSets";
import { isSafetyRelatedLabel } from "@/lib/jobSheet";

type Column = {
  field: BookingInputFieldDef;
  label: string;
  /** One formatted value per sample set. */
  values: FormattedInputValue[];
  safety: boolean;
};

type SampleRequirementsTableProps = {
  fields: BookingInputFieldDef[] | null | undefined;
  inputValues: BookingInputValues | null | undefined;
  /** Rendered at the right of the heading (e.g. the Edit inputs button). */
  toolbar?: ReactNode;
  className?: string;
};

function fallbackFields(values: BookingInputValues): BookingInputFieldDef[] {
  return Object.keys(values)
    .filter((k) => !k.startsWith("_") && !k.endsWith("_elements"))
    .sort()
    .map((k) => ({ field_key: k, field_label: k, field_type: "TEXT" }));
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

export function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ValueCell({ value }: { value: FormattedInputValue }) {
  if (value.kind === "empty") {
    return (
      <span className="text-muted-foreground" aria-label="Not given">
        —
      </span>
    );
  }
  if (value.kind === "text") {
    return (
      <span className="whitespace-pre-wrap break-words">
        <TextWithLinks text={value.text} />
      </span>
    );
  }
  const width = Math.max(value.columns.length, ...value.rows.map((r) => r.length));
  return (
    <table className="jobsheet-subtable w-full border-collapse text-xs">
      {value.columns.length > 0 && (
        <thead>
          <tr>
            {Array.from({ length: width }, (_, i) => (
              <th key={i} scope="col" className="border border-border/70 bg-muted/60 px-1.5 py-1 text-left font-medium">
                {value.columns[i] ?? ""}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {value.rows.map((row, ri) => (
          <tr key={ri}>
            {Array.from({ length: width }, (_, ci) => (
              <td key={ci} className="border border-border/70 px-1.5 py-1 align-top break-words">
                {row[ci] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParameterLabel({ column }: { column: Column }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      {column.safety && <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" aria-hidden />}
      <span className="break-words">{column.label}</span>
    </span>
  );
}

const STICKY_COL = "sticky left-0 z-10 bg-card border-r border-border/60 print:static";
const CELL = "px-3 py-2 align-top text-sm";
const HEAD_CELL = "px-3 py-2 text-left align-bottom text-xs font-semibold tracking-wide text-muted-foreground";
const DIFF_CELL = "jobsheet-diff bg-amber-50/70 dark:bg-amber-950/25";

/**
 * The user's test requirements as one table: a row per sample set (a single set is one row) and a column per
 * input the user filled in, in the equipment's field order. Values that differ from Set 1 are tinted.
 */
export function SampleRequirementsTable({ fields, inputValues, toolbar, className }: SampleRequirementsTableProps) {
  const values = inputValues ?? {};
  const defs = (fields && fields.length > 0 ? fields : fallbackFields(values)).filter(
    (f) => !isCommentsInputFieldKey(f.field_key),
  );
  const sets: BookingInputValues[] = [
    withoutSampleSets(values),
    ...readSampleSets(values).filter((s) => Object.keys(s).length > 0),
  ];
  const multi = sets.length > 1;

  const columns: Column[] = defs
    .map((field) => ({
      field,
      label: String(field.field_label || field.field_key).replace(/:\s*$/, ""),
      values: sets.map((s) => formatBookingInputValue(field, s)),
      safety: isSafetyRelatedLabel(field.field_label),
    }))
    .filter((c) => c.values.some((v) => v.kind !== "empty"));

  const countKey = sampleCountFieldKey(defs);
  const hasCountColumn = countKey != null && columns.some((c) => c.field.field_key === countKey);
  const knownCounts = sets
    .map((s) => (countKey ? positiveCount(s[countKey]) : null))
    .filter((n): n is number => n !== null);
  const totalSamples = knownCounts.length > 0 ? Math.round(knownCounts.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const differsFromFirst = (column: Column, i: number) =>
    i > 0 && formattedValueKey(column.values[i]) !== formattedValueKey(column.values[0]);
  const anyDiffers = multi && columns.some((c) => c.values.some((_, i) => differsFromFirst(c, i)));
  const countLabel = (n: number) => `${n} ${n === 1 ? "sample" : "samples"}`;

  return (
    <section
      aria-labelledby="jobsheet-requirements-heading"
      className={cn("jobsheet-section min-w-0 rounded-xl border border-border/80 bg-card shadow-sm", className)}
      data-testid="sample-requirements"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
        <h3 id="jobsheet-requirements-heading" className="text-base font-semibold">
          Sample requirements
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {sets.length} sample {multi ? "sets" : "set"}
          </span>
          {totalSamples != null && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {countLabel(totalSamples)}
              {multi ? " in total" : ""}
            </span>
          )}
        </div>
        {toolbar && <div className="ml-auto">{toolbar}</div>}
      </div>

      {columns.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">The user did not enter any sample details.</p>
      ) : (
        <>
          {(anyDiffers || columns.length > 2) && (
            <p className="px-4 pt-3 text-xs text-muted-foreground">
              {anyDiffers && (
                <>
                  <span className={cn("mr-1 inline-block h-3 w-3 rounded-sm align-middle border border-amber-200", DIFF_CELL)} aria-hidden />
                  Tinted values vary from Set 1.
                </>
              )}
              {columns.length > 2 && <span className="sm:hidden"> Swipe sideways to see every input.</span>}
            </p>
          )}
          <div className="jobsheet-table-scroll overflow-x-auto px-0 py-2">
            <table className="jobsheet-table w-full border-collapse" data-print-columns={columns.length + 1}>
              <caption className="sr-only">
                {multi ? `Sample requirements, one row for each of the ${sets.length} sample sets` : "Sample requirements"}
              </caption>
              <thead>
                <tr className="border-b border-border/70">
                  <th scope="col" className={cn(HEAD_CELL, STICKY_COL, "min-w-[4.5rem] uppercase")}>
                    Set
                  </th>
                  {columns.map((column) => (
                    <th key={column.field.field_key} scope="col" className={cn(HEAD_CELL, "min-w-[7rem] max-w-[16rem]")}>
                      <ParameterLabel column={column} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sets.map((_, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-b-0">
                    <th scope="row" className={cn(CELL, STICKY_COL, "text-left font-semibold whitespace-nowrap")}>
                      Set {i + 1}
                    </th>
                    {columns.map((column) => (
                      <td
                        key={column.field.field_key}
                        className={cn(
                          CELL,
                          "max-w-[20rem] font-medium text-foreground",
                          multi && differsFromFirst(column, i) && DIFF_CELL,
                        )}
                      >
                        <ValueCell value={column.values[i]} />
                        {multi && differsFromFirst(column, i) && <span className="sr-only"> (varies from Set 1)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {multi && totalSamples != null && hasCountColumn && (
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <th scope="row" className={cn(CELL, STICKY_COL, "text-left font-semibold")}>
                      Total
                    </th>
                    {columns.map((column) => (
                      <td key={column.field.field_key} className={cn(CELL, "font-semibold")}>
                        {column.field.field_key === countKey ? totalSamples : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default SampleRequirementsTable;
