import { useRef, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import PeriodicElementsDialog from "@/components/PeriodicElementsDialog";
import { apiClient } from "@/lib/api";
import {
  mergePeriodicDisplaySymbols,
  parsePeriodicHelpText,
  periodicSelectionChargeSummaryFromHelpText,
} from "@/data/periodicTableData";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import {
  applyTableRowSyncToValues,
  resolveTableColumns,
  resolveTableRowCountSourceKey,
  syncTableRowsToCount,
} from "@/lib/dynamicTableField";
import { formatStepAttr, resolveNumericFieldBounds } from "@/lib/numericFieldLimits";
import { MAX_SAMPLE_SETS, type SampleSetValues } from "@/lib/sampleSets";
import { cn } from "@/lib/utils";

export type SampleSetField = {
  field_key: string;
  field_label?: string;
  field_type?: string;
  options?: unknown;
  help_text?: string | null;
  default_value?: string | null;
  is_required?: boolean;
  source_element_field_key?: string | null;
};

type Props = {
  fields: SampleSetField[];
  sets: SampleSetValues[];
  onChange: (sets: SampleSetValues[]) => void;
  /** Values of sample set 1, copied when another set is added. */
  primaryValues: SampleSetValues;
  disabled?: boolean;
};

const WIDE_TYPES = new Set(["TABLE", "PERIODIC_TABLE", "ICPMS_STANDARD_COVERAGE"]);

const fieldTypeOf = (field: SampleSetField) => String(field.field_type || "").toUpperCase().trim();

const copyOf = (values: SampleSetValues): SampleSetValues => {
  const out: SampleSetValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("_")) continue;
    out[k] = Array.isArray(v) ? (JSON.parse(JSON.stringify(v)) as typeof v) : v;
  }
  return out;
};

const splitElements = (raw: unknown): string[] =>
  typeof raw === "string" && raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

export default function SampleSetsEditor({ fields, sets, onChange, primaryValues, disabled }: Props) {
  const setsRef = useRef(sets);
  setsRef.current = sets;
  const [periodicTarget, setPeriodicTarget] = useState<{ index: number; field: SampleSetField } | null>(null);
  const [periodicSelection, setPeriodicSelection] = useState<Set<string>>(new Set());

  const patchSet = (index: number, updates: SampleSetValues, sourceKey?: string) => {
    onChange(
      setsRef.current.map((s, i) => {
        if (i !== index) return s;
        const next: Record<string, unknown> = { ...s, ...updates };
        applyTableRowSyncToValues(next, fields, sourceKey ?? null);
        return next as SampleSetValues;
      }),
    );
  };

  const update = (index: number, key: string, value: SampleSetValues[string]) => patchSet(index, { [key]: value }, key);

  /** Same rules as the booking page's periodic "Apply": element counts plus ICPMS standard coverage. */
  const applyElements = async (index: number, field: SampleSetField, symbols: string[]) => {
    const key = field.field_key;
    const { disabled: disabledSet, preselected } = parsePeriodicHelpText(field.help_text);
    const icpmsFields = fields.filter((f) => fieldTypeOf(f) === "ICPMS_STANDARD_COVERAGE");
    const matching = icpmsFields.filter((f) => String(f.source_element_field_key || "").trim() === key);
    const coverageFields = matching.length > 0 ? matching : icpmsFields;
    const updates: SampleSetValues = {};

    const build = (picked: string[]) => {
      const merged = mergePeriodicDisplaySymbols(picked, field.help_text);
      const all = merged.all.filter((s) => !disabledSet.has(s));
      const billable = merged.billable.length;
      const countFor = (k: string) => (k === "A" || k === "B" ? (billable > 0 ? Math.max(1, billable) : 0) : billable);
      updates[key] = countFor(key);
      updates[`${key}_elements`] = all.join(",");
      for (const f of coverageFields) {
        const src = String(f.source_element_field_key || "").trim();
        if (!src) continue;
        updates[src] = countFor(src);
        updates[`${src}_elements`] = all.join(",");
      }
      return all;
    };

    let allowed = build([...symbols, ...Array.from(preselected)]);
    setPeriodicTarget(null);

    if (coverageFields.length > 0) {
      let count = 0;
      try {
        while (allowed.length > 0) {
          const res = await apiClient.getIcpmsMinStandardsCover(allowed);
          const uncovered = Array.isArray(res?.data?.uncovered) ? res.data.uncovered : [];
          if (uncovered.length === 0) {
            count = res?.data?.count ?? 0;
            break;
          }
          const exclude = window.confirm(
            `Some selected elements cannot be covered by available standards.\n\nUncovered elements:\n${uncovered.join(", ")}\n\nDo you want to exclude these elements and recalculate?`,
          );
          if (!exclude) {
            allowed = build(Array.from(preselected));
            break;
          }
          const uncoveredSet = new Set(uncovered.map((u) => String(u).toUpperCase()));
          const remaining = allowed.filter((s) => preselected.has(s) || !uncoveredSet.has(s.toUpperCase()));
          if (remaining.length === allowed.length) break;
          allowed = build(remaining);
        }
      } catch {
        count = 0;
      }
      for (const f of coverageFields) updates[f.field_key] = count;
    }
    patchSet(index, updates);
  };

  const renderTable = (set: SampleSetValues, index: number, field: SampleSetField) => {
    const key = field.field_key;
    const sourceKey = resolveTableRowCountSourceKey(field, fields);
    const rowCountDriven = Boolean(sourceKey);
    const { columns, hasSerialColumn } = resolveTableColumns(field.options, { rowCountDriven });
    const rows = (Array.isArray(set[key]) ? set[key] : []) as string[][];
    if (columns.length === 0) {
      return <p className="text-sm text-muted-foreground">No columns defined for this table.</p>;
    }
    const setRows = (next: string[][]) => update(index, key, next);
    const setCell = (ri: number, ci: number, value: string) => {
      if (hasSerialColumn && ci === 0) return;
      const next = rows.map((r) => r.slice());
      if (!next[ri]) next[ri] = Array(columns.length).fill("");
      next[ri][ci] = value;
      setRows(next);
    };
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((header, ci) => (
                  <th key={ci} className="border-r p-2 text-left font-medium last:border-r-0">
                    {header}
                  </th>
                ))}
                {!rowCountDriven && <th className="w-10 p-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (rowCountDriven ? 0 : 1)} className="p-2 text-center text-muted-foreground">
                    {rowCountDriven ? "No rows yet — set the row-count field above." : "No rows. Click + to add."}
                  </td>
                </tr>
              ) : (
                rows.map((row, ri) => (
                  <tr key={ri} className="border-b last:border-0">
                    {columns.map((_, ci) => (
                      <td key={ci} className="border-r p-1 last:border-r-0">
                        {hasSerialColumn && ci === 0 ? (
                          <span className="inline-flex h-8 items-center px-2 text-sm font-medium tabular-nums text-muted-foreground">
                            {row[ci] ?? String(ri + 1)}
                          </span>
                        ) : (
                          <Input
                            className="h-8 text-sm"
                            value={row[ci] ?? ""}
                            disabled={disabled}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                          />
                        )}
                      </td>
                    ))}
                    {!rowCountDriven && (
                      <td className="w-10 p-1 text-center align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={disabled}
                          title="Delete row"
                          onClick={() => {
                            const next = rows.filter((_, i) => i !== ri);
                            setRows(hasSerialColumn ? syncTableRowsToCount(next, next.length, columns.length, true) : next);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!rowCountDriven && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const newRow = Array(columns.length).fill("");
              if (hasSerialColumn) newRow[0] = String(rows.length + 1);
              setRows([...rows, newRow]);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add row
          </Button>
        )}
      </div>
    );
  };

  const renderField = (set: SampleSetValues, index: number, field: SampleSetField) => {
    const type = fieldTypeOf(field);
    const key = field.field_key;
    const id = `sample-set-${index}-${key}`;
    const raw = set[key];
    const options = Array.isArray(field.options) ? field.options : [];
    switch (type) {
      case "TEXT":
        return (
          <Input
            id={id}
            value={raw != null ? String(raw) : ""}
            placeholder={field.default_value || ""}
            disabled={disabled}
            onChange={(e) => update(index, key, e.target.value)}
          />
        );
      case "NUMERIC": {
        const { min, max, step } = resolveNumericFieldBounds(field);
        return (
          <Input
            id={id}
            type="number"
            value={raw === undefined || raw === null ? "" : String(raw)}
            min={min}
            max={max}
            step={formatStepAttr(step)}
            placeholder={field.default_value || ""}
            disabled={disabled}
            onChange={(e) => update(index, key, e.target.value)}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value === "") return;
              const n = Number(value.replace(",", "."));
              if (!Number.isFinite(n)) return;
              if (n < min) update(index, key, String(min));
              else if (n > max) update(index, key, String(max));
            }}
          />
        );
      }
      case "RADIO":
        return options.length > 0 ? (
          <RadioGroup
            value={raw != null ? String(raw) : field.default_value || ""}
            onValueChange={(v) => update(index, key, v)}
            disabled={disabled}
          >
            {options.map((option, oi) => {
              const { value, label } = normalizeChoiceOption(option, oi);
              return (
                <div key={`${key}-${oi}-${value}`} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`${id}-${value}`} />
                  <Label htmlFor={`${id}-${value}`} className="cursor-pointer font-normal">
                    {label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        ) : (
          <p className="text-sm text-muted-foreground">No options available</p>
        );
      case "COMBO":
        return (
          <Select
            value={raw != null ? String(raw) : field.default_value || ""}
            onValueChange={(v) => update(index, key, v)}
            disabled={disabled}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, oi) => {
                const { value, label } = normalizeChoiceOption(option, oi);
                return (
                  <SelectItem key={`${key}-${oi}-${value}`} value={value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      case "MULTI_SELECT": {
        const current = Array.isArray(raw) ? (raw as string[]) : [];
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {options.map((option, oi) => {
              const { value, label } = normalizeChoiceOption(option, oi);
              return (
                <label key={`${key}-${oi}-${value}`} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={current.includes(value)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      update(index, key, checked ? [...current, value] : current.filter((v) => v !== value))
                    }
                  />
                  {label}
                </label>
              );
            })}
          </div>
        );
      }
      case "TOGGLE":
        return (
          <Switch
            id={id}
            checked={raw === true || raw === "true"}
            disabled={disabled}
            onCheckedChange={(checked) => update(index, key, checked)}
          />
        );
      case "PERIODIC_TABLE": {
        const { disabled: disabledSet, preselected } = parsePeriodicHelpText(field.help_text);
        const { all } = mergePeriodicDisplaySymbols(splitElements(set[`${key}_elements`]), field.help_text);
        const allowedList = all.filter((s) => !disabledSet.has(s));
        const count = Number(raw) || 0;
        return (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setPeriodicSelection(new Set([...allowedList, ...Array.from(preselected)]));
                setPeriodicTarget({ index, field });
              }}
            >
              Select elements
            </Button>
            {(count > 0 || allowedList.length > 0) && (
              <p className="text-sm text-muted-foreground">
                {periodicSelectionChargeSummaryFromHelpText(allowedList, field.help_text)}
                {allowedList.length ? ` Selected: ${allowedList.join(", ")}.` : ""}
              </p>
            )}
          </div>
        );
      }
      case "ICPMS_STANDARD_COVERAGE":
        return (
          <div className="space-y-1">
            <Input id={id} type="number" value={String(Number(raw) || 0)} readOnly disabled className="bg-muted font-medium" />
            <p className="text-xs text-muted-foreground">Calculated from the elements selected for this sample set.</p>
          </div>
        );
      case "TABLE":
        return renderTable(set, index, field);
      default:
        return <p className="text-xs text-muted-foreground">Same as sample set 1</p>;
    }
  };

  return (
    <div className="space-y-3">
      {sets.map((set, index) => (
        <div key={index} className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Sample set {index + 2}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || sets.length >= MAX_SAMPLE_SETS}
                onClick={() => onChange([...sets.slice(0, index + 1), copyOf(set), ...sets.slice(index + 1)])}
                title="Duplicate this sample set"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={() => onChange(sets.filter((_, i) => i !== index))}
                title="Remove this sample set"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const type = fieldTypeOf(field);
              return (
                <div key={field.field_key} className={cn("space-y-1", WIDE_TYPES.has(type) && "sm:col-span-2")}>
                  <Label htmlFor={`sample-set-${index}-${field.field_key}`} className="text-xs">
                    {field.field_label || field.field_key}
                    {field.is_required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  {renderField(set, index, field)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || sets.length >= MAX_SAMPLE_SETS}
        onClick={() => onChange([...sets, copyOf(primaryValues)])}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add sample with different parameters
      </Button>
      <PeriodicElementsDialog
        open={periodicTarget != null}
        onOpenChange={(open) => !open && setPeriodicTarget(null)}
        helpText={periodicTarget?.field.help_text}
        selected={periodicSelection}
        onSelectedChange={setPeriodicSelection}
        onApply={() => {
          if (!periodicTarget) return;
          void applyElements(periodicTarget.index, periodicTarget.field, Array.from(periodicSelection));
        }}
      />
    </div>
  );
}
