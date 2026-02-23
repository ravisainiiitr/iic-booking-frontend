import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Check, Plus, Trash2 } from "lucide-react";
import { periodicTableElements, getCategoryColor, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";

export interface InputFieldDef {
  field_key: string;
  field_label: string;
  field_type: string;
  editing_required?: boolean;
  options?: (string | { value?: string; label?: string })[];
}

interface BookingUserInputsProps {
  inputValues: Record<string, string | boolean | string[] | number | string[][]>;
  inputFields?: InputFieldDef[] | null;
  status: string;
  onUpdate?: (newInputValues: Record<string, string | boolean | string[] | number | string[][]>) => Promise<void>;
  disabled?: boolean;
}

function formatVal(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length > 0 && Array.isArray(v[0])) return `${(v as unknown[][]).length} row(s)`;
    return v.join(", ");
  }
  return String(v);
}

function resolveRadioComboDisplay(
  value: unknown,
  options: (string | { value?: string; label?: string })[] | undefined,
  fieldType: string
): string {
  const type = String(fieldType || "").toUpperCase();
  if (value === undefined || value === null || value === "") return "—";
  if (type !== "RADIO" && type !== "COMBO") return formatVal(value);
  if (!options || options.length === 0) return formatVal(value);
  const strVal = String(value).trim();
  const optionLabels = options.map((o) => (typeof o === "string" ? o : o.label ?? o.value ?? ""));
  const optionValues = options.map((o, i) => (typeof o === "string" ? o : o.value ?? o.label ?? String(i + 1)));
  if (/^\d+$/.test(strVal)) {
    const idx = parseInt(strVal, 10);
    if (idx >= 1 && idx <= optionLabels.length) return optionLabels[idx - 1] || strVal;
  }
  const byValue = optionValues.indexOf(strVal);
  if (byValue >= 0) return optionLabels[byValue] || strVal;
  const byLabel = optionLabels.indexOf(strVal);
  if (byLabel >= 0) return optionLabels[byLabel];
  return strVal;
}

export function BookingUserInputs({
  inputValues,
  inputFields,
  status,
  onUpdate,
  disabled = false,
}: BookingUserInputsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormValues, setEditFormValues] = useState<Record<string, string | number | boolean | string[] | string[][]>>({});

  const iv = inputValues || {};
  const keysToShow = Object.keys(iv).filter((k) => !k.endsWith("_elements"));
  if (keysToShow.length === 0) return null;

  const isCompleted = String(status || "").toUpperCase() === "COMPLETED";
  const canEdit = !!onUpdate && !disabled && !isCompleted;

  const fields =
    inputFields && inputFields.length > 0
      ? inputFields
      : keysToShow.map(
          (key) =>
            ({ field_key: key, field_label: key, field_type: "", options: undefined, editing_required: false } as InputFieldDef)
        );

  const editableFields = fields.filter((f) => f.editing_required);
  const hasEditableFields = canEdit && editableFields.length > 0;
  const hasPeriodicTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE"
  );
  const hasTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "TABLE"
  );

  const openEditDialog = () => {
    const initial: Record<string, string | number | boolean | string[] | string[][]> = { ...iv };
    fields.forEach((f) => {
      if (String(f.field_type || "").toUpperCase() !== "TABLE") return;
      const raw = iv[f.field_key];
      if (raw === undefined || raw === null) {
        initial[f.field_key] = [];
        return;
      }
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw) as unknown;
          initial[f.field_key] = Array.isArray(parsed) && parsed.every((r) => Array.isArray(r))
            ? (parsed as string[][])
            : [];
        } catch {
          initial[f.field_key] = [];
        }
        return;
      }
      if (Array.isArray(raw) && raw.every((r) => Array.isArray(r))) {
        initial[f.field_key] = raw as string[][];
      }
    });
    setEditFormValues(initial);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(editFormValues);
      toast.success("User inputs updated");
      setEditDialogOpen(false);
    } catch (e) {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const updateFormValue = (
    fieldKey: string,
    value: string | number | boolean | string[] | string[][],
    elementsValue?: string
  ) => {
    setEditFormValues((prev) => {
      const next = { ...prev, [fieldKey]: value };
      if (elementsValue !== undefined) next[`${fieldKey}_elements`] = elementsValue;
      return next;
    });
  };

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium">User Inputs</p>
        {hasEditableFields && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={openEditDialog}
            title="Edit user inputs"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ul className="space-y-1 text-sm">
        {fields.map((f) => {
          const val = iv[f.field_key];
          const elementsVal = iv[`${f.field_key}_elements`];
          const isPeriodic = String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE";
          const isTable = String(f.field_type || "").toUpperCase() === "TABLE";
          const displayVal =
            ["RADIO", "COMBO"].includes(String(f.field_type || "").toUpperCase())
              ? resolveRadioComboDisplay(val, f.options, f.field_type)
              : formatVal(val);
          const elementsSuffix =
            isPeriodic && elementsVal != null && String(elementsVal).trim() !== ""
              ? ` (${formatVal(elementsVal)})`
              : "";

          if (isTable) {
            const columns = Array.isArray(f.options)
              ? f.options.map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
              : [];
            const rows = (Array.isArray(val) && val.length > 0 && Array.isArray(val[0]) ? val : []) as string[][];
            return (
              <li key={f.field_key} className="space-y-1.5">
                <span className="text-muted-foreground font-medium">{f.field_label}</span>
                {columns.length > 0 && rows.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          {columns.map((header, ci) => (
                            <th key={ci} className="text-left font-medium p-2 border-r last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={ri} className="border-b last:border-0">
                            {columns.map((_, ci) => (
                              <td key={ci} className="p-2 border-r last:border-r-0 text-foreground">
                                {row[ci] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : rows.length > 0 && columns.length === 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={ri} className="border-b last:border-0">
                            {row.map((cell, ci) => (
                              <td key={ci} className="p-2 border-r last:border-r-0 text-foreground">
                                {cell ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{rows.length === 0 ? "—" : displayVal}</span>
                )}
              </li>
            );
          }

          return (
            <li key={f.field_key} className="flex justify-between gap-2 items-baseline">
              <span className="text-muted-foreground shrink-0">{f.field_label}:</span>
              <span className="text-foreground text-right">
                {displayVal}
                {elementsSuffix}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Edit popup */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto",
            hasPeriodicTableField || hasTableField ? "sm:max-w-4xl" : "sm:max-w-md"
          )}
        >
          <DialogHeader>
            <DialogTitle>Edit User Inputs</DialogTitle>
            <DialogDescription>
              Update the values below. Only fields marked as editable can be changed and only until the booking is completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editableFields.map((f) => {
              const val = editFormValues[f.field_key];
              const type = String(f.field_type || "").toUpperCase();
              return (
                <div key={f.field_key} className="space-y-2">
                  <Label htmlFor={`edit-${f.field_key}`}>{f.field_label}</Label>
                  {type === "NUMERIC" && (
                    <Input
                      id={`edit-${f.field_key}`}
                      type="number"
                      value={typeof val === "number" ? val : Number(val) || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === "" ? 0 : Number(v);
                        updateFormValue(f.field_key, isNaN(n) ? 0 : n);
                      }}
                    />
                  )}
                  {type === "TEXT" && (
                    <Input
                      id={`edit-${f.field_key}`}
                      value={typeof val === "string" ? val : ""}
                      onChange={(e) => updateFormValue(f.field_key, e.target.value)}
                    />
                  )}
                  {type === "RADIO" && f.options && f.options.length > 0 && (
                    <RadioGroup
                      value={String(val ?? "")}
                      onValueChange={(v) => updateFormValue(f.field_key, v)}
                      className="flex flex-wrap gap-3 pt-1"
                    >
                      {f.options.map((opt, i) => {
                        const optionValue = typeof opt === "string" ? opt : opt.value ?? opt.label ?? String(i + 1);
                        const optionLabel = typeof opt === "string" ? opt : opt.label ?? opt.value ?? optionValue;
                        return (
                          <div key={optionValue} className="flex items-center gap-2">
                            <RadioGroupItem value={optionValue} id={`edit-${f.field_key}-${optionValue}`} />
                            <Label htmlFor={`edit-${f.field_key}-${optionValue}`} className="font-normal cursor-pointer">
                              {optionLabel}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  )}
                  {type === "COMBO" && f.options && f.options.length > 0 && (
                    <Select
                      value={String(val ?? "")}
                      onValueChange={(v) => updateFormValue(f.field_key, v)}
                    >
                      <SelectTrigger id={`edit-${f.field_key}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((opt, i) => {
                          const optionValue = typeof opt === "string" ? opt : opt.value ?? opt.label ?? String(i + 1);
                          const optionLabel = typeof opt === "string" ? opt : opt.label ?? opt.value ?? optionValue;
                          return (
                            <SelectItem key={optionValue} value={optionValue}>
                              {optionLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {type === "TOGGLE" && (
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id={`edit-${f.field_key}`}
                        checked={val === true || val === "true"}
                        onCheckedChange={(c) => updateFormValue(f.field_key, c === true)}
                      />
                      <Label htmlFor={`edit-${f.field_key}`} className="font-normal cursor-pointer">
                        {val ? "Yes" : "No"}
                      </Label>
                    </div>
                  )}
                  {type === "PERIODIC_TABLE" && (() => {
                    const elementsStr = String(editFormValues[`${f.field_key}_elements`] ?? "").trim();
                    const selectedSymbols = new Set(
                      elementsStr ? elementsStr.split(",").map((s) => s.trim()).filter(Boolean) : []
                    );
                    const toggleSymbol = (symbol: string) => {
                      const next = new Set(selectedSymbols);
                      if (next.has(symbol)) next.delete(symbol);
                      else next.add(symbol);
                      setEditFormValues((prev) => ({
                        ...prev,
                        [f.field_key]: next.size,
                        [`${f.field_key}_elements`]: Array.from(next).join(","),
                      }));
                    };
                    const grid: (Element | null)[][] = Array(7)
                      .fill(null)
                      .map(() => Array(18).fill(null));
                    periodicTableElements.forEach((el) => {
                      if (el.row <= 7 && el.col <= 18) grid[el.row - 1][el.col - 1] = el;
                    });
                    const lanthanides = periodicTableElements.filter((el) => el.category === "lanthanide");
                    const actinides = periodicTableElements.filter((el) => el.category === "actinide");
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-muted-foreground">
                          {selectedSymbols.size} element(s) selected. Click elements to toggle.
                        </p>
                        <div className="overflow-x-auto rounded-md border p-2 bg-muted/30">
                          <div className="inline-block min-w-max">
                            <div className="flex flex-col gap-0.5">
                              {grid.map((row, ri) => (
                                <div key={ri} className="flex gap-0.5">
                                  {row.map((el, ci) => (
                                    <div key={`${ri}-${ci}`}>
                                      {el ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleSymbol(el.symbol)}
                                          title={el.name}
                                          className={cn(
                                            "w-9 h-9 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
                                            getCategoryColor(el.category),
                                            selectedSymbols.has(el.symbol) &&
                                              "ring-2 ring-primary ring-offset-1 scale-105"
                                          )}
                                        >
                                          {selectedSymbols.has(el.symbol) && (
                                            <Check className="absolute top-0 right-0 w-3 h-3 text-primary" />
                                          )}
                                          <span className="font-bold">{el.symbol}</span>
                                        </button>
                                      ) : (
                                        <div className="w-9 h-9" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))}
                              <div className="flex gap-0.5 mt-1">
                                <div className="w-9 h-9 flex items-center justify-center text-xs font-semibold">
                                  Ln
                                </div>
                                {lanthanides.map((el) => (
                                  <button
                                    key={el.atomicNumber}
                                    type="button"
                                    onClick={() => toggleSymbol(el.symbol)}
                                    title={el.name}
                                    className={cn(
                                      "w-9 h-9 border-2 rounded flex items-center justify-center text-xs",
                                      getCategoryColor(el.category),
                                      selectedSymbols.has(el.symbol) && "ring-2 ring-primary"
                                    )}
                                  >
                                    <span className="font-bold">{el.symbol}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-0.5 mt-0.5">
                                <div className="w-9 h-9 flex items-center justify-center text-xs font-semibold">
                                  Ac
                                </div>
                                {actinides.map((el) => (
                                  <button
                                    key={el.atomicNumber}
                                    type="button"
                                    onClick={() => toggleSymbol(el.symbol)}
                                    title={el.name}
                                    className={cn(
                                      "w-9 h-9 border-2 rounded flex items-center justify-center text-xs",
                                      getCategoryColor(el.category),
                                      selectedSymbols.has(el.symbol) && "ring-2 ring-primary"
                                    )}
                                  >
                                    <span className="font-bold">{el.symbol}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {type === "TABLE" && (() => {
                    const columns = Array.isArray(f.options)
                      ? f.options.map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
                      : [];
                    const rows = (editFormValues[f.field_key] as string[][] | undefined) || [];
                    const addRow = () => {
                      const newRow = Array(columns.length).fill("");
                      updateFormValue(f.field_key, [...rows, newRow]);
                    };
                    const deleteRow = (rowIdx: number) => {
                      const next = rows.filter((_, i) => i !== rowIdx);
                      updateFormValue(f.field_key, next);
                    };
                    const setCell = (rowIdx: number, colIdx: number, cellVal: string) => {
                      const next = rows.map((r, i) => (i === rowIdx ? r.slice() : r));
                      if (!next[rowIdx]) next[rowIdx] = Array(columns.length).fill("");
                      next[rowIdx][colIdx] = cellVal;
                      updateFormValue(f.field_key, next);
                    };
                    if (columns.length === 0) {
                      return <p className="text-xs text-muted-foreground">No columns defined.</p>;
                    }
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-muted-foreground">
                          Headers are fixed. Edit any cell below; use Add row to add rows and the delete icon to remove a row.
                        </p>
                        <div className="rounded-md border overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                {columns.map((header, ci) => (
                                  <th key={ci} className="text-left font-medium p-2 border-r last:border-r-0">
                                    {header}
                                  </th>
                                ))}
                                <th className="w-10 p-2 text-center" title="Delete row"> </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={columns.length + 1} className="p-2 text-muted-foreground text-center text-xs">
                                    No rows. Click + to add.
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row, ri) => (
                                  <tr key={ri} className="border-b last:border-0">
                                    {columns.map((_, ci) => (
                                      <td key={ci} className="p-1 border-r last:border-r-0">
                                        <Input
                                          className="h-8 text-sm"
                                          value={row[ci] ?? ""}
                                          onChange={(e) => setCell(ri, ci, e.target.value)}
                                        />
                                      </td>
                                    ))}
                                    <td className="p-1 w-10 text-center align-middle">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => deleteRow(ri)}
                                        title="Delete row"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addRow}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add row
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BookingUserInputs;
