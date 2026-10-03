import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TypedTableInput from "@/components/TypedTableInput";
import {
  draftFromTypedTableConfig,
  newDraftColumn,
  typedTableConfigFromDraft,
  typedTableDraftErrors,
  type NumericFieldChoice,
  type TypedTableDraft,
  type TypedTableDraftColumn,
} from "@/lib/typedTableBuilder";
import {
  newTypedTableRow,
  TYPED_TABLE_CHOICE_TYPES,
  TYPED_TABLE_COLUMN_TYPES,
  TYPED_TABLE_COLUMN_TYPE_LABELS,
  TYPED_TABLE_MAX_COLUMNS,
  type TypedTableColumnType,
  type TypedTableRow,
} from "@/lib/typedTableField";

export type TypedTableBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label and key of the table field being configured. */
  fieldLabel: string;
  fieldKey: string;
  value: unknown;
  /** NUMERIC fields of the same user type that rows can follow. */
  numericFields: NumericFieldChoice[];
  onSave: (config: ReturnType<typeof typedTableConfigFromDraft>) => void;
};

/** Admin editor for an advanced table's columns and row rules, with a live booking-page preview. */
export default function TypedTableBuilderDialog({
  open,
  onOpenChange,
  fieldLabel,
  fieldKey,
  value,
  numericFields,
  onSave,
}: TypedTableBuilderDialogProps) {
  const [draft, setDraft] = useState<TypedTableDraft>(() => draftFromTypedTableConfig(value));
  const [previewRows, setPreviewRows] = useState<TypedTableRow[]>([]);
  const [previewCount, setPreviewCount] = useState("3");

  useEffect(() => {
    if (open) setDraft(draftFromTypedTableConfig(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload the saved schema each time the dialog opens
  }, [open]);

  const errors = typedTableDraftErrors(draft, numericFields, fieldKey);
  const previewConfig = useMemo(
    () => (draft.columns.some((c) => c.label.trim()) ? typedTableConfigFromDraft(draft) : null),
    [draft],
  );
  const linked = draft.mode === "LINKED";
  const previewTarget = linked
    ? Math.min(Math.max(0, Math.trunc(Number(previewCount) || 0)), previewConfig?.rows.max_rows ?? 0)
    : null;

  useEffect(() => {
    if (!previewConfig) return;
    setPreviewRows((prev) => {
      const want = previewTarget ?? Math.max(previewConfig.rows.initial_rows ?? 1, previewConfig.rows.min_rows ?? 0);
      if (previewTarget === null && prev.length > 0) return prev;
      if (prev.length === want) return prev;
      return prev.length > want
        ? prev.slice(0, want)
        : [...prev, ...Array.from({ length: want - prev.length }, () => newTypedTableRow(previewConfig))];
    });
  }, [previewConfig, previewTarget]);

  const setColumn = (uid: number, patch: Partial<TypedTableDraftColumn>) =>
    setDraft((d) => ({ ...d, columns: d.columns.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }));
  const moveColumn = (index: number, delta: -1 | 1) =>
    setDraft((d) => {
      const next = [...d.columns];
      const target = index + delta;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, columns: next };
    });
  const removeColumn = (uid: number) => setDraft((d) => ({ ...d, columns: d.columns.filter((c) => c.uid !== uid) }));
  const addColumn = () => setDraft((d) => ({ ...d, columns: [...d.columns, newDraftColumn("TEXT")] }));

  const save = () => {
    if (errors.length) return;
    onSave(typedTableConfigFromDraft(draft));
    onOpenChange(false);
  };

  const columnEditor = (c: TypedTableDraftColumn, index: number) => {
    const id = `ttb-${c.uid}`;
    const choice = TYPED_TABLE_CHOICE_TYPES.includes(c.type);
    return (
      <fieldset key={c.uid} className="space-y-3 rounded-md border bg-background p-3" data-testid="ttb-column">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">Column {index + 1}</legend>
          <div className="flex items-center">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => moveColumn(index, -1)} aria-label={`Move column ${index + 1} up`}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === draft.columns.length - 1} onClick={() => moveColumn(index, 1)} aria-label={`Move column ${index + 1} down`}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeColumn(c.uid)} aria-label={`Remove column ${index + 1}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${id}-label`} className="text-xs">Label</Label>
            <Input id={`${id}-label`} value={c.label} placeholder="e.g. Max temperature (°C)" onChange={(e) => setColumn(c.uid, { label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-type`} className="text-xs">Type</Label>
            <Select value={c.type} onValueChange={(v) => setColumn(c.uid, { type: v as TypedTableColumnType, default: "" })}>
              <SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPED_TABLE_COLUMN_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPED_TABLE_COLUMN_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-key`} className="text-xs">Key (optional)</Label>
            <Input id={`${id}-key`} value={c.key} placeholder="made from the label" onChange={(e) => setColumn(c.uid, { key: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${id}-help`} className="text-xs">Help / placeholder</Label>
            <Input id={`${id}-help`} value={c.help_text} onChange={(e) => setColumn(c.uid, { help_text: e.target.value })} />
          </div>
        </div>
        {c.type === "NUMERIC" && (
          <div className="grid grid-cols-3 gap-2">
            {(["min", "max", "step"] as const).map((name) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={`${id}-${name}`} className="text-xs">
                  {name === "min" ? "Lower limit" : name === "max" ? "Upper limit" : "Step"}
                </Label>
                <Input id={`${id}-${name}`} inputMode="decimal" value={c[name]} placeholder={name === "step" ? "any" : "none"} onChange={(e) => setColumn(c.uid, { [name]: e.target.value })} />
              </div>
            ))}
            <label className="col-span-3 flex items-center gap-2 text-xs">
              <Checkbox checked={c.integer} onCheckedChange={(v) => setColumn(c.uid, { integer: v === true })} />
              Whole numbers only
            </label>
          </div>
        )}
        {c.type === "TEXT" && (
          <div className="max-w-[12rem] space-y-1">
            <Label htmlFor={`${id}-maxlen`} className="text-xs">Max length (characters)</Label>
            <Input id={`${id}-maxlen`} inputMode="numeric" value={c.max_length} placeholder="500" onChange={(e) => setColumn(c.uid, { max_length: e.target.value })} />
          </div>
        )}
        {choice && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-options`} className="text-xs">Options (one per line)</Label>
            <Textarea id={`${id}-options`} rows={3} value={c.optionsText} onChange={(e) => setColumn(c.uid, { optionsText: e.target.value })} />
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          {c.type !== "PERIODIC_TABLE" && (
            c.type === "TOGGLE" ? (
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={c.default === "true"} onCheckedChange={(v) => setColumn(c.uid, { default: v === true ? "true" : "" })} />
                On by default
              </label>
            ) : (
              <div className="w-48 space-y-1">
                <Label htmlFor={`${id}-default`} className="text-xs">
                  Default {c.type === "MULTI_SELECT" ? "(comma-separated)" : ""}
                </Label>
                <Input id={`${id}-default`} value={c.default} onChange={(e) => setColumn(c.uid, { default: e.target.value })} />
              </div>
            )
          )}
          {c.type !== "TOGGLE" && (
            <label className="flex items-center gap-2 pb-2 text-xs">
              <Checkbox checked={c.required} onCheckedChange={(v) => setColumn(c.uid, { required: v === true })} />
              Required in every row
            </label>
          )}
        </div>
      </fieldset>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Configure columns — {fieldLabel || `field ${fieldKey}`}</DialogTitle>
          <DialogDescription>
            Each column has its own type and limits. In charge and time formulas, field {fieldKey} stands for the
            number of filled rows.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {draft.columns.map(columnEditor)}
            <Button type="button" variant="outline" size="sm" onClick={addColumn} disabled={draft.columns.length >= TYPED_TABLE_MAX_COLUMNS}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Add column
            </Button>

            <fieldset className="space-y-3 rounded-md border bg-muted/20 p-3">
              <legend className="px-1 text-sm font-medium">Rows</legend>
              <RadioGroup
                value={draft.mode}
                onValueChange={(v) => setDraft((d) => ({ ...d, mode: v === "LINKED" ? "LINKED" : "USER" }))}
                className="space-y-1"
                aria-label="How rows are added"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="USER" id="ttb-mode-user" />
                  Users add, remove and duplicate rows
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="LINKED" id="ttb-mode-linked" />
                  Rows follow a Numeric field (e.g. one row per sample)
                </label>
              </RadioGroup>
              {linked && (
                <div className="space-y-1">
                  <Label htmlFor="ttb-link" className="text-xs">Number of rows comes from</Label>
                  <Select value={draft.link_field_key || "__none__"} onValueChange={(v) => setDraft((d) => ({ ...d, link_field_key: v === "__none__" ? "" : v }))}>
                    <SelectTrigger id="ttb-link" className="max-w-xs"><SelectValue placeholder="Choose a Numeric field" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Choose a Numeric field</SelectItem>
                      {numericFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.key} — {f.label || "Numeric field"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {numericFields.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add a Numeric field for this user type first.</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {!linked && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="ttb-min-rows" className="text-xs">Minimum rows</Label>
                      <Input id="ttb-min-rows" inputMode="numeric" value={draft.min_rows} onChange={(e) => setDraft((d) => ({ ...d, min_rows: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ttb-initial-rows" className="text-xs">Rows at start</Label>
                      <Input id="ttb-initial-rows" inputMode="numeric" value={draft.initial_rows} onChange={(e) => setDraft((d) => ({ ...d, initial_rows: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label htmlFor="ttb-max-rows" className="text-xs">Maximum rows</Label>
                  <Input id="ttb-max-rows" inputMode="numeric" value={draft.max_rows} onChange={(e) => setDraft((d) => ({ ...d, max_rows: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={draft.serial_column} onCheckedChange={(v) => setDraft((d) => ({ ...d, serial_column: v === true }))} />
                  Show S.No. column
                </label>
                {!linked && (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={draft.allow_duplicate} onCheckedChange={(v) => setDraft((d) => ({ ...d, allow_duplicate: v === true }))} />
                    Allow duplicating a row
                  </label>
                )}
              </div>
            </fieldset>
          </div>

          <div className="space-y-2 lg:sticky lg:top-0 lg:self-start">
            <p className="text-sm font-medium">Preview (as users see it)</p>
            {linked && (
              <div className="flex items-center gap-2 text-xs">
                <Label htmlFor="ttb-preview-count" className="text-xs font-normal">
                  Preview with field {draft.link_field_key || "?"} =
                </Label>
                <Input id="ttb-preview-count" inputMode="numeric" className="h-8 w-20" value={previewCount} onChange={(e) => setPreviewCount(e.target.value)} />
              </div>
            )}
            <div className="rounded-md border bg-background p-3" data-testid="ttb-preview">
              {previewConfig ? (
                <TypedTableInput
                  fieldKey={fieldKey}
                  label={fieldLabel || `Field ${fieldKey}`}
                  config={previewConfig}
                  value={previewRows}
                  onChange={setPreviewRows}
                  scope="builder-preview"
                  linkLabel={numericFields.find((f) => f.key === draft.link_field_key)?.label}
                  idPrefix="ttb-preview"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Give a column a label to see the preview.</p>
              )}
            </div>
            {errors.length > 0 && (
              <ul className="space-y-0.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={errors.length > 0}>
            Use these columns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
