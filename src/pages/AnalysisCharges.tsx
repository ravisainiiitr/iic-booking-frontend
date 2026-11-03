import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, FileText, IndianRupee, Loader2, Search, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChargesMergedHint, ChargesTable } from "@/components/ui/charges-table";
import { chargesTableClasses as ct } from "@/components/ui/charges-table-classes";
import { apiClient } from "@/lib/api";
import {
  exportAnalysisChargesExcel,
  exportAnalysisChargesPdf,
  pivotAnalysisChargeRows,
  type AnalysisChargeExportRow,
} from "@/lib/analysisChargesExport";
import { buildAnalysisChargeRowsForEquipment } from "@/lib/analysisChargeRows";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Widths of the two sticky lead columns; the equipment column's `left` must equal the serial width. */
const serialColClass = "w-10 min-w-[2.5rem] px-1.5 sm:w-14 sm:min-w-[3.5rem] sm:px-2";
const equipmentColClass =
  "left-10 min-w-[8.5rem] max-w-[9.5rem] px-3 sm:left-14 sm:min-w-[12rem] sm:max-w-none sm:px-4";

const GST_TABLE_NOTE =
  "Note: All rates are exclusive of GST. GST @ 18% will be applicable to external users. No GST is applicable to IIT Roorkee internal users.";

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

function departmentLabel(eq: AnalysisEquipment): string {
  return eq.internal_department_code || eq.internal_department_name || "";
}

/** Every word of the search must appear in the equipment's name, code or department. */
export function matchesChargeSearch(eq: AnalysisEquipment, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [eq.name, eq.code, eq.internal_department_name, eq.internal_department_code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

export default function AnalysisCharges() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [userTypeOptions, setUserTypeOptions] = useState<UserTypeOption[]>([]);
  const [equipments, setEquipments] = useState<AnalysisEquipment[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  /** null = all user types; [] = none selected */
  const [selectedUserTypes, setSelectedUserTypes] = useState<string[] | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  /** Equipment of every department, for the search across departments. */
  const [allEquipments, setAllEquipments] = useState<AnalysisEquipment[]>([]);
  const [search, setSearch] = useState("");
  /** Search results the user has unticked. */
  const [searchExcluded, setSearchExcluded] = useState<number[]>([]);
  const searching = search.trim().length > 0;

  const selectedDepartment = useMemo(
    () => departments.find((d) => String(d.id) === departmentId) ?? null,
    [departments, departmentId]
  );

  const departmentTitle = useMemo(() => {
    if (searching) return `Search results for "${search.trim()}"`;
    if (!selectedDepartment) return "";
    const name = selectedDepartment.name || "Department";
    return selectedDepartment.code ? `${name} (${selectedDepartment.code})` : name;
  }, [selectedDepartment, searching, search]);

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
      setSelectedUserTypes(null);
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
        setAllEquipments(
          Array.isArray(res.data.equipments) ? (res.data.equipments as AnalysisEquipment[]) : []
        );
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

  const searchMatches = useMemo(
    () => (searching ? allEquipments.filter((e) => matchesChargeSearch(e, search)) : []),
    [allEquipments, search, searching]
  );

  /** Equipment offered in the checklist: the department's, or the search results. */
  const listedEquipments = searching ? searchMatches : equipments;

  const isEquipmentChecked = (id: number) =>
    searching ? !searchExcluded.includes(id) : selectedEquipmentIds.includes(id);

  const visibleEquipments = useMemo(() => {
    if (searching) {
      const excluded = new Set(searchExcluded);
      // Results can come from several departments, so name the department in the table.
      return searchMatches
        .filter((e) => !excluded.has(Number(e.equipment_id)))
        .map((e) => (departmentLabel(e) ? { ...e, name: `${e.name} (${departmentLabel(e)})` } : e));
    }
    const idSet = new Set(selectedEquipmentIds);
    return equipments.filter((e) => idSet.has(Number(e.equipment_id)));
  }, [equipments, selectedEquipmentIds, searching, searchMatches, searchExcluded]);

  const filterUserTypes = useMemo(() => {
    if (selectedUserTypes === null) return null;
    return new Set(selectedUserTypes.map((c) => c.toLowerCase()));
  }, [selectedUserTypes]);

  const tableRows = useMemo(
    (): AnalysisChargeExportRow[] =>
      visibleEquipments.flatMap((eq) => buildAnalysisChargeRowsForEquipment(eq, filterUserTypes)),
    [visibleEquipments, filterUserTypes]
  );

  const pivotTable = useMemo(() => pivotAnalysisChargeRows(tableRows), [tableRows]);

  const toggleEquipment = (id: number, checked: boolean) => {
    if (searching) {
      setSearchExcluded((prev) => (checked ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    setSelectedEquipmentIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleUserType = (code: string, checked: boolean) => {
    setSelectedUserTypes((prev) => {
      const allCodes = userTypeOptions.map((o) => o.code);
      const current = prev ?? allCodes;
      const next = checked
        ? current.includes(code)
          ? current
          : [...current, code]
        : current.filter((x) => x !== code);
      return allCodes.length > 0 && allCodes.every((c) => next.includes(c)) ? null : next;
    });
  };

  const allEquipmentSelected = searching
    ? searchMatches.length > 0 && searchExcluded.length === 0
    : equipments.length > 0 && selectedEquipmentIds.length === equipments.length;

  const toggleAllEquipment = () => {
    if (searching) {
      setSearchExcluded(allEquipmentSelected ? searchMatches.map((e) => Number(e.equipment_id)) : []);
      return;
    }
    setSelectedEquipmentIds(allEquipmentSelected ? [] : equipments.map((e) => Number(e.equipment_id)));
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setSearchExcluded([]);
  };
  const allUserTypesSelected = selectedUserTypes === null;
  const noUserTypesSelected = selectedUserTypes !== null && selectedUserTypes.length === 0;

  const handleDownloadExcel = async () => {
    if (!tableRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    try {
      await exportAnalysisChargesExcel(tableRows, { departmentName: departmentTitle });
      toast.success("Excel downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    }
  };

  const handleDownloadPdf = async () => {
    if (!tableRows.length) {
      toast.error("Nothing to export — select at least one equipment with charges.");
      return;
    }
    try {
      await exportAnalysisChargesPdf(tableRows, { departmentName: departmentTitle });
      toast.success("PDF downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 pb-6 pt-[calc(var(--site-header-h)+1.5rem)] sm:px-6">
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-gradient-to-r from-brand via-[hsl(215_62%_22%)] to-slate-950 px-4 py-3 text-white shadow-md shadow-primary/20 sm:items-center sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <IndianRupee className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                Analysis Charges
              </h1>
              <p className="text-sm text-white/75">
                Published rates by user category — filter, then download PDF or Excel.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-white/35 bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white sm:px-3"
          >
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to home</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </Button>
        </div>

        <section className="mb-6 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 space-y-1.5">
            <Label htmlFor="ac-search">Search equipment</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ac-search"
                type="text"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search by equipment name, code or department, e.g. XRD, FESEM, Raman"
                className="pl-9 pr-9"
                autoComplete="off"
              />
              {searching ? (
                <button
                  type="button"
                  onClick={() => changeSearch("")}
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {searching ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {searchMatches.length === 0
                  ? "No equipment matches your search."
                  : `${searchMatches.length} equipment found across all departments.`}{" "}
                Clear the search to browse by department.
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="ac-dept">Department</Label>
              <Select
                value={departmentId || undefined}
                onValueChange={(v) => {
                  changeSearch("");
                  setDepartmentId(v);
                }}
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
                <Label>{searching ? "Matching equipment" : "Equipment"}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={loading || listedEquipments.length === 0}
                  onClick={toggleAllEquipment}
                >
                  {allEquipmentSelected ? "Clear all" : "Select all"}
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                {loading ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Loading equipment…</p>
                ) : listedEquipments.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    {searching
                      ? "No equipment matches your search."
                      : "No equipment with published charges for this department."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {listedEquipments.map((eq) => {
                      const id = Number(eq.equipment_id);
                      const checked = isEquipmentChecked(id);
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
                            {searching && departmentLabel(eq) ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                {departmentLabel(eq)}
                              </span>
                            ) : null}
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
                  onClick={() => setSelectedUserTypes(allUserTypesSelected ? [] : null)}
                >
                  {allUserTypesSelected ? "Clear all" : "Select all"}
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                <p className="mb-2 px-1.5 text-xs text-muted-foreground">
                  {allUserTypesSelected
                    ? "Showing all user categories (default)."
                    : noUserTypesSelected
                      ? "No user category selected."
                      : `${selectedUserTypes?.length ?? 0} selected.`}
                </p>
                <ul className="space-y-1.5">
                  {userTypeOptions.map((ut) => {
                    const checked =
                      allUserTypesSelected || (selectedUserTypes ?? []).includes(ut.code);
                    return (
                      <li
                        key={ut.code}
                        className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`ut-${ut.code}`}
                          checked={checked}
                          onCheckedChange={(v) => toggleUserType(ut.code, v === true)}
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
        ) : !departmentId && !searching ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            Select a department to view analysis charges.
          </div>
        ) : tableRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            {noUserTypesSelected
              ? "Select one or more user types to view charges."
              : searching && searchMatches.length === 0
                ? "No equipment matches your search. Try a shorter word or the equipment code."
                : "Select one or more equipment to view charges by user category."}
          </div>
        ) : (
          <section className="charges-print-area overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.07] via-card to-card px-4 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                {searching ? "Search" : "Department"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {departmentTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Charges by user category — standard published rates
              </p>
              <p className="mt-4 whitespace-nowrap overflow-x-auto print:whitespace-normal print:text-sm text-base font-bold tracking-tight text-amber-900 sm:text-lg dark:text-amber-200">
                {GST_TABLE_NOTE}
              </p>
            </div>
            <div className="p-3 sm:p-4">
              <ChargesTable
                className="min-w-[720px]"
                viewportClassName="max-h-[75dvh]"
              >
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className={cn(ct.th, ct.stickyLeft, ct.thStickyLeft, serialColClass, "text-center")}
                    >
                      <span className="sm:hidden" aria-label="S.No.">#</span>
                      <span className="hidden sm:inline">S.No.</span>
                    </th>
                    <th
                      scope="col"
                      className={cn(ct.th, ct.stickyLeft, ct.thStickyLeft, equipmentColClass)}
                    >
                      Equipment
                    </th>
                    {pivotTable.hasParameters ? (
                      <th scope="col" className={cn(ct.th, "min-w-[9rem]")}>
                        Parameter
                      </th>
                    ) : null}
                    {pivotTable.categories.map((cat) => (
                      <th key={cat} scope="col" className={cn(ct.th, "min-w-[9rem] text-center")}>
                        {cat}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivotTable.rows.map((row, idx) => {
                    const endsGroup = (span: number) => {
                      const next = pivotTable.rows[idx + span];
                      return next !== undefined && next.isFirstOfEquipment;
                    };
                    const groupEndClass = (span = 1) => endsGroup(span) && ct.groupEnd;
                    return (
                      <tr
                        key={`${row.equipmentName}-${row.parameter ?? "base"}-${idx}`}
                        className={cn(ct.row, row.serialNumber % 2 === 0 && ct.zebra)}
                      >
                        {row.isFirstOfEquipment ? (
                          <td
                            rowSpan={row.equipmentRowSpan}
                            className={cn(
                              ct.td,
                              ct.rowHeader,
                              ct.stickyLeft,
                              serialColClass,
                              "text-center text-sm font-normal tabular-nums text-muted-foreground dark:text-slate-400",
                              groupEndClass(row.equipmentRowSpan)
                            )}
                          >
                            {row.serialNumber}
                          </td>
                        ) : null}
                        {row.isFirstOfEquipment ? (
                          <th
                            scope="rowgroup"
                            rowSpan={row.equipmentRowSpan}
                            className={cn(
                              ct.td,
                              ct.rowHeader,
                              ct.stickyLeft,
                              equipmentColClass,
                              "text-left text-sm font-semibold leading-snug text-primary dark:text-sky-300 sm:text-[0.95rem]",
                              groupEndClass(row.equipmentRowSpan)
                            )}
                          >
                            {row.equipmentName}
                          </th>
                        ) : null}
                        {pivotTable.hasParameters ? (
                          <td
                            className={cn(
                              ct.td,
                              "text-sm font-medium text-slate-800 dark:text-slate-200",
                              groupEndClass()
                            )}
                          >
                            {row.parameter || "—"}
                          </td>
                        ) : null}
                        {pivotTable.categories.map((cat) => {
                          const cell = row.cells[cat];
                          if (cell?.spanned) return null;
                          const span = cell?.rowSpan ?? 1;
                          return (
                            <td
                              key={cat}
                              rowSpan={cell?.rowSpan}
                              className={cn(
                                ct.td,
                                "text-center",
                                span > 1 && ct.merged,
                                groupEndClass(span)
                              )}
                            >
                              {cell ? (
                                <>
                                  <span className="block whitespace-pre-line text-sm font-semibold leading-snug tabular-nums text-foreground">
                                    {cell.amount}
                                  </span>
                                  {span > 1 ? <ChargesMergedHint>All parameters</ChargesMergedHint> : null}
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </ChargesTable>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
