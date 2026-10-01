import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import { formatStepAttr, resolveNumericFieldBounds } from "@/lib/numericFieldLimits";
import { MAX_SAMPLE_SETS, type SampleSetValues } from "@/lib/sampleSets";

export type SampleSetField = {
  field_key: string;
  field_label?: string;
  field_type?: string;
  options?: unknown;
  help_text?: string | null;
  default_value?: string | null;
};

type Props = {
  fields: SampleSetField[];
  sets: SampleSetValues[];
  onChange: (sets: SampleSetValues[]) => void;
  /** Values of sample set 1, copied when another set is added. */
  primaryValues: SampleSetValues;
  disabled?: boolean;
};

const EDITABLE_TYPES = new Set(["TEXT", "NUMERIC", "RADIO", "COMBO", "MULTI_SELECT", "TOGGLE"]);

const copyOf = (values: SampleSetValues): SampleSetValues => {
  const out: SampleSetValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("_")) continue;
    out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out;
};

export default function SampleSetsEditor({ fields, sets, onChange, primaryValues, disabled }: Props) {
  const update = (index: number, key: string, value: SampleSetValues[string]) =>
    onChange(sets.map((s, i) => (i === index ? { ...s, [key]: value } : s)));

  const renderField = (set: SampleSetValues, index: number, field: SampleSetField) => {
    const type = String(field.field_type || "").toUpperCase().trim();
    const key = field.field_key;
    const id = `sample-set-${index}-${key}`;
    const raw = set[key];
    const options = Array.isArray(field.options) ? field.options : [];
    if (!EDITABLE_TYPES.has(type)) {
      return <p className="text-xs text-muted-foreground">Same as sample set 1</p>;
    }
    switch (type) {
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
            disabled={disabled}
            onChange={(e) => update(index, key, e.target.value)}
          />
        );
      }
      case "RADIO":
      case "COMBO":
        return (
          <Select value={raw != null ? String(raw) : ""} onValueChange={(v) => update(index, key, v)} disabled={disabled}>
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
      default:
        return (
          <Input
            id={id}
            value={raw != null ? String(raw) : ""}
            disabled={disabled}
            onChange={(e) => update(index, key, e.target.value)}
          />
        );
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
            {fields.map((field) => (
              <div key={field.field_key} className="space-y-1">
                <Label htmlFor={`sample-set-${index}-${field.field_key}`} className="text-xs">
                  {field.field_label || field.field_key}
                </Label>
                {renderField(set, index, field)}
              </div>
            ))}
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
    </div>
  );
}
