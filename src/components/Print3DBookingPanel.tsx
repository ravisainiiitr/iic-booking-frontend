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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatINRAmount } from "@/lib/money";
import {
  apiClient,
  type PrintAnalysisBatchResult,
  type PrintAnalysisResult,
  type PrintEstimateBreakdown,
  type PrintMaterial,
  type PrintOrientationComparison,
  type PrintSupportDefaults,
  type PrintSupportMode,
  type PrintSupportSettings,
} from "@/lib/api";
import {
  PRINT_ESTIMATE_NOTE,
  SUPPORT_MODE_OPTIONS,
  formatAreaMm2,
  formatPrintDuration,
  printEstimateSummary,
  sumPrintEstimates,
  supportModeSummary,
  type PrintEstimateTotals,
} from "@/lib/printEstimate";
import { extractStlFilesFromZip, type ZipStlEntry } from "@/lib/extractZipStlFiles";
import { NO_FABRICATION_MATERIALS_MESSAGE } from "@/lib/fabricationProfiles";
import {
  LIVE_INPUT_DEBOUNCE_MS,
  OWN_PRINT_UPLOAD_HINT,
  ownMaterialChargeNote,
  parseWholeQuantity,
  printModelSize,
} from "@/lib/ownMaterialSizing";
import {
  checkStlSize,
  fitsPrintSize,
  formatPrintSize,
  formatPrintSizeLimit,
  previewBedSize,
  printSizeLimitFrom,
  type MaxPrintSizePayload,
  type PrintSizeLimit,
  type Size3,
  type StlSizeCheck,
} from "@/lib/printSizeLimit";
import {
  describeOrientation,
  largestFlatFace,
  layFlat,
  normalizeOrientation,
  orientationKey,
  sameOrientation,
  type Orientation,
  type Vec3,
} from "@/lib/preview3d/orientation";
import type { StlMeshData } from "@/lib/preview3d/stlMesh";
import type { SupportViewMode } from "@/lib/preview3d/supportGeometry";
import { PrintOrientationControls, orientationHint } from "@/components/PrintOrientationControls";
import { StlThumbnail } from "@/components/preview3d/StlThumbnail";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Lightbulb,
  Loader2,
  Ruler,
  Upload,
  X,
} from "lucide-react";

// three.js viewer: loaded only when a model is previewed (this module is also imported for helpers).
const StlModelPreview = lazy(() =>
  import("@/components/StlModelPreview").then((m) => ({ default: m.StlModelPreview })),
);

const MAX_STL_BYTES = 100 * 1024 * 1024;
const SETTINGS_RECALC_DEBOUNCE_MS = 400;
const ORIENTATION_SAVE_DEBOUNCE_MS = 500;
const ORIENTATION_HINT_DELAY_MS = 800;
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
  /** Supports in a separate support material, one copy (whole grams; 0 when printed in the model material). */
  supportWeightGramsEach?: number;
  supportMaterialCode?: string;
  /** Model breakdown of one copy (model / supports / waste, warm-up). */
  breakdown?: PrintEstimateBreakdown | null;
  /** Model size from the analysis ("X × Y × Z mm"), when known. */
  modelSize?: string | null;
  /** Placement on the plate chosen by the user (3×3 rotation, STL axes); null = as uploaded. */
  orientation?: number[] | null;
  /** W × D × H of the model as placed (from the server analysis). */
  sizeMm?: Size3 | null;
}

export interface Print3DBookingValues {
  analysisId?: string;
  batchId?: string;
  /** Totals for all files and copies (model material, including supports printed in it). */
  weightGrams: number;
  materialCode: string;
  timeMinutes: number;
  /** Separate support material, totals for all files and copies (0 when supports use the model material). */
  supportWeightGrams?: number;
  supportMaterialCode?: string;
  /** The support choice sent with the files. */
  supports?: PrintSupportSettings;
  items: Print3DFileItem[];
  /** Changes whenever quantities, material or the own-material choice change. */
  partsKey: string;
  ownMaterial: boolean;
}

interface Print3DBookingPanelProps {
  equipmentId: number | string;
  materials?: PrintMaterial[];
  /** Preview build plate when the printer has no maximum print size (default 220 × 220 × 250 mm). */
  bedSize?: { x: number; y: number; z: number };
  /** Equipment's maximum print size (`max_print_size` of the detail API); when omitted it comes with the materials. */
  maxPrintSize?: MaxPrintSizePayload | null;
  /** When set (charge estimate), load materials for this user type without login. */
  estimateUserType?: string;
  /** Equipment's fixed own-material charge; null/undefined hides the option. */
  ownMaterialCharge?: string | number | null;
  /** Quantity Required (input A): the whole job is printed this many times. */
  jobQuantity?: number;
  onReady: (values: Print3DBookingValues | null) => void;
  /** True while the STL is analysed or re-estimated. */
  onAnalyzingChange?: (analyzing: boolean) => void;
  /** True while typed copies wait to be saved or are being saved (the charge is refreshed after). */
  onUpdatingChange?: (updating: boolean) => void;
  /** Why the chosen file(s) cannot be booked (larger than the printer's maximum print size), or null. */
  onSizeBlockChange?: (message: string | null) => void;
  /** Charge worked out by the page for the current files (shown in the estimate summary). */
  charge?: { amount: string | number | null; loading?: boolean } | null;
  disabled?: boolean;
}

export function printSizeBlockMessage(errors: string[], serverError: string | null): string | null {
  if (errors.length > 1) return `${errors.length} models are too large for this printer. ${errors[0]}`;
  return errors[0] ?? serverError ?? null;
}

export function print3DItemFromAnalysis(a: PrintAnalysisResult, fallbackFilename?: string): Print3DFileItem {
  const filename = a.stl_filename || fallbackFilename || "model.stl";
  const quantity = Math.max(1, Math.floor(Number(a.quantity) || 1));
  const weightEach = ceilPrintWeightGrams(a.weight_grams);
  const timeEach = Number(a.estimated_time_minutes ?? 0);
  const breakdown = a.estimate_breakdown ?? null;
  const supportCode = breakdown?.support_material_code || "";
  const rawOrientation = a.slicer_settings?.orientation;
  const size = (a.bounding_box as { size?: Record<string, unknown> } | undefined)?.size;
  const sizeMm = size ? ([Number(size.x), Number(size.y), Number(size.z)] as Size3) : null;
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
    supportWeightGramsEach: supportCode ? ceilPrintWeightGrams(breakdown?.support_material_g) : 0,
    supportMaterialCode: supportCode,
    breakdown,
    modelSize: printModelSize(a.bounding_box),
    orientation: Array.isArray(rawOrientation) ? normalizeOrientation(rawOrientation.map(Number)) : null,
    sizeMm: sizeMm && sizeMm.every((v) => Number.isFinite(v)) ? sizeMm : null,
  };
}

/** Too-large message for a part the user turned (the server refuses to book it). */
export function orientedSizeError(item: Print3DFileItem, limit: PrintSizeLimit | null): string | null {
  if (!limit || !item.orientation || !item.sizeMm || fitsPrintSize(item.sizeMm, limit)) return null;
  return (
    `${item.filename} turned this way is ${formatPrintSize(item.sizeMm)} (W × D × H), larger than this printer's ` +
    `maximum print size of ${formatPrintSizeLimit(limit)}. Choose another orientation.`
  );
}

export const COPIES_DRAFT_ERROR = "Number of copies must be a whole number of at least 1.";

function withId(set: Set<string>, id: string, on: boolean): Set<string> {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
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
  bedSize: defaultBedSize,
  maxPrintSize,
  estimateUserType,
  ownMaterialCharge,
  jobQuantity = 1,
  onReady,
  onAnalyzingChange,
  onUpdatingChange,
  onSizeBlockChange,
  charge,
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
  const batchRef = useRef<PrintAnalysisBatchResult | null>(null);
  batchRef.current = batch;
  const analysisRef = useRef<PrintAnalysisResult | null>(null);
  analysisRef.current = analysis;
  /** Parts whose typed copies are waiting for the debounce before they are saved. */
  const [pendingQtyIds, setPendingQtyIds] = useState<Set<string>>(new Set());
  const qtyTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const qtyInFlightRef = useRef<Record<string, boolean>>({});
  const qtyQueuedRef = useRef<Record<string, number | undefined>>({});
  const [fetchedMaxPrintSize, setFetchedMaxPrintSize] = useState<MaxPrintSizePayload | null>(null);
  const [sizeChecks, setSizeChecks] = useState<StlSizeCheck[]>([]);
  const [serverSizeError, setServerSizeError] = useState<string | null>(null);
  const initialPreviewIndexRef = useRef(0);
  const [supportDefaults, setSupportDefaults] = useState<PrintSupportDefaults | null>(null);
  const [supportMaterials, setSupportMaterials] = useState<PrintMaterial[]>([]);
  const [supportMode, setSupportMode] = useState<PrintSupportMode>("auto");
  const [supportAdvanced, setSupportAdvanced] = useState(false);
  /** null = the printer profile's default. */
  const [supportDensity, setSupportDensity] = useState<number | null>(null);
  const [supportAngle, setSupportAngle] = useState<number | null>(null);
  const [supportMaterialId, setSupportMaterialId] = useState("same");
  const supportSettings = useMemo<PrintSupportSettings>(
    () => ({
      support_mode: supportMode,
      support_density_pct: supportDensity,
      support_angle_deg: supportAngle,
      support_material_id: supportMaterialId === "same" ? null : Number(supportMaterialId),
    }),
    [supportMode, supportDensity, supportAngle, supportMaterialId],
  );
  const supportSettingsRef = useRef(supportSettings);
  supportSettingsRef.current = supportSettings;
  const supportKey = JSON.stringify(supportSettings);
  // Orientation per part: drawn at once, saved (and re-estimated) after a short pause.
  const [orientationDrafts, setOrientationDrafts] = useState<Record<string, Orientation>>({});
  const [orientingIds, setOrientingIds] = useState<Set<string>>(new Set());
  const orientationTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [pickFace, setPickFace] = useState(false);
  const [placedMesh, setPlacedMesh] = useState<StlMeshData | null>(null);
  const [comparison, setComparison] = useState<{
    key: string;
    data: PrintOrientationComparison | null;
    error: string | null;
  } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const analysisRef = useRef<PrintAnalysisResult | null>(null);
  const batchRef = useRef<PrintAnalysisBatchResult | null>(null);

  const sizeLimit = useMemo(
    () => printSizeLimitFrom(maxPrintSize !== undefined ? maxPrintSize : fetchedMaxPrintSize),
    [maxPrintSize, fetchedMaxPrintSize],
  );
  const bedSize = sizeLimit || !defaultBedSize ? previewBedSize(sizeLimit) : defaultBedSize;
  const sizeErrors = sizeChecks.filter((c) => c.error);
  const sizeWarnings = sizeChecks.filter((c) => c.warning);
  const tooLarge = sizeErrors.length > 0;

  const ownMaterialAvailable =
    ownMaterialCharge !== null && ownMaterialCharge !== undefined && String(ownMaterialCharge) !== "";

  const busy = analyzingStl || recalculating;
  const orienting = orientingIds.size > 0 || Object.keys(orientationDrafts).length > 0;
  const updating = savingPartIds.size > 0 || pendingQtyIds.size > 0 || orienting;
  const qtyDraftInvalid = Object.values(partDrafts).some((d) => parseWholeQuantity(d.qty) === null);
  /** While copies are being typed or saved, the booking page gets no values, so no stale charge is shown. */
  const holdReady = updating || qtyDraftInvalid;
  const holdReadyRef = useRef(false);
  holdReadyRef.current = holdReady;

  useEffect(() => {
    onAnalyzingChange?.(busy);
  }, [busy, onAnalyzingChange]);
  useEffect(() => {
    onUpdatingChange?.(updating);
  }, [updating, onUpdatingChange]);
  useEffect(() => () => onUpdatingChange?.(false), [onUpdatingChange]);
  useEffect(() => () => Object.values(qtyTimersRef.current).forEach(clearTimeout), []);
  const cancelQtyEdits = useCallback(() => {
    Object.values(qtyTimersRef.current).forEach(clearTimeout);
    qtyTimersRef.current = {};
    setPendingQtyIds(new Set());
  }, []);

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

  const hasMaterialsProp = Boolean(materialsProp?.length);
  useEffect(() => {
    // Also fetched when the page passes the materials: the printer's support options come with them.
    const userTypeOpts = estimateUserType ? { user_type: estimateUserType } : undefined;
    let cancelled = false;
    void Promise.resolve(apiClient.getEquipmentPrintMaterials(equipmentId, userTypeOpts)).then((res) => {
      if (cancelled || !res) return;
      setSupportDefaults(res.data?.support_defaults ?? null);
      setSupportMaterials(res.data?.support_materials ?? []);
      if (hasMaterialsProp) return;
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
    return () => {
      cancelled = true;
    };
  }, [equipmentId, hasMaterialsProp, estimateUserType]);

  useEffect(() => {
    if (supportMaterialId !== "same" && !supportMaterials.some((m) => String(m.id) === supportMaterialId)) {
      setSupportMaterialId("same");
    }
  }, [supportMaterials, supportMaterialId]);

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
  analysisRef.current = analysis;
  batchRef.current = batch;

  const orientedSizeErrors = useMemo(
    () => completedItems.map((i) => orientedSizeError(i, sizeLimit)).filter((e): e is string => !!e),
    [completedItems, sizeLimit],
  );
  const sizeBlock = printSizeBlockMessage(
    [...sizeErrors.map((c) => c.error as string), ...orientedSizeErrors],
    serverSizeError,
  );

  useEffect(() => {
    onSizeBlockChange?.(sizeBlock);
  }, [sizeBlock, onSizeBlockChange]);

  useEffect(() => () => onSizeBlockChange?.(null), [onSizeBlockChange]);

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
      if (holdReadyRef.current) {
        onReady(null);
        return;
      }
      const totalWeight = items.reduce((sum, i) => sum + i.weightGrams, 0);
      const totalTime = items.reduce((sum, i) => sum + i.timeMinutes, 0);
      const supportWeight = items.reduce((sum, i) => sum + (i.supportWeightGramsEach ?? 0) * i.quantity, 0);
      const supportCode = items.find((i) => i.supportMaterialCode)?.supportMaterialCode ?? "";
      const own = ownMaterialRef.current;
      onReady({
        analysisId: items.length === 1 ? items[0].id : analysisIdRef.current ?? undefined,
        batchId: batchIdRef.current ?? undefined,
        weightGrams: totalWeight,
        materialCode,
        timeMinutes: totalTime,
        supportWeightGrams: supportWeight,
        supportMaterialCode: supportCode,
        supports: supportSettingsRef.current,
        items,
        partsKey: JSON.stringify([
          own,
          materialCode,
          items.map((i) => [
            i.id,
            i.quantity,
            i.weightGramsEach,
            i.timeMinutesEach,
            i.supportWeightGramsEach ?? 0,
            orientationKey(i.orientation),
          ]),
          supportCode,
        ]),
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
    // Only the own-material choice and the end of a copies edit re-emit here; file and material changes emit
    // from their own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownMaterial, holdReady]);

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

  /** Merge a saved part into the current (latest) batch or analysis and re-emit the totals. */
  const mergeSavedPart = useCallback(
    (updated: PrintAnalysisResult) => {
      const merge = (a: PrintAnalysisResult): PrintAnalysisResult =>
        a.id === updated.id
          ? { ...a, part_name: updated.part_name, display_part_name: updated.display_part_name, quantity: updated.quantity }
          : a;
      const code = lastReadyRef.current?.code;
      const currentBatch = batchRef.current;
      const currentAnalysis = analysisRef.current;
      if (currentBatch) {
        const nextBatch = { ...currentBatch, items: currentBatch.items.map(merge) };
        batchRef.current = nextBatch;
        setBatch(nextBatch);
        if (code) applyReadyValues(buildItemsFromBatch(nextBatch), code);
      } else if (currentAnalysis) {
        const next = merge(currentAnalysis);
        analysisRef.current = next;
        setAnalysis(next);
        if (code) applyReadyValues([print3DItemFromAnalysis(next, file?.name)], code);
      }
    },
    [applyReadyValues, file?.name],
  );

  const savePart = useCallback(
    async (itemId: string, data: { part_name?: string; quantity?: number }) => {
      setSavingPartIds((s) => withId(s, itemId, true));
      try {
        const res = await apiClient.updatePrintAnalysisPart(itemId, data);
        if (res.error || !res.data) {
          toast.error(res.error || "Could not update the part.");
          return false;
        }
        mergeSavedPart(res.data);
        return true;
      } finally {
        setSavingPartIds((s) => withId(s, itemId, false));
      }
    },
    [mergeSavedPart],
  );

  /** One copies save per part at a time; a value typed meanwhile is sent next and only the last answer counts. */
  const sendQty = async (itemId: string, qty: number) => {
    if (qtyInFlightRef.current[itemId]) {
      qtyQueuedRef.current[itemId] = qty;
      return;
    }
    qtyInFlightRef.current[itemId] = true;
    setSavingPartIds((s) => withId(s, itemId, true));
    let saved: PrintAnalysisResult | null = null;
    let error: string | null = null;
    try {
      let next: number | undefined = qty;
      while (next !== undefined) {
        qtyQueuedRef.current[itemId] = undefined;
        const res = await apiClient.updatePrintAnalysisPart(itemId, { quantity: next });
        if (res.error || !res.data) error = res.error || "Could not update the part.";
        else {
          saved = res.data;
          error = null;
        }
        next = qtyQueuedRef.current[itemId];
      }
    } finally {
      qtyInFlightRef.current[itemId] = false;
      if (saved) mergeSavedPart(saved);
      if (error) {
        toast.error(error);
        const known = saved?.quantity ?? lastReadyRef.current?.items.find((i) => i.id === itemId)?.quantity;
        if (known != null) {
          setPartDrafts((d) => (d[itemId] ? { ...d, [itemId]: { ...d[itemId], qty: String(known) } } : d));
        }
      }
      setSavingPartIds((s) => withId(s, itemId, false));
    }
  };

  const partDraft = (item: Print3DFileItem) => partDrafts[item.id] ?? { name: item.partName, qty: String(item.quantity) };

  const commitPartName = async (item: Print3DFileItem) => {
    const draft = partDrafts[item.id];
    if (!draft || draft.name.trim() === item.partName) return;
    await savePart(item.id, { part_name: draft.name.trim() });
  };

  const setQtyPending = (id: string, on: boolean) => setPendingQtyIds((s) => withId(s, id, on));

  /** Typing (or the number box arrows): save the copies once the user pauses, which refreshes the charge. */
  const onPartQtyChange = (item: Print3DFileItem, text: string) => {
    setPartDrafts((d) => ({ ...d, [item.id]: { ...partDraft(item), ...d[item.id], qty: text } }));
    clearTimeout(qtyTimersRef.current[item.id]);
    delete qtyTimersRef.current[item.id];
    const qty = parseWholeQuantity(text);
    if (qty === null || (qty === item.quantity && !qtyInFlightRef.current[item.id])) {
      setQtyPending(item.id, false);
      return;
    }
    setQtyPending(item.id, true);
    qtyTimersRef.current[item.id] = setTimeout(() => {
      delete qtyTimersRef.current[item.id];
      setQtyPending(item.id, false);
      void sendQty(item.id, qty);
    }, LIVE_INPUT_DEBOUNCE_MS);
  };

  const commitPartQty = (item: Print3DFileItem) => {
    const draft = partDrafts[item.id];
    if (!draft) return;
    const qty = parseWholeQuantity(draft.qty);
    if (qty === null) {
      toast.error(COPIES_DRAFT_ERROR);
      setPartDrafts((d) => ({ ...d, [item.id]: { ...draft, qty: String(item.quantity) } }));
      return;
    }
    if (qtyTimersRef.current[item.id]) {
      clearTimeout(qtyTimersRef.current[item.id]);
      delete qtyTimersRef.current[item.id];
      setQtyPending(item.id, false);
      void sendQty(item.id, qty);
    }
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
      cancelQtyEdits();
      setServerSizeError(null);
      clearReady();

      try {
        const res = await apiClient.analyzeEquipmentStl(equipmentId, {
          file: selectedFile,
          material_id: materialId,
          density_percent: density,
          supports: supportSettingsRef.current,
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
    [applyBatchAnalysis, applySingleAnalysis, cancelQtyEdits, clearReady, density, equipmentId, materialId],
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
          supports: supportSettingsRef.current,
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
        supports: supportSettingsRef.current,
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
  }, [density, materialId, supportKey, analyzingStl, disabled]);

  /** Put one re-estimated file back into the single analysis or the batch. */
  const mergeAnalysisResult = useCallback(
    (updated: PrintAnalysisResult) => {
      const code = lastReadyRef.current?.code || updated.material_code_snapshot || "";
      const currentBatch = batchRef.current;
      if (currentBatch) {
        const nextBatch = {
          ...currentBatch,
          items: currentBatch.items.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
        };
        batchRef.current = nextBatch;
        setBatch(nextBatch);
        if (code) applyReadyValues(buildItemsFromBatch(nextBatch), code);
        return;
      }
      if (analysisRef.current?.id === updated.id) {
        analysisRef.current = updated;
        setAnalysis(updated);
        if (code) applyReadyValues([print3DItemFromAnalysis(updated, file?.name)], code);
      }
    },
    [applyReadyValues, file?.name],
  );

  const dropOrientationDraft = (itemId: string, sent: Orientation) =>
    setOrientationDrafts((d) => {
      if (!(itemId in d) || !sameOrientation(d[itemId], sent)) return d;
      const next = { ...d };
      delete next[itemId];
      return next;
    });

  const saveOrientation = async (itemId: string, next: Orientation) => {
    if (!materialId) {
      dropOrientationDraft(itemId, next);
      return;
    }
    setOrientingIds((s) => new Set(s).add(itemId));
    try {
      const res = await apiClient.recalculatePrintAnalysis(itemId, {
        material_id: materialId,
        density_percent: density,
        supports: supportSettingsRef.current,
        orientation: next,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not update the estimate for this orientation.");
        return;
      }
      mergeAnalysisResult(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the estimate for this orientation.");
    } finally {
      dropOrientationDraft(itemId, next);
      setOrientingIds((s) => {
        const rest = new Set(s);
        rest.delete(itemId);
        return rest;
      });
    }
  };
  const saveOrientationRef = useRef(saveOrientation);
  saveOrientationRef.current = saveOrientation;

  const changeOrientation = useCallback((itemId: string, next: Orientation) => {
    const value = normalizeOrientation(next);
    setOrientationDrafts((d) => ({ ...d, [itemId]: value }));
    setPickFace(false);
    const timers = orientationTimersRef.current;
    if (timers[itemId]) clearTimeout(timers[itemId]);
    timers[itemId] = setTimeout(() => {
      delete timers[itemId];
      void saveOrientationRef.current(itemId, value);
    }, ORIENTATION_SAVE_DEBOUNCE_MS);
  }, []);

  const resetOrientationState = () => {
    for (const t of Object.values(orientationTimersRef.current)) clearTimeout(t);
    orientationTimersRef.current = {};
    setOrientationDrafts({});
    setPickFace(false);
    setComparison(null);
    setShowComparison(false);
  };

  useEffect(
    () => () => {
      for (const t of Object.values(orientationTimersRef.current)) clearTimeout(t);
    },
    [],
  );

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
    resetOrientationState();
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
    cancelQtyEdits();
    setSizeChecks([]);
    setServerSizeError(null);
    resetOrientationState();
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

  const sets = Math.max(1, Math.floor(jobQuantity) || 1);
  const totals = useMemo(() => {
    const weight = completedItems.reduce((s, i) => s + i.weightGrams, 0) * sets;
    const time = completedItems.reduce((s, i) => s + i.timeMinutes, 0) * sets;
    const supportWeight = completedItems.reduce((s, i) => s + (i.supportWeightGramsEach ?? 0) * i.quantity, 0) * sets;
    return { weight, time, supportWeight };
  }, [completedItems, sets]);
  const estimateTotals = useMemo(() => sumPrintEstimates(completedItems, sets), [completedItems, sets]);
  const supportCode = completedItems.find((i) => i.supportMaterialCode)?.supportMaterialCode ?? "";
  const supportsAvailable = supportDefaults?.supports_available === true;
  const supportModesSelectable = supportsAvailable && supportDefaults?.modes_selectable !== false;
  const defaultSupportDensity = supportDefaults?.density_pct ?? 15;
  const defaultSupportAngle = supportDefaults?.angle_deg ?? 45;
  const [angleMin, angleMax] = supportDefaults?.angle_range ?? [30, 70];

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
  const currentItemId = currentPreviewItem?.id ?? null;
  const currentDraftPending = !!currentItemId && currentItemId in orientationDrafts;
  const currentOrientation: Orientation = currentPreviewItem
    ? currentDraftPending
      ? orientationDrafts[currentPreviewItem.id]
      : currentPreviewItem.orientation ?? null
    : null;
  const largestFace = useMemo(() => (placedMesh ? largestFlatFace(placedMesh.positions) : null), [placedMesh]);
  const orientationEnabled = !!currentPreviewItem && !analyzingStl && !disabled;

  const comparisonKey = currentPreviewItem
    ? [currentPreviewItem.id, orientationKey(currentPreviewItem.orientation), materialId, density, supportKey].join("|")
    : "";
  const comparisonKeyRef = useRef(comparisonKey);
  comparisonKeyRef.current = comparisonKey;
  const fetchComparison = useCallback(async () => {
    const key = comparisonKeyRef.current;
    const itemId = key.split("|")[0];
    if (!itemId) return;
    setComparing(true);
    try {
      const res = await apiClient.getPrintAnalysisOrientations(itemId, {
        material_id: materialId,
        density_percent: density,
        supports: supportSettingsRef.current,
      });
      if (comparisonKeyRef.current !== key) return;
      setComparison({ key, data: res.data ?? null, error: res.data ? null : res.error || "Could not compare orientations." });
    } catch (e) {
      if (comparisonKeyRef.current === key) {
        setComparison({ key, data: null, error: e instanceof Error ? e.message : "Could not compare orientations." });
      }
    } finally {
      setComparing(false);
    }
  }, [density, materialId]);
  const currentComparison = comparison?.key === comparisonKey ? comparison : null;

  // Look for a better orientation in the background once the part is estimated (drives the hint).
  useEffect(() => {
    const wanted = supportsAvailable && supportMode !== "none";
    if (!comparisonKey || !wanted || busy || updating || comparison?.key === comparisonKey) return;
    const timer = setTimeout(() => void fetchComparison(), ORIENTATION_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [comparisonKey, supportsAvailable, supportMode, busy, updating, comparison?.key, fetchComparison]);

  const onCompare = () => {
    if (!currentComparison?.data) void fetchComparison();
  };
  const hint =
    !showComparison && !currentDraftPending && supportMode !== "none"
      ? orientationHint(currentComparison?.data ?? null)
      : null;
  const applySuggested = () => {
    const data = currentComparison?.data;
    if (!data || !currentPreviewItem) return;
    changeOrientation(currentPreviewItem.id, data.candidates[data.best_index]?.orientation ?? null);
  };

  const previewBreakdown = currentPreviewItem?.breakdown ?? null;
  const previewSupports = useMemo(() => {
    if (!supportsAvailable) return null;
    let mode: SupportViewMode;
    if (!supportModesSelectable) mode = (previewBreakdown?.support_mode as SupportViewMode | undefined) ?? "everywhere";
    else if (supportMode !== "auto") mode = supportMode;
    else mode = previewBreakdown && !currentDraftPending ? (previewBreakdown.support_mode as SupportViewMode) : "buildplate";
    const angle = supportAngle ?? previewBreakdown?.support_angle_deg ?? defaultSupportAngle;
    const supportG = previewBreakdown?.support_g ?? 0;
    const summary =
      currentDraftPending || orientingIds.has(currentItemId ?? "")
        ? "Supports: updating…"
        : previewBreakdown && supportG > 0.05
          ? `Supports ~${supportG < 10 ? supportG.toFixed(1) : Math.round(supportG)} g${
              previewBreakdown.support_material_code ? ` (${previewBreakdown.support_material_code})` : ""
            }`
          : null;
    return {
      mode,
      angleDeg: angle,
      color: supportMaterialId !== "same" ? "#f59e0b" : null,
      summary,
    };
  }, [
    supportsAvailable,
    supportModesSelectable,
    supportMode,
    previewBreakdown,
    currentDraftPending,
    supportAngle,
    defaultSupportAngle,
    orientingIds,
    currentItemId,
    supportMaterialId,
  ]);
  const previewTimeline = previewBreakdown
    ? {
        progress: previewBreakdown.progress ?? null,
        printMinutes: previewBreakdown.total_min,
        warmupMinutes: previewBreakdown.warmup_min,
      }
    : currentPreviewItem
      ? { printMinutes: currentPreviewItem.timeMinutesEach }
      : null;
  const onFacePicked = (normal: Vec3) => {
    if (currentPreviewItem) changeOrientation(currentPreviewItem.id, layFlat(currentOrientation, normal));
  };

  useEffect(() => {
    setPreviewIndex(initialPreviewIndexRef.current);
    initialPreviewIndexRef.current = 0;
  }, [file?.name, previewEntries.length]);

  const goToPreview = (index: number) => {
    if (previewEntries.length === 0) return;
    setPreviewIndex(Math.max(0, Math.min(index, previewEntries.length - 1)));
  };

  const hasParts = completedItems.length > 0;
  const materialSection = (
    <>
      <div className="space-y-2">
        <Label htmlFor="print-material">Material</Label>
        <Select value={materialId} onValueChange={setMaterialId} disabled={disabled || analyzingStl}>
          <SelectTrigger id="print-material">
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
          aria-label="Density"
        />
      </div>
    </>
  );

  const supportsSection = supportsAvailable ? (
          <div className="space-y-3 rounded-md border p-3" data-testid="print-supports">
            <div className="space-y-2">
              <Label htmlFor="print-support-mode">Supports</Label>
              {supportModesSelectable ? (
                <Select
                  value={supportMode}
                  onValueChange={(v) => setSupportMode(v as PrintSupportMode)}
                  disabled={disabled || analyzingStl}
                >
                  <SelectTrigger id="print-support-mode" data-testid="print-support-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">This printer always prints supports wherever the model needs them.</p>
              )}
              {supportModesSelectable && (
                <p className="text-xs text-muted-foreground">
                  {SUPPORT_MODE_OPTIONS.find((o) => o.value === supportMode)?.hint}
                </p>
              )}
              {estimateTotals && (
                <p className="text-xs text-muted-foreground" data-testid="print-overhangs">
                  {estimateTotals.overhangAreaMm2 >= 1
                    ? `Detected overhangs: ${formatAreaMm2(estimateTotals.overhangAreaMm2)} (${formatAreaMm2(
                        estimateTotals.overhangPlateMm2,
                      )} with a clear path to the build plate)`
                    : "No overhangs that need support were detected."}
                  {" · "}Estimated with: <span className="font-medium text-foreground">{supportModeSummary(estimateTotals)}</span>
                </p>
              )}
            </div>

            {supportMaterials.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="print-support-material">Support material</Label>
                <Select value={supportMaterialId} onValueChange={setSupportMaterialId} disabled={disabled || analyzingStl}>
                  <SelectTrigger id="print-support-material" data-testid="print-support-material">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Same as model material</SelectItem>
                    {supportMaterials.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name} — ₹{m.price_per_gram}/g
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {supportModesSelectable && (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  aria-expanded={supportAdvanced}
                  onClick={() => setSupportAdvanced((v) => !v)}
                  data-testid="print-support-advanced-toggle"
                >
                  {supportAdvanced ? "Hide advanced support settings" : "Advanced support settings"}
                </Button>
                {supportAdvanced && (
                  <div className="space-y-4" data-testid="print-support-advanced">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Support density</Label>
                        <span className="text-muted-foreground" data-testid="print-support-density">
                          {supportDensity ?? defaultSupportDensity}%{supportDensity == null ? " (printer default)" : ""}
                        </span>
                      </div>
                      <Slider
                        min={5}
                        max={40}
                        step={1}
                        value={[supportDensity ?? defaultSupportDensity]}
                        onValueChange={([v]) => setSupportDensity(v)}
                        disabled={disabled || analyzingStl}
                        aria-label="Support density"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Overhang angle threshold</Label>
                        <span className="text-muted-foreground" data-testid="print-support-angle">
                          {supportAngle ?? defaultSupportAngle}°{supportAngle == null ? " (default)" : ""}
                        </span>
                      </div>
                      <Slider
                        min={angleMin}
                        max={angleMax}
                        step={5}
                        value={[supportAngle ?? defaultSupportAngle]}
                        onValueChange={([v]) => setSupportAngle(v)}
                        disabled={disabled || analyzingStl}
                        aria-label="Overhang angle threshold"
                      />
                      <p className="text-xs text-muted-foreground">
                        Surfaces leaning further than this from vertical get supports; a larger angle means fewer supports.
                      </p>
                    </div>
                    {(supportDensity != null || supportAngle != null) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSupportDensity(null);
                          setSupportAngle(null);
                        }}
                        disabled={disabled || analyzingStl}
                      >
                        Use printer defaults
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
  ) : null;

  return (
    <Card className="mb-6 border-primary/20" data-testid="print-3d-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">3D print: upload, orient and estimate</CardTitle>
        <CardDescription>
          Upload a single STL or a ZIP of several STL files, place each part on the printer&apos;s plate the way it
          should be printed, then pick the material. Weight, supports, time and charges update as you go.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm font-bold text-amber-900">{PRINT_3D_TENTATIVE_CHARGE_NOTE}</p>

        <section className="space-y-4" aria-labelledby="print-step-upload">
        <PrintStepHeading id="print-step-upload" step={1} title="Upload your model" done={!!file && !tooLarge && !serverSizeError} />
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
        </section>

        <section className="space-y-4" aria-labelledby="print-step-orient">
        <PrintStepHeading
          id="print-step-orient"
          step={2}
          title="Orient & supports"
          done={hasParts && !orientedSizeErrors.length}
          detail={previewEntries.length ? undefined : "Upload a model to see it on the printer's plate."}
        />
        {orientedSizeErrors.length > 0 && (
          <div
            role="alert"
            data-testid="print-orientation-size-error"
            className="flex gap-2 rounded-md border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <ul className="space-y-1">
              {orientedSizeErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {hint && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-info-border bg-info-subtle p-3 text-sm text-info-subtle-foreground"
            data-testid="print-orientation-hint"
            role="status"
          >
            <span className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {hint}
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowComparison(true)}>
                Compare
              </Button>
              <Button type="button" size="sm" onClick={applySuggested} disabled={!orientationEnabled}>
                Turn it
              </Button>
            </span>
          </div>
        )}
        <div className={cn("grid gap-4", previewEntries.length > 0 && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        {previewEntries.length > 0 && (
          <div className="min-w-0 space-y-2">
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
                orientation={currentOrientation}
                sizeLimit={sizeLimit}
                supports={previewSupports}
                timeline={previewTimeline}
                pickFace={pickFace && orientationEnabled}
                onFacePicked={onFacePicked}
                onMeshReady={setPlacedMesh}
              />
            </Suspense>
          </div>
        )}
        <div className="space-y-4">
          {currentPreviewItem ? (
            <PrintOrientationControls
              orientation={currentOrientation}
              onChange={(next) => changeOrientation(currentPreviewItem.id, next)}
              largestFace={largestFace}
              pickFace={pickFace}
              onPickFaceChange={setPickFace}
              comparison={currentComparison?.data ?? null}
              comparing={comparing}
              compareError={currentComparison?.error ?? null}
              onCompare={onCompare}
              showComparison={showComparison}
              onShowComparisonChange={setShowComparison}
              saving={currentDraftPending || orientingIds.has(currentPreviewItem.id)}
              disabled={!orientationEnabled}
            />
          ) : (
            previewEntries.length > 0 &&
            !tooLarge &&
            !serverSizeError && (
              <p className="text-sm text-muted-foreground" data-testid="print-orientation-waiting">
                You can turn the part to need fewer supports once it is analysed.
              </p>
            )
          )}
          {supportsSection}
        </div>
        </div>
        </section>

        <section className="space-y-4" aria-labelledby="print-step-material">
          <PrintStepHeading id="print-step-material" step={3} title="Material & settings" done={hasParts && !!materialId} />
          {materialSection}
        </section>

        <section className="space-y-4" aria-labelledby="print-step-estimate">
        <PrintStepHeading
          id="print-step-estimate"
          step={4}
          title="Estimate & charges"
          detail={hasParts ? undefined : "Weight, print time and charges appear once the model is analysed."}
        />
        {completedItems.length > 0 && !analyzingStl && (
          <>
            <div className={cn("space-y-2 transition-opacity", recalculating && "opacity-60")} data-testid="print-parts" aria-busy={recalculating}>
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
                  const itemOrientation = item.id in orientationDrafts ? orientationDrafts[item.id] : item.orientation ?? null;
                  return (
                    <div
                      key={item.id}
                      data-testid={`print-part-${item.id}`}
                      className={cn("flex gap-3 p-3", isActive && "bg-primary/10")}
                    >
                      <button
                        type="button"
                        className={cn(
                          "h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          (isActive || !canPreview) && "border-primary/50",
                        )}
                        onClick={() => goToPreview(previewIdx)}
                        aria-label={`Show ${item.partName} in the 3D preview`}
                        data-testid={`print-part-thumb-${item.id}`}
                      >
                        <StlThumbnail
                          buffer={previewEntries[previewIdx]?.buffer ?? null}
                          orientation={itemOrientation}
                          color={previewColor?.color_hex ?? previewColor?.color ?? previewColor?.colour ?? null}
                        />
                      </button>
                      <div className="min-w-0 flex-1 space-y-2">
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
                            onChange={(e) => onPartQtyChange(item, e.target.value)}
                            onBlur={() => commitPartQty(item)}
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
                        {itemOrientation && <span data-testid="print-part-orientation">{describeOrientation(itemOrientation)}</span>}
                        {(savingPartIds.has(item.id) || pendingQtyIds.has(item.id) || orientingIds.has(item.id)) && (
                          <span data-testid="print-part-updating">Updating…</span>
                        )}
                      </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sets > 1 && (
                <p className="text-sm text-muted-foreground" data-testid="print-job-quantity">
                  Quantity Required: <span className="font-medium text-foreground">{sets}</span> — totals below are for
                  all {sets} sets.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total weight</dt>
                  <dd className="font-medium" data-testid="print-total-weight">
                    {formatPrintWeightGrams(totals.weight)}
                  </dd>
                </div>
                {totals.supportWeight > 0 && (
                  <div>
                    <dt className="text-muted-foreground">Support material{supportCode ? ` (${supportCode})` : ""}</dt>
                    <dd className="font-medium" data-testid="print-total-support-weight">
                      {formatPrintWeightGrams(totals.supportWeight)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Total print time</dt>
                  <dd className="font-medium" data-testid="print-total-time">
                    {totals.time} min{totals.time >= 60 ? ` (${formatPrintDuration(totals.time)})` : ""}
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
              {estimateTotals && (
                <div className="rounded-md bg-muted/40 p-2 text-xs" data-testid="print-estimate-breakdown">
                  <p className="font-medium text-foreground">{printEstimateSummary(estimateTotals)}</p>
                  <p className="text-muted-foreground">
                    {PRINT_ESTIMATE_NOTE}
                    {estimateTotals.notes.length ? ` ${estimateTotals.notes.join(" ")}` : ""}
                  </p>
                </div>
              )}
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
                {ownMaterialChargeNote(ownMaterialCharge, "printing")}
              </span>
            </span>
          </label>
        )}
        {ownMaterialAvailable && ownMaterial && (
          <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm" data-testid="print-own-material-need">
            {completedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{OWN_PRINT_UPLOAD_HINT}</p>
            ) : (
              <>
                <p>
                  Material to bring:{" "}
                  <span className="font-semibold tabular-nums" data-testid="print-own-material-grams">
                    {formatPrintWeightGrams(totals.weight)}
                  </span>
                  {selectedMaterial ? ` of ${selectedMaterial.name}` : ""}
                  {totals.supportWeight > 0 && supportCode ? (
                    <span data-testid="print-own-material-support">
                      {" "}
                      + {formatPrintWeightGrams(totals.supportWeight)} of {supportCode} for supports
                    </span>
                  ) : null}
                  {holdReady || busy ? <span className="ml-2 text-xs text-muted-foreground">Updating…</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto-filled from the model estimate (model, supports and waste)
                  {completedItems.some((i) => i.quantity > 1) || sets > 1 ? " for every copy" : ""}
                  {sets > 1 ? ` and all ${sets} sets` : ""}. Bring a little extra in case a print has to be restarted.
                </p>
                {completedItems.some((i) => i.modelSize) && (
                  <ul className="text-xs text-muted-foreground" data-testid="print-own-material-sizes">
                    {completedItems
                      .filter((i) => i.modelSize)
                      .map((i) => (
                        <li key={i.id}>
                          {completedItems.length > 1 ? `${i.partName}: ` : "Model size: "}
                          {i.modelSize}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        {(analysis?.status === "FAILED" || batch?.status === "FAILED") && (
          <p className="text-sm text-destructive">
            {analysis?.error_message || batch?.error_message || "Analysis failed"}
          </p>
        )}
        </section>

        {hasParts && (
          <PrintEstimateBar
            weightGrams={totals.weight}
            supportWeightGrams={totals.supportWeight}
            supportCode={supportCode}
            timeMinutes={totals.time}
            totals={estimateTotals}
            updating={busy || holdReady}
            charge={charge}
            ownMaterial={ownMaterial}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PrintStepHeading({
  id,
  step,
  title,
  done,
  detail,
}: {
  id: string;
  step: number;
  title: string;
  done?: boolean;
  detail?: string;
}) {
  return (
    <div className="space-y-1 border-b pb-2">
      <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground",
          )}
          aria-hidden
        >
          {done ? <Check className="h-3.5 w-3.5" /> : step}
        </span>
        <span>
          <span className="sr-only">Step {step}: </span>
          {title}
        </span>
      </h3>
      {detail && <p className="pl-8 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/** Always-visible running estimate (sticks to the bottom of the screen while the user works on the part). */
export function PrintEstimateBar({
  weightGrams,
  supportWeightGrams,
  supportCode,
  timeMinutes,
  totals,
  updating,
  charge,
  ownMaterial,
}: {
  weightGrams: number;
  supportWeightGrams: number;
  supportCode: string;
  timeMinutes: number;
  totals: PrintEstimateTotals | null;
  updating: boolean;
  charge?: { amount: string | number | null; loading?: boolean } | null;
  ownMaterial: boolean;
}) {
  const split = totals
    ? [
        `model ${Math.round(totals.modelG * 10) / 10} g`,
        totals.supportG > 0.05 ? `supports ${Math.round(totals.supportG * 10) / 10} g` : null,
        totals.wasteG > 0.05 ? `waste ${Math.round(totals.wasteG * 10) / 10} g` : null,
      ].filter(Boolean)
    : [];
  const amount = charge?.amount;
  const hasAmount = amount !== null && amount !== undefined && amount !== "" && Number.isFinite(Number(amount));
  return (
    <div
      className="sticky bottom-0 z-10 -mx-2 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-0"
      data-testid="print-estimate-bar"
      aria-live="polite"
      aria-busy={updating}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-muted-foreground">Weight</dt>
          <dd className="font-semibold tabular-nums" data-testid="print-bar-weight">
            {formatPrintWeightGrams(weightGrams)}
            {supportWeightGrams > 0 ? ` + ${formatPrintWeightGrams(supportWeightGrams)}${supportCode ? ` ${supportCode}` : ""}` : ""}
            {split.length > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({split.join(" · ")})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Print time</dt>
          <dd className="font-semibold tabular-nums" data-testid="print-bar-time">
            {formatPrintDuration(timeMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Charge{ownMaterial ? " (own material)" : ""}</dt>
          <dd className="font-semibold tabular-nums" data-testid="print-bar-charge">
            {charge?.loading ? "Calculating…" : hasAmount ? formatINRAmount(amount as string | number) : "Shown with the booking"}
          </dd>
        </div>
      </dl>
      {updating && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Updating the estimate…
        </p>
      )}
    </div>
  );
}
