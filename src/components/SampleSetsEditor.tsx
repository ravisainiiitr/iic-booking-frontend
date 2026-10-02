import { useEffect, useRef, useState } from "react";
import { ChevronDown, ClipboardCopy, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DynamicFieldRow } from "@/components/DynamicFieldRow";
import PeriodicElementsDialog from "@/components/PeriodicElementsDialog";
import {
  mergePeriodicDisplaySymbols,
  parsePeriodicHelpText,
  periodicSelectionChargeSummaryFromHelpText,
} from "@/data/periodicTableData";
import { dynamicFieldControlWidth } from "@/lib/dynamicFieldLayout";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import {
  applyTableRowSyncToValues,
  resolveTableColumns,
  resolveTableRowCountSourceKey,
  syncTableRowsToCount,
} from "@/lib/dynamicTableField";
import { formatNumericBound, formulaFallbackValues } from "@/lib/numericFieldLimits";
import { computePeriodicElementUpdates, splitElements } from "@/lib/periodicElementSelection";
import {
  boundsWithCombinedMax,
  combinedAllowances,
  combinedLimitMessage,
  fitNewSampleSet,
  formatAllowance,
  maxForExtraSet,
  sampleSetFieldBounds,
  sampleSetFieldLimitError,
} from "@/lib/sampleSetLimits";
import { NumericFieldInput } from "@/components/NumericFieldInput";
import {
  defaultSampleSetValues,
  MAX_SAMPLE_SETS,
  sampleSetSummary,
  type SampleSetValues,
} from "@/lib/sampleSets";
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
  /** Values of sample set 1 (for the combined A / B maximum and "Copy set 1 values"). */
  primaryValues: SampleSetValues;
  disabled?: boolean;
  /** When false, sets cannot be added, duplicated or removed (values inside existing sets stay editable). */
  allowAddRemove?: boolean;
  /** Shown when `allowAddRemove` is false. */
  addRemoveLockedNote?: string;
  /**
   * The equipment's "Allow samples with different parameters" switch. When false no set can be added or
   * duplicated; sets saved earlier stay editable and removable.
   */
  allowAdd?: boolean;
  /** Equipment slot length, for max formulas using SLOT_DURATION_MINUTES. */
  slotDurationMinutes?: number | null;
  /** Sets as saved (when editing), so unchanged legacy values below the minimum are not flagged. */
  storedSets?: SampleSetValues[];
};

export const SAMPLE_SET_HELPER_TEXT =
  "Need different settings for some samples? Add another sample set — each set is charged and timed separately.";
export const SAMPLE_SETS_SWITCHED_OFF_NOTE =
  "This equipment no longer accepts new sample sets. The sets below can still be changed or removed.";

const fieldTypeOf = (field: SampleSetField) => String(field.field_type || "").toUpperCase().trim();

const copyOf = (values: SampleSetValues): SampleSetValues => {
  const out: SampleSetValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("_")) continue;
    out[k] = Array.isArray(v) ? (JSON.parse(JSON.stringify(v)) as typeof v) : v;
  }
  return out;
};

/** "Select elements" button plus the current selection summary, shared by every sample set. */
export function PeriodicElementsField({
  field,
  values,
  disabled,
  onOpen,
}: {
  field: SampleSetField;
  values: SampleSetValues;
  disabled?: boolean;
  onOpen: (selection: Set<string>) => void;
}) {
  const key = field.field_key;
  const { disabled: disabledSet, preselected } = parsePeriodicHelpText(field.help_text);
  const { all } = mergePeriodicDisplaySymbols(splitElements(values[`${key}_elements`]), field.help_text);
  const allowedList = all.filter((s) => !disabledSet.has(s));
  const count = Number(values[key]) || 0;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onOpen(new Set([...allowedList, ...Array.from(preselected)]))}
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

export default function SampleSetsEditor({
  fields,
  sets,
  onChange,
  primaryValues,
  disabled,
  allowAddRemove = true,
  addRemoveLockedNote = "Only the Officer In-Charge or administrator can add or remove sample sets after booking.",
  allowAdd = true,
  slotDurationMinutes,
  storedSets,
}: Props) {
  const formulaContext = { slotDurationMinutes, fallbacks: formulaFallbackValues(fields) };
  const setsRef = useRef(sets);
  setsRef.current = sets;
  const [periodicTarget, setPeriodicTarget] = useState<{ index: number; field: SampleSetField } | null>(null);
  const [periodicSelection, setPeriodicSelection] = useState<Set<string>>(new Set());

  // Stable ids per set (sets are plain values) so collapse state and scrolling follow the right card.
  const nextIdRef = useRef(1);
  const idsRef = useRef<number[]>([]);
  if (idsRef.current.length > sets.length) idsRef.current = idsRef.current.slice(0, sets.length);
  while (idsRef.current.length < sets.length) idsRef.current.push(nextIdRef.current++);
  const ids = idsRef.current;
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [scrollToId, setScrollToId] = useState<number | null>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (scrollToId == null) return;
    cardRefs.current.get(scrollToId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setScrollToId(null);
  }, [scrollToId]);

  const allowances = combinedAllowances(fields, primaryValues, sets);
  const overLimit = allowances.find((a) => a.over);
  const fieldLimitError = sampleSetFieldLimitError(fields, sets, formulaContext, storedSets);
  const atSetCap = sets.length >= MAX_SAMPLE_SETS;
  const newSet = fitNewSampleSet(fields, primaryValues, sets, defaultSampleSetValues(fields));
  const exhausted = allowances.find((a) => Math.max(0, a.remaining) < a.floor);
  const addBlockedReason = !allowAdd
    ? SAMPLE_SETS_SWITCHED_OFF_NOTE
    : !allowAddRemove
      ? addRemoveLockedNote
      : atSetCap
        ? `At most ${MAX_SAMPLE_SETS + 1} sample sets are allowed in one booking.`
        : exhausted
          ? `${exhausted.label} already uses the maximum allowed (${formatNumericBound(exhausted.max)}) across all sample sets, so another sample set cannot be added.`
          : null;

  /** Insert `values` at `index`, giving the new card its own id and bringing it into view. */
  const insertSet = (index: number, values: SampleSetValues) => {
    const id = nextIdRef.current++;
    idsRef.current = [...ids.slice(0, index), id, ...ids.slice(index)];
    setScrollToId(id);
    onChange([...sets.slice(0, index), values, ...sets.slice(index)]);
  };

  const removeSet = (index: number) => {
    idsRef.current = ids.filter((_, i) => i !== index);
    onChange(sets.filter((_, i) => i !== index));
  };

  const toggleCollapsed = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const applyElements = async (index: number, field: SampleSetField, symbols: string[]) => {
    setPeriodicTarget(null);
    patchSet(index, await computePeriodicElementUpdates(fields, field, symbols));
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
                            aria-label={`${columns[ci] || `Column ${ci + 1}`}, row ${ri + 1}`}
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
                          aria-label={`Delete row ${ri + 1}`}
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
            className={dynamicFieldControlWidth(type, field.field_label)}
            onChange={(e) => update(index, key, e.target.value)}
          />
        );
      case "NUMERIC": {
        const limit = allowances.find((a) => a.key === key);
        const { bounds, maxHint } = boundsWithCombinedMax(
          sampleSetFieldBounds(field, set, formulaContext),
          limit,
          limit ? maxForExtraSet(limit, primaryValues, sets, index) : undefined,
        );
        return (
          <NumericFieldInput
            id={id}
            value={raw}
            bounds={bounds}
            maxHint={maxHint}
            label={`Sample set ${index + 2}: ${field.field_label || key}`}
            required={field.is_required}
            placeholder={field.is_required ? field.default_value || "" : "Optional"}
            disabled={disabled}
            onValueChange={(next) => update(index, key, next)}
          />
        );
      }
      case "RADIO":
        return options.length > 0 ? (
          <RadioGroup
            value={raw != null ? String(raw) : field.default_value || ""}
            onValueChange={(v) => update(index, key, v)}
            disabled={disabled}
            aria-label={field.field_label || key}
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {options.map((option, oi) => {
              const { value, label } = normalizeChoiceOption(option, oi);
              return (
                <div key={`${key}-${oi}-${value}`} className="flex items-center gap-2">
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
            <SelectTrigger id={id} className={dynamicFieldControlWidth(type)}>
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
          <div role="group" aria-label={field.field_label || key} className="flex flex-wrap gap-x-4 gap-y-1">
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
      case "PERIODIC_TABLE":
        return (
          <PeriodicElementsField
            field={field}
            values={set}
            disabled={disabled}
            onOpen={(selection) => {
              setPeriodicSelection(selection);
              setPeriodicTarget({ index, field });
            }}
          />
        );
      case "ICPMS_STANDARD_COVERAGE":
        return (
          <div className="space-y-1">
            <Input
              id={id}
              type="number"
              value={String(Number(raw) || 0)}
              readOnly
              disabled
              className="w-20 bg-muted font-medium tabular-nums"
            />
            <p className="text-xs text-muted-foreground">Calculated from the elements selected for this sample set.</p>
          </div>
        );
      case "TABLE":
        return renderTable(set, index, field);
      default:
        return <p className="text-xs text-muted-foreground">Same as sample set 1</p>;
    }
  };

  const addDisabled = disabled || Boolean(addBlockedReason) || newSet == null;
  const addButton = (label: string, className?: string) => (
    <span title={addBlockedReason ?? undefined} className={cn("inline-flex", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 border-dashed sm:w-auto"
        disabled={addDisabled}
        onClick={() => newSet && insertSet(sets.length, newSet)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </Button>
    </span>
  );

  return (
    <div className="space-y-3" data-testid="sample-sets-editor">
      {sets.map((set, index) => {
        const id = ids[index];
        const isCollapsed = collapsed.has(id);
        const title = `Sample set ${index + 2}`;
        const duplicate = fitNewSampleSet(fields, primaryValues, sets, copyOf(set));
        const fromSetOne = fitNewSampleSet(
          fields,
          primaryValues,
          sets.filter((_, i) => i !== index),
          copyOf(primaryValues),
        );
        const summary = isCollapsed ? sampleSetSummary(fields, set) : "";
        return (
          <section
            key={id}
            ref={(el) => {
              if (el) cardRefs.current.set(id, el);
              else cardRefs.current.delete(id);
            }}
            aria-label={title}
            className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card shadow-sm dark:bg-muted/10"
          >
            <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-2 py-1.5 dark:bg-muted/20">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapsed(id)}
              >
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                  aria-hidden
                />
                <span className="shrink-0 text-sm font-semibold">{title}</span>
                {summary && <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>}
              </button>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={disabled || fromSetOne == null}
                  onClick={() => fromSetOne && onChange(sets.map((s, i) => (i === index ? fromSetOne : s)))}
                  title={
                    fromSetOne == null
                      ? "Sample set 1's values do not fit the maximum allowed across all sample sets."
                      : "Replace this set's values with sample set 1's values"
                  }
                  aria-label={`Copy sample set 1 values into ${title}`}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Copy set 1 values</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  disabled={disabled || Boolean(addBlockedReason) || duplicate == null}
                  onClick={() => duplicate && insertSet(index + 1, duplicate)}
                  title={addBlockedReason ?? "Duplicate this sample set"}
                  aria-label={`Duplicate ${title}`}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={disabled || !allowAddRemove}
                  onClick={() => removeSet(index)}
                  title={allowAddRemove ? "Remove this sample set" : addRemoveLockedNote}
                  aria-label={`Remove ${title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-3 p-3 sm:gap-2.5">
                {fields.map((field) => (
                  <DynamicFieldRow
                    key={field.field_key}
                    fieldType={fieldTypeOf(field)}
                    label={field.field_label || field.field_key}
                    htmlFor={`sample-set-${index}-${field.field_key}`}
                    required={field.is_required}
                  >
                    {renderField(set, index, field)}
                  </DynamicFieldRow>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {sets.length > 0 && allowances.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground" aria-live="polite">
          {allowances.map((a) => (
            <li key={a.key} className={a.over ? "font-medium text-destructive" : undefined}>
              {formatAllowance(a)}
            </li>
          ))}
        </ul>
      )}
      {sets.length > 0 && overLimit && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {combinedLimitMessage(overLimit)} Lower the values in one of the sample sets.
        </p>
      )}
      {fieldLimitError && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {fieldLimitError}
        </p>
      )}
      {!allowAdd ? (
        sets.length > 0 && <p className="text-xs text-muted-foreground">{SAMPLE_SETS_SWITCHED_OFF_NOTE}</p>
      ) : sets.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 dark:bg-muted/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground sm:text-sm">{SAMPLE_SET_HELPER_TEXT}</p>
          {addButton("Add sample with different parameters", "w-full shrink-0 sm:w-auto")}
        </div>
      ) : (
        addButton("Add another sample set", "w-full sm:w-auto")
      )}
      {allowAdd && addBlockedReason && !atSetCap && (
        <p className="text-xs text-muted-foreground">{addBlockedReason}</p>
      )}
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
