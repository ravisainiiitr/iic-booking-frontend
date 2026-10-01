import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { formatNumericBound, formatStepAttr, isNumericInputDraft, nudgeNumericValue, numericFieldAllowsNegative, resolveFieldAFormulaMax, resolveNumericFieldBounds, roundToStepPrecision, type NumericFieldBounds } from "@/lib/numericFieldLimits";
import { normalizeChoiceOption } from "@/lib/dynamicFieldOptions";
import { dynamicFieldControlWidth } from "@/lib/dynamicFieldLayout";
import { DynamicFieldRow } from "@/components/DynamicFieldRow";
import {
  resolveTableColumns,
  resolveTableRowCountSourceKey,
  parseTableRowCount,
  syncTableRowsToCount,
  applyTableRowSyncToValues,
  getFieldValueCI,
} from "@/lib/dynamicTableField";
import {
  isBookingInputValueEmpty,
  isCommentsInputFieldKey,
} from "@/lib/bookingInputValues";
import SampleSetsEditor, { PeriodicElementsField } from "@/components/SampleSetsEditor";
import { computePeriodicElementUpdates } from "@/lib/periodicElementSelection";
import PeriodicElementsDialog from "@/components/PeriodicElementsDialog";
import { readSampleSets, SAMPLE_SETS_KEY, type SampleSetValues } from "@/lib/sampleSets";

export interface InputFieldDef {
  field_key: string;
  field_label: string;
  field_type: string;
  is_required?: boolean;
  editing_required?: boolean;
  /** Choice list for RADIO/COMBO; NUMERIC fields carry a limits object (e.g. { min, max_formula }). */
  options?: (string | { value?: string; label?: string })[];
  help_text?: string;
  source_element_field_key?: string | null;
}

interface BookingUserInputsProps {
  inputValues: Record<string, string | boolean | string[] | number | string[][]>;
  inputFields?: InputFieldDef[] | null;
  editableInputFields?: InputFieldDef[] | null;
  status: string;
  onUpdate?: (newInputValues: Record<string, string | boolean | string[] | number | string[][]>) => Promise<void>;
  disabled?: boolean;
  /** Legacy flag; editing is still restricted by editable fields. */
  enableChargeRecalculation?: boolean;
  /** Sample/slot trace events (ordered by created_at). Editing is disabled when latest status is COMPLETED. */
  sampleTrace?: Array<{ status: string }>;
  /** When true, editing is not restricted to BOOKED + not processed (admin/operator can edit in other cases). */
  isAdminUser?: boolean;
  /** Booking-level flag (not an equipment input field); shown as Yes/No in this card. */
  atmosphereSensitiveSample?: boolean;
  /** Open Edit User Inputs once when editable fields are available (post-booking CTA). */
  autoOpenEdit?: boolean;
  onAutoOpenEditConsumed?: () => void;
  /** Used by max formulas that reference SLOT_DURATION_MINUTES. */
  slotDurationMinutes?: number | null;
  /** External booking users are exempt from the field A max formula (same as at booking creation). */
  skipFormulaLimits?: boolean;
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

  const normalized = options.map((o, i) => normalizeChoiceOption(o, i));
  const optionLabels = normalized.map((o) => o.label);
  const optionValues = normalized.map((o) => o.value);

  // When value is boolean (or string "true"/"false"), map to option labels per optional text (e.g. Yes/No)
  const isBoolLike =
    typeof value === "boolean" ||
    (typeof value === "string" && (value.trim().toLowerCase() === "true" || value.trim().toLowerCase() === "false"));
  if (isBoolLike && options.length >= 1) {
    const boolVal = value === true || String(value).trim().toLowerCase() === "true";
    const yesIdx = optionLabels.findIndex((l) => /^yes$/i.test(String(l)));
    const noIdx = optionLabels.findIndex((l) => /^no$/i.test(String(l)));
    if (yesIdx >= 0 && noIdx >= 0) {
      return boolVal ? (optionLabels[yesIdx] || optionValues[yesIdx]) : (optionLabels[noIdx] || optionValues[noIdx]);
    }
    const yesValIdx = optionValues.findIndex((v) => /^true$/i.test(String(v)));
    const noValIdx = optionValues.findIndex((v) => /^false$/i.test(String(v)));
    if (yesValIdx >= 0 && noValIdx >= 0) {
      return boolVal ? (optionLabels[yesValIdx] || optionValues[yesValIdx]) : (optionLabels[noValIdx] || optionValues[noValIdx]);
    }
    // Convention: two options, first = false, second = true (e.g. "No", "Yes")
    if (options.length === 2) {
      return boolVal ? (optionLabels[1] ?? optionValues[1]) : (optionLabels[0] ?? optionValues[0]);
    }
  }

  const strVal = String(value).trim();
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
  editableInputFields,
  status,
  onUpdate,
  disabled = false,
  enableChargeRecalculation = false,
  sampleTrace,
  isAdminUser = false,
  atmosphereSensitiveSample,
  autoOpenEdit = false,
  onAutoOpenEditConsumed,
  slotDurationMinutes,
  skipFormulaLimits = false,
}: BookingUserInputsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormValues, setEditFormValues] = useState<Record<string, string | number | boolean | string[] | string[][]>>({});
  const [icpmsStandardsByFieldKey, setIcpmsStandardsByFieldKey] = useState<
    Record<
      string,
      {
        standards: Array<{ id: number; s_no: string; name_of_std: string; list_of_elements?: string }>;
      } | null
    >
  >({});
  const [editSampleSets, setEditSampleSets] = useState<SampleSetValues[]>([]);
  const [periodicField, setPeriodicField] = useState<InputFieldDef | null>(null);
  const [periodicSelection, setPeriodicSelection] = useState<Set<string>>(new Set());
  const autoOpenHandledRef = useRef(false);
  const incompleteScrollDoneRef = useRef(false);

  const iv = inputValues || {};
  const storedSampleSets = readSampleSets(iv as Record<string, unknown>);
  const keysToShow = Object.keys(iv).filter((k) => !k.endsWith("_elements") && !k.startsWith("_"));
  if (keysToShow.length === 0) return null;

  const statusUpper = String(status || "").toUpperCase();
  const isCompleted = statusUpper === "COMPLETED";
  const isBooked = statusUpper === "BOOKED";
  /** Closed outcomes: no user-input edits even when fields are marked editing_required / charge recalc. */
  const noUserInputEdits =
    statusUpper === "REFUNDED" ||
    statusUpper === "ABSENT" ||
    statusUpper === "BOOKING_NOT_UTILIZED";
  void sampleTrace;
  // Users: until the booking is completed. OIC / admin: at any stage, including after completion.
  const canEdit =
    !!onUpdate &&
    !disabled &&
    !noUserInputEdits &&
    (isAdminUser || (isBooked && !isCompleted));
  void enableChargeRecalculation; // kept for backward compatibility, but does not override editable field restrictions.

  const fields =
    inputFields && inputFields.length > 0
      ? inputFields
      : keysToShow.map(
          (key) =>
            ({ field_key: key, field_label: key, field_type: "", options: undefined, editing_required: false } as InputFieldDef)
        );

  // Sample set 1 offers the same fields as the extra sample sets: every input field.
  const editableFields =
    editableInputFields && editableInputFields.length > 0 ? editableInputFields : fields;
  const hasEditableFields = canEdit && editableFields.length > 0;
  const sampleSetFields = fields.filter((f) => !isCommentsInputFieldKey(f.field_key));

  const numericBoundsFor = (f: InputFieldDef, values: Record<string, unknown>): NumericFieldBounds =>
    resolveNumericFieldBounds(
      f,
      skipFormulaLimits ? undefined : resolveFieldAFormulaMax(f, values, slotDurationMinutes),
    );

  /** First numeric-limit violation in `values`, mirroring the backend check on save. */
  const numericLimitError = (values: Record<string, unknown>): { key: string; message: string } | null => {
    const numericDefs = new Map<string, InputFieldDef>();
    [...fields, ...editableFields].forEach((f) => {
      if (String(f.field_type || "").toUpperCase() === "NUMERIC") numericDefs.set(f.field_key, f);
    });
    for (const f of numericDefs.values()) {
      const raw = values[f.field_key];
      if (raw === undefined || raw === null || raw === "") continue;
      const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
      if (!Number.isFinite(n)) continue;
      const { min, max } = numericBoundsFor(f, values);
      const label = f.field_label || f.field_key;
      if (n < min) return { key: f.field_key, message: `${label} cannot be less than ${formatNumericBound(min)}.` };
      if (n > max) return { key: f.field_key, message: `${label} cannot be greater than ${formatNumericBound(max)}.` };
    }
    return null;
  };

  const comparable = (v: unknown) =>
    v === undefined || v === null || v === "" ? "" : typeof v === "object" ? JSON.stringify(v) : String(v).trim();
  const valuesChangedFrom = (values: Record<string, unknown>) =>
    Object.keys({ ...iv, ...values }).some(
      (k) => !isCommentsInputFieldKey(k) && comparable(values[k]) !== comparable(iv[k]),
    );

  const editLimitError =
    editDialogOpen && valuesChangedFrom(editFormValues) ? numericLimitError(editFormValues) : null;
  const editLimitErrorOnReadOnlyField =
    editLimitError != null && !editableFields.some((f) => f.field_key === editLimitError.key);
  const hasPeriodicTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE"
  );
  const hasTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "TABLE"
  );

  const incompleteOptionalEditableKeys = useMemo(() => {
    const sourceValues = editDialogOpen ? editFormValues : iv;
    return editableFields
      .filter((f) => {
        const key = String(f.field_key || "").trim();
        if (!key || isCommentsInputFieldKey(key)) return false;
        // Only fields the lab asks users to complete after booking (editing_required).
        if (!f.editing_required) return false;
        // Prefer optional (non-essential) empties; if is_required unknown, still flag empty editable fields.
        if (f.is_required === true) return false;
        return isBookingInputValueEmpty(sourceValues[key], f, sourceValues as Record<string, unknown>);
      })
      .map((f) => f.field_key);
  }, [editableFields, editDialogOpen, editFormValues, iv]);

  // Compute "Standards covering selected elements" for ICPMS on view mode.
  // This mirrors the logic used in `BookEquipment.tsx` but runs for booking details.
  // Note: we only show results; charge recalculation still happens via Save/updateBookingInputValues.
  const icpmsCoverageFields = (inputFields ?? []).filter(
    (f) => String(f.field_type || "").toUpperCase() === "ICPMS_STANDARD_COVERAGE"
  );
  const periodicFields = (inputFields ?? []).filter(
    (f) => String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE"
  );

  // Keep effect lightweight: only depend on inputValues + inputFields identity.
  const icpmsCoverageDeps = icpmsCoverageFields
    .map((f) => `${f.field_key}:${String(f.source_element_field_key ?? "")}`)
    .join("|");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next: Record<
        string,
        {
          standards: Array<{ id: number; s_no: string; name_of_std: string; list_of_elements?: string }>;
        } | null
      > = {};

      for (const f of icpmsCoverageFields) {
        let sourceKey = String(f.source_element_field_key ?? "").trim();
        if (!sourceKey) {
          // Booking details payload may miss source_element_field_key.
          // Fallback to a periodic field that has selected elements.
          const periodicWithElements = periodicFields.find((pf) =>
            String(inputValues?.[`${pf.field_key}_elements`] ?? "").trim().length > 0
          );
          sourceKey = periodicWithElements?.field_key ?? "";
        }
        if (!sourceKey) {
          next[f.field_key] = null;
          continue;
        }

        const elementsStr = String(inputValues?.[`${sourceKey}_elements`] ?? "").trim();
        const elements = elementsStr
          ? elementsStr
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        if (elements.length === 0) {
          next[f.field_key] = null;
          continue;
        }

        try {
          const res = await apiClient.getIcpmsMinStandardsCover(elements);
          if (cancelled) return;
          if (res.error) {
            next[f.field_key] = null;
            continue;
          }
          const data = res.data;
          const standards = Array.isArray(data?.standards) ? data.standards : [];
          next[f.field_key] = { standards };
        } catch {
          next[f.field_key] = null;
        }
      }

      if (!cancelled) setIcpmsStandardsByFieldKey(next);
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icpmsCoverageDeps, inputValues, periodicFields]);

  const openEditDialog = () => {
    const initial: Record<string, string | number | boolean | string[] | string[][]> = { ...iv };
    fields.forEach((f) => {
      if (String(f.field_type || "").toUpperCase() !== "TABLE") return;
      const raw = iv[f.field_key];
      let rows: string[][] = [];
      if (raw === undefined || raw === null) {
        rows = [];
      } else if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw) as unknown;
          rows =
            Array.isArray(parsed) && parsed.every((r) => Array.isArray(r))
              ? (parsed as string[][])
              : [];
        } catch {
          rows = [];
        }
      } else if (Array.isArray(raw) && raw.every((r) => Array.isArray(r))) {
        rows = raw as string[][];
      }

      const sourceKey = resolveTableRowCountSourceKey(f, fields);
      const { columns, hasSerialColumn } = resolveTableColumns(f.options, {
        rowCountDriven: Boolean(sourceKey),
      });
      if (sourceKey) {
        const n = parseTableRowCount(getFieldValueCI(initial as Record<string, unknown>, sourceKey) ?? iv[sourceKey]);
        initial[f.field_key] = syncTableRowsToCount(rows, n, columns.length, hasSerialColumn);
      } else if (hasSerialColumn && rows.length > 0) {
        initial[f.field_key] = syncTableRowsToCount(rows, rows.length, columns.length, true);
      } else {
        initial[f.field_key] = rows;
      }
    });
    setEditFormValues(initial);
    setEditSampleSets(storedSampleSets.map((s) => ({ ...s })));
    setEditDialogOpen(true);
  };

  useEffect(() => {
    if (!autoOpenEdit || autoOpenHandledRef.current) return;
    if (!hasEditableFields) return;
    autoOpenHandledRef.current = true;
    incompleteScrollDoneRef.current = false;
    // Defer so the booking detail section is mounted before the dialog opens.
    const t = window.setTimeout(() => {
      openEditDialog();
      onAutoOpenEditConsumed?.();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when detail is ready
  }, [autoOpenEdit, hasEditableFields]);

  useEffect(() => {
    if (!editDialogOpen) {
      incompleteScrollDoneRef.current = false;
      return;
    }
    if (incompleteScrollDoneRef.current) return;
    const firstKey = incompleteOptionalEditableKeys[0];
    if (!firstKey) return;
    incompleteScrollDoneRef.current = true;
    const t = window.setTimeout(() => {
      document.getElementById(`edit-field-wrap-${firstKey}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [editDialogOpen, incompleteOptionalEditableKeys]);

  const handleSaveEdit = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      // ICPMS standard coverage is recalculated when elements are applied (same as the extra sample sets).
      const nextValues: Record<string, string | boolean | string[] | number | string[][]> = { ...editFormValues };

      const limitError = valuesChangedFrom(nextValues) ? numericLimitError(nextValues) : null;
      if (limitError) {
        toast.error(limitError.message);
        document.getElementById(`edit-field-wrap-${limitError.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const allowedKeys = new Set<string>(["comments"]);
      editableFields.forEach((f) => {
        allowedKeys.add(f.field_key);
        allowedKeys.add(`${f.field_key}_elements`);
      });
      const payload: Record<string, unknown> = Object.fromEntries(
        Object.entries(nextValues).filter(([k]) => allowedKeys.has(k))
      );
      payload[SAMPLE_SETS_KEY] = editSampleSets;

      await onUpdate(payload as Parameters<typeof onUpdate>[0]);
      toast.success("Booking information has been updated.");
      setEditDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const applyPeriodicSelection = async (field: InputFieldDef, symbols: string[]) => {
    setPeriodicField(null);
    const updates = await computePeriodicElementUpdates(sampleSetFields, field, symbols);
    setEditFormValues((prev) => ({ ...prev, ...(updates as typeof prev) }));
  };

  const updateFormValue = (
    fieldKey: string,
    value: string | number | boolean | string[] | string[][],
    elementsValue?: string
  ) => {
    setEditFormValues((prev) => {
      const next: Record<string, unknown> = { ...prev, [fieldKey]: value };
      if (elementsValue !== undefined) next[`${fieldKey}_elements`] = elementsValue;
      const defs = editableFields.length > 0 ? editableFields : fields;
      applyTableRowSyncToValues(next, defs, fieldKey);
      return next as typeof prev;
    });
  };

  /** Keep TABLE rows in sync with linked numeric field while the edit dialog is open. */
  useEffect(() => {
    if (!editDialogOpen) return;
    const defs = editableFields.length > 0 ? editableFields : fields;
    setEditFormValues((prev) => {
      const next: Record<string, unknown> = { ...prev };
      const changed = applyTableRowSyncToValues(next, defs);
      return changed ? (next as typeof prev) : prev;
    });
  }, [editDialogOpen, editFormValues, editableFields, fields]);

  return (
    <div className="mt-6 pt-6 border-t border-border/80">
      <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-primary/5 dark:bg-primary/10 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold text-foreground tracking-tight">User Inputs</p>
          </div>
          {hasEditableFields && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 border-border/80"
              onClick={openEditDialog}
              title="Edit user inputs"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      <ul className="divide-y divide-border/50">
        {storedSampleSets.length > 0 && (
          <li className="px-5 py-2.5 text-base font-semibold text-primary">Sample set 1</li>
        )}
        {fields.map((f, idx) => {
          const val = iv[f.field_key];
          const elementsVal = iv[`${f.field_key}_elements`];
          const isPeriodic = String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE";
          const isTable = String(f.field_type || "").toUpperCase() === "TABLE";
          const isIcpmsCoverage = String(f.field_type || "").toUpperCase() === "ICPMS_STANDARD_COVERAGE";
          const icpmsStandards = icpmsStandardsByFieldKey[f.field_key]?.standards;
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
              ? f.options.map((o, i) => normalizeChoiceOption(o, i).label).filter(Boolean)
              : [];
            const rows = (Array.isArray(val) && val.length > 0 && Array.isArray(val[0]) ? val : []) as string[][];
            return (
              <li key={f.field_key} className="px-5 py-4 bg-background/40 dark:bg-background/20">
                <span className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{f.field_label}</span>
                {columns.length > 0 && rows.length > 0 ? (
                  <div className="rounded-lg border border-border/70 overflow-hidden shadow-sm">
                    <table className="w-full text-base border-collapse">
                      <thead>
                        <tr className="bg-primary/10 dark:bg-primary/15 border-b border-border/70">
                          {columns.map((header, ci) => (
                            <th key={ci} className="text-left font-semibold text-foreground px-4 py-3 border-r border-border/50 last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border/40 last:border-0 bg-background/60 dark:bg-background/40 hover:bg-muted/30 transition-colors">
                            {columns.map((_, ci) => (
                              <td key={ci} className="px-4 py-3 text-foreground font-medium border-r border-border/40 last:border-r-0">
                                {row[ci] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : rows.length > 0 && columns.length === 0 ? (
                  <div className="rounded-lg border border-border/70 overflow-hidden shadow-sm">
                    <table className="w-full text-base border-collapse">
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border/40 last:border-0 bg-background/60 dark:bg-background/40 hover:bg-muted/30 transition-colors">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-4 py-3 text-foreground font-medium border-r border-border/40 last:border-r-0">
                                {cell ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <span className="text-base text-muted-foreground">{rows.length === 0 ? "—" : displayVal}</span>
                )}
              </li>
            );
          }

          return (
            <li
              key={f.field_key}
              className={cn(
                "flex flex-col sm:flex-row sm:justify-between gap-1.5 sm:gap-4 px-5 py-4",
                isIcpmsCoverage && icpmsStandards && icpmsStandards.length > 0
                  ? "sm:items-start"
                  : "sm:items-center",
                idx % 2 === 0 ? "bg-background/50 dark:bg-background/30" : "bg-background/30 dark:bg-background/10"
              )}
            >
              <span className="text-sm sm:text-base font-semibold text-muted-foreground shrink-0 min-w-0">
                {f.field_label}
              </span>
              <span
                className={cn(
                  "text-base font-medium text-foreground break-words",
                  isIcpmsCoverage && icpmsStandards && icpmsStandards.length > 0
                    ? "sm:flex-1 sm:min-w-0 sm:text-left"
                    : "sm:text-right"
                )}
              >
                {displayVal}
                {elementsSuffix}
                {isIcpmsCoverage && f.help_text && (
                  <span className="block text-sm font-normal text-muted-foreground mt-2 whitespace-pre-wrap">
                    {f.help_text}
                  </span>
                )}
                {isIcpmsCoverage && icpmsStandards && icpmsStandards.length > 0 && (
                    <div className="block text-sm font-normal text-muted-foreground mt-3 w-full min-w-0 text-left">
                      <span className="font-medium text-foreground">Standards covering selected elements</span>
                      <div className="mt-2 rounded-lg border border-border/70 overflow-hidden shadow-sm">
                        <table className="w-full text-base border-collapse">
                          <thead>
                            <tr className="bg-primary/10 dark:bg-primary/15 border-b border-border/70">
                              <th className="text-left font-semibold text-foreground px-4 py-3 border-r border-border/50">S.NO.</th>
                              <th className="text-left font-semibold text-foreground px-4 py-3 border-r border-border/50">Name of Std</th>
                              <th className="text-left font-semibold text-foreground px-4 py-3">List of Element</th>
                            </tr>
                          </thead>
                          <tbody>
                            {icpmsStandards.map((s) => (
                              <tr
                                key={s.id}
                                className="border-b border-border/40 last:border-0 bg-background/60 dark:bg-background/40"
                              >
                                <td className="px-4 py-3 text-foreground font-medium border-r border-border/40 align-top">
                                  {s.s_no}
                                </td>
                                <td className="px-4 py-3 text-foreground border-r border-border/40 align-top">
                                  {s.name_of_std}
                                </td>
                                <td className="px-4 py-3 text-foreground align-top break-words max-w-[min(100%,28rem)]">
                                  {(s.list_of_elements && String(s.list_of_elements).trim()) || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </span>
            </li>
          );
        })}
        {atmosphereSensitiveSample !== undefined && (
          <li
            className={cn(
              "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 sm:gap-4 px-5 py-4",
              fields.length % 2 === 0
                ? "bg-background/50 dark:bg-background/30"
                : "bg-background/30 dark:bg-background/10"
            )}
          >
            <span className="text-sm sm:text-base font-semibold text-muted-foreground shrink-0 min-w-0">
              Atmosphere-sensitive sample
            </span>
            <span className="text-base font-medium text-foreground sm:text-right">
              {atmosphereSensitiveSample ? "Yes (submit at slot start)" : "No"}
            </span>
          </li>
        )}
        {storedSampleSets.map((set, setIndex) => (
          <li key={`sample-set-${setIndex}`} className="px-5 py-4 bg-primary/[0.03]">
            <p className="mb-2 text-base font-semibold text-primary">Sample set {setIndex + 2}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {fields
                .filter((f) => set[f.field_key] !== undefined && !isCommentsInputFieldKey(f.field_key))
                .map((f) => {
                  const fieldType = String(f.field_type || "").toUpperCase();
                  const setVal = set[f.field_key];
                  if (fieldType === "TABLE") {
                    const rows = (Array.isArray(setVal) && Array.isArray(setVal[0]) ? setVal : []) as string[][];
                    const columns = Array.isArray(f.options)
                      ? f.options.map((o, i) => normalizeChoiceOption(o, i).label).filter(Boolean)
                      : [];
                    return (
                      <div key={f.field_key} className="space-y-1 text-sm sm:text-base sm:col-span-2">
                        <dt className="text-muted-foreground">{f.field_label}</dt>
                        <dd>
                          {rows.length === 0 ? (
                            "—"
                          ) : (
                            <table className="w-full border-collapse rounded border text-sm">
                              {columns.length > 0 && (
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    {columns.map((header, ci) => (
                                      <th key={ci} className="border-r px-2 py-1 text-left font-medium last:border-r-0">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                              )}
                              <tbody>
                                {rows.map((row, ri) => (
                                  <tr key={ri} className="border-b last:border-0">
                                    {(columns.length > 0 ? columns : row).map((_, ci) => (
                                      <td key={ci} className="border-r px-2 py-1 font-medium last:border-r-0">
                                        {row[ci] || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </dd>
                      </div>
                    );
                  }
                  const elements = set[`${f.field_key}_elements`];
                  const elementsSuffix =
                    fieldType === "PERIODIC_TABLE" && elements != null && String(elements).trim() !== ""
                      ? ` (${formatVal(elements)})`
                      : "";
                  return (
                    <div key={f.field_key} className="flex justify-between gap-3 text-sm sm:text-base">
                      <dt className="text-muted-foreground">{f.field_label}</dt>
                      <dd className="font-medium text-foreground text-right">
                        {["RADIO", "COMBO"].includes(fieldType)
                          ? resolveRadioComboDisplay(setVal, f.options, f.field_type)
                          : formatVal(setVal)}
                        {elementsSuffix}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </li>
        ))}
      </ul>
      </div>

      {/* Edit popup */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto text-base",
            hasPeriodicTableField || hasTableField ? "sm:max-w-4xl" : "sm:max-w-2xl"
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-lg">Edit User Inputs</DialogTitle>
            <DialogDescription className="text-sm">
              Update the values below until the booking is completed (the Officer In Charge can also edit after
              completion). If the charge goes up, pay the difference within 1 minute or the edit is cancelled and the
              previous values are restored; a lower charge is refunded after the Officer In Charge confirms it.
            </DialogDescription>
          </DialogHeader>
          {incompleteOptionalEditableKeys.length > 0 ? (
            <div className="mb-1 flex gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-50">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
              <p className="text-sm leading-relaxed">
                Please complete the remaining booking information to assist the laboratory in processing your sample efficiently.
              </p>
            </div>
          ) : null}
          <div className="space-y-4 py-4 sm:space-y-3">
            <p className="text-sm font-semibold text-primary">Sample set 1</p>
            {editableFields.map((f) => {
              const val = editFormValues[f.field_key];
              const type = String(f.field_type || "").toUpperCase();
              const isIncompleteOptional = incompleteOptionalEditableKeys.includes(f.field_key);
              return (
                <div
                  key={f.field_key}
                  id={`edit-field-wrap-${f.field_key}`}
                  className={cn(
                    "rounded-lg transition-colors",
                    isIncompleteOptional &&
                      "border border-amber-300/90 bg-amber-50/80 p-3 ring-1 ring-amber-200/80 dark:border-amber-700/60 dark:bg-amber-950/30 dark:ring-amber-800/40"
                  )}
                >
                  <DynamicFieldRow
                    fieldType={type}
                    htmlFor={`edit-${f.field_key}`}
                    align={type === "NUMERIC" ? "start" : undefined}
                    labelClassName={cn("text-sm font-semibold text-foreground", type === "NUMERIC" && "sm:pt-2.5")}
                    label={
                      <>
                        {f.field_label}
                        {isIncompleteOptional ? (
                          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Incomplete
                          </span>
                        ) : null}
                      </>
                    }
                  >
                  {type === "NUMERIC" && (() => {
                    const bounds = numericBoundsFor(f, editFormValues);
                    const { min: effectiveMin, max: effectiveMax, step: effectiveStep } = bounds;
                    const fieldLimitError = editLimitError?.key === f.field_key ? editLimitError.message : null;
                    const allowsNegative = numericFieldAllowsNegative(bounds);
                    const stepAttr = formatStepAttr(effectiveStep);
                    const nudge = (direction: 1 | -1) => {
                      updateFormValue(
                        f.field_key,
                        Number(nudgeNumericValue(val as string | number | undefined, direction, bounds))
                      );
                    };
                    return (
                      <div className="space-y-1.5">
                        <div className="inline-flex items-stretch">
                          <Input
                            id={`edit-${f.field_key}`}
                            type="number"
                            inputMode={allowsNegative ? "text" : "decimal"}
                            className="text-base h-10 w-28 rounded-r-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={effectiveMin}
                            max={effectiveMax}
                            step={stepAttr}
                            value={val === undefined || val === null || val === "" ? "" : String(val)}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || isNumericInputDraft(v)) {
                                if (v.trim().startsWith("-") && !allowsNegative) {
                                  updateFormValue(f.field_key, effectiveMin);
                                  return;
                                }
                                updateFormValue(f.field_key, v);
                                return;
                              }
                              updateFormValue(f.field_key, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                nudge(1);
                              } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                nudge(-1);
                              }
                            }}
                            onBlur={() => {
                              if (val === "" || val === undefined || val === null || isNumericInputDraft(String(val))) {
                                if (String(val) === "-" || String(val) === "-." || String(val) === ".") return;
                                return;
                              }
                              const n = Number(String(val).replace(",", "."));
                              if (!Number.isFinite(n)) {
                                updateFormValue(f.field_key, effectiveMin);
                                return;
                              }
                              let next = roundToStepPrecision(n, effectiveStep);
                              next = Math.min(effectiveMax, Math.max(effectiveMin, next));
                              updateFormValue(f.field_key, next);
                            }}
                          />
                          <div className="flex flex-col shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-5 w-7 rounded-none rounded-tr-md border-input border-l-0 border-b-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Increase by ${stepAttr}`}
                              onClick={() => nudge(1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-5 w-7 rounded-none rounded-br-md border-input border-l-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Decrease by ${stepAttr}`}
                              onClick={() => nudge(-1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {fieldLimitError ? (
                          <p className="text-xs font-medium text-destructive" role="alert">
                            {fieldLimitError}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Allowed: {formatNumericBound(effectiveMin)} – {formatNumericBound(effectiveMax)}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {type === "TEXT" && (
                    <Input
                      id={`edit-${f.field_key}`}
                      className={cn("text-base h-10", dynamicFieldControlWidth(type, f.field_label))}
                      value={typeof val === "string" ? val : ""}
                      onChange={(e) => updateFormValue(f.field_key, e.target.value)}
                    />
                  )}
                  {type === "RADIO" && f.options && f.options.length > 0 && (
                    <RadioGroup
                      value={String(val ?? "")}
                      onValueChange={(v) => updateFormValue(f.field_key, v)}
                      aria-label={f.field_label || f.field_key}
                      className="flex flex-wrap items-center gap-x-5 gap-y-2"
                    >
                      {f.options.map((opt, i) => {
                        const { value: optionValue, label: optionLabel } = normalizeChoiceOption(opt, i);
                        return (
                          <div key={`edit-${f.field_key}-${i}-${optionValue}`} className="flex items-center gap-2">
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
                      <SelectTrigger id={`edit-${f.field_key}`} className={dynamicFieldControlWidth(type)}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((opt, i) => {
                          const { value: optionValue, label: optionLabel } = normalizeChoiceOption(opt, i);
                          return (
                            <SelectItem key={`edit-${f.field_key}-${i}-${optionValue}`} value={optionValue}>
                              {optionLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {type === "TOGGLE" && (
                    <div className="flex items-center gap-2">
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
                  {type === "ICPMS_STANDARD_COVERAGE" && (
                    <div className="space-y-1.5">
                      <Input
                        id={`edit-${f.field_key}`}
                        type="number"
                        className="text-base h-10 bg-muted font-medium"
                        value={typeof val === "number" ? val : Number(val) ?? ""}
                        readOnly
                        disabled
                      />
                      {f.help_text && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.help_text}</p>
                      )}
                    </div>
                  )}
                  {type === "PERIODIC_TABLE" && (
                    <PeriodicElementsField
                      field={f}
                      values={editFormValues as SampleSetValues}
                      disabled={saving}
                      onOpen={(selection) => {
                        setPeriodicSelection(selection);
                        setPeriodicField(f);
                      }}
                    />
                  )}
                  {type === "MULTI_SELECT" && f.options && f.options.length > 0 && (() => {
                    const current = Array.isArray(val) ? (val as string[]) : [];
                    return (
                      <div
                        role="group"
                        aria-label={f.field_label || f.field_key}
                        className="flex flex-wrap gap-x-4 gap-y-1"
                      >
                        {f.options.map((opt, i) => {
                          const { value: optionValue, label: optionLabel } = normalizeChoiceOption(opt, i);
                          return (
                            <label key={`edit-${f.field_key}-${i}-${optionValue}`} className="flex items-center gap-1.5 text-sm">
                              <Checkbox
                                checked={current.includes(optionValue)}
                                onCheckedChange={(checked) =>
                                  updateFormValue(
                                    f.field_key,
                                    checked ? [...current, optionValue] : current.filter((v) => v !== optionValue)
                                  )
                                }
                              />
                              {optionLabel}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {type === "TABLE" && (() => {
                    const defs = editableFields.length > 0 ? editableFields : fields;
                    const sourceKey = resolveTableRowCountSourceKey(f, defs);
                    const rowCountDriven = Boolean(sourceKey);
                    const { columns, hasSerialColumn } = resolveTableColumns(f.options, {
                      rowCountDriven,
                    });
                    const rows = (editFormValues[f.field_key] as string[][] | undefined) || [];
                    const serialLocked = hasSerialColumn;
                    const addRow = () => {
                      if (rowCountDriven) return;
                      const newRow = Array(columns.length).fill("");
                      if (hasSerialColumn) newRow[0] = String(rows.length + 1);
                      updateFormValue(f.field_key, [...rows, newRow]);
                    };
                    const deleteRow = (rowIdx: number) => {
                      if (rowCountDriven) return;
                      const next = rows.filter((_, i) => i !== rowIdx);
                      const renumbered = hasSerialColumn
                        ? syncTableRowsToCount(next, next.length, columns.length, true)
                        : next;
                      updateFormValue(f.field_key, renumbered);
                    };
                    const setCell = (rowIdx: number, colIdx: number, cellVal: string) => {
                      if (serialLocked && colIdx === 0) return;
                      const next = rows.map((r, i) => (i === rowIdx ? r.slice() : r));
                      if (!next[rowIdx]) next[rowIdx] = Array(columns.length).fill("");
                      next[rowIdx][colIdx] = cellVal;
                      updateFormValue(f.field_key, next);
                    };
                    if (columns.length === 0) {
                      return <p className="text-sm text-muted-foreground">No columns defined.</p>;
                    }
                    return (
                      <div className="space-y-2 pt-1">
                        <div className="rounded-lg border overflow-x-auto">
                          <table className="w-full text-base border-collapse">
                            <thead>
                              <tr className="bg-muted/60 border-b">
                                {columns.map((header, ci) => (
                                  <th key={ci} className="text-left font-semibold px-3 py-2.5 border-r last:border-r-0">
                                    {header}
                                  </th>
                                ))}
                                {!rowCountDriven && <th className="w-10 p-2.5 text-center" title="Delete row"> </th>}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={columns.length + (rowCountDriven ? 0 : 1)}
                                    className="p-3 text-muted-foreground text-center text-sm"
                                  >
                                    {rowCountDriven
                                      ? "No rows yet — set the row-count field."
                                      : "No rows. Click + to add."}
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row, ri) => (
                                  <tr key={ri} className="border-b last:border-0">
                                    {columns.map((_, ci) => (
                                      <td key={ci} className="p-1.5 border-r last:border-r-0">
                                        {serialLocked && ci === 0 ? (
                                          <span className="inline-flex h-9 items-center px-3 text-base font-medium tabular-nums text-muted-foreground">
                                            {row[ci] ?? String(ri + 1)}
                                          </span>
                                        ) : (
                                          <Input
                                            className="h-9 text-base"
                                            value={row[ci] ?? ""}
                                            onChange={(e) => setCell(ri, ci, e.target.value)}
                                          />
                                        )}
                                      </td>
                                    ))}
                                    {!rowCountDriven && (
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
                                    )}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {!rowCountDriven && (
                          <Button type="button" variant="outline" size="sm" onClick={addRow}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add row
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                  </DynamicFieldRow>
                </div>
              );
            })}
          </div>
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Samples with different parameters</p>
            <p className="text-xs text-muted-foreground">
              The values above are sample set 1. Each extra sample set is charged and timed separately.
            </p>
            <SampleSetsEditor
              fields={sampleSetFields}
              sets={editSampleSets}
              onChange={setEditSampleSets}
              primaryValues={editFormValues as SampleSetValues}
              disabled={saving}
            />
          </div>
          <PeriodicElementsDialog
            open={periodicField != null}
            onOpenChange={(open) => !open && setPeriodicField(null)}
            helpText={periodicField?.help_text}
            selected={periodicSelection}
            onSelectedChange={setPeriodicSelection}
            onApply={() => {
              if (!periodicField) return;
              void applyPeriodicSelection(periodicField, Array.from(periodicSelection));
            }}
          />
          {editLimitErrorOnReadOnlyField ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {editLimitError?.message} Adjust the values above to stay within this limit.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || Boolean(editLimitError)}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BookingUserInputs;
