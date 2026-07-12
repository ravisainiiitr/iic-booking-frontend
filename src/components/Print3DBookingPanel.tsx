import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  apiClient,
  type PrintAnalysisBatchResult,
  type PrintAnalysisResult,
  type PrintMaterial,
} from "@/lib/api";
import { StlModelPreview } from "@/components/StlModelPreview";
import { extractStlFilesFromZip, type ZipStlEntry } from "@/lib/extractZipStlFiles";
import { ChevronLeft, ChevronRight, FileUp, Upload, X } from "lucide-react";

const MAX_STL_BYTES = 100 * 1024 * 1024;
const SETTINGS_RECALC_DEBOUNCE_MS = 400;
const DEFAULT_DENSITY = 100;
const MIN_DENSITY = 20;

export const PRINT_3D_TENTATIVE_CHARGE_NOTE =
  "Note: The Charges are Tentative and will be updated during final printing.";

export function ceilPrintWeightGrams(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n);
}

export function formatPrintWeightGrams(value: number | string | null | undefined): string {
  return `${ceilPrintWeightGrams(value)} g`;
}

export interface Print3DFileItem {
  id: string;
  filename: string;
  weightGrams: number;
  timeMinutes: number;
  status: PrintAnalysisResult["status"];
}

export interface Print3DBookingValues {
  analysisId?: string;
  batchId?: string;
  weightGrams: number;
  materialCode: string;
  timeMinutes: number;
  items: Print3DFileItem[];
}

interface Print3DBookingPanelProps {
  equipmentId: number | string;
  materials?: PrintMaterial[];
  bedSize?: { x: number; y: number; z: number };
  /** When set (charge estimate), load materials for this user type without login. */
  estimateUserType?: string;
  onReady: (values: Print3DBookingValues | null) => void;
  onAnalyzingChange?: (analyzing: boolean) => void;
  disabled?: boolean;
}

function isBatchResult(
  data: PrintAnalysisResult | PrintAnalysisBatchResult,
): data is PrintAnalysisBatchResult {
  return Array.isArray((data as PrintAnalysisBatchResult).items);
}

function pollUntilComplete(
  analysisId: string,
  onUpdate: (data: PrintAnalysisResult) => void,
): { promise: Promise<PrintAnalysisResult>; cancel: () => void } {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<PrintAnalysisResult>((resolve, reject) => {
    const tick = async () => {
      if (cancelled) return;
      const res = await apiClient.getPrintAnalysis(analysisId);
      if (res.error || !res.data) {
        reject(new Error(res.error || "Failed to load analysis"));
        return;
      }
      onUpdate(res.data);
      if (res.data.status === "COMPLETED") {
        resolve(res.data);
        return;
      }
      if (res.data.status === "FAILED") {
        reject(new Error(res.data.error_message || "STL analysis failed"));
        return;
      }
      timer = setTimeout(tick, 1500);
    };
    void tick();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

function pollBatchUntilComplete(
  batchId: string,
  onUpdate: (data: PrintAnalysisBatchResult) => void,
): { promise: Promise<PrintAnalysisBatchResult>; cancel: () => void } {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<PrintAnalysisBatchResult>((resolve, reject) => {
    const tick = async () => {
      if (cancelled) return;
      const res = await apiClient.getPrintAnalysisBatch(batchId);
      if (res.error || !res.data) {
        reject(new Error(res.error || "Failed to load batch"));
        return;
      }
      onUpdate(res.data);
      if (res.data.status === "COMPLETED") {
        resolve(res.data);
        return;
      }
      if (res.data.status === "FAILED") {
        reject(new Error(res.data.error_message || "ZIP analysis failed"));
        return;
      }
      if (res.data.status === "PARTIAL") {
        const failed = res.data.items.filter((i) => i.status === "FAILED");
        if (failed.length === res.data.items.length) {
          reject(new Error("All STL files in the ZIP failed analysis."));
          return;
        }
        const completed = res.data.items.filter((i) => i.status === "COMPLETED");
        if (completed.length > 0 && !res.data.items.some((i) => ["PENDING", "PROCESSING"].includes(i.status))) {
          resolve(res.data);
          return;
        }
      }
      timer = setTimeout(tick, 1500);
    };
    void tick();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

function buildItemsFromBatch(batch: PrintAnalysisBatchResult): Print3DFileItem[] {
  return batch.items
    .filter((i) => i.status === "COMPLETED")
    .map((i) => ({
      id: i.id,
      filename: i.stl_filename || i.id,
      weightGrams: ceilPrintWeightGrams(i.weight_grams),
      timeMinutes: Number(i.estimated_time_minutes ?? 0),
      status: i.status,
    }));
}

export function Print3DBookingPanel({
  equipmentId,
  materials: materialsProp,
  bedSize = { x: 220, y: 220, z: 250 },
  estimateUserType,
  onReady,
  onAnalyzingChange,
  disabled,
}: Print3DBookingPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<{ cancel: () => void } | null>(null);
  const analysisIdRef = useRef<string | null>(null);
  const batchIdRef = useRef<string | null>(null);
  const skipSettingsRecalcRef = useRef(true);
  const settingsRecalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recalcInFlightRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isZipUpload, setIsZipUpload] = useState(false);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [zipStlEntries, setZipStlEntries] = useState<ZipStlEntry[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [materials, setMaterials] = useState<PrintMaterial[]>(materialsProp ?? []);
  const [materialId, setMaterialId] = useState<string>("");
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [analyzingStl, setAnalyzingStl] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [analysis, setAnalysis] = useState<PrintAnalysisResult | null>(null);
  const [batch, setBatch] = useState<PrintAnalysisBatchResult | null>(null);
  const [progress, setProgress] = useState(0);

  const busy = analyzingStl || recalculating;

  useEffect(() => {
    onAnalyzingChange?.(busy);
  }, [busy, onAnalyzingChange]);

  useEffect(() => {
    if (!busy) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 99) return p;
        if (recalculating) return Math.min(p + 8, 96);
        if (analysis?.status === "PROCESSING" || batch?.status === "PROCESSING") return Math.min(p + 4, 92);
        if (p < 90) return Math.min(p + 2, 90);
        if (p < 95) return Math.min(p + 1, 95);
        return Math.min(p + 1, 99);
      });
    }, 450);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [busy, recalculating, analysis?.status, batch?.status]);

  useEffect(() => {
    if (materialsProp?.length) {
      setMaterials(materialsProp);
      if (!materialId && materialsProp[0]) {
        setMaterialId(String(materialsProp[0].id));
      }
    }
  }, [materialsProp, materialId]);

  useEffect(() => {
    if (materialsProp?.length) return;
    const userTypeOpts = estimateUserType ? { user_type: estimateUserType } : undefined;
    void apiClient.getEquipmentPrintMaterials(equipmentId, userTypeOpts).then((res) => {
      if (res.data?.materials?.length) {
        setMaterials(res.data.materials);
        setMaterialId(String(res.data.materials[0].id));
      } else {
        setMaterials([]);
        setMaterialId("");
      }
    });
  }, [equipmentId, materialsProp, estimateUserType]);

  useEffect(() => {
    return () => {
      pollRef.current?.cancel();
      if (settingsRecalcTimerRef.current) clearTimeout(settingsRecalcTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const selectedMaterial = useMemo(
    () => materials.find((m) => String(m.id) === materialId),
    [materials, materialId],
  );

  const completedItems = useMemo(() => {
    if (batch) return buildItemsFromBatch(batch);
    if (analysis?.status === "COMPLETED") {
      return [
        {
          id: analysis.id,
          filename: analysis.stl_filename || file?.name || "model.stl",
          weightGrams: ceilPrintWeightGrams(analysis.weight_grams),
          timeMinutes: Number(analysis.estimated_time_minutes ?? 0),
          status: analysis.status,
        },
      ];
    }
    return [];
  }, [analysis, batch, file?.name]);

  const applyReadyValues = useCallback(
    (items: Print3DFileItem[], materialCode: string) => {
      if (!items.length || !materialCode) {
        onReady(null);
        return;
      }
      const totalWeight = items.reduce((sum, i) => sum + i.weightGrams, 0);
      const totalTime = items.reduce((sum, i) => sum + i.timeMinutes, 0);
      onReady({
        analysisId: items.length === 1 ? items[0].id : analysisIdRef.current ?? undefined,
        batchId: batchIdRef.current ?? undefined,
        weightGrams: totalWeight,
        materialCode,
        timeMinutes: totalTime,
        items,
      });
    },
    [onReady],
  );

  const applySingleAnalysis = useCallback(
    (data: PrintAnalysisResult) => {
      setAnalysis(data);
      setBatch(null);
      if (data.status !== "COMPLETED") {
        onReady(null);
        return;
      }
      analysisIdRef.current = data.id;
      batchIdRef.current = null;
      const code = data.material_code_snapshot || selectedMaterial?.code;
      if (!code) {
        onReady(null);
        return;
      }
      applyReadyValues(
        [
          {
            id: data.id,
            filename: data.stl_filename || file?.name || "model.stl",
            weightGrams: ceilPrintWeightGrams(data.weight_grams),
            timeMinutes: Number(data.estimated_time_minutes ?? 0),
            status: data.status,
          },
        ],
        code,
      );
    },
    [applyReadyValues, file?.name, onReady, selectedMaterial?.code],
  );

  const applyBatchAnalysis = useCallback(
    (data: PrintAnalysisBatchResult) => {
      setBatch(data);
      setAnalysis(null);
      batchIdRef.current = data.id;
      analysisIdRef.current = null;
      const items = buildItemsFromBatch(data);
      const code = data.material_code_snapshot || selectedMaterial?.code || "";
      if (!items.length || !code) {
        onReady(null);
        return;
      }
      applyReadyValues(items, code);
    },
    [applyReadyValues, onReady, selectedMaterial?.code],
  );

  const runFullAnalysis = useCallback(
    async (selectedFile: File) => {
      if (!materialId) {
        toast.error("Select a material first.");
        return;
      }
      pollRef.current?.cancel();
      setAnalyzingStl(true);
      setProgress(8);
      setAnalysis(null);
      setBatch(null);
      analysisIdRef.current = null;
      batchIdRef.current = null;
      onReady(null);

      const zip = selectedFile.name.toLowerCase().endsWith(".zip");

      try {
        const res = await apiClient.analyzeEquipmentStl(equipmentId, {
          file: selectedFile,
          material_id: materialId,
          density_percent: density,
        });
        if (res.error || !res.data) {
          toast.error(res.error || "Analysis failed");
          return;
        }

        if (isBatchResult(res.data)) {
          const initial = res.data;
          setBatch(initial);
          setProgress(40);
          if (initial.status === "COMPLETED") {
            setProgress(100);
            applyBatchAnalysis(initial);
            toast.success(`${initial.items.length} STL file(s) analyzed.`);
            return;
          }
          const poll = pollBatchUntilComplete(initial.id, (data) => {
            setBatch(data);
            if (data.status === "PROCESSING") setProgress((p) => Math.max(p, 55));
            if (data.status === "COMPLETED" || data.status === "PARTIAL") {
              setProgress(100);
              applyBatchAnalysis(data);
            }
          });
          pollRef.current = poll;
          const finalData = await poll.promise;
          setProgress(100);
          applyBatchAnalysis(finalData);
          toast.success(`${buildItemsFromBatch(finalData).length} STL file(s) analyzed.`);
          return;
        }

        const initial = res.data;
        setAnalysis(initial);
        setProgress(40);
        if (initial.status === "COMPLETED") {
          setProgress(100);
          applySingleAnalysis(initial);
          toast.success("STL analyzed successfully.");
          return;
        }
        const poll = pollUntilComplete(initial.id, (data) => {
          setAnalysis(data);
          if (data.status === "PROCESSING") setProgress((p) => Math.max(p, 55));
          if (data.status === "COMPLETED") {
            setProgress(100);
            applySingleAnalysis(data);
          }
        });
        pollRef.current = poll;
        const finalData = await poll.promise;
        setProgress(100);
        applySingleAnalysis(finalData);
        if (finalData.warnings?.length) {
          toast.warning(finalData.warnings.join(" "));
        } else {
          toast.success("STL analyzed successfully.");
        }
      } catch (e) {
        setProgress(0);
        toast.error(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setAnalyzingStl(false);
      }
    },
    [applyBatchAnalysis, applySingleAnalysis, density, equipmentId, materialId, onReady],
  );

  const recalculateFromSettings = useCallback(async () => {
    if (!materialId || recalcInFlightRef.current) return;

    recalcInFlightRef.current = true;
    setRecalculating(true);
    setProgress(30);
    try {
      if (batchIdRef.current) {
        const res = await apiClient.recalculatePrintAnalysisBatch(batchIdRef.current, {
          material_id: materialId,
          density_percent: density,
        });
        if (res.error || !res.data) {
          toast.error(res.error || "Recalculation failed");
          return;
        }
        setProgress(100);
        applyBatchAnalysis(res.data);
        return;
      }

      const analysisId = analysisIdRef.current;
      if (!analysisId) return;

      const res = await apiClient.recalculatePrintAnalysis(analysisId, {
        material_id: materialId,
        density_percent: density,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Recalculation failed");
        return;
      }
      setProgress(100);
      applySingleAnalysis(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalculation failed");
    } finally {
      recalcInFlightRef.current = false;
      setRecalculating(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }, [applyBatchAnalysis, applySingleAnalysis, density, materialId]);

  const recalculateFromSettingsRef = useRef(recalculateFromSettings);
  recalculateFromSettingsRef.current = recalculateFromSettings;

  useEffect(() => {
    if ((!analysisIdRef.current && !batchIdRef.current) || analyzingStl || disabled) return;
    if (skipSettingsRecalcRef.current) {
      skipSettingsRecalcRef.current = false;
      return;
    }
    if (settingsRecalcTimerRef.current) clearTimeout(settingsRecalcTimerRef.current);
    settingsRecalcTimerRef.current = setTimeout(() => {
      void recalculateFromSettingsRef.current();
    }, SETTINGS_RECALC_DEBOUNCE_MS);
    return () => {
      if (settingsRecalcTimerRef.current) clearTimeout(settingsRecalcTimerRef.current);
    };
  }, [density, materialId, analyzingStl, disabled]);

  const onFileSelected = async (selected: File | null) => {
    if (!selected) return;
    const lower = selected.name.toLowerCase();
    const zip = lower.endsWith(".zip");
    const stl = lower.endsWith(".stl");
    if (!zip && !stl) {
      toast.error("Please upload a .stl file or .zip archive.");
      return;
    }
    if (selected.size > MAX_STL_BYTES) {
      toast.error("File must be under 100 MB.");
      return;
    }
    skipSettingsRecalcRef.current = true;
    setIsZipUpload(zip);
    setFile(selected);
    setZipStlEntries([]);
    setPreviewIndex(0);
    if (stl) {
      setStlBuffer(null);
      const buf = await selected.arrayBuffer();
      setStlBuffer(buf);
    } else {
      setStlBuffer(null);
      try {
        const entries = await extractStlFilesFromZip(selected);
        setZipStlEntries(entries);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read ZIP file.");
        setFile(null);
        setIsZipUpload(false);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    void runFullAnalysis(selected);
  };

  const clear = () => {
    pollRef.current?.cancel();
    if (settingsRecalcTimerRef.current) clearTimeout(settingsRecalcTimerRef.current);
    skipSettingsRecalcRef.current = true;
    analysisIdRef.current = null;
    batchIdRef.current = null;
    setFile(null);
    setIsZipUpload(false);
    setStlBuffer(null);
    setZipStlEntries([]);
    setPreviewIndex(0);
    setAnalysis(null);
    setBatch(null);
    setProgress(0);
    onReady(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const progressLabel = analyzingStl
    ? batch?.status === "PROCESSING" || analysis?.status === "PROCESSING"
      ? "Slicing and estimating print time…"
      : batch?.status === "PENDING" || analysis?.status === "PENDING"
        ? "Queued for analysis…"
        : progress >= 95
          ? "Finalizing analysis…"
          : isZipUpload
            ? "Analyzing STL files in ZIP…"
            : "Analyzing STL on server…"
    : recalculating
      ? "Updating weight and print time…"
      : "";

  const totals = useMemo(() => {
    const weight = completedItems.reduce((s, i) => s + i.weightGrams, 0);
    const time = completedItems.reduce((s, i) => s + i.timeMinutes, 0);
    return { weight, time };
  }, [completedItems]);

  const previewEntries = useMemo((): ZipStlEntry[] => {
    if (isZipUpload && zipStlEntries.length > 0) return zipStlEntries;
    if (stlBuffer && file) return [{ filename: file.name, buffer: stlBuffer }];
    return [];
  }, [isZipUpload, zipStlEntries, stlBuffer, file]);

  const currentPreviewBuffer = previewEntries[previewIndex]?.buffer ?? null;
  const currentPreviewFilename = previewEntries[previewIndex]?.filename ?? "";

  useEffect(() => {
    setPreviewIndex(0);
  }, [file?.name, previewEntries.length]);

  const goToPreview = (index: number) => {
    if (previewEntries.length === 0) return;
    setPreviewIndex(Math.max(0, Math.min(index, previewEntries.length - 1)));
  };

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">3D model upload</CardTitle>
        <CardDescription>
          Upload a single STL or a ZIP containing multiple STL files. Changing material or density
          updates weight and time instantly without re-uploading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-bold text-amber-900">{PRINT_3D_TENTATIVE_CHARGE_NOTE}</p>
        <div className="space-y-2">
          <Label>Material</Label>
          <Select value={materialId} onValueChange={setMaterialId} disabled={disabled || analyzingStl}>
            <SelectTrigger>
              <SelectValue placeholder={materials.length ? "Select material" : "No materials configured"} />
            </SelectTrigger>
            <SelectContent>
              {materials.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name} — ₹{m.price_per_gram}/g
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Density</Label>
            <span className="text-sm text-muted-foreground">{density}%</span>
          </div>
          <Slider
            min={MIN_DENSITY}
            max={100}
            step={5}
            value={[density]}
            onValueChange={([v]) => setDensity(v)}
            disabled={disabled || analyzingStl}
          />
        </div>

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center",
            file && "border-primary/40 bg-muted/20",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".stl,.zip"
            className="hidden"
            disabled={disabled || analyzingStl}
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="space-y-2">
              <FileUp className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">{file.name}</p>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || analyzingStl}
                  onClick={() => file && void runFullAnalysis(file)}
                >
                  Re-analyze
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={analyzingStl}>
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <Button
                type="button"
                disabled={disabled || analyzingStl || !materials.length}
                onClick={() => inputRef.current?.click()}
              >
                Choose STL or ZIP file
              </Button>
            </div>
          )}
        </div>

        {busy && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{progressLabel}</span>
              <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {previewEntries.length > 0 && (
          <div className="space-y-2">
            {previewEntries.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={previewIndex <= 0}
                  onClick={() => goToPreview(previewIndex - 1)}
                  aria-label="Previous model"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-sm font-medium truncate">{currentPreviewFilename}</p>
                  <p className="text-xs text-muted-foreground">
                    Model {previewIndex + 1} of {previewEntries.length}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={previewIndex >= previewEntries.length - 1}
                  onClick={() => goToPreview(previewIndex + 1)}
                  aria-label="Next model"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <StlModelPreview buffer={currentPreviewBuffer} bedSize={bedSize} />
          </div>
        )}

        {completedItems.length > 0 && !busy && (
          <>
            <Separator />
            {completedItems.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Files ({completedItems.length})</p>
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {completedItems.map((item, idx) => {
                    const zipIdx = zipStlEntries.findIndex(
                      (e) => e.filename === item.filename || e.filename.toLowerCase() === item.filename.toLowerCase(),
                    );
                    const previewIdx = zipIdx >= 0 ? zipIdx : idx;
                    const isActive = isZipUpload && previewEntries.length > 1 && previewIdx === previewIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex w-full justify-between gap-2 p-3 text-sm text-left transition-colors",
                          isZipUpload && zipStlEntries.length > 0 && "hover:bg-muted/60 cursor-pointer",
                          isActive && "bg-primary/10",
                        )}
                        onClick={() => {
                          if (isZipUpload && zipStlEntries.length > 0) goToPreview(previewIdx);
                        }}
                      >
                        <span className="truncate font-medium">{item.filename}</span>
                        <span className="text-muted-foreground shrink-0">
                          {formatPrintWeightGrams(item.weightGrams)} · {item.timeMinutes} min
                        </span>
                      </button>
                    );
                  })}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Total weight</dt>
                    <dd className="font-medium">{formatPrintWeightGrams(totals.weight)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total print time</dt>
                    <dd className="font-medium">{totals.time} min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Density</dt>
                    <dd className="font-medium">{density}%</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Weight</dt>
                  <dd className="font-medium">{formatPrintWeightGrams(totals.weight)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Print time</dt>
                  <dd className="font-medium">{totals.time} min</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Density</dt>
                  <dd className="font-medium">{density}%</dd>
                </div>
                {analysis?.analysis_method ? (
                  <div>
                    <dt className="text-muted-foreground">Method</dt>
                    <dd className="font-medium">{analysis.analysis_method}</dd>
                  </div>
                ) : null}
                {analysis?.volume_cm3 != null ? (
                  <div>
                    <dt className="text-muted-foreground">Volume</dt>
                    <dd className="font-medium">{Number(analysis.volume_cm3).toFixed(2)} cm³</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </>
        )}
        {(analysis?.status === "FAILED" || batch?.status === "FAILED") && (
          <p className="text-sm text-destructive">
            {analysis?.error_message || batch?.error_message || "Analysis failed"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
