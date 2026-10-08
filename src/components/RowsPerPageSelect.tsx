import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROWS_PER_PAGE_OPTIONS } from "@/hooks/use-rows-per-page";

interface RowsPerPageSelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RowsPerPageSelect({ value, onChange, disabled }: RowsPerPageSelectProps) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="whitespace-nowrap text-sm text-muted-foreground">
        Rows per page
      </span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
        <SelectTrigger className="h-8 w-[4.75rem]" aria-labelledby={labelId} data-testid="rows-per-page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROWS_PER_PAGE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
