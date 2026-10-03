import { lazy, Suspense, useId, useState } from "react";
import { Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { maxAllowedHint, parseNumericInput } from "@/lib/numericInput";
import {
  formatTypedTableNumber,
  newTypedTableRow,
  readTypedTableRows,
  typedTableCellProblem,
  typedTableHiddenRowCount,
  typedTableLinkKey,
  TYPED_TABLE_DEFAULT_MAX_ROWS,
  TYPED_TABLE_TEXT_MAX_LENGTH,
  type TypedTableColumn,
  type TypedTableConfig,
  type TypedTableRow,
} from "@/lib/typedTableField";
import { cn } from "@/lib/utils";

const PeriodicElementsDialog = lazy(() => import("@/components/PeriodicElementsDialog"));

export type TypedTableInputProps = {
  fieldKey: string;
  label: string;
  config: TypedTableConfig | null;
  value: unknown;
  onChange: (rows: TypedTableRow[]) => void;
  disabled?: boolean;
  /** Booking form scope used for rows hidden when a linked count goes down ("primary", "set-2", "edit"). */
  scope?: string;
  /** Label of the NUMERIC field a linked table follows. */
  linkLabel?: string;
  /** Id of the table wrapper; cells get `${idPrefix}-r${rowIndex}-${columnKey}` (see focusTypedTableProblem). */
  idPrefix?: string;
  density?: "comfortable" | "compact";
  /** Force the stacked card layout (e.g. inside narrow dialogs). */
  stacked?: boolean;
};

function columnRangeText(column: TypedTableColumn): string {
  if (column.type === "NUMERIC") {
    const hasMin = column.min !== null && column.min !== undefined;
    const hasMax = column.max !== null && column.max !== undefined;
    if (hasMin && hasMax) return `${formatTypedTableNumber(column.min!)}–${formatTypedTableNumber(column.max!)}`;
    if (hasMax) return `max ${formatTypedTableNumber(column.max!)}`;
    if (hasMin) return `min ${formatTypedTableNumber(column.min!)}`;
    return column.integer ? "whole number" : "";
  }
  if (column.type === "TEXT" && column.max_length) return `max ${column.max_length} chars`;
  return "";
}

type CellProps = {
  column: TypedTableColumn;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  ariaLabel: string;
  disabled?: boolean;
};

function NumericCell({ column, value, onChange, id, ariaLabel, disabled }: CellProps) {
  const [note, setNote] = useState<string | null>(null);
  const min = column.min ?? null;
  const max = column.max ?? null;
  const text = value === undefined || value === null ? "" : String(value);
  const problem = typedTableCellProblem(column, value);
  const n = parseNumericInput(text);
  const hintId = `${id}-hint`;

  const handleChange = (raw: string) => {
    const t = raw.trim();
    if (t !== "" && !/^-?\d*([.,]\d*)?$/.test(t)) return;
    if (t.startsWith("-") && min !== null && min >= 0) return;
    if (column.integer && /[.,]/.test(t)) return;
    const parsed = parseNumericInput(t);
    if (parsed !== undefined && max !== null && parsed > max) {
      setNote(`${t} is over the limit`);
      onChange(max);
      return;
    }
    setNote(null);
    onChange(t.replace(",", "."));
  };

  const handleBlur = () => {
    if (text.trim() === "") {
      if (value !== undefined && value !== null && value !== "") onChange("");
      return;
    }
    const parsed = parseNumericInput(text);
    if (parsed === undefined) return;
    if (min !== null && parsed < min) {
      setNote(`${text} is not allowed`);
      onChange(min);
      return;
    }
    if (typeof value !== "number") onChange(parsed);
  };

  let hint: { text: string; tone: "info" | "error" } | null = null;
  if (problem) hint = { text: problem.message, tone: "error" };
  else if (max !== null && n !== undefined && n >= max) {
    hint = { text: note ? `${maxAllowedHint(max)} (${note})` : maxAllowedHint(max), tone: "info" };
  } else if (min !== null && n !== undefined && n <= min && note) {
    hint = { text: `Minimum is ${formatTypedTableNumber(min)} (${note})`, tone: "info" };
  }

  return (
    <div className="min-w-[6.5rem]">
      <Input
        id={id}
        type="text"
        inputMode={column.integer ? "numeric" : "decimal"}
        value={text}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={problem ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        placeholder={columnRangeText(column) || undefined}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={cn("h-9", problem && "border-destructive focus-visible:ring-destructive")}
      />
      {hint && (
        <p
          id={hintId}
          className={cn("mt-1 text-xs", hint.tone === "error" ? "text-destructive" : "text-muted-foreground")}
          aria-live="polite"
        >
          {hint.text}
        </p>
      )}
    </div>
  );
}

function MultiSelectCell({ column, value, onChange, id, ariaLabel, disabled }: CellProps) {
  const selected = Array.isArray(value) ? value.map(String) : [];
  const options = column.options ?? [];
  const toggle = (option: string, on: boolean) => {
    const next = on ? [...selected.filter((s) => s !== option), option] : selected.filter((s) => s !== option);
    onChange(options.filter((o) => next.includes(o)));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`${ariaLabel}: ${selected.length ? selected.join(", ") : "none selected"}`}
          className="h-9 w-full min-w-[8rem] justify-between font-normal"
        >
          <span className="truncate">{selected.length ? selected.join(", ") : "Select…"}</span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div role="group" aria-label={ariaLabel} className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((option, i) => {
            const optionId = `${id}-opt-${i}`;
            return (
              <label key={option} htmlFor={optionId} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                <Checkbox id={optionId} checked={selected.includes(option)} onCheckedChange={(c) => toggle(option, c === true)} />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PeriodicCell({ value, onChange, id, ariaLabel, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const selected = Array.isArray(value) ? value.map(String) : [];
  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label={`${ariaLabel}: ${selected.length ? selected.join(", ") : "no elements chosen"}`}
        className="h-9 w-full min-w-[8rem] justify-start font-normal"
        onClick={() => {
          setDraft(new Set(selected));
          setOpen(true);
        }}
      >
        <span className="truncate">{selected.length ? selected.join(", ") : "Choose elements"}</span>
      </Button>
      {open && (
        <Suspense fallback={null}>
          <PeriodicElementsDialog
            open={open}
            onOpenChange={setOpen}
            selected={draft}
            onSelectedChange={setDraft}
            onApply={() => {
              onChange(Array.from(draft));
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function TypedTableCell(props: CellProps) {
  const { column, value, onChange, id, ariaLabel, disabled } = props;
  const problem = column.type === "NUMERIC" ? null : typedTableCellProblem(column, value);
  let control: JSX.Element;
  switch (column.type) {
    case "NUMERIC":
      return <NumericCell {...props} />;
    case "TEXT":
      control = (
        <Input
          id={id}
          type="text"
          value={value === undefined || value === null ? "" : String(value)}
          maxLength={column.max_length || TYPED_TABLE_TEXT_MAX_LENGTH}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={problem ? true : undefined}
          placeholder={column.help_text || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-[8rem]"
        />
      );
      break;
    case "RADIO":
      control = (
        <RadioGroup
          value={value === undefined || value === null ? "" : String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
          aria-label={ariaLabel}
          className="flex flex-wrap gap-x-3 gap-y-1"
        >
          {(column.options ?? []).map((option, i) => (
            <label key={option} htmlFor={`${id}-r${i}`} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <RadioGroupItem id={`${id}-r${i}`} value={option} />
              <span>{option}</span>
            </label>
          ))}
        </RadioGroup>
      );
      break;
    case "COMBO":
      control = (
        <Select
          value={value === undefined || value === null || value === "" ? undefined : String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id} aria-label={ariaLabel} className="h-9 min-w-[8rem]">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(column.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "MULTI_SELECT":
      return <MultiSelectCell {...props} />;
    case "TOGGLE":
      return (
        <div className="flex h-9 items-center gap-2">
          <Switch
            id={id}
            checked={value === true || value === "true"}
            onCheckedChange={(c) => onChange(c)}
            disabled={disabled}
            aria-label={ariaLabel}
          />
          <span className="text-xs text-muted-foreground" aria-hidden>
            {value === true || value === "true" ? "Yes" : "No"}
          </span>
        </div>
      );
    case "PERIODIC_TABLE":
      return <PeriodicCell {...props} />;
    default:
      control = <span className="text-xs text-muted-foreground">Unsupported column type</span>;
  }
  return (
    <div>
      {control}
      {problem && <p className="mt-1 text-xs text-destructive">{problem.message}</p>}
    </div>
  );
}

/** Booking-form editor for an advanced table (TYPED_TABLE) field. */
export default function TypedTableInput({
  fieldKey,
  label,
  config,
  value,
  onChange,
  disabled,
  scope = "primary",
  linkLabel,
  idPrefix,
  density = "comfortable",
  stacked,
}: TypedTableInputProps) {
  const autoId = useId();
  const isMobile = useIsMobile();
  const baseId = (idPrefix || `tt-${autoId}`).replace(/[^A-Za-z0-9_-]/g, "");

  if (!config) {
    return <p className="text-sm text-muted-foreground">This table has not been set up yet. Please contact the lab.</p>;
  }

  const rows = readTypedTableRows(value);
  const linkKey = typedTableLinkKey(config);
  const linked = !!linkKey;
  const maxRows = config.rows.max_rows ?? TYPED_TABLE_DEFAULT_MAX_ROWS;
  const minRows = config.rows.min_rows ?? 0;
  const serial = config.rows.serial_column !== false;
  const canAdd = !linked && rows.length < maxRows && !disabled;
  const canRemove = !linked && rows.length > minRows && !disabled;
  const canDuplicate = !linked && config.rows.allow_duplicate !== false && rows.length < maxRows && !disabled;
  const hidden = linked ? typedTableHiddenRowCount(scope, fieldKey) : 0;
  const linkName = linkLabel || `field ${linkKey}`;
  const compact = density === "compact";

  const setCell = (rowIndex: number, key: string, cell: unknown) =>
    onChange(rows.map((row, i) => (i === rowIndex ? { ...row, [key]: cell } : row)));
  const addRow = () => onChange([...rows, newTypedTableRow(config)]);
  const removeRow = (rowIndex: number) => onChange(rows.filter((_, i) => i !== rowIndex));
  const duplicateRow = (rowIndex: number) =>
    onChange([...rows.slice(0, rowIndex + 1), JSON.parse(JSON.stringify(rows[rowIndex])), ...rows.slice(rowIndex + 1)]);

  const cellId = (rowIndex: number, column: TypedTableColumn) => `${baseId}-r${rowIndex}-${column.key}`;
  const cellLabel = (rowIndex: number, column: TypedTableColumn) => `${label}, row ${rowIndex + 1}: ${column.label}`;

  const rowActions = (rowIndex: number) =>
    linked ? null : (
      <div className="flex items-center gap-1">
        {config.rows.allow_duplicate !== false && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canDuplicate}
            onClick={() => duplicateRow(rowIndex)}
            aria-label={`Duplicate row ${rowIndex + 1}`}
            title="Duplicate row"
          >
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          disabled={!canRemove}
          onClick={() => removeRow(rowIndex)}
          aria-label={`Remove row ${rowIndex + 1}`}
          title="Remove row"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );

  const status = linked ? (
    rows.length === 0 ? (
      <>Enter {linkName} to get one row per sample.</>
    ) : (
      <>
        {rows.length} row{rows.length === 1 ? "" : "s"}, set by {linkName}.
        {rows.length >= maxRows && <> Max {maxRows} rows allowed.</>}
      </>
    )
  ) : (
    <>
      {rows.length} of max {maxRows} row{maxRows === 1 ? "" : "s"}
      {minRows > 0 && <> (at least {minRows})</>}.
    </>
  );

  const useCards = stacked || isMobile;

  return (
    <div
      id={idPrefix ? baseId : undefined}
      tabIndex={-1}
      className={cn("space-y-2 outline-none", compact && "space-y-1.5")}
      data-typed-table={fieldKey}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {status}
      </p>
      {hidden > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="status">
          {hidden} filled row{hidden === 1 ? " is" : "s are"} hidden because {linkName} went down. Raise it again to bring{" "}
          {hidden === 1 ? "it" : "them"} back; hidden rows are not submitted.
        </p>
      )}

      {rows.length > 0 &&
        (useCards ? (
          <ol className="space-y-2" aria-label={label}>
            {rows.map((row, rowIndex) => (
              <li key={rowIndex} className="rounded-md border bg-card p-3">
                <div role="group" aria-labelledby={`${baseId}-row${rowIndex}-title`} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p id={`${baseId}-row${rowIndex}-title`} className="text-sm font-medium">
                      Row {rowIndex + 1}
                    </p>
                    {rowActions(rowIndex)}
                  </div>
                  {config.columns.map((column) => (
                    <div key={column.key} className="space-y-1">
                      <label htmlFor={cellId(rowIndex, column)} className="block text-xs font-medium">
                        {column.label}
                        {column.required && <span className="ml-0.5 text-destructive">*</span>}
                        {columnRangeText(column) && (
                          <span className="ml-1 font-normal text-muted-foreground">({columnRangeText(column)})</span>
                        )}
                      </label>
                      <TypedTableCell
                        column={column}
                        value={row[column.key]}
                        onChange={(v) => setCell(rowIndex, column.key, v)}
                        id={cellId(rowIndex, column)}
                        ariaLabel={cellLabel(rowIndex, column)}
                        disabled={disabled}
                      />
                      {column.help_text && column.type !== "TEXT" && (
                        <p className="text-xs text-muted-foreground">{column.help_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm" aria-label={label}>
              <thead className="bg-muted/50">
                <tr>
                  {serial && (
                    <th scope="col" className="w-12 px-2 py-2 text-left text-xs font-medium">
                      S.No.
                    </th>
                  )}
                  {config.columns.map((column) => (
                    <th key={column.key} scope="col" className="px-2 py-2 text-left align-bottom text-xs font-medium" title={column.help_text || undefined}>
                      {column.label}
                      {column.required && <span className="ml-0.5 text-destructive">*</span>}
                      {columnRangeText(column) && (
                        <span className="block font-normal text-muted-foreground">{columnRangeText(column)}</span>
                      )}
                    </th>
                  ))}
                  {!linked && (
                    <th scope="col" className="w-20 px-2 py-2">
                      <span className="sr-only">Row actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t align-top">
                    {serial && <td className="px-2 py-2 pt-3.5 text-xs text-muted-foreground">{rowIndex + 1}</td>}
                    {config.columns.map((column) => (
                      <td key={column.key} className="px-2 py-1.5">
                        <TypedTableCell
                          column={column}
                          value={row[column.key]}
                          onChange={(v) => setCell(rowIndex, column.key, v)}
                          id={cellId(rowIndex, column)}
                          ariaLabel={cellLabel(rowIndex, column)}
                          disabled={disabled}
                        />
                      </td>
                    ))}
                    {!linked && <td className="px-1 py-1.5">{rowActions(rowIndex)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {!linked && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={!canAdd}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add row
          </Button>
          {rows.length >= maxRows && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Max {maxRows} rows allowed
            </span>
          )}
        </div>
      )}
    </div>
  );
}
