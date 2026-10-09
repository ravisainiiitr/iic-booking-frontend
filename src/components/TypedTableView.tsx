import { readTypedTableConfig, typedTableDisplay } from "@/lib/typedTableField";
import { formatInputScalar } from "@/lib/bookingInputDisplay";
import { cn } from "@/lib/utils";

type Props = {
  tableConfig: unknown;
  value: unknown;
  label?: string;
  className?: string;
};

/** Read-only advanced table (TYPED_TABLE) as saved with a booking. */
export function TypedTableView({ tableConfig, value, label, className }: Props) {
  const config = readTypedTableConfig(tableConfig);
  if (!config) return <span className="text-muted-foreground">{formatInputScalar(value)}</span>;
  const { columns, rows } = typedTableDisplay(config, value);
  if (!rows.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border/70", className)}>
      <table className="w-full border-collapse text-sm" aria-label={label}>
        {columns.length > 0 && (
          <thead>
            <tr className="border-b border-border/70 bg-primary/10 dark:bg-primary/15">
              {columns.map((header, ci) => (
                <th key={ci} scope="col" className="border-r border-border/50 px-3 py-2 text-left font-semibold last:border-r-0">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/40 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="border-r border-border/40 px-3 py-2 font-medium last:border-r-0 break-words">
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TypedTableView;
