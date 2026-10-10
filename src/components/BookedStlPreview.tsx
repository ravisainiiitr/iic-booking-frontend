import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RotateCw } from "lucide-react";
import { apiClient, type FabricationPart } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  checkStlSize,
  formatPrintSizeLimit,
  previewBedSize,
  printSizeLimitFrom,
  type MaxPrintSizePayload,
} from "@/lib/printSizeLimit";
import { normalizeOrientation } from "@/lib/preview3d/orientation";
import type { StlPreviewSupports, StlPreviewTimeline } from "@/components/StlModelPreview";

// three.js viewer: loaded only when a model is previewed.
const StlModelPreview = lazy(() => import("@/components/StlModelPreview").then((m) => ({ default: m.StlModelPreview })));

/** Same size as the viewer frame, so the page does not jump when the model appears. */
const FRAME_HEIGHT = "h-[460px] sm:h-[520px]";
/** Same look as the booking page for supports printed in a separate material. */
const SEPARATE_SUPPORT_COLOR = "#f59e0b";

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The booking page's print timeline (layer slider times) for one copy of a booked model. */
export function bookedPrintTimeline(part: FabricationPart): StlPreviewTimeline | null {
  const printMinutes = num(part.print_minutes) ?? num(part.time_min_each);
  if (printMinutes === null) return null;
  return {
    progress: Array.isArray(part.print_progress) ? part.print_progress : null,
    printMinutes,
    warmupMinutes: num(part.warmup_minutes),
  };
}

function PreviewStatus({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div
      className={`${FRAME_HEIGHT} flex w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground`}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** 3D preview of the STL files attached to a 3D print booking; each model is downloaded when first shown.
 * The build plate is the printer's maximum print size set by the OIC (220 × 220 mm when not set). */
export function BookedStlPreview({
  parts,
  maxPrintSize,
  onDownload,
}: {
  parts: FabricationPart[];
  maxPrintSize?: MaxPrintSizePayload | null;
  /** Saves the original file (offered when the preview cannot load it). */
  onDownload?: (part: FabricationPart) => void;
}) {
  const [index, setIndex] = useState(0);
  const [buffers, setBuffers] = useState<Record<string, ArrayBuffer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, { loaded: number; total: number | null }>>({});
  const [attempt, setAttempt] = useState(0);
  const loadedIds = useRef(new Set<string>());
  const safeIndex = Math.min(index, Math.max(0, parts.length - 1));
  const part = parts[safeIndex];
  const id = part?.analysis_id;
  const sizeLimit = useMemo(() => printSizeLimitFrom(maxPrintSize), [maxPrintSize]);
  const bedSize = useMemo(() => previewBedSize(sizeLimit), [sizeLimit]);

  useEffect(() => {
    if (!id || loadedIds.current.has(id)) return;
    const controller = new AbortController();
    setErrors((e) => {
      if (!(id in e)) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
    setProgress((p) => ({ ...p, [id]: { loaded: 0, total: null } }));
    void apiClient
      .getPrintAnalysisStlBuffer(id, {
        signal: controller.signal,
        onProgress: (loaded, total) => {
          if (!controller.signal.aborted) setProgress((p) => ({ ...p, [id]: { loaded, total } }));
        },
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.buffer) {
          loadedIds.current.add(id);
          setBuffers((b) => ({ ...b, [id]: res.buffer! }));
        } else {
          setErrors((e) => ({ ...e, [id]: res.error || "Download failed" }));
        }
      });
    return () => controller.abort();
  }, [id, attempt]);

  const buffer = part ? buffers[part.analysis_id] : undefined;
  const sizeCheck = useMemo(() => {
    if (!sizeLimit || !buffer) return null;
    const check = checkStlSize(part?.filename || "model.stl", buffer, sizeLimit);
    if (!check.size) return null;
    return { tooLarge: !!check.error, rotated: check.rotated, limitLabel: formatPrintSizeLimit(sizeLimit) };
  }, [sizeLimit, buffer, part?.filename]);

  if (!part) return null;
  const multi = parts.length > 1;
  const orientation = normalizeOrientation(part.orientation);
  const supportG = num(part.support_g_each) ?? 0;
  const supports: StlPreviewSupports | null = part.support_mode
    ? {
        mode: part.support_mode === "auto" ? (supportG > 0 ? "buildplate" : "none") : part.support_mode,
        angleDeg: num(part.support_angle_deg),
        color: part.support_material_code ? SEPARATE_SUPPORT_COLOR : null,
        summary: supportG > 0.05 ? `Supports ~${supportG} g${part.support_material_code ? ` (${part.support_material_code})` : ""}` : null,
      }
    : null;
  const layerHeight = num(part.layer_height_mm);
  const volume = num(part.volume_cm3);
  const weight = num(part.weight_g_each);
  const minutes = num(part.time_min_each);
  const error = errors[part.analysis_id];
  const loading = progress[part.analysis_id];
  const percent = loading?.total ? Math.min(100, Math.round((loading.loaded / loading.total) * 100)) : null;

  return (
    <div className="space-y-2" data-testid="booked-stl-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium break-words">
          Preview: <span className="text-foreground">{part.name || part.filename || "Model"}</span>
        </p>
        {multi && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous model"
              disabled={safeIndex === 0}
              onClick={() => setIndex(safeIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-muted-foreground" aria-live="polite" data-testid="stl-preview-position">
              Model {safeIndex + 1} of {parts.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next model"
              disabled={safeIndex === parts.length - 1}
              onClick={() => setIndex(safeIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <PreviewStatus testId="booked-stl-error">
          <p className="max-w-md">
            The model could not be loaded for the preview ({error}).
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCw className="mr-1 h-4 w-4" />
              Try again
            </Button>
            {onDownload && (
              <Button type="button" variant="outline" size="sm" onClick={() => onDownload(part)}>
                <Download className="mr-1 h-4 w-4" />
                Download STL
              </Button>
            )}
          </div>
        </PreviewStatus>
      ) : buffer === undefined ? (
        <PreviewStatus testId="booked-stl-loading">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p>
            Downloading the model…
            {loading && loading.loaded > 0 && (
              <span className="tabular-nums">
                {" "}
                {mb(loading.loaded)}
                {loading.total ? ` of ${mb(loading.total)}` : ""} MB
              </span>
            )}
          </p>
          {percent !== null && (
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          )}
        </PreviewStatus>
      ) : (
        <Suspense
          fallback={
            <PreviewStatus testId="booked-stl-viewer-loading">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <p>Opening the 3D viewer…</p>
            </PreviewStatus>
          }
        >
          <StlModelPreview
            key={part.analysis_id}
            buffer={buffer}
            bedSize={bedSize}
            sizeCheck={sizeCheck}
            materialName={part.material_name || null}
            materialCode={part.material_code || null}
            layerHeightMm={layerHeight !== null && layerHeight > 0 ? layerHeight : null}
            stats={{ weightGrams: weight, timeMinutes: minutes, quantity: part.quantity }}
            orientation={orientation}
            orientationNote={orientation ? "User-selected orientation" : null}
            sizeLimit={sizeLimit}
            supports={supports}
            timeline={bookedPrintTimeline(part)}
          />
        </Suspense>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="booked-stl-info">
        {weight !== null && (
          <div>
            <dt className="text-muted-foreground">Weight (one copy)</dt>
            <dd className="font-medium">{weight} g</dd>
          </div>
        )}
        {minutes !== null && (
          <div>
            <dt className="text-muted-foreground">Print time (one copy)</dt>
            <dd className="font-medium">{minutesLabel(minutes)}</dd>
          </div>
        )}
        {volume !== null && (
          <div>
            <dt className="text-muted-foreground">Volume (one copy)</dt>
            <dd className="font-medium" data-testid="booked-stl-volume">{volume.toFixed(2)} cm³</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Copies</dt>
          <dd className="font-medium">{part.quantity}</dd>
        </div>
      </dl>
      {part.filename && part.filename !== part.name && <p className="truncate text-xs text-muted-foreground">File: {part.filename}</p>}
    </div>
  );
}

export default BookedStlPreview;
