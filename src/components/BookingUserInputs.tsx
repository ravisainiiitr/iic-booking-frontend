import { useEffect, useState } from "react";
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
import { Pencil, Check, Plus, Trash2, FileText } from "lucide-react";
import { periodicTableElements, getCategoryColor, parsePeriodicHelpText, mergePeriodicDisplaySymbols, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { formatNumericBound, resolveNumericFieldBounds } from "@/lib/numericFieldLimits";

export interface InputFieldDef {
  field_key: string;
  field_label: string;
  field_type: string;
  editing_required?: boolean;
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
  /** Sample/slot trace events (ordered by created_at). Editing is disabled when latest status is PROCESSING or COMPLETED. */
  sampleTrace?: Array<{ status: string }>;
  /** When true, editing is not restricted to BOOKED + not processed (admin/operator can edit in other cases). */
  isAdminUser?: boolean;
  /** Booking-level flag (not an equipment input field); shown as Yes/No in this card. */
  atmosphereSensitiveSample?: boolean;
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

  const optionLabels = options.map((o) => (typeof o === "string" ? o : o.label ?? o.value ?? ""));
  const optionValues = options.map((o, i) => (typeof o === "string" ? o : o.value ?? o.label ?? String(i + 1)));

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

  const iv = inputValues || {};
  const keysToShow = Object.keys(iv).filter((k) => !k.endsWith("_elements"));
  if (keysToShow.length === 0) return null;

  const statusUpper = String(status || "").toUpperCase();
  const isCompleted = statusUpper === "COMPLETED";
  const isBooked = statusUpper === "BOOKED";
  /** Closed outcomes: no user-input edits even when fields are marked editing_required / charge recalc. */
  const noUserInputEdits =
    statusUpper === "REFUNDED" ||
    statusUpper === "ABSENT" ||
    statusUpper === "BOOKING_NOT_UTILIZED";
  const latestSampleStatus = sampleTrace?.length
    ? String(sampleTrace[sampleTrace.length - 1]?.status ?? "").toUpperCase()
    : "";
  const sampleSlotBlocksEdit = latestSampleStatus === "PROCESSING" || latestSampleStatus === "COMPLETED";
  // Internal/external: only when BOOKED and not processed. Admin: no status/processed restriction.
  const canEdit =
    !!onUpdate &&
    !disabled &&
    !noUserInputEdits &&
    !isCompleted &&
    (isAdminUser || (isBooked && !sampleSlotBlocksEdit));
  void enableChargeRecalculation; // kept for backward compatibility, but does not override editable field restrictions.

  const fields =
    inputFields && inputFields.length > 0
      ? inputFields
      : keysToShow.map(
          (key) =>
            ({ field_key: key, field_label: key, field_type: "", options: undefined, editing_required: false } as InputFieldDef)
        );

  const editableFields =
    editableInputFields && editableInputFields.length > 0
      ? editableInputFields
      : fields.filter((f) => f.editing_required);
  const hasEditableFields = canEdit && editableFields.length > 0;
  const hasPeriodicTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "PERIODIC_TABLE"
  );
  const hasTableField = editableFields.some(
    (f) => String(f.field_type || "").toUpperCase() === "TABLE"
  );

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
      // ICPMS Standard Coverage auto-computation for "My Bookings" edit flow:
      // replicate the same behavior as the booking page PeriodicTable "Apply" flow.
      const nextValues: Record<string, string | boolean | string[] | number | string[][]> = { ...editFormValues };

      const icpmsCoverageFields = (inputFields ?? []).filter(
        (f) => String(f.field_type || "").toUpperCase() === "ICPMS_STANDARD_COVERAGE"
      );

      if (icpmsCoverageFields.length > 0) {
        const getSelectedElements = (sourceKey: string) => {
          const elementsStr = String(nextValues[`${sourceKey}_elements`] ?? "").trim();
          if (!elementsStr) return [];
          return elementsStr.split(",").map((s) => s.trim()).filter((s) => Boolean(s));
        };

        const setSelectedElements = (sourceKey: string, elements: string[]) => {
          const cleaned = elements.map((e) => String(e).trim()).filter(Boolean);
          nextValues[`${sourceKey}_elements`] = cleaned.join(",");

          // For consistency with the booking apply flow:
          // - A and B are treated as at-least-1 when non-empty
          // - but can still be reset to 0 when empty.
          const count =
            sourceKey === "A" || sourceKey === "B"
              ? cleaned.length > 0
                ? Math.max(1, cleaned.length)
                : 0
              : cleaned.length;
          nextValues[sourceKey] = count;
        };

        for (const icpmsField of icpmsCoverageFields) {
          let sourceKey = String(icpmsField.source_element_field_key ?? "").trim();
          if (!sourceKey) {
            // Booking-details payload can miss source_element_field_key.
            // Use a periodic field that currently has selected elements as fallback.
            const periodicWithElements = periodicFields.find((pf) =>
              String(nextValues[`${pf.field_key}_elements`] ?? "").trim().length > 0
            );
            sourceKey = periodicWithElements?.field_key ?? "";
          }
          if (!sourceKey) continue;

          let selectedElements = getSelectedElements(sourceKey);

          // Nothing selected => reset ICPMS min standards to 0
          if (selectedElements.length === 0) {
            nextValues[icpmsField.field_key] = 0;
            continue;
          }

          // Recompute using uncovered-elements confirmation logic.
          // The backend may return:
          // - { count, standards, uncovered? } with status 200
          // - or an "error" string plus "uncovered" list for impossible covers.
          // For our UI behavior:
          // - If uncovered exists, ask:
          //   OK => exclude uncovered and recompute
          //   Cancel => clear selection + reset ICPMS values
          while (selectedElements.length > 0) {
            const res = await apiClient.getIcpmsMinStandardsCover(selectedElements);
            const data = res.data;

            const uncovered: string[] = Array.isArray(data?.uncovered) ? data.uncovered : [];
            if (uncovered.length > 0) {
              const uncoveredStr = uncovered.join(", ");
              const exclude = window.confirm(
                `Some selected elements cannot be covered by available standards.\n\nUncovered elements:\n${uncoveredStr}\n\nDo you want to exclude these elements and recalculate?`
              );

              if (!exclude) {
                // Reset element requirements and ICPMS values
                setSelectedElements(sourceKey, []);
                nextValues[icpmsField.field_key] = 0;
                selectedElements = [];
                break;
              }

              const uncoveredSet = new Set(uncovered.map((u) => String(u).toUpperCase()));
              selectedElements = selectedElements.filter((e) => !uncoveredSet.has(String(e).toUpperCase()));
              setSelectedElements(sourceKey, selectedElements);
              continue; // recompute with reduced set
            }

            const minCount = data?.count ?? 0;
            nextValues[icpmsField.field_key] = minCount;
            break;
          }
        }
      }

      setEditFormValues(nextValues);

      const allowedKeys = new Set<string>(["comments"]);
      editableFields.forEach((f) => {
        allowedKeys.add(f.field_key);
        allowedKeys.add(`${f.field_key}_elements`);
      });
      const payload = Object.fromEntries(
        Object.entries(nextValues).filter(([k]) => allowedKeys.has(k))
      );

      await onUpdate(payload);
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
    <div className="mt-6 pt-6 border-t border-border/80">
      <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-primary/5 dark:bg-primary/10 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold text-foreground tracking-tight">User Inputs</p>
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
              ? f.options.map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
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
              <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-0">
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
            <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-0">
              Atmosphere-sensitive sample
            </span>
            <span className="text-base font-medium text-foreground sm:text-right">
              {atmosphereSensitiveSample ? "Yes (submit at slot start)" : "No"}
            </span>
          </li>
        )}
      </ul>
      </div>

      {/* Edit popup */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto text-base",
            hasPeriodicTableField || hasTableField ? "sm:max-w-4xl" : "sm:max-w-md"
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-lg">Edit User Inputs</DialogTitle>
            <DialogDescription className="text-sm">
              Update the values below. Only fields marked as editable can be changed and only until the booking is completed or sample slot status is Processing or Completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {editableFields.map((f) => {
              const val = editFormValues[f.field_key];
              const type = String(f.field_type || "").toUpperCase();
              return (
                <div key={f.field_key} className="space-y-2.5">
                  <Label htmlFor={`edit-${f.field_key}`} className="text-sm font-semibold text-foreground">
                    {f.field_label}
                  </Label>
                  {type === "NUMERIC" && (() => {
                    const { min: effectiveMin, max: effectiveMax, step: effectiveStep } =
                      resolveNumericFieldBounds(f);
                    const stepAttr =
                      effectiveStep < 1
                        ? String(effectiveStep)
                        : Number.isInteger(effectiveStep)
                          ? String(effectiveStep)
                          : String(effectiveStep);
                    return (
                      <div className="space-y-1.5">
                        <Input
                          id={`edit-${f.field_key}`}
                          type="number"
                          className="text-base h-10"
                          min={effectiveMin}
                          max={effectiveMax}
                          step={stepAttr}
                          value={typeof val === "number" ? val : Number(val) || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              updateFormValue(f.field_key, effectiveMin);
                              return;
                            }
                            const n = Number(v);
                            if (isNaN(n)) {
                              updateFormValue(f.field_key, effectiveMin);
                              return;
                            }
                            const clamped = Math.min(effectiveMax, Math.max(effectiveMin, n));
                            updateFormValue(f.field_key, clamped);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Allowed range {formatNumericBound(effectiveMin)}–{formatNumericBound(effectiveMax)}
                          {effectiveStep !== 1 ? ` · step ${formatNumericBound(effectiveStep)}` : ""}
                        </p>
                      </div>
                    );
                  })()}
                  {type === "TEXT" && (
                    <Input
                      id={`edit-${f.field_key}`}
                      className="text-base h-10"
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
                  {type === "PERIODIC_TABLE" && (() => {
                    const elementsStr = String(editFormValues[`${f.field_key}_elements`] ?? "").trim();
                    const { disabled: disabledSet, preselected: preselectedSet } = parsePeriodicHelpText(f.help_text);
                    const selectedSymbols = new Set(
                      elementsStr
                        ? elementsStr.split(",").map((s) => s.trim()).filter((s) => Boolean(s) && !disabledSet.has(s))
                        : []
                    );
                    preselectedSet.forEach((s) => selectedSymbols.add(s));
                    const toggleSymbol = (symbol: string) => {
                      if (disabledSet.has(symbol) || preselectedSet.has(symbol)) return;
                      const next = new Set(selectedSymbols);
                      if (next.has(symbol)) next.delete(symbol);
                      else next.add(symbol);
                      preselectedSet.forEach((s) => next.add(s));
                      const { all, billable } = mergePeriodicDisplaySymbols(Array.from(next), f.help_text);
                      setEditFormValues((prev) => ({
                        ...prev,
                        [f.field_key]: billable.length,
                        [`${f.field_key}_elements`]: all.join(","),
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
                    const elButton = (el: Element) => {
                      const isDisabled = disabledSet.has(el.symbol);
                      const isLocked = preselectedSet.has(el.symbol);
                      const isSelected = selectedSymbols.has(el.symbol) || isLocked;
                      return (
                        <button
                          key={el.atomicNumber}
                          type="button"
                          onClick={() => toggleSymbol(el.symbol)}
                          disabled={isDisabled || isLocked}
                          title={
                            isDisabled
                              ? `${el.name} (disabled)`
                              : isLocked
                                ? `${el.name} (locked preselected — not charged)`
                                : el.name
                          }
                          className={cn(
                            "w-9 h-9 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
                            getCategoryColor(el.category),
                            isSelected && "ring-2 ring-primary ring-offset-1 scale-105",
                            isLocked && "ring-2 ring-sky-500 ring-offset-1",
                            (isDisabled || isLocked) && "opacity-60 cursor-not-allowed pointer-events-none",
                            isDisabled && "bg-muted border-dashed"
                          )}
                        >
                          {isSelected && (
                            <Check className="absolute top-0 right-0 w-3 h-3 text-primary" />
                          )}
                          <span className="font-bold">{el.symbol}</span>
                        </button>
                      );
                    };
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-sm text-muted-foreground">
                          {selectedSymbols.size} element(s) selected
                          {preselectedSet.size > 0
                            ? ` (${mergePeriodicDisplaySymbols(Array.from(selectedSymbols), f.help_text).billable.length} for charge; locked: ${Array.from(preselectedSet).join(", ")})`
                            : ""}
                          . Click elements to toggle.
                          {disabledSet.size > 0 && " Elements listed in Help text are disabled."}
                          {preselectedSet.size > 0 && " Slash-prefixed Help text elements are locked and not charged."}
                        </p>
                        <div className="overflow-x-auto rounded-md border p-2 bg-muted/30">
                          <div className="inline-block min-w-max">
                            <div className="flex flex-col gap-0.5">
                              {grid.map((row, ri) => (
                                <div key={ri} className="flex gap-0.5">
                                  {row.map((el, ci) => (
                                    <div key={`${ri}-${ci}`}>
                                      {el ? (
                                        elButton(el)
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
                                {lanthanides.map((el) => elButton(el))}
                              </div>
                              <div className="flex gap-0.5 mt-0.5">
                                <div className="w-9 h-9 flex items-center justify-center text-xs font-semibold">
                                  Ac
                                </div>
                                {actinides.map((el) => elButton(el))}
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
                      return <p className="text-sm text-muted-foreground">No columns defined.</p>;
                    }
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-sm text-muted-foreground">
                          Headers are fixed. Edit any cell below; use Add row to add rows and the delete icon to remove a row.
                        </p>
                        <div className="rounded-lg border overflow-x-auto">
                          <table className="w-full text-base border-collapse">
                            <thead>
                              <tr className="bg-muted/60 border-b">
                                {columns.map((header, ci) => (
                                  <th key={ci} className="text-left font-semibold px-3 py-2.5 border-r last:border-r-0">
                                    {header}
                                  </th>
                                ))}
                                <th className="w-10 p-2.5 text-center" title="Delete row"> </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={columns.length + 1} className="p-3 text-muted-foreground text-center text-sm">
                                    No rows. Click + to add.
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row, ri) => (
                                  <tr key={ri} className="border-b last:border-0">
                                    {columns.map((_, ci) => (
                                      <td key={ci} className="p-1.5 border-r last:border-r-0">
                                        <Input
                                          className="h-9 text-base"
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
