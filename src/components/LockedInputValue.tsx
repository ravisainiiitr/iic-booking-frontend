import { Lock } from "lucide-react";
import { formatBookingInputValue, type BookingInputFieldDef } from "@/lib/bookingInputDisplay";
import { LOCKED_INPUT_HINT } from "@/lib/inputEditLock";

/** Read-only value of an input the viewer cannot change after booking, with the lock hint. */
export function LockedInputValue({
  field,
  values,
  id,
}: {
  field: BookingInputFieldDef;
  values: Record<string, unknown>;
  id?: string;
}) {
  const formatted = formatBookingInputValue(field, values);
  return (
    <div className="space-y-1" id={id} data-testid={`locked-input-${field.field_key}`}>
      {formatted.kind === "table" ? (
        <div className="overflow-x-auto rounded-md border bg-muted/40">
          <table className="w-full border-collapse text-sm">
            {formatted.columns.length > 0 && (
              <thead>
                <tr className="border-b">
                  {formatted.columns.map((header, ci) => (
                    <th key={ci} className="border-r p-2 text-left font-medium last:border-r-0">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {formatted.rows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-r p-2 last:border-r-0">
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-base font-medium text-foreground">
          {formatted.kind === "text" ? formatted.text : "—"}
        </p>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden />
        {LOCKED_INPUT_HINT}
      </p>
    </div>
  );
}

export default LockedInputValue;
