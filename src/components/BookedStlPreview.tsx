import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import type { StlPreviewSupports } from "@/components/StlModelPreview";

// three.js viewer: loaded only when a model is previewed.
const StlModelPreview = lazy(() => import("@/components/StlModelPreview").then((m) => ({ default: m.StlModelPreview })));

const FRAME_HEIGHT = "h-[420px] sm:h-[460px]";

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 3D preview of the STL files attached to a 3D print booking; each model is downloaded when first shown.
 * The build plate is the printer's maximum print size set by the OIC (220 × 220 mm when not set). */
export function BookedStlPreview({
  parts,
  maxPrintSize,
}: {
  parts: FabricationPart[];
  maxPrintSize?: MaxPrintSizePayload | null;
}) {
  const [index, setIndex] = useState(0);
  const [buffers, setBuffers] = useState<Record<string, ArrayBuffer | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const safeIndex = Math.min(index, Math.max(0, parts.length - 1));
  const part = parts[safeIndex];
  const id = part?.analysis_id;
  const sizeLimit = useMemo(() => printSizeLimitFrom(maxPrintSize), [maxPrintSize]);
  const bedSize = useMemo(() => previewBedSize(sizeLimit), [sizeLimit]);

  useEffect(() => {
    if (!id || id in buffers) return;
    let cancelled = false;
    void apiClient.getPrintAnalysisStlBuffer(id).then((res) => {
      if (cancelled) return;
      setBuffers((b) => ({ ...b, [id]: res.buffer ?? null }));
      if (!res.buffer) setErrors((e) => ({ ...e, [id]: res.error || "Download failed" }));
    });
    return () => {
      cancelled = true;
    };
  }, [id, buffers]);

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
        summary: supportG > 0.05 ? `Supports ~${supportG} g${part.support_material_code ? ` (${part.support_material_code})` : ""}` : null,
      }
    : null;
  const error = errors[part.analysis_id];

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
        <p className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          The model could not be loaded for the preview ({error}). Use the STL button to download it instead.
        </p>
      ) : buffer === undefined ? (
        <div className={`${FRAME_HEIGHT} w-full animate-pulse rounded-lg border bg-muted`} aria-label="Loading preview" role="status" />
      ) : (
        <Suspense fallback={<div className={`${FRAME_HEIGHT} w-full animate-pulse rounded-lg border bg-muted`} aria-label="Loading preview" />}>
          <StlModelPreview
            key={part.analysis_id}
            buffer={buffer}
            bedSize={bedSize}
            sizeCheck={sizeCheck}
            materialName={part.material_name || null}
            materialCode={part.material_code || null}
            stats={{
              weightGrams: num(part.weight_g_each),
              timeMinutes: num(part.time_min_each),
              quantity: part.quantity,
            }}
            orientation={orientation}
            orientationNote={orientation ? "User-selected orientation" : null}
            sizeLimit={sizeLimit}
            supports={supports}
          />
        </Suspense>
      )}
      {part.filename && part.filename !== part.name && <p className="truncate text-xs text-muted-foreground">File: {part.filename}</p>}
    </div>
  );
}

export default BookedStlPreview;
