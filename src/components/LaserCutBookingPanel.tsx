import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient, type LaserCutAnalysis, type LaserCutBatch, type LaserSheetMaterial } from "@/lib/api";
import { DXF_UNIT_LABELS, parseDxfGeometry, unitToMm, type DxfGeometry, type DxfUnitKey } from "@/lib/dxfGeometry";
import { extractDxfFilesFromZip } from "@/lib/extractZipDxfFiles";
import { laserPartTimeText } from "@/lib/laserTimeEstimate";
import { NO_FABRICATION_MATERIALS_MESSAGE } from "@/lib/fabricationProfiles";
import {
  LIVE_INPUT_DEBOUNCE_MS,
  OWN_SHEET_MARGIN_MM,
  OWN_SHEET_UPLOAD_HINT,
  formatMm,
  laserOwnSheet,
  ownMaterialChargeNote,
  parseWholeQuantity,
} from "@/lib/ownMaterialSizing";
import { AlertTriangle, Eye, Trash2, Upload } from "lucide-react";
import { DxfPreviewNavigator, laserPartMetrics, type DxfPreviewItem } from "@/components/DxfPreviewNavigator";

const MAX_DXF_BYTES = 25 * 1024 * 1024;
const UNIT_OPTIONS: DxfUnitKey[] = ["mm", "cm", "m", "in", "ft"];

export interface LaserCutBookingValues {
  batchId: string;
  /** Changes whenever anything that affects the charge changes (used to refresh the estimate). */
  partsKey: string;
  ownMaterial: boolean;
  parts: LaserCutAnalysis[];
  /** Sum of the per-part material estimates (2 decimals), before own-material and rounding. */
  materialEstimate: number;
}

interface LaserCutBookingPanelProps {
  equipmentId: number | string;
  materials?: LaserSheetMaterial[];
  /** Equipment's fixed own-material charge; null/undefined hides the option. */
  ownMaterialCharge?: string | number | null;
  /** Own-material choice made outside the panel (booking file-replace dialog). */
  ownMaterialSelected?: boolean;
  estimateUserType?: string;
  /** Quantity Required (input A): every part is cut this many times its own count. */
  jobQuantity?: number;
  onReady: (values: LaserCutBookingValues | null) => void;
  /** True while drawings are uploaded and measured. */
  onAnalyzingChange?: (analyzing: boolean) => void;
  /** True while a typed part quantity waits to be saved or is being saved (the charge is refreshed after). */
  onUpdatingChange?: (updating: boolean) => void;
  disabled?: boolean;
}

export const QUANTITY_DRAFT_ERROR = "Number of parts must be a whole number of at least 1.";

export function formatRupees(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDim(value: string | number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function materialLabel(m: LaserSheetMaterial): string {
  return `${m.name} — ${formatRupees(m.sheet_rate)} per ${formatDim(m.sheet_width_mm)} × ${formatDim(m.sheet_height_mm)} mm sheet`;
}

export const OWN_SHEET_SIZE_NOTE = "Size not checked against IIC sheets — make sure your sheet is large enough.";

/**
 * Reason the parts cannot be booked yet, or null when every part is measured, priced and fits.
 * With the user's own sheet, parts are not checked against the IIC sheet size.
 */
export function laserPartsBlockReason(parts: LaserCutAnalysis[], ownMaterial = false): string | null {
  if (!parts.length) return "Upload at least one DXF file.";
  for (const p of parts) {
    const label = p.display_part_name || p.part_name || p.dxf_filename || "A part";
    if (p.status !== "COMPLETED") return `${label}: the DXF could not be measured. Remove it or upload a corrected file.`;
    if (!p.material_id) return `${label}: choose a sheet material.`;
    if (p.fit_error && !ownMaterial) return `${label}: ${p.fit_error}`;
  }
  return null;
}

export function laserPartsKey(parts: LaserCutAnalysis[], ownMaterial: boolean): string {
  return JSON.stringify([
    ownMaterial,
    parts.map((p) => [p.id, p.quantity, p.material_id, p.units, p.area_mm2, p.status]),
  ]);
}

interface PartDraft {
  name: string;
  qty: string;
}

interface SheetDraft {
  w: string;
  h: string;
  /** Size shown when the draft was started; a new size from the server replaces an idle draft. */
  basis: string;
}

function parseSheetMm(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function withId(set: Set<string>, id: string, on: boolean): Set<string> {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export function LaserCutBookingPanel({
  equipmentId,
  materials: materialsProp,
  ownMaterialCharge,
  ownMaterialSelected,
  estimateUserType,
  jobQuantity = 1,
  onReady,
  onAnalyzingChange,
  onUpdatingChange,
  disabled,
}: LaserCutBookingPanelProps) {
  const sets = Math.max(1, Math.floor(jobQuantity) || 1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<LaserSheetMaterial[]>(materialsProp ?? []);
  const [materialsLoaded, setMaterialsLoaded] = useState(Boolean(materialsProp?.length));
  const [fetchedOwnCharge, setFetchedOwnCharge] = useState<string | null>(null);
  const [defaultMaterialId, setDefaultMaterialId] = useState<string>("");
  const [batch, setBatch] = useState<LaserCutBatch | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, PartDraft>>({});
  const [geometries, setGeometries] = useState<Record<string, DxfGeometry | null>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [ownMaterial, setOwnMaterial] = useState(false);
  /** Parts whose typed quantity is waiting for the debounce before it is saved. */
  const [pendingQtyIds, setPendingQtyIds] = useState<Set<string>>(new Set());
  const qtyTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const qtyInFlightRef = useRef<Record<string, boolean>>({});
  const qtyQueuedRef = useRef<Record<string, number | undefined>>({});
  const [sheetDrafts, setSheetDrafts] = useState<Record<string, SheetDraft>>({});
  const [sheetSavingIds, setSheetSavingIds] = useState<Set<string>>(new Set());
  const sheetTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updating = savingIds.size > 0 || pendingQtyIds.size > 0;
  const busy = uploading || updating;
  useEffect(() => {
    onAnalyzingChange?.(uploading);
  }, [uploading, onAnalyzingChange]);
  useEffect(() => {
    onUpdatingChange?.(updating);
  }, [updating, onUpdatingChange]);
  useEffect(() => () => onUpdatingChange?.(false), [onUpdatingChange]);
  useEffect(
    () => () => {
      Object.values(qtyTimersRef.current).forEach(clearTimeout);
      Object.values(sheetTimersRef.current).forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (materialsProp?.length) {
      setMaterials(materialsProp);
      setMaterialsLoaded(true);
      return;
    }
    let cancelled = false;
    void apiClient
      .getEquipmentLaserSheetMaterials(equipmentId, estimateUserType ? { user_type: estimateUserType } : undefined)
      .then((res) => {
        if (cancelled) return;
        setMaterials(res.data?.materials ?? []);
        setFetchedOwnCharge(res.data?.own_material_fixed_charge ?? null);
        setMaterialsLoaded(!res.error);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, estimateUserType, materialsProp]);

  useEffect(() => {
    if (!defaultMaterialId && materials[0]) setDefaultMaterialId(String(materials[0].id));
  }, [materials, defaultMaterialId]);

  const effectiveOwnCharge = ownMaterialCharge !== undefined ? ownMaterialCharge : fetchedOwnCharge;
  const ownMaterialAvailable = effectiveOwnCharge !== null && effectiveOwnCharge !== undefined && effectiveOwnCharge !== "";

  useEffect(() => {
    if (!ownMaterialAvailable && ownMaterial) setOwnMaterial(false);
  }, [ownMaterialAvailable, ownMaterial]);

  const parts = useMemo(() => batch?.items ?? [], [batch]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const materialEstimate = useMemo(
    () => Math.round(parts.reduce((s, p) => s + (Number(p.estimated_material_cost) || 0), 0) * 100) / 100,
    [parts],
  );
  const ownSheet = ownMaterial || Boolean(ownMaterialSelected);
  const qtyDraftInvalid = parts.some((p) => drafts[p.id] && parseWholeQuantity(drafts[p.id].qty) === null);
  const blockReason = qtyDraftInvalid ? QUANTITY_DRAFT_ERROR : laserPartsBlockReason(parts, ownSheet);
  const partsKey = laserPartsKey(parts, ownMaterial);
  const batchId = batch?.id ?? null;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const partsRef = useRef(parts);
  partsRef.current = parts;

  useEffect(() => {
    if (!batchId || blockReason || busy) {
      onReadyRef.current(null);
      return;
    }
    onReadyRef.current({ batchId, partsKey, ownMaterial, parts: partsRef.current, materialEstimate });
  }, [batchId, blockReason, busy, ownMaterial, materialEstimate, partsKey]);

  const replacePart = useCallback((updated: LaserCutAnalysis) => {
    setBatch((prev) =>
      prev ? { ...prev, items: prev.items.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) } : prev,
    );
  }, []);

  const savePart = useCallback(
    async (part: LaserCutAnalysis, data: Parameters<typeof apiClient.updateLaserCutAnalysis>[1]) => {
      setSavingIds((s) => new Set(s).add(part.id));
      try {
        const res = await apiClient.updateLaserCutAnalysis(part.id, data);
        if (res.error || !res.data) {
          toast.error(res.error || "Could not update the part.");
          return false;
        }
        replacePart(res.data);
        return true;
      } finally {
        setSavingIds((s) => {
          const next = new Set(s);
          next.delete(part.id);
          return next;
        });
      }
    },
    [replacePart],
  );

  const readLocalDrawings = async (file: File): Promise<Array<{ filename: string; geometry: DxfGeometry | null }>> => {
    const parse = (text: string) => {
      try {
        return parseDxfGeometry(text);
      } catch {
        return null;
      }
    };
    try {
      if (file.name.toLowerCase().endsWith(".zip")) {
        const entries = await extractDxfFilesFromZip(file);
        return entries.map((e) => ({ filename: e.filename, geometry: parse(e.text) }));
      }
      return [{ filename: file.name, geometry: parse(await file.text()) }];
    } catch {
      return [];
    }
  };

  const uploadFiles = async (files: File[]) => {
    const accepted = files.filter((f) => {
      const lower = f.name.toLowerCase();
      if (!lower.endsWith(".dxf") && !lower.endsWith(".zip")) {
        toast.error(`${f.name}: only .dxf or .zip files are accepted.`);
        return false;
      }
      if (f.size > MAX_DXF_BYTES) {
        toast.error(`${f.name}: file must be under 25 MB.`);
        return false;
      }
      return true;
    });
    if (!accepted.length) return;
    setUploading(true);
    setUploadProgress(5);
    let current = batch;
    try {
      for (let idx = 0; idx < accepted.length; idx += 1) {
        const file = accepted[idx];
        const knownIds = new Set((current?.items ?? []).map((p) => p.id));
        const [local, res] = await Promise.all([
          readLocalDrawings(file),
          apiClient.analyzeEquipmentDxf(equipmentId, {
            file,
            batch_id: current?.id ?? null,
            material_id: defaultMaterialId || null,
          }),
        ]);
        setUploadProgress(Math.round(((idx + 1) / accepted.length) * 100));
        if (res.error || !res.data) {
          toast.error(`${file.name}: ${res.error || "upload failed"}`);
          continue;
        }
        current = res.data;
        setBatch(res.data);
        const added = res.data.items.filter((p) => !knownIds.has(p.id));
        const unused = [...local];
        const geo: Record<string, DxfGeometry | null> = {};
        added.forEach((p, i) => {
          const byName = unused.findIndex((l) => l.filename.toLowerCase() === (p.dxf_filename || "").toLowerCase());
          const pick = byName >= 0 ? unused.splice(byName, 1)[0] : unused.splice(0, 1)[0] ?? local[i];
          geo[p.id] = pick?.geometry ?? null;
        });
        setGeometries((g) => ({ ...g, ...geo }));
        const failed = added.filter((p) => p.status === "FAILED");
        if (failed.length) {
          toast.error(`${failed.length} drawing(s) could not be measured. See the parts list for details.`);
        }
        if (added[0]) setPreviewId((prev) => prev ?? added[0].id);
      }
    } finally {
      setUploading(false);
      window.setTimeout(() => setUploadProgress(0), 300);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePart = async (part: LaserCutAnalysis) => {
    setSavingIds((s) => new Set(s).add(part.id));
    try {
      const res = await apiClient.deleteLaserCutAnalysis(part.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBatch((prev) => (prev ? { ...prev, items: prev.items.filter((p) => p.id !== part.id) } : prev));
      setPreviewId((prev) => (prev === part.id ? null : prev));
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(part.id);
        return next;
      });
    }
  };

  const draftFor = (p: LaserCutAnalysis): PartDraft =>
    drafts[p.id] ?? { name: p.part_name || p.display_part_name || "", qty: String(p.quantity ?? 1) };

  const setDraft = (id: string, patch: Partial<PartDraft>, part: LaserCutAnalysis) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(part), ...d[id], ...patch } }));

  const commitName = async (p: LaserCutAnalysis) => {
    const draft = drafts[p.id];
    if (!draft || draft.name.trim() === (p.part_name || "")) return;
    await savePart(p, { part_name: draft.name.trim() });
  };

  const setQtyPending = (id: string, on: boolean) => setPendingQtyIds((s) => withId(s, id, on));

  /** One quantity save per part at a time; a value typed meanwhile is sent next and only the last answer counts. */
  const sendQty = async (partId: string, qty: number) => {
    if (qtyInFlightRef.current[partId]) {
      qtyQueuedRef.current[partId] = qty;
      return;
    }
    qtyInFlightRef.current[partId] = true;
    setSavingIds((s) => withId(s, partId, true));
    let saved: LaserCutAnalysis | null = null;
    let error: string | null = null;
    try {
      let next: number | undefined = qty;
      while (next !== undefined) {
        qtyQueuedRef.current[partId] = undefined;
        const res = await apiClient.updateLaserCutAnalysis(partId, { quantity: next });
        if (res.error || !res.data) error = res.error || "Could not update the part.";
        else {
          saved = res.data;
          error = null;
        }
        next = qtyQueuedRef.current[partId];
      }
    } finally {
      qtyInFlightRef.current[partId] = false;
      if (saved) replacePart(saved);
      if (error) {
        toast.error(error);
        const known = saved ?? partsRef.current.find((p) => p.id === partId);
        if (known) setDrafts((d) => (d[partId] ? { ...d, [partId]: { ...d[partId], qty: String(known.quantity) } } : d));
      }
      setSavingIds((s) => withId(s, partId, false));
    }
  };

  /** Typing (or the number box arrows): save the quantity once the user pauses, which refreshes the charge. */
  const onQtyChange = (p: LaserCutAnalysis, text: string) => {
    setDraft(p.id, { qty: text }, p);
    clearTimeout(qtyTimersRef.current[p.id]);
    delete qtyTimersRef.current[p.id];
    const qty = parseWholeQuantity(text);
    if (qty === null || (qty === p.quantity && !qtyInFlightRef.current[p.id])) {
      setQtyPending(p.id, false);
      return;
    }
    setQtyPending(p.id, true);
    qtyTimersRef.current[p.id] = setTimeout(() => {
      delete qtyTimersRef.current[p.id];
      setQtyPending(p.id, false);
      void sendQty(p.id, qty);
    }, LIVE_INPUT_DEBOUNCE_MS);
  };

  const commitQty = (p: LaserCutAnalysis) => {
    const draft = drafts[p.id];
    if (!draft) return;
    const qty = parseWholeQuantity(draft.qty);
    if (qty === null) {
      toast.error(QUANTITY_DRAFT_ERROR);
      setDrafts((d) => ({ ...d, [p.id]: { ...draft, qty: String(p.quantity) } }));
      return;
    }
    if (qtyTimersRef.current[p.id]) {
      clearTimeout(qtyTimersRef.current[p.id]);
      delete qtyTimersRef.current[p.id];
      setQtyPending(p.id, false);
      void sendQty(p.id, qty);
    }
  };

  const saveOwnSheet = async (p: LaserCutAnalysis, size: { w: number; h: number } | null) => {
    setSheetSavingIds((s) => withId(s, p.id, true));
    try {
      const res = await apiClient.updateLaserCutAnalysis(p.id, {
        own_sheet_width_mm: size ? size.w : null,
        own_sheet_height_mm: size ? size.h : null,
        own_material: true,
      });
      if (sheetTimersRef.current[p.id]) return;
      if (res.error || !res.data) toast.error(res.error || "Could not save the sheet size.");
      else replacePart(res.data);
      setSheetDrafts((d) => {
        const rest = { ...d };
        delete rest[p.id];
        return rest;
      });
    } finally {
      setSheetSavingIds((s) => withId(s, p.id, false));
    }
  };

  const onSheetChange = (p: LaserCutAnalysis, current: SheetDraft, patch: Partial<SheetDraft>) => {
    const next = { ...current, ...patch };
    setSheetDrafts((d) => ({ ...d, [p.id]: next }));
    clearTimeout(sheetTimersRef.current[p.id]);
    delete sheetTimersRef.current[p.id];
    const w = parseSheetMm(next.w);
    const h = parseSheetMm(next.h);
    if (w === null || h === null) return;
    sheetTimersRef.current[p.id] = setTimeout(() => {
      delete sheetTimersRef.current[p.id];
      void saveOwnSheet(p, { w, h });
    }, LIVE_INPUT_DEBOUNCE_MS);
  };

  const resetOwnSheet = (p: LaserCutAnalysis) => {
    clearTimeout(sheetTimersRef.current[p.id]);
    delete sheetTimersRef.current[p.id];
    void saveOwnSheet(p, null);
  };

  const previewItems = useMemo<DxfPreviewItem[]>(
    () =>
      parts.map((p) => {
        const material = p.material_id ? materialById.get(p.material_id) : undefined;
        const failed = p.status === "FAILED";
        const own = ownSheet ? laserOwnSheet(p, material) : null;
        // The preview lays the part on the sheet as drawn, so the sheet is shown turned to suit the part.
        const ownSheetSize =
          own && Number(p.width_mm) > own.widthMm ? { widthMm: own.heightMm, heightMm: own.widthMm } : own;
        return {
          id: p.id,
          name: p.display_part_name || p.part_name || p.dxf_filename || "Part",
          filename: p.dxf_filename,
          geometry: failed ? null : geometries[p.id] ?? null,
          unitScale: unitToMm(p.units),
          thicknessMm: material ? Number(material.thickness_mm) : null,
          widthMm: p.width_mm != null ? Number(p.width_mm) : null,
          heightMm: p.height_mm != null ? Number(p.height_mm) : null,
          materialName: material?.name ?? p.material_name ?? null,
          materialCode: material?.code ?? p.material_code_snapshot ?? null,
          materialFamily: material?.material_family ?? null,
          sheetWidthMm: ownSheet ? ownSheetSize?.widthMm ?? null : material ? Number(material.sheet_width_mm) || null : null,
          sheetHeightMm: ownSheet ? ownSheetSize?.heightMm ?? null : material ? Number(material.sheet_height_mm) || null : null,
          error: failed ? p.error_message || "This DXF could not be read." : null,
          metrics: failed
            ? []
            : laserPartMetrics({
                widthMm: p.width_mm,
                heightMm: p.height_mm,
                areaMm2: p.area_mm2,
                quantity: p.quantity,
                materialName: material?.name ?? p.material_name,
                thicknessMm: material?.thickness_mm,
                cost: p.estimated_material_cost != null ? formatRupees(p.estimated_material_cost) : undefined,
              }),
        };
      }),
    [parts, materialById, geometries, ownSheet],
  );
  const previewActiveId = parts.some((p) => p.id === previewId) ? previewId : parts[0]?.id ?? null;
  const controlsDisabled = disabled || uploading;
  /** Sheet and unit changes are checked against the IIC sheet size unless the user brings their own sheet. */
  const ownSheetFlag = ownSheet ? { own_material: true } : {};

  const renderOwnSheet = (p: LaserCutAnalysis) => {
    const material = p.material_id ? materialById.get(p.material_id) : undefined;
    const sheet = laserOwnSheet(p, material);
    if (!sheet) return null;
    const basis = `${sheet.widthMm}x${sheet.heightMm}:${sheet.source}`;
    const stored = sheetDrafts[p.id];
    const draft: SheetDraft =
      stored && (stored.basis === basis || sheetTimersRef.current[p.id])
        ? stored
        : { w: String(sheet.widthMm), h: String(sheet.heightMm), basis };
    const label = p.display_part_name || p.part_name || p.dxf_filename || "part";
    const sheetsNeeded = Math.max(1, Number(p.quantity) || 1) * sets;
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs"
        data-testid={`laser-own-sheet-${p.id}`}
      >
        <span className="font-medium text-foreground">Your sheet</span>
        <Input
          type="number"
          inputMode="decimal"
          min={1}
          className="h-7 w-20 tabular-nums"
          aria-label={`Your sheet width (mm) for ${label}`}
          value={draft.w}
          disabled={controlsDisabled}
          onChange={(e) => onSheetChange(p, draft, { w: e.target.value })}
        />
        <span aria-hidden>×</span>
        <Input
          type="number"
          inputMode="decimal"
          min={1}
          className="h-7 w-20 tabular-nums"
          aria-label={`Your sheet height (mm) for ${label}`}
          value={draft.h}
          disabled={controlsDisabled}
          onChange={(e) => onSheetChange(p, draft, { h: e.target.value })}
        />
        <span>mm</span>
        <span className="text-muted-foreground" data-testid="laser-own-sheet-source">
          {sheet.source === "user"
            ? "Entered by you."
            : `Auto-filled from your design: ${formatMm(p.width_mm)} × ${formatMm(p.height_mm)} mm part + ${OWN_SHEET_MARGIN_MM} mm margin on each side${sheet.rotated ? ", turned to suit the machine bed" : ""}.`}
          {sheetsNeeded > 1 ? ` Sized for one part; bring enough for all ${sheetsNeeded}.` : ""}
        </span>
        {sheet.source === "user" && (
          <button
            type="button"
            className="text-primary underline underline-offset-2 disabled:opacity-50"
            disabled={controlsDisabled || sheetSavingIds.has(p.id)}
            onClick={() => resetOwnSheet(p)}
          >
            Reset to model size
          </button>
        )}
        {sheetSavingIds.has(p.id) && <span>Saving…</span>}
      </div>
    );
  };

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Laser cutting parts</CardTitle>
        <CardDescription>
          Upload one or more DXF drawings, or a ZIP of DXFs. For each part, set its name, how many you need and the
          sheet material. The material cost is the part&apos;s bounding rectangle × number of parts ÷ sheet area ×
          sheet price. The machine time is worked out from the cut path in each drawing and sets how long a slot you
          need.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {materials.length === 0 ? (
          materialsLoaded && (
            <p className="text-sm text-destructive" role="alert" data-testid="laser-no-materials">
              {NO_FABRICATION_MATERIALS_MESSAGE}
            </p>
          )
        ) : (
          <div className="space-y-2">
            <Label htmlFor="laser-default-material">Sheet material for new uploads</Label>
            <Select value={defaultMaterialId} onValueChange={setDefaultMaterialId} disabled={controlsDisabled}>
              <SelectTrigger id="laser-default-material">
                <SelectValue placeholder="Select sheet material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {materialLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={cn("rounded-lg border-2 border-dashed p-5 text-center", parts.length && "border-primary/40 bg-muted/20")}>
          <input
            ref={inputRef}
            type="file"
            accept=".dxf,.zip"
            multiple
            className="hidden"
            data-testid="laser-dxf-input"
            disabled={controlsDisabled}
            onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
          />
          <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <Button
            type="button"
            disabled={controlsDisabled || materials.length === 0}
            onClick={() => inputRef.current?.click()}
          >
            {parts.length ? "Add more DXF or ZIP files" : "Choose DXF or ZIP files"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Up to 25 MB per file. Text and dimensions are ignored.</p>
        </div>

        {uploading && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Measuring drawings…</span>
              <span className="font-medium tabular-nums">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {parts.length > 0 && (
          <div className="space-y-3" data-testid="laser-parts">
            <p className="text-sm font-medium">Parts ({parts.length})</p>
            {parts.map((p) => {
              const draft = draftFor(p);
              const saving = savingIds.has(p.id);
              const failed = p.status === "FAILED";
              const fitError = ownSheet ? null : p.fit_error;
              return (
                <div
                  key={p.id}
                  data-testid={`laser-part-${p.id}`}
                  className={cn(
                    "space-y-2 rounded-md border p-3",
                    (failed || fitError) && "border-destructive/50 bg-destructive/5",
                    previewActiveId === p.id && "ring-1 ring-primary/40",
                  )}
                >
                  <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_6rem_minmax(0,2.5fr)_auto]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground" htmlFor={`part-name-${p.id}`}>
                        Part name
                      </Label>
                      <Input
                        id={`part-name-${p.id}`}
                        value={draft.name}
                        maxLength={255}
                        disabled={controlsDisabled || failed}
                        onChange={(e) => setDraft(p.id, { name: e.target.value }, p)}
                        onBlur={() => void commitName(p)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground" htmlFor={`part-qty-${p.id}`}>
                        Quantity
                      </Label>
                      <Input
                        id={`part-qty-${p.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={draft.qty}
                        disabled={controlsDisabled || failed}
                        onChange={(e) => onQtyChange(p, e.target.value)}
                        onBlur={() => commitQty(p)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sheet material</Label>
                      <Select
                        value={p.material_id ? String(p.material_id) : ""}
                        onValueChange={(v) => void savePart(p, { material_id: Number(v), ...ownSheetFlag })}
                        disabled={controlsDisabled || failed || saving}
                      >
                        <SelectTrigger aria-label={`Sheet material for ${draft.name || p.dxf_filename}`}>
                          <SelectValue placeholder="Select sheet material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Preview ${draft.name || p.dxf_filename}`}
                        disabled={failed}
                        onClick={() => setPreviewId(p.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${draft.name || p.dxf_filename}`}
                        disabled={controlsDisabled || saving}
                        onClick={() => void removePart(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="truncate">{p.dxf_filename}</span>
                    {!failed && (
                      <span data-testid="laser-part-size">
                        {formatDim(p.width_mm)} × {formatDim(p.height_mm)} mm
                        {p.area_mm2 ? ` (${(Number(p.area_mm2) / 1_000_000).toFixed(4)} m² each)` : ""}
                      </span>
                    )}
                    {p.estimated_material_cost != null && (
                      <span className="font-medium text-foreground" data-testid="laser-part-cost">
                        Material: {formatRupees(p.estimated_material_cost)}
                      </span>
                    )}
                    {!failed && laserPartTimeText(p.time_estimate) && (
                      <span data-testid="laser-part-time">Machine time: {laserPartTimeText(p.time_estimate)}</span>
                    )}
                    {(saving || pendingQtyIds.has(p.id)) && <span data-testid="laser-part-updating">Updating…</span>}
                  </div>

                  {ownSheet && !failed && renderOwnSheet(p)}

                  {p.units_assumed && !failed && (
                    <div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>This drawing has no units set. Choose the unit it was drawn in:</span>
                      <Select
                        value={String(p.units || "mm")}
                        onValueChange={(v) => void savePart(p, { units: v, ...ownSheetFlag })}
                        disabled={controlsDisabled || saving}
                      >
                        <SelectTrigger className="h-7 w-36 bg-white" aria-label="Drawing units">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {DXF_UNIT_LABELS[u]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {failed && <p className="text-xs text-destructive">{p.error_message || "This DXF could not be read."}</p>}
                  {fitError && (
                    <p className="text-xs text-destructive" data-testid="laser-part-fit-error">
                      {fitError}
                    </p>
                  )}
                  {[...(p.warnings ?? []), ...(p.time_estimate?.warning ? [p.time_estimate.warning] : [])]
                    .filter((w) => !(p.units_assumed && w.toLowerCase().includes("no units")))
                    .map((w) => (
                      <p key={w} className="text-xs text-amber-800">
                        {w}
                      </p>
                    ))}
                </div>
              );
            })}

            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {sets > 1 ? `Estimated sheet material (all parts × ${sets} sets)` : "Estimated sheet material (all parts)"}
              </span>
              <span
                className={cn("font-semibold tabular-nums", ownMaterial && "text-muted-foreground line-through")}
                data-testid="laser-material-estimate"
              >
                {formatRupees(Math.round(materialEstimate * sets * 100) / 100)}
              </span>
            </div>
          </div>
        )}

        {ownMaterialAvailable && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox
              checked={ownMaterial}
              onCheckedChange={(v) => setOwnMaterial(v === true)}
              disabled={disabled}
              aria-label="I will bring my own sheet material"
            />
            <span>
              I will bring my own sheet material.
              <span className="block text-xs text-muted-foreground">
                {ownMaterialChargeNote(effectiveOwnCharge, "sheet")}
              </span>
            </span>
          </label>
        )}

        {ownSheet && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300" data-testid="laser-own-sheet-note">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {OWN_SHEET_SIZE_NOTE}
          </p>
        )}
        {ownSheet && parts.length === 0 && (
          <p className="text-xs text-muted-foreground" data-testid="laser-own-sheet-hint">
            {OWN_SHEET_UPLOAD_HINT}
          </p>
        )}

        {parts.length > 0 && blockReason && !busy && (
          <p className="text-sm text-destructive" data-testid="laser-block-reason">
            {blockReason}
          </p>
        )}

        {previewItems.length > 0 && (
          <DxfPreviewNavigator items={previewItems} activeId={previewActiveId} onActiveChange={setPreviewId} />
        )}
      </CardContent>
    </Card>
  );
}
