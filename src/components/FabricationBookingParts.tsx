import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Box, Download, FileCog, History, Loader2 } from "lucide-react";
import {
  apiClient,
  getApiOrigin,
  type FabricationFileChange,
  type FabricationFilesState,
  type FabricationPart,
  type LaserSheetMaterial,
} from "@/lib/api";
import { DXF_UNIT_LABELS, parseDxfGeometry, unitToMm, type DxfGeometry } from "@/lib/dxfGeometry";
import { DxfPreviewNavigator, laserPartMetrics, type DxfPreviewItem } from "@/components/DxfPreviewNavigator";
import { getRealBookingId } from "@/lib/bookingRef";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LaserCutBookingPanel,
  materialLabel,
  OWN_SHEET_SIZE_NOTE,
  type LaserCutBookingValues,
} from "@/components/LaserCutBookingPanel";
import { Print3DBookingPanel, type Print3DBookingValues } from "@/components/Print3DBookingPanel";

const BookedStlPreview = lazy(() => import("@/components/BookedStlPreview"));

export interface FabricationBookingFields {
  booking_id: number | string;
  real_booking_id?: number | null;
  equipment: number;
  equipment_profile_type?: string;
  user_type_snapshot?: string;
  own_material?: boolean;
  own_material_fixed_charge?: string | null;
  fabrication_parts?: FabricationPart[];
  fabrication_file_changes?: FabricationFileChange[];
  fabrication_files_replaceable?: { allowed: boolean; reason: string | null } | null;
  fabrication_workflow?: { rejected?: boolean } | null;
}

function absoluteApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${getApiOrigin()}${url.startsWith("/") ? url : `/${url}`}`;
}

/** Download the STL / DXF of a booked part (presigned S3 link, or an authenticated fetch for local storage). */
export async function downloadFabricationFile(part: FabricationPart): Promise<void> {
  const res =
    part.kind === "laser"
      ? await apiClient.getLaserCutDxfPresign(part.analysis_id)
      : await apiClient.getPrintAnalysisStlPresign(part.analysis_id);
  if (res.error || !res.data?.url) {
    toast.error(res.error || "The file is no longer available.");
    return;
  }
  const url = String(res.data.url);
  const absolute = absoluteApiUrl(url);
  if (!/^https?:\/\//i.test(url) || absolute.includes("/api/print-analyses/") || absolute.includes("/api/laser-cut-analyses/")) {
    const token = apiClient.getToken?.();
    const dl = await fetch(absolute, { headers: token ? { Authorization: `Token ${token}` } : {} });
    if (!dl.ok) {
      toast.error(`Download failed (HTTP ${dl.status}).`);
      return;
    }
    const objectUrl = window.URL.createObjectURL(await dl.blob());
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = part.filename || (part.kind === "laser" ? "part.dxf" : "model.stl");
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
    return;
  }
  window.open(absolute, "_blank", "noopener,noreferrer");
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dim(value: string | number | null | undefined): string {
  const n = num(value);
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function fabricationPartDetail(part: FabricationPart): string {
  if (part.kind === "laser") {
    const material = part.material_name || part.material_code || "No sheet material";
    const w = num(part.width_mm);
    const h = num(part.height_mm);
    const area = num(part.area_mm2);
    const size = w !== null && h !== null ? `${dim(w)} × ${dim(h)} mm` : "size unknown";
    const areaText = area !== null ? ` (${(area / 1_000_000).toFixed(4)} m² each)` : "";
    return `${material} · ${size}${areaText}`;
  }
  const weight = num(part.weight_g_total);
  const time = num(part.time_min_total);
  const bits = [
    weight !== null ? `${Math.ceil(weight)} g${part.actual_weight ? " (actual)" : ""}` : null,
    time !== null ? `${time} min${part.actual_time ? " (actual)" : ""}` : null,
  ].filter(Boolean);
  return bits.length ? `${bits.join(" · ")} total` : "Not measured";
}

function filesLine(files: FabricationFileChange["new_files"]): string {
  if (!files?.length) return "no files";
  return files
    .map((f) => `${f.part_name || f.filename || "part"} × ${f.quantity ?? 1}${f.material ? ` (${f.material})` : ""}`)
    .join(", ");
}

/** Preview of the DXFs attached to a booking; each drawing is fetched when it is first shown. */
export function BookedDxfPreview({ parts, ownMaterial = false }: { parts: FabricationPart[]; ownMaterial?: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(parts[0]?.analysis_id ?? null);
  const [geometries, setGeometries] = useState<Record<string, DxfGeometry | null>>({});
  const current = parts.some((p) => p.analysis_id === activeId) ? activeId : parts[0]?.analysis_id ?? null;

  useEffect(() => {
    if (!current || current in geometries) return;
    let cancelled = false;
    void apiClient.getLaserCutDxfText(current).then((res) => {
      if (cancelled) return;
      let geometry: DxfGeometry | null = null;
      if (res.text) {
        try {
          geometry = parseDxfGeometry(res.text);
        } catch {
          geometry = null;
        }
      }
      setGeometries((g) => ({ ...g, [current]: geometry }));
    });
    return () => {
      cancelled = true;
    };
  }, [current, geometries]);

  const items = useMemo<DxfPreviewItem[]>(
    () =>
      parts.map((p) => ({
        id: p.analysis_id,
        name: p.name || p.filename || "Part",
        filename: p.filename,
        geometry: p.analysis_id in geometries ? geometries[p.analysis_id] : undefined,
        unitScale: unitToMm(p.units),
        thicknessMm: num(p.thickness_mm),
        widthMm: num(p.width_mm),
        heightMm: num(p.height_mm),
        materialName: p.material_name || null,
        materialCode: p.material_code || null,
        sheetWidthMm: ownMaterial ? null : num(p.sheet_width_mm),
        sheetHeightMm: ownMaterial ? null : num(p.sheet_height_mm),
        metrics: laserPartMetrics({
          widthMm: p.width_mm,
          heightMm: p.height_mm,
          areaMm2: p.area_mm2,
          quantity: p.quantity,
          materialName: p.material_name || p.material_code,
          thicknessMm: p.thickness_mm,
        }),
      })),
    [parts, geometries, ownMaterial],
  );

  return <DxfPreviewNavigator items={items} activeId={current} onActiveChange={setActiveId} />;
}

interface FabricationBookingPartsProps {
  booking: FabricationBookingFields;
  /** Job sheet: plain list, no actions. */
  printable?: boolean;
  onUpdated?: (booking: Record<string, unknown>) => void;
}

export function FabricationBookingParts({ booking, printable, onUpdated }: FabricationBookingPartsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const parts = booking.fabrication_parts ?? [];
  const changes = booking.fabrication_file_changes ?? [];
  const isLaser = booking.equipment_profile_type === "LASER_CUT_2D";
  const replaceable = booking.fabrication_files_replaceable;

  const totalQty = parts.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0);

  return (
    <div className="rounded-lg border p-4 space-y-3" data-testid="fabrication-booking-parts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {isLaser ? "Laser cutting parts" : "Print files"}{" "}
          <span className="text-muted-foreground font-normal">
            ({parts.length} file{parts.length === 1 ? "" : "s"}, {totalQty} piece{totalQty === 1 ? "" : "s"})
          </span>
        </p>
        <div className="flex items-center gap-2">
          {booking.own_material && (
            <Badge variant="secondary" data-testid="own-material-badge">
              User brings own material
            </Badge>
          )}
          {!printable && replaceable?.allowed && (
            <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)} data-testid="replace-files-button">
              <FileCog className="mr-1 h-4 w-4" /> {booking.fabrication_workflow?.rejected ? "Replace files" : "Change files"}
            </Button>
          )}
        </div>
      </div>
      {parts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files are attached to this booking.</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {parts.map((part) => (
            <li key={part.analysis_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-testid={`fabrication-part-${part.analysis_id}`}>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {part.name} <span className="text-muted-foreground font-normal">× {part.quantity}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {fabricationPartDetail(part)}
                  {part.filename ? ` · ${part.filename}` : ""}
                </p>
              </div>
              {!printable && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={downloading === part.analysis_id}
                  onClick={async () => {
                    setDownloading(part.analysis_id);
                    try {
                      await downloadFabricationFile(part);
                    } finally {
                      setDownloading(null);
                    }
                  }}
                  aria-label={`Download ${part.filename || part.name}`}
                >
                  {downloading === part.analysis_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="ml-1">{isLaser ? "DXF" : "STL"}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!printable && parts.length > 0 && (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={previewOpen}
            onClick={() => setPreviewOpen((v) => !v)}
            data-testid={isLaser ? "laser-preview-toggle" : "print-preview-toggle"}
          >
            <Box className="mr-1 h-4 w-4" />
            {previewOpen
              ? "Hide preview"
              : parts.length > 1
                ? `Preview ${parts.length} ${isLaser ? "DXF" : "STL"} files`
                : `Preview ${isLaser ? "DXF" : "STL"}`}
          </Button>
          {previewOpen &&
            (isLaser ? (
              <BookedDxfPreview parts={parts} ownMaterial={Boolean(booking.own_material)} />
            ) : (
              <Suspense fallback={<div className="h-[420px] w-full animate-pulse rounded-lg border bg-muted sm:h-[460px]" aria-label="Loading preview" />}>
                <BookedStlPreview parts={parts} />
              </Suspense>
            ))}
        </div>
      )}
      {!printable && replaceable && !replaceable.allowed && replaceable.reason && (
        <p className="text-xs text-muted-foreground">{replaceable.reason}</p>
      )}
      {!printable && changes.length > 0 && (
        <details className="text-xs" data-testid="fabrication-change-history">
          <summary className="cursor-pointer text-muted-foreground inline-flex items-center gap-1">
            <History className="h-3.5 w-3.5" /> File changes ({changes.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {changes.map((c) => (
              <li key={c.id} className="rounded border p-2">
                <p className="font-medium">
                  {c.changed_at ? new Date(c.changed_at).toLocaleString() : "—"}
                  {c.changed_by_name ? ` · ${c.changed_by_name}` : ""}
                  {c.reverted_at ? " · reverted (extra charge not paid)" : ""}
                </p>
                <p className="text-muted-foreground">Before: {filesLine(c.previous_files)}{c.previous_own_material ? " · own material" : ""}</p>
                <p className="text-muted-foreground">After: {filesLine(c.new_files)}{c.new_own_material ? " · own material" : ""}</p>
                {(c.charge_before || c.charge_after) && (
                  <p className="text-muted-foreground">Charge: ₹{c.charge_before ?? "—"} → ₹{c.charge_after ?? "—"}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {dialogOpen && (
        <FabricationReplaceDialog
          booking={booking}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onUpdated={(updated) => {
            setDialogOpen(false);
            onUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
}

interface PartEdit {
  name: string;
  qty: string;
  materialId: string;
  units: string;
}

interface FabricationReplaceDialogProps {
  booking: FabricationBookingFields;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (booking: Record<string, unknown>) => void;
}

export function FabricationReplaceDialog({ booking, open, onOpenChange, onUpdated }: FabricationReplaceDialogProps) {
  const isLaser = booking.equipment_profile_type === "LASER_CUT_2D";
  const [state, setState] = useState<FabricationFilesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"edit" | "replace">("edit");
  const [edits, setEdits] = useState<Record<string, PartEdit>>({});
  const [ownMaterial, setOwnMaterial] = useState(!!booking.own_material);
  const [sheets, setSheets] = useState<LaserSheetMaterial[]>([]);
  const [laserValues, setLaserValues] = useState<LaserCutBookingValues | null>(null);
  const [printValues, setPrintValues] = useState<Print3DBookingValues | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const bookingPk = getRealBookingId(booking);

  useEffect(() => {
    let cancelled = false;
    if (bookingPk == null) {
      toast.error("Could not load the booking files.");
      onOpenChange(false);
      return;
    }
    setLoading(true);
    void apiClient.getBookingFabricationFiles(bookingPk).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not load the booking files.");
        onOpenChange(false);
        return;
      }
      setState(res.data);
      setOwnMaterial(!!res.data.own_material);
      setEdits(
        Object.fromEntries(
          res.data.parts.map((p) => [
            p.analysis_id,
            { name: p.name ?? "", qty: String(p.quantity ?? 1), materialId: p.material_id ? String(p.material_id) : "", units: p.units ?? "mm" },
          ])
        )
      );
    });
    if (isLaser) {
      void apiClient
        .getEquipmentLaserSheetMaterials(booking.equipment, booking.user_type_snapshot ? { user_type: booking.user_type_snapshot } : undefined)
        .then((res) => {
          if (!cancelled) setSheets(res.data?.materials ?? []);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [bookingPk, booking.equipment, booking.user_type_snapshot, isLaser, onOpenChange]);

  const partUpdates = useMemo(() => {
    if (!state) return [];
    const updates: Array<{ analysis_id: string; part_name?: string; quantity?: number; material_id?: number | null; units?: string }> = [];
    for (const p of state.parts) {
      const e = edits[p.analysis_id];
      if (!e) continue;
      const u: (typeof updates)[number] = { analysis_id: p.analysis_id };
      if (e.name.trim() && e.name.trim() !== (p.name ?? "")) u.part_name = e.name.trim();
      const qty = Number(e.qty);
      if (Number.isInteger(qty) && qty >= 1 && qty !== Number(p.quantity)) u.quantity = qty;
      if (isLaser && e.materialId && Number(e.materialId) !== Number(p.material_id ?? 0)) u.material_id = Number(e.materialId);
      if (isLaser && p.units_assumed && e.units && e.units !== p.units) u.units = e.units;
      if (Object.keys(u).length > 1) updates.push(u);
    }
    return updates;
  }, [state, edits, isLaser]);

  const qtyError = useMemo(() => {
    for (const [id, e] of Object.entries(edits)) {
      const qty = Number(e.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        const p = state?.parts.find((x) => x.analysis_id === id);
        return `${p?.name || "A part"}: quantity must be a whole number of 1 or more.`;
      }
    }
    return null;
  }, [edits, state]);

  const ownChanged = !!state && ownMaterial !== !!state.own_material;
  const replacementReady = isLaser ? !!laserValues?.batchId : !!(printValues?.batchId || printValues?.analysisId);
  const canSubmit =
    !!state?.can_replace &&
    !saving &&
    !uploadBusy &&
    (mode === "replace" ? replacementReady : !qtyError && (partUpdates.length > 0 || ownChanged));

  const submit = async () => {
    if (!state || bookingPk == null) return;
    const body: Parameters<typeof apiClient.replaceBookingFabricationFiles>[1] = {};
    if (mode === "replace") {
      if (isLaser && laserValues?.batchId) body.laser_cut_batch_id = laserValues.batchId;
      if (!isLaser && printValues?.batchId) body.print_analysis_batch_id = printValues.batchId;
      else if (!isLaser && printValues?.analysisId) body.print_analysis_id = printValues.analysisId;
    } else if (partUpdates.length) {
      body.part_updates = partUpdates;
    }
    if (state.own_material_available || ownChanged) body.own_material = ownMaterial;
    setSaving(true);
    const res = await apiClient.replaceBookingFabricationFiles(bookingPk, body);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not update the files.");
      return;
    }
    toast.success(res.data.message || "Files updated.");
    onUpdated(res.data.booking);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto" data-testid="fabrication-replace-dialog">
        <DialogHeader>
          <DialogTitle>Change {isLaser ? "DXF" : "STL"} files</DialogTitle>
          <DialogDescription>
            Edit part names, quantities{isLaser ? " and sheet materials" : ""}, or upload a new set of files. The charge is
            recalculated and the lab is emailed the updated files.
          </DialogDescription>
        </DialogHeader>
        {loading || !state ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !state.can_replace ? (
          <p className="text-sm text-muted-foreground">{state.blocked_reason || "Files can't be changed right now."}</p>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex rounded-md border p-0.5" role="tablist">
              {(["edit", "replace"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={mode === m ? "default" : "ghost"}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  disabled={saving || uploadBusy}
                >
                  {m === "edit" ? "Edit parts" : "Upload new files"}
                </Button>
              ))}
            </div>

            {mode === "edit" ? (
              <div className="space-y-3" data-testid="fabrication-edit-parts">
                {state.parts.map((p) => {
                  const e = edits[p.analysis_id];
                  if (!e) return null;
                  const set = (patch: Partial<PartEdit>) =>
                    setEdits((prev) => ({ ...prev, [p.analysis_id]: { ...prev[p.analysis_id], ...patch } }));
                  return (
                    <div key={p.analysis_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-6">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Part name</Label>
                        <Input value={e.name} onChange={(ev) => set({ name: ev.target.value })} aria-label={`Name of ${p.filename || p.name}`} />
                        <p className="text-[11px] text-muted-foreground truncate">{p.filename}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={e.qty}
                          onChange={(ev) => set({ qty: ev.target.value })}
                          aria-label={`Quantity of ${p.filename || p.name}`}
                        />
                      </div>
                      {isLaser ? (
                        <>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs text-muted-foreground">Sheet material</Label>
                            <Select value={e.materialId} onValueChange={(v) => set({ materialId: v })}>
                              <SelectTrigger aria-label={`Sheet material of ${p.filename || p.name}`}>
                                <SelectValue placeholder={p.material_name || "Choose a sheet"} />
                              </SelectTrigger>
                              <SelectContent>
                                {p.material_id && !sheets.some((m) => m.id === p.material_id) && (
                                  <SelectItem value={String(p.material_id)}>
                                    {p.material_name || p.material_code} (no longer offered for new choices)
                                  </SelectItem>
                                )}
                                {sheets.map((m) => (
                                  <SelectItem key={m.id} value={String(m.id)}>
                                    {materialLabel(m)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {p.units_assumed ? (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Drawing units</Label>
                              <Select value={e.units} onValueChange={(v) => set({ units: v })}>
                                <SelectTrigger aria-label={`Units of ${p.filename || p.name}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(DXF_UNIT_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground self-end pb-2">{fabricationPartDetail(p).split(" · ").slice(1).join(" · ")}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground self-end pb-2 sm:col-span-3">{fabricationPartDetail(p)}</div>
                      )}
                    </div>
                  );
                })}
                {qtyError && <p className="text-sm text-destructive">{qtyError}</p>}
              </div>
            ) : (
              <div className="space-y-2" data-testid="fabrication-upload-new">
                <p className="text-xs text-muted-foreground">
                  The new upload replaces all current files of this booking.
                </p>
                {isLaser ? (
                  <LaserCutBookingPanel
                    equipmentId={booking.equipment}
                    estimateUserType={booking.user_type_snapshot || undefined}
                    ownMaterialCharge={null}
                    ownMaterialSelected={ownMaterial}
                    onReady={setLaserValues}
                    onAnalyzingChange={setUploadBusy}
                    disabled={saving}
                  />
                ) : (
                  <Print3DBookingPanel
                    equipmentId={booking.equipment}
                    estimateUserType={booking.user_type_snapshot || undefined}
                    ownMaterialCharge={null}
                    onReady={setPrintValues}
                    onAnalyzingChange={setUploadBusy}
                    disabled={saving}
                  />
                )}
              </div>
            )}

            {state.own_material_available && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={ownMaterial} onCheckedChange={(v) => setOwnMaterial(v === true)} aria-label="User brings own material" />
                <span>
                  User brings their own material
                  {state.own_material_fixed_charge ? ` (fixed charge ₹${Number(state.own_material_fixed_charge).toFixed(2)} instead of the material cost)` : ""}
                </span>
              </label>
            )}
            {isLaser && ownMaterial && mode === "edit" && (
              <p className="text-xs text-amber-800 dark:text-amber-300" data-testid="replace-own-sheet-note">
                {OWN_SHEET_SIZE_NOTE}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {state?.can_replace && (
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit} data-testid="fabrication-replace-submit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and recalculate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
