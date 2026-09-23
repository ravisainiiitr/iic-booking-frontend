import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, IndianRupee, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import {
  exportAnalysisChargesExcel,
  exportAnalysisChargesPdf,
  type AnalysisChargeExportRow,
} from "@/lib/analysisChargesExport";
import { buildChargeCategoryPresentation } from "@/lib/chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "@/lib/chargeCategorySummary";
import { cn } from "@/lib/utils";
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

function pickDefaultDepartmentId(depts: DeptOption[]): string {
  if (!depts.length) return "";
  const iic = depts.find(
    (d) =>
      String(d.code || "").toUpperCase() === "IIC" ||
      /instrumentation/i.test(String(d.name || ""))
  );
  return String((iic ?? depts[0]).id);
}

function GstBadge({ text }: { text: string }) {
  const t = String(text || "").trim();
  const isNone = /^no\s*gst$/i.test(t);
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto whitespace-nowrap px-2.5 py-0.5 text-xs font-medium",
        isNone
          ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
          : "border-amber-200/80 bg-amber-50 text-amber-900"
      )}
    >
      {t || "—"}
    </Badge>
  );
}

export default function AnalysisCharges() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [userTypeOptions, setUserTypeOptions] = useState<UserTypeOption[]>([]);
  const [equipments, setEquipments] = useState<AnalysisEquipment[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  /** Empty = All user types */
  const [selectedUserTypes, setSelectedUserTypes] = useState<string[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);

  const selectedDepartment = useMemo(
    () => departments.find((d) => String(d.id) === departmentId) ?? null,
    [departments, departmentId]
  );

  const departmentTitle = useMemo(() => {
    if (!selectedDepartment) return "";
    const name = selectedDepartment.name || "Department";
    return selectedDepartment.code ? `${name} (${selectedDepartment.code})` : name;
  }, [selectedDepartment]);

  const loadCatalog = useCallback(async (deptId: string) => {
    if (!deptId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.getAnalysisChargesCatalog({
        internalDepartmentId: Number(deptId),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to load analysis charges.");
        setEquipments([]);
        setUserTypeOptions([]);
        setSelectedEquipmentIds([]);
        return;
      }
      const depts = Array.isArray(res.data.departments) ? res.data.departments : [];
      setDepartments(depts);
      const list = Array.isArray(res.data.equipments) ? (res.data.equipments as AnalysisEquipment[]) : [];
      setUserTypeOptions(Array.isArray(res.data.user_types) ? res.data.user_types : []);
      setEquipments(list);
      setSelectedEquipmentIds(list.map((e) => Number(e.equipment_id)));
      setSelectedUserTypes([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load analysis charges.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Bootstrap: load once to get department list, then select IIC (or first) and reload scoped.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getAnalysisChargesCatalog({});
        if (cancelled) return;
        if (res.error || !res.data) {
          toast.error(res.error || "Failed to load analysis charges.");
          setLoading(false);
          return;
        }
        const depts = Array.isArray(res.data.departments) ? res.data.departments : [];
        setDepartments(depts);
        const defaultId = pickDefaultDepartmentId(depts);
        setDepartmentId(defaultId);
        setBootstrapped(true);
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load analysis charges.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped || !departmentId) return;
    void loadCatalog(departmentId);
  }, [bootstrapped, departmentId, loadCatalog]);

  const visibleEquipments = useMemo(() => {
    const idSet = new Set(selectedEquipmentIds);
    return equipments.filter((e) => idSet.has(Number(e.equipment_id)));
  }, [equipments, selectedEquipmentIds]);

  const filterUserTypes = useMemo(() => {
    if (selectedUserTypes.length === 0) return null;
    return new Set(selectedUserTypes.map((c) => c.toLowerCase()));
  }, [selectedUserTypes]);

  const tableRows = useMemo((): AnalysisChargeExportRow[] => {
    const rows: AnalysisChargeExportRow[] = [];
    for (const eq of visibleEquipments) {
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

      if (presentation.simplified && presentation.mode === "multi_param") {
        const opts = presentation.optionColumns ?? [];
        for (const row of presentation.multiParamRows ?? []) {
          const chargeParts = opts.map(
            (opt) => `${opt}: ${row.chargesByOption[opt] ?? "—"}`
          );
          rows.push({
            equipmentName: eq.name,
            userCategory: row.label,
            charge: chargeParts.join(" · "),
            gst: row.gstLine,
          });
        }
      } else if (presentation.simplified) {
        for (const row of presentation.rows) {
          rows.push({
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
            equipmentName: eq.name,
            userCategory: row.label,
            charge: row.displayText || parts.join(" · "),
            gst: isExternalBookingUserType(row.userType) ? "GST extra @18%" : "No GST",
          });
        }
      }
    }
    return rows;
  }, [visibleEquipments, filterUserTypes]);

  const toggleEquipment = (id: number, checked: boolean) => {
    setSelectedEquipmentIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleUserType = (code: string, checked: boolean) => {
    setSelectedUserTypes((prev) => {
      if (prev.length === 0 && checked) return [code];
      if (checked) return prev.includes(code) ? prev : [...prev, code];
      return prev.filter((x) => x !== code);
    });
  };

  const allEquipmentSelected =
    equipments.length > 0 && selectedEquipmentIds.length === equipments.length;
  const allUserTypesSelected = selectedUserTypes.length === 0;

  const handleDownloadExcel = () => {
    if (!tableRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    exportAnalysisChargesExcel(tableRows, { departmentName: departmentTitle });
    toast.success("Excel downloaded.");
  };

  const handleDownloadPdf = () => {
    if (!tableRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    exportAnalysisChargesPdf(tableRows, { departmentName: departmentTitle });
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
            Published rates by user category for a selected department. Filter equipment and user
            types, then download a professional PDF or Excel sheet.
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
              <Select
                value={departmentId || undefined}
                onValueChange={setDepartmentId}
                disabled={!departments.length}
              >
                <SelectTrigger id="ac-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
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
                    No equipment with published charges for this department.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {equipments.map((eq) => {
                      const id = Number(eq.equipment_id);
                      const checked = selectedEquipmentIds.includes(id);
                      return (
                        <li
                          key={id}
                          className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
                        >
                          <Checkbox
                            id={`eq-${id}`}
                            checked={checked}
                            onCheckedChange={(v) => toggleEquipment(id, v === true)}
                          />
                          <label
                            htmlFor={`eq-${id}`}
                            className="cursor-pointer text-sm font-medium leading-snug text-foreground"
                          >
                            {eq.name}
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
                      <li
                        key={ut.code}
                        className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`ut-${ut.code}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (allUserTypesSelected && v !== true) {
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
                        <label
                          htmlFor={`ut-${ut.code}`}
                          className="cursor-pointer text-sm leading-snug"
                        >
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
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={!tableRows.length}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadExcel}
              disabled={!tableRows.length}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Download Excel
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
              <Download className="h-3.5 w-3.5" />
              {tableRows.length} rate line{tableRows.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading charges…
          </div>
        ) : !departmentId ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            Select a department to view analysis charges.
          </div>
        ) : tableRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            Select one or more equipment to view charges by user category.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.07] via-card to-card px-4 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                Department
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {departmentTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Charges by user category — standard published rates
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14 bg-muted/50 text-center text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">
                      S.No.
                    </TableHead>
                    <TableHead className="min-w-[14rem] bg-muted/50 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">
                      Equipment
                    </TableHead>
                    <TableHead className="min-w-[11rem] bg-muted/50 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">
                      User Category
                    </TableHead>
                    <TableHead className="min-w-[16rem] bg-muted/50 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">
                      Charge
                    </TableHead>
                    <TableHead className="w-36 bg-muted/50 text-center text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">
                      GST
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row, idx) => (
                    <TableRow
                      key={`${row.equipmentName}-${row.userCategory}-${idx}`}
                      className={cn(
                        "border-border/50",
                        idx % 2 === 1 && "bg-muted/20"
                      )}
                    >
                      <TableCell className="px-3 py-3.5 text-center text-sm tabular-nums text-muted-foreground sm:px-4">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-[0.95rem] font-semibold text-foreground sm:px-4">
                        {row.equipmentName}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-foreground sm:px-4">
                        {row.userCategory}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm leading-relaxed text-foreground sm:px-4">
                        {row.charge}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-center sm:px-4">
                        <GstBadge text={row.gst} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
