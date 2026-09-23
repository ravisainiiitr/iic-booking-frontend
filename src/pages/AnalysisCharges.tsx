import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, IndianRupee, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChargeCategoryLegacyTable,
  ChargeCategoryMultiParamTable,
  ChargeCategorySimplifiedTable,
} from "@/components/ChargeCategoryRatesPanel";
import { apiClient } from "@/lib/api";
import {
  exportAnalysisChargesExcel,
  exportAnalysisChargesPdf,
  type AnalysisChargeExportRow,
} from "@/lib/analysisChargesExport";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import { formatINR } from "@/lib/money";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { toast } from "sonner";

type DeptOption = { id: number; name: string; code: string; equipment_count: number };
type UserTypeOption = { code: string; label: string };
type AnalysisEquipment = {
  equipment_id: number;
  code: string;
  name: string;
  profile_type: string;
  status: string;
  internal_department: number | null;
  internal_department_name: string | null;
  internal_department_code: string | null;
  slot_duration_minutes?: number | null;
  charge_profiles: Array<Record<string, unknown>>;
  input_fields?: Array<{ field_key?: string | null; options?: unknown; user_type?: string }>;
  slot_options?: Array<Record<string, unknown>>;
};

const ALL_DEPTS = "all";

export default function AnalysisCharges() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [userTypeOptions, setUserTypeOptions] = useState<UserTypeOption[]>([]);
  const [equipments, setEquipments] = useState<AnalysisEquipment[]>([]);
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPTS);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  /** Empty set = All user types */
  const [selectedUserTypes, setSelectedUserTypes] = useState<string[]>([]);

  const load = useCallback(async (dept: string) => {
    setLoading(true);
    try {
      const res = await apiClient.getAnalysisChargesCatalog({
        internalDepartmentId: dept === ALL_DEPTS ? "all" : Number(dept),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to load analysis charges.");
        setEquipments([]);
        setDepartments([]);
        setUserTypeOptions([]);
        setSelectedEquipmentIds([]);
        return;
      }
      const list = Array.isArray(res.data.equipments) ? res.data.equipments : [];
      setDepartments(Array.isArray(res.data.departments) ? res.data.departments : []);
      setUserTypeOptions(Array.isArray(res.data.user_types) ? res.data.user_types : []);
      setEquipments(list as AnalysisEquipment[]);
      setSelectedEquipmentIds(list.map((e) => Number(e.equipment_id)));
      // Keep "All" user types (empty selection) as default
      setSelectedUserTypes([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load analysis charges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(departmentId);
  }, [departmentId, load]);

  const visibleEquipments = useMemo(() => {
    const idSet = new Set(selectedEquipmentIds);
    return equipments.filter((e) => idSet.has(Number(e.equipment_id)));
  }, [equipments, selectedEquipmentIds]);

  const filterUserTypes = useMemo(() => {
    if (selectedUserTypes.length === 0) return null; // All
    return new Set(selectedUserTypes.map((c) => c.toLowerCase()));
  }, [selectedUserTypes]);

  const equipmentCards = useMemo(() => {
    return visibleEquipments.map((eq) => {
      const summaryRows = buildChargeCategorySummaryRows(eq).filter((row) => {
        if (!filterUserTypes) return true;
        return filterUserTypes.has(String(row.userType || "").toLowerCase());
      });
      const presentation = buildChargeCategoryPresentation(eq.profile_type, summaryRows, {
        inputFields: eq.input_fields,
        slotOptions: Array.isArray(eq.slot_options) ? eq.slot_options : [],
      });
      if (filterUserTypes && presentation.multiParamRows) {
        presentation.multiParamRows = presentation.multiParamRows.filter((r) =>
          filterUserTypes.has(String(r.userType || "").toLowerCase())
        );
      }
      if (filterUserTypes) {
        presentation.rows = presentation.rows.filter((r) =>
          filterUserTypes.has(String(r.userType || "").toLowerCase())
        );
      }
      return { eq, summaryRows, presentation };
    });
  }, [visibleEquipments, filterUserTypes]);

  const exportRows = useMemo((): AnalysisChargeExportRow[] => {
    const rows: AnalysisChargeExportRow[] = [];
    for (const { eq, summaryRows, presentation } of equipmentCards) {
      const dept =
        [eq.internal_department_name, eq.internal_department_code].filter(Boolean).join(" ") ||
        "—";
      if (presentation.simplified && presentation.mode === "multi_param") {
        const opts = presentation.optionColumns ?? [];
        for (const row of presentation.multiParamRows ?? []) {
          const chargeParts = opts.map(
            (opt) => `${opt}: ${row.chargesByOption[opt] ?? "—"}`
          );
          rows.push({
            department: dept,
            equipmentCode: eq.code,
            equipmentName: eq.name,
            userCategory: row.label,
            charge: chargeParts.join(" · "),
            gst: row.gstLine,
          });
        }
      } else if (presentation.simplified) {
        for (const row of presentation.rows) {
          rows.push({
            department: dept,
            equipmentCode: eq.code,
            equipmentName: eq.name,
            userCategory: row.label,
            charge: row.chargeLine,
            gst: row.gstLine,
          });
        }
      } else {
        for (const row of summaryRows) {
          const parts = [`₹${row.primary}`];
          if (row.secondary) parts.push(`Secondary ₹${row.secondary}`);
          if (row.notes) parts.push(row.notes);
          rows.push({
            department: dept,
            equipmentCode: eq.code,
            equipmentName: eq.name,
            userCategory: row.label,
            charge: row.displayText || parts.join(" · "),
            gst: isExternalBookingUserType(row.userType) ? "GST extra @18%" : "No GST",
          });
        }
      }
    }
    return rows;
  }, [equipmentCards]);

  const toggleEquipment = (id: number, checked: boolean) => {
    setSelectedEquipmentIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleUserType = (code: string, checked: boolean) => {
    setSelectedUserTypes((prev) => {
      // Switching from "All" (empty) to a specific selection starts with that one type.
      if (prev.length === 0 && checked) return [code];
      if (checked) return prev.includes(code) ? prev : [...prev, code];
      const next = prev.filter((x) => x !== code);
      return next;
    });
  };

  const allEquipmentSelected =
    equipments.length > 0 && selectedEquipmentIds.length === equipments.length;
  const allUserTypesSelected = selectedUserTypes.length === 0;

  const handleDownloadExcel = () => {
    if (!exportRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    exportAnalysisChargesExcel(exportRows);
    toast.success("Excel downloaded.");
  };

  const handleDownloadPdf = () => {
    if (!exportRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    exportAnalysisChargesPdf(exportRows);
    toast.success("PDF downloaded.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary via-[hsl(215_62%_22%)] to-slate-950 p-6 text-white shadow-xl shadow-primary/25 sm:p-8">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <IndianRupee className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analysis Charges</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            Live rates from each equipment&apos;s Charges by user category. Filter by department,
            equipment, and user type — then download PDF or Excel if needed.
          </p>
          <p className="mt-3 text-xs text-white/70">
            <Link to="/" className="underline underline-offset-2 hover:text-white">
              Back to home
            </Link>
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="ac-dept">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="ac-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPTS}>All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                      {d.code ? ` (${d.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-5">
              <div className="flex items-center justify-between gap-2">
                <Label>Equipment</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={loading || equipments.length === 0}
                  onClick={() =>
                    setSelectedEquipmentIds(
                      allEquipmentSelected ? [] : equipments.map((e) => Number(e.equipment_id))
                    )
                  }
                >
                  {allEquipmentSelected ? "Clear all" : "Select all"}
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                {loading ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Loading equipment…</p>
                ) : equipments.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No equipment with published charges for this filter.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {equipments.map((eq) => {
                      const id = Number(eq.equipment_id);
                      const checked = selectedEquipmentIds.includes(id);
                      return (
                        <li key={id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
                          <Checkbox
                            id={`eq-${id}`}
                            checked={checked}
                            onCheckedChange={(v) => toggleEquipment(id, v === true)}
                          />
                          <label htmlFor={`eq-${id}`} className="cursor-pointer text-sm leading-snug">
                            <span className="font-medium text-foreground">{eq.name}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">{eq.code}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <Label>User type</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={userTypeOptions.length === 0}
                  onClick={() => setSelectedUserTypes([])}
                >
                  All
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                <p className="mb-2 px-1.5 text-xs text-muted-foreground">
                  {allUserTypesSelected
                    ? "Showing all user categories (default)."
                    : `${selectedUserTypes.length} selected.`}
                </p>
                <ul className="space-y-1.5">
                  {userTypeOptions.map((ut) => {
                    const checked =
                      allUserTypesSelected || selectedUserTypes.includes(ut.code);
                    return (
                      <li key={ut.code} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
                        <Checkbox
                          id={`ut-${ut.code}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (allUserTypesSelected && v !== true) {
                              // Leaving "All": keep every type except this one
                              setSelectedUserTypes(
                                userTypeOptions
                                  .map((o) => o.code)
                                  .filter((c) => c !== ut.code)
                              );
                              return;
                            }
                            if (allUserTypesSelected && v === true) return;
                            toggleUserType(ut.code, v === true);
                          }}
                        />
                        <label htmlFor={`ut-${ut.code}`} className="cursor-pointer text-sm leading-snug">
                          {ut.label}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
            <Button type="button" variant="outline" onClick={handleDownloadPdf} disabled={!exportRows.length}>
              <FileText className="mr-1.5 h-4 w-4" />
              Download PDF
            </Button>
            <Button type="button" variant="outline" onClick={handleDownloadExcel} disabled={!exportRows.length}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Download Excel
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
              <Download className="h-3.5 w-3.5" />
              {exportRows.length} rate line{exportRows.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading charges…
          </div>
        ) : equipmentCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            Select one or more equipment to view charges by user category.
          </div>
        ) : (
          <div className="space-y-8">
            {equipmentCards.map(({ eq, summaryRows, presentation }) => (
              <article key={eq.equipment_id} className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {eq.name}
                  </h2>
                  <span className="text-sm text-muted-foreground">{eq.code}</span>
                  {eq.internal_department_name ? (
                    <span className="text-xs text-muted-foreground">
                      · {eq.internal_department_name}
                    </span>
                  ) : null}
                </div>
                {summaryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No charge rows for the selected user types.
                  </p>
                ) : presentation.simplified && presentation.mode === "multi_param" ? (
                  <ChargeCategoryMultiParamTable presentation={presentation} />
                ) : presentation.simplified ? (
                  <ChargeCategorySimplifiedTable presentation={presentation} />
                ) : (
                  <ChargeCategoryLegacyTable
                    subtitle="Standard rates for this equipment, including student and faculty categories."
                    unitLabels={{
                      primary: "Unit charge",
                      secondary: "Additional charge",
                      rateSuffix: "",
                    }}
                    showSecondary={summaryRows.some((row) => !!row.secondary)}
                    rows={summaryRows}
                    formatAmount={formatINR}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
