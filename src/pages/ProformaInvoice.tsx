import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatINR, formatRupees } from "@/lib/money";
import {
  deleteSavedProforma,
  isChargeRelevantProformaInput,
  readProformaLineItemsFromStorage,
  readSavedProformas,
  saveProformaDraft,
  writeProformaLineItemsToStorage,
  type ProformaLineItemField,
  type ProformaLineItemStored,
  type ProformaSavedDraft,
} from "@/lib/proformaInvoiceStorage";
import {
  departmentLabel,
  deriveDepartmentsFromEquipments,
  pickDefaultDepartmentId,
  type EquipmentDeptOption,
} from "@/lib/equipmentDepartments";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, FileText, Trash2, Download, Pencil, Save, FolderOpen } from "lucide-react";
import { toast } from "sonner";

function fieldMapFor(entry: ProformaLineItemStored | undefined): Record<string, ProformaLineItemField> {
  const map: Record<string, ProformaLineItemField> = {};
  entry?.input_fields?.forEach((f) => {
    map[f.field_key] = f;
  });
  return map;
}

function chargeRelevantInputs(
  inputValues: Record<string, number | string>,
  entry: ProformaLineItemStored | undefined
): Array<[string, number | string]> {
  const fields = fieldMapFor(entry);
  return Object.entries(inputValues)
    .filter(([k, v]) => isChargeRelevantProformaInput(k, v, fields[k]))
    .map(([k, v]) => [fields[k]?.field_label || k, v]);
}

type LineItemResult = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  profile_type: string;
  input_values: Record<string, number | string>;
  total_time_minutes: number;
  charge_breakdown: Array<{ description: string; amount: number }>;
  base_charge: string;
  gst_percent: number;
  gst_amount: string;
  total_charge: string;
};

export default function ProformaInvoice() {
  const navigate = useNavigate();
  const [equipmentList, setEquipmentList] = useState<
    Array<{ equipment_id: number; code: string; name: string; internal_department: number | null }>
  >([]);
  const [departments, setDepartments] = useState<EquipmentDeptOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<ProformaSavedDraft[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedEquipId, setSelectedEquipId] = useState<string>("");
  const [lineItems, setLineItems] = useState<ProformaLineItemStored[]>([]);
  const [result, setResult] = useState<{
    user_type: string;
    line_items: LineItemResult[];
    subtotal: string;
    total_gst: string;
    total_amount: string;
    amount_in_words?: string;
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadEquipments = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiClient.getEquipments(undefined, "ACTIVE");
      const raw = (res as any)?.data ?? res;
      const data = Array.isArray(raw) ? raw : raw?.equipments ?? raw?.results ?? [];
      setEquipmentList(
        data.map((e: any) => ({
          equipment_id: e.equipment_id ?? e.id,
          code: e.code ?? e.equipment_code ?? "",
          name: e.name ?? e.equipment_name ?? "",
          internal_department: e.internal_department ?? null,
        }))
      );
      const depts = deriveDepartmentsFromEquipments(data);
      setDepartments(depts);
      setDepartmentId((prev) =>
        prev && depts.some((d) => String(d.id) === prev) ? prev : pickDefaultDepartmentId(depts)
      );
    } catch {
      toast.error("Failed to load equipment list.");
      setEquipmentList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEquipments();
    setLineItems(readProformaLineItemsFromStorage());
    setSavedDrafts(readSavedProformas());
  }, [loadEquipments]);

  const visibleEquipmentList = useMemo(
    () =>
      departmentId
        ? equipmentList.filter((e) => String(e.internal_department ?? "") === departmentId)
        : equipmentList,
    [equipmentList, departmentId]
  );

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value);
    setSelectedEquipId("");
  };

  const handleSaveProforma = () => {
    if (lineItems.length === 0) {
      toast.error("Add at least one equipment before saving.");
      return;
    }
    const name = window.prompt("Name this proforma", `Proforma ${new Date().toLocaleDateString()}`);
    if (name === null) return;
    try {
      setSavedDrafts(saveProformaDraft(name, lineItems));
      toast.success("Proforma saved.");
    } catch {
      toast.error("Could not save proforma (browser storage may be full).");
    }
  };

  const handleLoadProforma = (draft: ProformaSavedDraft) => {
    writeProformaLineItemsToStorage(draft.lineItems);
    setLineItems(draft.lineItems);
    toast.success(`Loaded "${draft.name}".`);
  };

  const handleDeleteProforma = (draft: ProformaSavedDraft) => {
    if (!window.confirm(`Delete saved proforma "${draft.name}"?`)) return;
    setSavedDrafts(deleteSavedProforma(draft.id));
  };

  const goConfigureEquipment = () => {
    const id = selectedEquipId ? parseInt(selectedEquipId, 10) : NaN;
    if (!id || isNaN(id)) {
      toast.error("Select an equipment first.");
      return;
    }
    navigate(`/book-equipment?equipment_id=${id}&proforma=1`);
  };

  const removeFromSummary = (index: number) => {
    setLineItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      writeProformaLineItemsToStorage(next);
      return next;
    });
    setResult(null);
  };

  useEffect(() => {
    let cancelled = false;
    if (lineItems.length === 0) {
      setResult(null);
      setCalculating(false);
      return;
    }
    (async () => {
      setCalculating(true);
      setResult(null);
      try {
        const items = lineItems.map((item) => {
          const input_values: Record<string, number | string> = {};
          Object.entries(item.input_values).forEach(([k, v]) => {
            if (v === "" || v === undefined) return;
            const num = typeof v === "string" ? parseFloat(v) : v;
            input_values[k] = typeof num === "number" && !isNaN(num) ? num : v;
          });
          return { equipment_id: item.equipment_id, input_values };
        });
        const res = await apiClient.proformaInvoiceCalculate(items);
        const data = res?.data ?? (res as any);
        if (cancelled) return;
        setResult({
          user_type: data.user_type ?? "",
          line_items: data.line_items ?? [],
          subtotal: data.subtotal ?? "0",
          total_gst: data.total_gst ?? "0",
          total_amount: data.total_amount ?? "0",
          amount_in_words: data.amount_in_words,
        });
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message || (e?.data?.error ?? "Calculation failed.");
          toast.error(msg);
          setResult(null);
        }
      } finally {
        if (!cancelled) setCalculating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineItems]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Proforma invoice</h1>
          <p className="mt-2 text-sm text-white/85">
            Add equipment with parameters and charges. Totals update automatically — download PDF when ready.
          </p>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Line items</CardTitle>
                <CardDescription>
                  Select equipment, configure parameters, then build the invoice summary.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              {departments.length > 0 && (
                <div className="w-full sm:w-auto sm:min-w-[240px] space-y-2">
                  <Label>Department</Label>
                  <Select value={departmentId || undefined} onValueChange={handleDepartmentChange} disabled={loadingList}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {departmentLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Add equipment</Label>
                <Select value={selectedEquipId} onValueChange={setSelectedEquipId} disabled={loadingList}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleEquipmentList.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {e.code} – {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={goConfigureEquipment} disabled={!selectedEquipId}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
              <Button variant="outline" onClick={handleSaveProforma} disabled={lineItems.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                Save proforma
              </Button>
            </div>

            {savedDrafts.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Saved proformas
                </p>
                <ul className="divide-y">
                  {savedDrafts.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.lineItems.length} item{d.lineItems.length !== 1 ? "s" : ""} · saved{" "}
                          {new Date(d.savedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => handleLoadProforma(d)}>
                          Load
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteProforma(d)}
                          aria-label={`Delete ${d.name}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {calculating && lineItems.length > 0 && (
              <p className="text-sm text-muted-foreground">Updating proforma totals…</p>
            )}

            {lineItems.length === 0 && (
              <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
                No equipment in this proforma yet. Select an equipment and click <strong>Add</strong> to enter parameters on the Book Equipment page.
              </p>
            )}

            {result && result.line_items.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Proforma summary</h3>
                <p className="text-sm text-muted-foreground">
                  Charges as per your user type:{" "}
                  <span className="capitalize font-medium">{result.user_type?.replace(/_/g, " ")}</span>
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left p-3 font-medium w-10">#</th>
                        <th className="text-left p-3 font-medium">Equipment</th>
                        <th className="text-left p-3 font-medium">Inputs & charge breakup</th>
                        <th className="text-right p-3 font-medium">Base (₹)</th>
                        <th className="text-right p-3 font-medium">GST (₹)</th>
                        <th className="text-right p-3 font-medium">Total (₹)</th>
                        <th className="p-3 w-[88px] text-center font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.line_items.map((row, idx) => {
                        const inputParts = chargeRelevantInputs(row.input_values, lineItems[idx]).map(
                          ([label, v]) => `${label}: ${v}`
                        );
                        return (
                          <tr key={`${row.equipment_id}-${idx}`} className="border-t">
                            <td className="p-3 align-top">{idx + 1}</td>
                            <td className="p-3 align-top">
                              <span className="font-medium">{row.equipment_name}</span>
                              <br />
                              <span className="text-muted-foreground text-xs">{row.equipment_code}</span>
                            </td>
                            <td className="p-3 align-top">
                              <div className="space-y-1.5">
                                {inputParts.length > 0 && (
                                  <div className="text-muted-foreground">{inputParts.join(", ")}</div>
                                )}
                                {row.charge_breakdown && row.charge_breakdown.length > 0 && (
                                  <ul className="list-none space-y-0.5 text-muted-foreground">
                                    {row.charge_breakdown.map((b, i) => (
                                      <li key={i} className="whitespace-pre-line">
                                        {b.description}: {formatINR(b.amount)}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {!inputParts.length && (!row.charge_breakdown || !row.charge_breakdown.length) && "—"}
                              </div>
                            </td>
                            <td className="p-3 text-right align-top">{formatRupees(row.base_charge)}</td>
                            <td className="p-3 text-right align-top">{formatRupees(row.gst_amount)}</td>
                            <td className="p-3 text-right font-medium align-top">{formatRupees(row.total_charge)}</td>
                            <td className="p-2 align-top">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-primary shrink-0"
                                  onClick={() =>
                                    navigate(
                                      `/book-equipment?equipment_id=${row.equipment_id}&proforma=1&proformaLineIndex=${idx}`
                                    )
                                  }
                                  aria-label="Edit parameters"
                                  title="Edit parameters"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => removeFromSummary(idx)}
                                  aria-label="Remove from proforma"
                                  title="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t bg-muted/40 font-semibold">
                        <td colSpan={3} className="p-3 text-right">
                          Subtotal
                        </td>
                        <td className="p-3 text-right">{formatRupees(result.subtotal)}</td>
                        <td className="p-3 text-right">{formatRupees(result.total_gst)}</td>
                        <td className="p-3 text-right">{formatINR(result.total_amount)}</td>
                        <td />
                      </tr>
                      <tr className="border-t bg-primary/10 font-bold">
                        <td colSpan={5} className="p-3 text-right align-top">
                          <span className="block">Total amount</span>
                          {result.amount_in_words && (
                            <span className="block text-xs font-normal text-muted-foreground mt-1">
                              {result.amount_in_words}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">{formatINR(result.total_amount)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    disabled={downloadingPdf}
                    onClick={async () => {
                      setDownloadingPdf(true);
                      try {
                        const line_items = result.line_items.map((row, idx) => {
                          const input_labels_and_values: Record<string, string | number> = Object.fromEntries(
                            chargeRelevantInputs(row.input_values, lineItems[idx])
                          );
                          return {
                            equipment_id: row.equipment_id,
                            equipment_code: row.equipment_code,
                            equipment_name: row.equipment_name,
                            input_values: row.input_values,
                            input_labels_and_values,
                            charge_breakdown: row.charge_breakdown,
                            base_charge: row.base_charge,
                            gst_amount: row.gst_amount,
                            total_charge: row.total_charge,
                          };
                        });
                        const res = await apiClient.proformaInvoiceDownloadPdf({
                          line_items,
                          subtotal: result.subtotal,
                          total_gst: result.total_gst,
                          total_amount: result.total_amount,
                        });
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        if (res.blob) {
                          const url = URL.createObjectURL(res.blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `proforma_invoice_${new Date().toISOString().slice(0, 10)}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("Proforma invoice downloaded.");
                        }
                      } catch {
                        toast.error("Failed to download PDF.");
                      } finally {
                        setDownloadingPdf(false);
                      }
                    }}
                  >
                    {downloadingPdf ? (
                      "Downloading…"
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download proforma invoice (PDF)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF includes IIT Roorkee letterhead, your details, date & time of request, and a computer-generated disclaimer.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
