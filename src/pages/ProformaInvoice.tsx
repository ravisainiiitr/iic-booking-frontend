import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Calculator, FileText, Trash2, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { periodicTableElements, getCategoryColor, parseDisabledElementsFromHelpText, type Element } from "@/data/periodicTableData";
import { cn } from "@/lib/utils";

type InputField = {
  field_key: string;
  field_label: string;
  field_type: string;
  is_required?: boolean;
  default_value?: string;
  options?: Array<{ value?: string; label?: string } | string>;
  help_text?: string;
};

type LineItemEntry = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  profile_type: string;
  input_fields: InputField[];
  input_values: Record<string, string | number>;
};

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
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedEquipId, setSelectedEquipId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemEntry[]>([]);
  const [result, setResult] = useState<{
    user_type: string;
    line_items: LineItemResult[];
    subtotal: string;
    total_gst: string;
    total_amount: string;
    amount_in_words?: string;
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [periodicTableContext, setPeriodicTableContext] = useState<{ lineIndex: number; fieldKey: string } | null>(null);
  const [selectedPeriodicSymbols, setSelectedPeriodicSymbols] = useState<Set<string>>(new Set());
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
        }))
      );
    } catch (e) {
      toast.error("Failed to load equipment list.");
      setEquipmentList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  const addEquipment = async () => {
    const id = selectedEquipId ? parseInt(selectedEquipId, 10) : NaN;
    if (!id || isNaN(id)) {
      toast.error("Select an equipment first.");
      return;
    }
    if (lineItems.some((i) => i.equipment_id === id)) {
      toast.error("This equipment is already in the list.");
      return;
    }
    setAdding(true);
    try {
      const detail = await apiClient.getEquipmentDetailById(id);
      const d = detail?.data ?? detail;
        const inputFields: InputField[] = Array.isArray(d?.input_fields) && d.input_fields.length > 0
        ? d.input_fields.map((f: any) => ({
            field_key: f.field_key ?? "",
            field_label: f.field_label ?? f.field_key,
            field_type: f.field_type ?? "NUMERIC",
            is_required: f.is_required === true,
            default_value: f.default_value ?? "",
            options: f.options ?? [],
            help_text: f.help_text ?? "",
          }))
        : [
            { field_key: "A", field_label: "A (e.g. no. of samples)", field_type: "NUMERIC", default_value: "1" },
            { field_key: "B", field_label: "B (e.g. slots / elements)", field_type: "NUMERIC", default_value: "1" },
          ];
      const inputValues: Record<string, string | number> = {};
      inputFields.forEach((f) => {
        const def = f.default_value;
        if (def !== undefined && def !== "") {
          const num = parseFloat(def);
          inputValues[f.field_key] = isNaN(num) ? def : num;
        } else if (f.field_type === "NUMERIC") {
          inputValues[f.field_key] = 0;
        }
      });
      setLineItems((prev) => [
        ...prev,
        {
          equipment_id: id,
          equipment_code: d?.code ?? "",
          equipment_name: d?.name ?? "",
          profile_type: d?.profile_type ?? "",
          input_fields: inputFields,
          input_values: inputValues,
        },
      ]);
      setSelectedEquipId("");
      setResult(null);
    } catch (e) {
      toast.error("Failed to load equipment details.");
    } finally {
      setAdding(false);
    }
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const updateInputValue = (index: number, key: string, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, input_values: { ...item.input_values, [key]: value } }
          : item
      )
    );
    setResult(null);
  };

  const handleCalculate = async () => {
    if (lineItems.length === 0) {
      toast.error("Add at least one equipment.");
      return;
    }
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
      setResult({
        user_type: data.user_type ?? "",
        line_items: data.line_items ?? [],
        subtotal: data.subtotal ?? "0",
        total_gst: data.total_gst ?? "0",
        total_amount: data.total_amount ?? "0",
      });
      toast.success("Proforma calculated.");
    } catch (e: any) {
      const msg = e?.message || (e?.data?.error ?? "Calculation failed.");
      toast.error(msg);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Proforma Invoice</CardTitle>
                <CardDescription>
                  Select equipments and enter samples/slots/elements. Charges are calculated as per your user type. Review the breakdown and total before booking.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add equipment */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Add equipment</Label>
                <Select
                  value={selectedEquipId}
                  onValueChange={setSelectedEquipId}
                  disabled={loadingList}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentList.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {e.code} – {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addEquipment} disabled={adding || !selectedEquipId}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Line items with inputs */}
            {lineItems.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Line items</Label>
                {lineItems.map((item, index) => (
                  <Card key={`${item.equipment_id}-${index}`} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {item.equipment_name} ({item.equipment_code})
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {item.profile_type?.replace(/_/g, " ") || "—"}
                        </p>
                        {item.input_fields.length > 0 ? (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {item.input_fields.map((field) => {
                              const fieldType = String(field.field_type || "").toUpperCase();
                              return (
                                <div key={field.field_key} className="space-y-1">
                                  <Label className="text-xs">
                                    {field.field_label || field.field_key}
                                    {field.is_required ? " *" : ""}
                                  </Label>
                                  {fieldType === "RADIO" ? (
                                    <RadioGroup
                                      value={String(item.input_values[field.field_key] ?? field.default_value ?? "")}
                                      onValueChange={(v) => updateInputValue(index, field.field_key, v)}
                                      className="flex flex-wrap gap-2"
                                    >
                                      {(field.options || []).map((opt: { value?: string; label?: string } | string) => {
                                        const optionValue = typeof opt === "object" ? (opt?.value ?? String(opt)) : String(opt);
                                        const optionLabel = typeof opt === "object" ? (opt?.label ?? optionValue) : opt;
                                        return (
                                          <div key={optionValue} className="flex items-center space-x-2">
                                            <RadioGroupItem value={optionValue} id={`proforma-${index}-${field.field_key}-${optionValue}`} />
                                            <Label htmlFor={`proforma-${index}-${field.field_key}-${optionValue}`} className="font-normal text-xs cursor-pointer">
                                              {optionLabel}
                                            </Label>
                                          </div>
                                        );
                                      })}
                                    </RadioGroup>
                                  ) : fieldType === "PERIODIC_TABLE" ? (
                                    (() => {
                                      const count = Number(item.input_values[field.field_key]) || 0;
                                      const elementsStr = String(item.input_values[field.field_key + "_elements"] ?? "");
                                      const elementsList = elementsStr ? elementsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
                                      const disabledSet = parseDisabledElementsFromHelpText(field.help_text ?? "");
                                      const allowedList = elementsList.filter((s) => !disabledSet.has(s));
                                      return (
                                        <div className="space-y-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setPeriodicTableContext({ lineIndex: index, fieldKey: field.field_key });
                                              setSelectedPeriodicSymbols(new Set(allowedList));
                                            }}
                                          >
                                            Select elements
                                          </Button>
                                          {count > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              {allowedList.length} element(s) selected{allowedList.length ? `: ${allowedList.join(", ")}` : ""}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <Input
                                      type={fieldType === "NUMERIC" ? "number" : "text"}
                                      value={String(item.input_values[field.field_key] ?? "")}
                                      onChange={(e) =>
                                        updateInputValue(
                                          index,
                                          field.field_key,
                                          fieldType === "NUMERIC"
                                            ? (e.target.value === "" ? "" : parseFloat(e.target.value))
                                            : e.target.value
                                        )
                                      }
                                      placeholder={field.default_value || "0"}
                                      min={fieldType === "NUMERIC" ? 0 : undefined}
                                      step="any"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(index)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}

                <Button
                  onClick={handleCalculate}
                  disabled={calculating}
                  className="w-full sm:w-auto"
                >
                  {calculating ? (
                    "Calculating…"
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate proforma
                    </>
                  )}
                </Button>

                {/* Periodic table element selector dialog */}
                <Dialog open={!!periodicTableContext} onOpenChange={(open) => !open && setPeriodicTableContext(null)}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Select elements</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {periodicTableContext && (() => {
                        const entry = lineItems[periodicTableContext.lineIndex];
                        const field = entry?.input_fields?.find((f) => f.field_key === periodicTableContext.fieldKey);
                        const disabledSet = parseDisabledElementsFromHelpText(field?.help_text ?? "");
                        const toggle = (symbol: string) => {
                          if (disabledSet.has(symbol)) return;
                          setSelectedPeriodicSymbols((prev) => {
                            const next = new Set(prev);
                            if (next.has(symbol)) next.delete(symbol);
                            else next.add(symbol);
                            return next;
                          });
                        };
                        return (
                          <>
                            <p className="text-sm text-muted-foreground">
                              {selectedPeriodicSymbols.size} element(s) selected. Count is used for charge calculation.
                              {disabledSet.size > 0 && (
                                <span className="block mt-1"> Elements listed in Help text are disabled.</span>
                              )}
                            </p>
                            <div className="overflow-x-auto">
                              <div className="inline-block min-w-max">
                                <div className="flex flex-col gap-1">
                                  {(() => {
                                    const grid: (Element | null)[][] = Array(7).fill(null).map(() => Array(18).fill(null));
                                    periodicTableElements.forEach((el) => {
                                      if (el.row <= 7 && el.col <= 18) grid[el.row - 1][el.col - 1] = el;
                                    });
                                    const lanthanides = periodicTableElements.filter((el) => el.category === "lanthanide");
                                    const actinides = periodicTableElements.filter((el) => el.category === "actinide");
                                    const elButton = (el: Element) => {
                                      const isDisabled = disabledSet.has(el.symbol);
                                      return (
                                        <button
                                          key={el.atomicNumber}
                                          type="button"
                                          onClick={() => toggle(el.symbol)}
                                          disabled={isDisabled}
                                          title={isDisabled ? `${el.name} (disabled)` : el.name}
                                          className={cn(
                                            "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
                                            getCategoryColor(el.category),
                                            selectedPeriodicSymbols.has(el.symbol) && "ring-2 ring-primary ring-offset-1 scale-105",
                                            isDisabled && "opacity-60 cursor-not-allowed pointer-events-none bg-muted border-dashed"
                                          )}
                                        >
                                          {selectedPeriodicSymbols.has(el.symbol) && <Check className="w-3 h-3 absolute top-0 right-0" />}
                                          <span className="font-bold">{el.symbol}</span>
                                        </button>
                                      );
                                    };
                                    return (
                                      <>
                                        {grid.map((row, ri) => (
                                          <div key={ri} className="flex gap-1">
                                            {row.map((el, ci) => (
                                              <div key={`${ri}-${ci}`}>
                                                {el ? elButton(el) : <div className="w-10 h-10" />}
                                              </div>
                                            ))}
                                          </div>
                                        ))}
                                        <div className="flex gap-1 mt-1">
                                          <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ln</div>
                                          {lanthanides.map((el) => elButton(el))}
                                        </div>
                                        <div className="flex gap-1 mt-1">
                                          <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ac</div>
                                          {actinides.map((el) => elButton(el))}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPeriodicTableContext(null)}>Cancel</Button>
                      <Button
                        onClick={() => {
                          if (periodicTableContext) {
                            const allowed = Array.from(selectedPeriodicSymbols);
                            const entry = lineItems[periodicTableContext.lineIndex];
                            const field = entry?.input_fields?.find((f) => f.field_key === periodicTableContext.fieldKey);
                            const disabledSet = parseDisabledElementsFromHelpText(field?.help_text ?? "");
                            const filtered = allowed.filter((s) => !disabledSet.has(s));
                            updateInputValue(periodicTableContext.lineIndex, periodicTableContext.fieldKey, filtered.length);
                            updateInputValue(periodicTableContext.lineIndex, periodicTableContext.fieldKey + "_elements", filtered.join(","));
                            setPeriodicTableContext(null);
                          }
                        }}
                      >
                        Apply
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Result table */}
            {result && result.line_items.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Proforma summary</h3>
                <p className="text-sm text-muted-foreground">
                  Charges as per your user type: <span className="capitalize font-medium">{result.user_type?.replace(/_/g, " ")}</span>
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Equipment</th>
                        <th className="text-left p-3 font-medium">Inputs & charge breakup</th>
                        <th className="text-right p-3 font-medium">Base (₹)</th>
                        <th className="text-right p-3 font-medium">GST (₹)</th>
                        <th className="text-right p-3 font-medium">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.line_items.map((row, idx) => {
                        const entry = lineItems[idx];
                        const labelMap: Record<string, string> = {};
                        if (entry?.input_fields) {
                          entry.input_fields.forEach((f) => {
                            labelMap[f.field_key] = f.field_label || f.field_key;
                          });
                        }
                        const inputParts = Object.entries(row.input_values)
                          .filter(([, v]) => v !== "" && v !== undefined)
                          .map(([k, v]) => `${labelMap[k] ?? k}: ${v}`);
                        return (
                          <tr key={row.equipment_id + "-" + idx} className="border-t">
                            <td className="p-3 align-top">{idx + 1}</td>
                            <td className="p-3 align-top">
                              <span className="font-medium">{row.equipment_name}</span>
                              <br />
                              <span className="text-muted-foreground text-xs">{row.equipment_code}</span>
                            </td>
                            <td className="p-3 align-top">
                              <div className="space-y-1.5">
                                {inputParts.length > 0 && (
                                  <div className="text-muted-foreground">
                                    {inputParts.join(", ")}
                                  </div>
                                )}
                                {row.charge_breakdown && row.charge_breakdown.length > 0 && (
                                  <ul className="list-none space-y-0.5 text-muted-foreground">
                                    {row.charge_breakdown.map((b, i) => (
                                      <li key={i} className="whitespace-pre-line">
                                        {b.description}: ₹{b.amount.toFixed(2)}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {(!inputParts.length && (!row.charge_breakdown || !row.charge_breakdown.length)) && "—"}
                              </div>
                            </td>
                            <td className="p-3 text-right align-top">{Number(row.base_charge).toFixed(2)}</td>
                            <td className="p-3 text-right align-top">{Number(row.gst_amount).toFixed(2)}</td>
                            <td className="p-3 text-right font-medium align-top">{Number(row.total_charge).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t bg-muted/40 font-semibold">
                        <td colSpan={3} className="p-3 text-right">
                          Subtotal
                        </td>
                        <td className="p-3 text-right">{Number(result.subtotal).toFixed(2)}</td>
                        <td className="p-3 text-right">{Number(result.total_gst).toFixed(2)}</td>
                        <td className="p-3 text-right">₹{Number(result.total_amount).toFixed(2)}</td>
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
                        <td className="p-3 text-right">₹{Number(result.total_amount).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Download PDF */}
                {result && result.line_items.length > 0 && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      disabled={downloadingPdf}
                      onClick={async () => {
                        setDownloadingPdf(true);
                        try {
                          const line_items = result.line_items.map((row, idx) => {
                            const entry = lineItems[idx];
                            const labelMap: Record<string, string> = {};
                            if (entry?.input_fields) {
                              entry.input_fields.forEach((f) => {
                                labelMap[f.field_key] = f.field_label || f.field_key;
                              });
                            }
                            const input_labels_and_values: Record<string, string | number> = {};
                            Object.entries(row.input_values).forEach(([k, v]) => {
                              if (v === "" || v === undefined) return;
                              if (k.endsWith("_elements")) return;
                              const label = labelMap[k] ?? k;
                              input_labels_and_values[label] = typeof v === "number" ? v : v;
                            });
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
                        } catch (e) {
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
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
