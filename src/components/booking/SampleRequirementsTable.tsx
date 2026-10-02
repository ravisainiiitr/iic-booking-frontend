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

/** Above this many sets (and more sets than parameters) the table turns: one row per set. */
const SETS_AS_ROWS_THRESHOLD = 6;

type Row = {
  field: BookingInputFieldDef;
  label: string;
  values: FormattedInputValue[];
  varies: boolean;
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

function ParameterLabel({ row }: { row: Row }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      {row.safety && <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" aria-hidden />}
      <span className="break-words">{row.label}</span>
    </span>
  );
}

const STICKY_COL = "sticky left-0 z-10 bg-card print:static";
const CELL = "px-3 py-2 align-top text-sm";
const HEAD_CELL = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const DIFF_CELL = "jobsheet-diff bg-amber-50 dark:bg-amber-950/30";

/**
 * The user's test requirements as a table: Parameter | Value for one sample set, or one column per set
 * (one row per set when there are many sets), with values that differ from Set 1 tinted.
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

  const rows: Row[] = defs
    .map((field) => {
      const formatted = sets.map((s) => formatBookingInputValue(field, s));
      const keys = formatted.map(formattedValueKey);
      return {
        field,
        label: String(field.field_label || field.field_key),
        values: formatted,
        varies: multi && new Set(keys).size > 1,
        safety: isSafetyRelatedLabel(field.field_label),
      };
    })
    .filter((r) => r.values.some((v) => v.kind !== "empty"));

  const countKey = sampleCountFieldKey(defs);
  const perSetCount = sets.map((s) => (countKey ? positiveCount(s[countKey]) : null));
  const knownCounts = perSetCount.filter((n): n is number => n !== null);
  const totalSamples = knownCounts.length > 0 ? Math.round(knownCounts.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const setsAsRows = multi && sets.length > SETS_AS_ROWS_THRESHOLD && sets.length > rows.length;
  const differsFromFirst = (row: Row, i: number) =>
    multi && i > 0 && formattedValueKey(row.values[i]) !== formattedValueKey(row.values[0]);
  const countLabel = (n: number | null) => (n == null ? null : `${n} ${n === 1 ? "sample" : "samples"}`);
  const caption = multi
    ? `Sample requirements for ${sets.length} sample sets${setsAsRows ? ", one row per set" : ", one column per set"}`
    : "Sample requirements";

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
          {multi && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {sets.length} sample sets
            </span>
          )}
          {totalSamples != null && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {countLabel(totalSamples)}
              {multi ? " in total" : ""}
            </span>
          )}
        </div>
        {toolbar && <div className="ml-auto">{toolbar}</div>}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">The user did not enter any sample details.</p>
      ) : (
        <>
          {multi && rows.some((r) => r.varies) && (
            <p className="px-4 pt-3 text-xs text-muted-foreground">
              <span className={cn("mr-1 inline-block h-3 w-3 rounded-sm align-middle border border-amber-300", DIFF_CELL)} aria-hidden />
              Tinted cells differ from Set 1.
              <span className="sm:hidden"> Swipe sideways to see every set.</span>
            </p>
          )}
          <div className="jobsheet-table-scroll overflow-x-auto px-0 py-2">
            <table className="jobsheet-table w-full border-collapse">
              <caption className="sr-only">{caption}</caption>
              {!multi ? (
                <>
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className={cn(HEAD_CELL, "w-[40%] min-w-[9rem]")}>
                        Parameter
                      </th>
                      <th scope="col" className={HEAD_CELL}>
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field.field_key} className="border-b border-border/50 last:border-b-0 even:bg-muted/20">
                        <th scope="row" className={cn(CELL, "text-left font-medium text-muted-foreground")}>
                          <ParameterLabel row={row} />
                        </th>
                        <td className={cn(CELL, "font-medium text-foreground")}>
                          <ValueCell value={row.values[0]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : !setsAsRows ? (
                <>
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className={cn(HEAD_CELL, STICKY_COL, "min-w-[9rem] max-w-[16rem]")}>
                        Parameter
                      </th>
                      {sets.map((_, i) => (
                        <th key={i} scope="col" className={cn(HEAD_CELL, "min-w-[8rem] normal-case")}>
                          <span className="block text-sm font-semibold text-foreground">Set {i + 1}</span>
                          {countLabel(perSetCount[i]) && (
                            <span className="block font-normal">{countLabel(perSetCount[i])}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field.field_key} className="border-b border-border/50 last:border-b-0">
                        <th scope="row" className={cn(CELL, STICKY_COL, "text-left font-medium text-muted-foreground")}>
                          <ParameterLabel row={row} />
                          {row.varies && (
                            <span className="ml-1.5 inline-block rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              Varies
                            </span>
                          )}
                        </th>
                        {row.values.map((value, i) => (
                          <td
                            key={i}
                            className={cn(CELL, "font-medium text-foreground", differsFromFirst(row, i) && DIFF_CELL)}
                          >
                            <ValueCell value={value} />
                            {differsFromFirst(row, i) && <span className="sr-only"> (differs from Set 1)</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {totalSamples != null && (
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <th scope="row" className={cn(CELL, STICKY_COL, "text-left font-semibold")}>
                          Total samples
                        </th>
                        <td colSpan={sets.length} className={cn(CELL, "font-semibold")}>
                          {totalSamples} across {sets.length} sets
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </>
              ) : (
                <>
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className={cn(HEAD_CELL, STICKY_COL, "min-w-[4.5rem]")}>
                        Set
                      </th>
                      {rows.map((row) => (
                        <th key={row.field.field_key} scope="col" className={cn(HEAD_CELL, "min-w-[8rem] normal-case")}>
                          <ParameterLabel row={row} />
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
                        {rows.map((row) => (
                          <td
                            key={row.field.field_key}
                            className={cn(CELL, "font-medium text-foreground", differsFromFirst(row, i) && DIFF_CELL)}
                          >
                            <ValueCell value={row.values[i]} />
                            {differsFromFirst(row, i) && <span className="sr-only"> (differs from Set 1)</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {totalSamples != null && countKey && (
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <th scope="row" className={cn(CELL, STICKY_COL, "text-left font-semibold")}>
                          Total
                        </th>
                        {rows.map((row) => (
                          <td key={row.field.field_key} className={cn(CELL, "font-semibold")}>
                            {row.field.field_key === countKey ? totalSamples : ""}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </>
              )}
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default SampleRequirementsTable;
