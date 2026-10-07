import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { extractStlFilesFromZip, type ZipStlEntry } from "@/lib/extractZipStlFiles";
import { NO_FABRICATION_MATERIALS_MESSAGE } from "@/lib/fabricationProfiles";
import {
  checkStlSize,
  formatPrintSizeLimit,
  previewBedSize,
  printSizeLimitFrom,
  type MaxPrintSizePayload,
  type StlSizeCheck,
} from "@/lib/printSizeLimit";
import { AlertTriangle, ChevronLeft, ChevronRight, FileUp, Ruler, Upload, X } from "lucide-react";

// three.js viewer: loaded only when a model is previewed (this module is also imported for helpers).
const StlModelPreview = lazy(() =>
  import("@/components/StlModelPreview").then((m) => ({ default: m.StlModelPreview })),
);

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
  partName: string;
  quantity: number;
  /** One copy. */
  weightGramsEach: number;
  timeMinutesEach: number;
  /** All copies (each × quantity). */
  weightGrams: number;
  timeMinutes: number;
  status: PrintAnalysisResult["status"];
}

export interface Print3DBookingValues {
  analysisId?: string;
  batchId?: string;
  /** Totals for all files and copies. */
  weightGrams: number;
  materialCode: string;
  timeMinutes: number;
  items: Print3DFileItem[];
  /** Changes whenever quantities, material or the own-material choice change. */
  partsKey: string;
  ownMaterial: boolean;
}

interface Print3DBookingPanelProps {
  equipmentId: number | string;
  materials?: PrintMaterial[];
  bedSize?: { x: number; y: number; z: number };
  /** Equipment's maximum print size (`max_print_size` of the detail API); when omitted it comes with the materials. */
  maxPrintSize?: MaxPrintSizePayload | null;
  /** When set (charge estimate), load materials for this user type without login. */
  estimateUserType?: string;
  /** Equipment's fixed own-material charge; null/undefined hides the option. */
  ownMaterialCharge?: string | number | null;
  onReady: (values: Print3DBookingValues | null) => void;
  onAnalyzingChange?: (analyzing: boolean) => void;
  disabled?: boolean;
}

export function print3DItemFromAnalysis(a: PrintAnalysisResult, fallbackFilename?: string): Print3DFileItem {
  const filename = a.stl_filename || fallbackFilename || "model.stl";
  const quantity = Math.max(1, Math.floor(Number(a.quantity) || 1));
  const weightEach = ceilPrintWeightGrams(a.weight_grams);
  const timeEach = Number(a.estimated_time_minutes ?? 0);
  return {
    id: a.id,
    filename,
    partName: a.part_name || a.display_part_name || filename.replace(/\.stl$/i, ""),
    quantity,
    weightGramsEach: weightEach,
    timeMinutesEach: timeEach,
    weightGrams: weightEach * quantity,
    timeMinutes: timeEach * quantity,
    status: a.status,
  };
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
  return batch.items.filter((i) => i.status === "COMPLETED").map((i) => print3DItemFromAnalysis(i, i.id));
}

export function Print3DBookingPanel({
  equipmentId,
  materials: materialsProp,
  bedSize: defaultBedSize = { x: 220, y: 220, z: 250 },
  maxPrintSize,
  estimateUserType,
  ownMaterialCharge,
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
  const [materialsLoaded, setMaterialsLoaded] = useState(Boolean(materialsProp?.length));
  const [materialId, setMaterialId] = useState<string>("");
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [analyzingStl, setAnalyzingStl] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [analysis, setAnalysis] = useState<PrintAnalysisResult | null>(null);
  const [batch, setBatch] = useState<PrintAnalysisBatchResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [ownMaterial, setOwnMaterial] = useState(false);
  const [savingPartIds, setSavingPartIds] = useState<Set<string>>(new Set());
  const [partDrafts, setPartDrafts] = useState<Record<string, { name: string; qty: string }>>({});
  const ownMaterialRef = useRef(false);
  ownMaterialRef.current = ownMaterial;
  const lastReadyRef = useRef<{ items: Print3DFileItem[]; code: string } | null>(null);
  const [fetchedMaxPrintSize, setFetchedMaxPrintSize] = useState<MaxPrintSizePayload | null>(null);
  const [sizeChecks, setSizeChecks] = useState<StlSizeCheck[]>([]);
  const [serverSizeError, setServerSizeError] = useState<string | null>(null);
  const initialPreviewIndexRef = useRef(0);

  const sizeLimit = useMemo(
    () => printSizeLimitFrom(maxPrintSize !== undefined ? maxPrintSize : fetchedMaxPrintSize),
    [maxPrintSize, fetchedMaxPrintSize],
  );
  const bedSize = previewBedSize(sizeLimit) ?? defaultBedSize;
  const sizeErrors = sizeChecks.filter((c) => c.error);
  const sizeWarnings = sizeChecks.filter((c) => c.warning);
  const tooLarge = sizeErrors.length > 0;

  const ownMaterialAvailable =
    ownMaterialCharge !== null && ownMaterialCharge !== undefined && String(ownMaterialCharge) !== "";

  const busy = analyzingStl || recalculating || savingPartIds.size > 0;

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
      setMaterialsLoaded(true);
      if (!materialId && materialsProp[0]) {
        setMaterialId(String(materialsProp[0].id));
      }
    }
  }, [materialsProp, materialId]);

  useEffect(() => {
    if (materialsProp?.length) return;
    const userTypeOpts = estimateUserType ? { user_type: estimateUserType } : undefined;
    void apiClient.getEquipmentPrintMaterials(equipmentId, userTypeOpts).then((res) => {
      setFetchedMaxPrintSize(res.data?.max_print_size ?? null);
      if (res.data?.materials?.length) {
        setMaterials(res.data.materials);
        setMaterialId(String(res.data.materials[0].id));
      } else {
        setMaterials([]);
        setMaterialId("");
      }
      setMaterialsLoaded(!res.error);
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
    if (analysis?.status === "COMPLETED") return [print3DItemFromAnalysis(analysis, file?.name)];
    return [];
  }, [analysis, batch, file?.name]);

  const clearReady = useCallback(() => {
    lastReadyRef.current = null;
    onReady(null);
  }, [onReady]);

  const applyReadyValues = useCallback(
    (items: Print3DFileItem[], materialCode: string) => {
      if (!items.length || !materialCode) {
        clearReady();
        return;
      }
      lastReadyRef.current = { items, code: materialCode };
      const totalWeight = items.reduce((sum, i) => sum + i.weightGrams, 0);
      const totalTime = items.reduce((sum, i) => sum + i.timeMinutes, 0);
      const own = ownMaterialRef.current;
      onReady({
        analysisId: items.length === 1 ? items[0].id : analysisIdRef.current ?? undefined,
        batchId: batchIdRef.current ?? undefined,
        weightGrams: totalWeight,
        materialCode,
        timeMinutes: totalTime,
        items,
        partsKey: JSON.stringify([own, materialCode, items.map((i) => [i.id, i.quantity, i.weightGramsEach, i.timeMinutesEach])]),
        ownMaterial: own,
      });
    },
    [clearReady, onReady],
  );

  useEffect(() => {
    if (!ownMaterialAvailable && ownMaterial) setOwnMaterial(false);
  }, [ownMaterialAvailable, ownMaterial]);

  useEffect(() => {
    const last = lastReadyRef.current;
    if (last) applyReadyValues(last.items, last.code);
    // Only the own-material choice re-emits here; file and material changes emit from their own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownMaterial]);

  const applySingleAnalysis = useCallback(
    (data: PrintAnalysisResult) => {
      setAnalysis(data);
      setBatch(null);
      if (data.status !== "COMPLETED") {
        clearReady();
        return;
      }
      analysisIdRef.current = data.id;
      batchIdRef.current = null;
      const code = data.material_code_snapshot || selectedMaterial?.code;
      if (!code) {
        clearReady();
        return;
      }
      applyReadyValues([print3DItemFromAnalysis(data, file?.name)], code);
    },
    [applyReadyValues, clearReady, file?.name, selectedMaterial?.code],
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
        clearReady();
        return;
      }
      applyReadyValues(items, code);
    },
    [applyReadyValues, clearReady, selectedMaterial?.code],
  );

  const savePart = useCallback(
    async (itemId: string, data: { part_name?: string; quantity?: number }) => {
      setSavingPartIds((s) => new Set(s).add(itemId));
      try {
        const res = await apiClient.updatePrintAnalysisPart(itemId, data);
        if (res.error || !res.data) {
          toast.error(res.error || "Could not update the part.");
          return false;
        }
        const updated = res.data;
        const merge = (a: PrintAnalysisResult): PrintAnalysisResult =>
          a.id === updated.id
            ? { ...a, part_name: updated.part_name, display_part_name: updated.display_part_name, quantity: updated.quantity }
            : a;
        const code = lastReadyRef.current?.code;
        if (batch) {
          const nextBatch = { ...batch, items: batch.items.map(merge) };
          setBatch(nextBatch);
          if (code) applyReadyValues(buildItemsFromBatch(nextBatch), code);
        } else if (analysis) {
          const next = merge(analysis);
          setAnalysis(next);
          if (code) applyReadyValues([print3DItemFromAnalysis(next, file?.name)], code);
        }
        return true;
      } finally {
        setSavingPartIds((s) => {
          const next = new Set(s);
          next.delete(itemId);
          return next;
        });
      }
    },
    [analysis, applyReadyValues, batch, file?.name],
  );

  const partDraft = (item: Print3DFileItem) => partDrafts[item.id] ?? { name: item.partName, qty: String(item.quantity) };

  const commitPartName = async (item: Print3DFileItem) => {
    const draft = partDrafts[item.id];
    if (!draft || draft.name.trim() === item.partName) return;
    await savePart(item.id, { part_name: draft.name.trim() });
  };

  const commitPartQty = async (item: Print3DFileItem) => {
    const draft = partDrafts[item.id];
    if (!draft) return;
    const qty = Number(draft.qty);
    const reset = () => setPartDrafts((d) => ({ ...d, [item.id]: { ...draft, qty: String(item.quantity) } }));
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Number of copies must be a whole number of at least 1.");
      reset();
      return;
    }
    if (qty === item.quantity) return;
    if (!(await savePart(item.id, { quantity: qty }))) reset();
  };

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
      setPartDrafts({});
      setServerSizeError(null);
      clearReady();

      try {
        const res = await apiClient.analyzeEquipmentStl(equipmentId, {
          file: selectedFile,
          material_id: materialId,
          density_percent: density,
        });
        if (res.error || !res.data) {
          setProgress(0);
          if ("code" in res && res.code === "PRINT_SIZE_EXCEEDED") {
            setServerSizeError(res.error || "The model is larger than this printer's maximum print size.");
            return;
          }
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
    [applyBatchAnalysis, applySingleAnalysis, clearReady, density, equipmentId, materialId],
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
    pollRef.current?.cancel();
    setIsZipUpload(zip);
    setFile(selected);
    setZipStlEntries([]);
    setPreviewIndex(0);
    setSizeChecks([]);
    setServerSizeError(null);
    let entries: ZipStlEntry[];
    if (stl) {
      setStlBuffer(null);
      const buf = await selected.arrayBuffer();
      setStlBuffer(buf);
      entries = [{ filename: selected.name, buffer: buf }];
    } else {
      setStlBuffer(null);
      try {
        entries = await extractStlFilesFromZip(selected);
        setZipStlEntries(entries);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read ZIP file.");
        setFile(null);
        setIsZipUpload(false);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    const checks = entries.map((e) => checkStlSize(e.filename, e.buffer, sizeLimit));
    setSizeChecks(checks);
    const firstTooLarge = checks.findIndex((c) => c.error);
    if (firstTooLarge >= 0) {
      // Not sent for analysis: the server would refuse it, and the user fixes the model first.
      setAnalysis(null);
      setBatch(null);
      analysisIdRef.current = null;
      batchIdRef.current = null;
      clearReady();
      initialPreviewIndexRef.current = firstTooLarge;
      setPreviewIndex(firstTooLarge);
      return;
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
    setPartDrafts({});
    setSizeChecks([]);
    setServerSizeError(null);
    clearReady();
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
  const currentSizeCheck = sizeChecks[previewIndex];
  const currentPreviewItem =
    completedItems.find((i) => i.filename.toLowerCase() === currentPreviewFilename.toLowerCase()) ??
    (completedItems.length === 1 && previewEntries.length === 1 ? completedItems[0] : undefined);
  const previewLayerHeight = Number(
    (analysis?.slicer_settings ?? batch?.slicer_settings)?.layer_height_mm,
  );
  const previewColor = (selectedMaterial as { color?: string; colour?: string; color_hex?: string } | undefined);

  useEffect(() => {
    setPreviewIndex(initialPreviewIndexRef.current);
    initialPreviewIndexRef.current = 0;
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
          {materialsLoaded && materials.length === 0 && (
            <p className="text-sm text-destructive" role="alert" data-testid="print-no-materials">
              {NO_FABRICATION_MATERIALS_MESSAGE}
            </p>
          )}
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

        {sizeLimit && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground" data-testid="print-max-size">
            <Ruler className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Maximum print size:{" "}
              <span className="font-medium text-foreground tabular-nums">{formatPrintSizeLimit(sizeLimit)}</span> (W × D × H).{" "}
              {sizeLimit.allowRotation
                ? "A model that fits when turned is accepted; the lab re-orients it."
                : "The model must fit as it is oriented in the file."}{" "}
              STL sizes are read in millimetres.
            </span>
          </p>
        )}

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center",
            file && "border-primary/40 bg-muted/20",
            file && (tooLarge || serverSizeError) && "border-destructive bg-destructive-subtle",
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
                  disabled={disabled || analyzingStl || tooLarge}
                  onClick={() => file && void runFullAnalysis(file)}
                >
                  Re-analyze
                </Button>
                {(tooLarge || serverSizeError) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || analyzingStl}
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose another file
                  </Button>
                )}
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

        {(tooLarge || serverSizeError) && (
          <div
            role="alert"
            data-testid="print-size-error"
            className="flex gap-2 rounded-md border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">
                {sizeErrors.length > 1
                  ? `${sizeErrors.length} models are too large for this printer, so the files were not uploaded.`
                  : "This model is too large for this printer, so it was not uploaded."}
              </p>
              {tooLarge ? (
                <ul className="list-disc space-y-1 pl-4">
                  {sizeErrors.map((c) => (
                    <li key={c.filename}>{c.error}</li>
                  ))}
                </ul>
              ) : (
                <p>{serverSizeError}</p>
              )}
            </div>
          </div>
        )}
        {!tooLarge && sizeWarnings.length > 0 && (
          <div
            data-testid="print-size-warning"
            className="flex gap-2 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              {sizeWarnings.map((c) => (
                <p key={c.filename}>
                  {sizeWarnings.length > 1 ? `${c.filename}: ` : ""}
                  {c.warning}
                </p>
              ))}
            </div>
          </div>
        )}

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
            <Suspense
              fallback={<div className="h-[420px] w-full animate-pulse rounded-lg border bg-muted sm:h-[460px]" aria-label="Loading 3D preview" />}
            >
              <StlModelPreview
                buffer={currentPreviewBuffer}
                bedSize={bedSize}
                materialName={selectedMaterial?.name ?? null}
                materialCode={selectedMaterial?.code ?? null}
                colorHint={previewColor?.color_hex ?? previewColor?.color ?? previewColor?.colour ?? null}
                layerHeightMm={Number.isFinite(previewLayerHeight) && previewLayerHeight > 0 ? previewLayerHeight : null}
                sizeCheck={
                  sizeLimit && currentSizeCheck?.size
                    ? {
                        tooLarge: !!currentSizeCheck.error,
                        rotated: currentSizeCheck.rotated,
                        limitLabel: formatPrintSizeLimit(sizeLimit),
                      }
                    : null
                }
                stats={
                  currentPreviewItem
                    ? {
                        weightGrams: currentPreviewItem.weightGramsEach,
                        timeMinutes: currentPreviewItem.timeMinutesEach,
                        quantity: currentPreviewItem.quantity,
                      }
                    : null
                }
              />
            </Suspense>
          </div>
        )}

        {completedItems.length > 0 && !analyzingStl && !recalculating && (
          <>
            <Separator />
            <div className="space-y-2" data-testid="print-parts">
              <p className="text-sm font-medium">
                {completedItems.length > 1 ? `Parts (${completedItems.length})` : "Part"}
              </p>
              <div className="divide-y rounded-md border">
                {completedItems.map((item, idx) => {
                  const draft = partDraft(item);
                  const zipIdx = zipStlEntries.findIndex((e) => e.filename.toLowerCase() === item.filename.toLowerCase());
                  const previewIdx = zipIdx >= 0 ? zipIdx : idx;
                  const canPreview = isZipUpload && zipStlEntries.length > 1;
                  const isActive = canPreview && previewIdx === previewIndex;
                  return (
                    <div
                      key={item.id}
                      data-testid={`print-part-${item.id}`}
                      className={cn("space-y-2 p-3", isActive && "bg-primary/10")}
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`print-part-name-${item.id}`}>
                            Part name
                          </Label>
                          <Input
                            id={`print-part-name-${item.id}`}
                            value={draft.name}
                            maxLength={255}
                            disabled={disabled}
                            onFocus={() => canPreview && goToPreview(previewIdx)}
                            onChange={(e) =>
                              setPartDrafts((d) => ({ ...d, [item.id]: { ...partDraft(item), name: e.target.value } }))
                            }
                            onBlur={() => void commitPartName(item)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`print-part-qty-${item.id}`}>
                            Copies
                          </Label>
                          <Input
                            id={`print-part-qty-${item.id}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={draft.qty}
                            disabled={disabled}
                            onFocus={() => canPreview && goToPreview(previewIdx)}
                            onChange={(e) =>
                              setPartDrafts((d) => ({ ...d, [item.id]: { ...partDraft(item), qty: e.target.value } }))
                            }
                            onBlur={() => void commitPartQty(item)}
                          />
                        </div>
                      </div>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="truncate">{item.filename}</span>
                        <span>
                          {formatPrintWeightGrams(item.weightGramsEach)} · {item.timeMinutesEach} min each
                        </span>
                        {item.quantity > 1 && (
                          <span className="font-medium text-foreground" data-testid="print-part-total">
                            × {item.quantity} = {formatPrintWeightGrams(item.weightGrams)} · {item.timeMinutes} min
                          </span>
                        )}
                        {savingPartIds.has(item.id) && <span>Saving…</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total weight</dt>
                  <dd className="font-medium" data-testid="print-total-weight">
                    {formatPrintWeightGrams(totals.weight)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total print time</dt>
                  <dd className="font-medium" data-testid="print-total-time">
                    {totals.time} min
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Density</dt>
                  <dd className="font-medium">{density}%</dd>
                </div>
                {completedItems.length === 1 && analysis?.analysis_method ? (
                  <div>
                    <dt className="text-muted-foreground">Method</dt>
                    <dd className="font-medium">{analysis.analysis_method}</dd>
                  </div>
                ) : null}
                {completedItems.length === 1 && analysis?.volume_cm3 != null ? (
                  <div>
                    <dt className="text-muted-foreground">Volume (one copy)</dt>
                    <dd className="font-medium">{Number(analysis.volume_cm3).toFixed(2)} cm³</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </>
        )}
        {ownMaterialAvailable && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox
              checked={ownMaterial}
              onCheckedChange={(v) => setOwnMaterial(v === true)}
              disabled={disabled}
              aria-label="I will bring my own printing material"
            />
            <span>
              I will bring my own printing material.
              <span className="block text-xs text-muted-foreground">
                A fixed charge of ₹{Number(ownMaterialCharge).toFixed(2)} replaces the material cost.
              </span>
            </span>
          </label>
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
