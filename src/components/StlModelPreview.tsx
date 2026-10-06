import { useEffect, useMemo, useRef, useState } from "react";
import { printAppearance } from "@/lib/preview3d/appearance";
import { formatMm, isCoarsePointer, isWebGLAvailable, prefersReducedMotion } from "@/lib/preview3d/env";
import { loadStlMesh } from "@/lib/preview3d/loadStlMesh";
import { drawMeshToCanvas } from "@/lib/preview3d/softwareRender";
import type { StlMeshData, StlMeshPhase } from "@/lib/preview3d/stlMesh";
import { cn } from "@/lib/utils";
import { PreviewStage, type ViewPreset } from "@/components/preview3d/stage";
import { buildPrintScene } from "@/components/preview3d/printScene";
import {
  PREVIEW_FRAME_CLASS,
  PREVIEW_SCENE_CLASS,
  PreviewChip,
  PreviewLoading,
  PreviewNotice,
  PreviewToolbar,
  touchHint,
  useFullscreen,
} from "@/components/preview3d/PreviewChrome";

export interface StlPreviewStats {
  /** One copy. */
  weightGrams?: number | null;
  timeMinutes?: number | null;
  quantity?: number | null;
}

interface StlModelPreviewProps {
  buffer: ArrayBuffer | null;
  /** Printer build plate (x × y) and height (z), mm. */
  bedSize?: { x: number; y: number; z: number };
  className?: string;
  /** Filament / resin, for the model's look (PLA, PETG, ABS, resin; colour words such as "Black PLA"). */
  materialName?: string | null;
  materialCode?: string | null;
  /** Explicit colour, e.g. "#ff6600" or "red", when the material carries one. */
  colorHint?: string | null;
  layerHeightMm?: number | null;
  /** Estimated weight / time, shown when known. */
  stats?: StlPreviewStats | null;
}

const PHASE_LABEL: Record<StlMeshPhase, string> = {
  parse: "Reading the model",
  simplify: "Simplifying a very large model for the preview",
  normals: "Shading the surfaces",
};

const PHASE_SPAN: Record<StlMeshPhase, [number, number]> = {
  parse: [0, 0.45],
  simplify: [0.45, 0.75],
  normals: [0.75, 1],
};

function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function SoftwareView({ mesh, color }: { mesh: StlMeshData; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr)) || 600;
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr)) || 400;
    drawMeshToCanvas(canvas, mesh, color);
  }, [mesh, color]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" data-testid="stl-preview-2d" aria-label="Shaded view of the model" role="img" />;
}

export function StlModelPreview({
  buffer,
  bedSize,
  className,
  materialName,
  materialCode,
  colorHint,
  layerHeightMm,
  stats,
}: StlModelPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<PreviewStage | null>(null);
  const materialsRef = useRef<Array<{ wireframe: boolean }>>([]);
  const fullscreen = useFullscreen(frameRef);
  const webgl = useMemo(() => isWebGLAvailable(), []);
  const [webglFailed, setWebglFailed] = useState(false);
  const [mesh, setMesh] = useState<StlMeshData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: StlMeshPhase; value: number } | null>(null);
  const [dimensions, setDimensions] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [exceedsBed, setExceedsBed] = useState(false);
  const [ready, setReady] = useState(false);

  const appearance = useMemo(
    () => printAppearance({ materialName, materialCode, colorHint }),
    [materialName, materialCode, colorHint],
  );
  const use3d = webgl && !webglFailed;

  useEffect(() => {
    setMesh(null);
    setLoadError(null);
    setReady(false);
    if (!buffer) return;
    let cancelled = false;
    setProgress({ phase: "parse", value: 0 });
    const maxTriangles = !use3d ? 60_000 : isCoarsePointer() ? 200_000 : 400_000;
    loadStlMesh(buffer, { maxTriangles }, (phase, fraction) => {
      if (cancelled) return;
      const [a, b] = PHASE_SPAN[phase];
      setProgress({ phase, value: a + (b - a) * fraction });
    })
      .then((data) => {
        if (cancelled) return;
        setMesh(data);
        setProgress(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setProgress(null);
        setLoadError(e instanceof Error ? e.message : "Could not read the STL file.");
      });
    return () => {
      cancelled = true;
    };
  }, [buffer, use3d]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!use3d || !mount || !mesh) return;
    let stage: PreviewStage;
    try {
      stage = new PreviewStage(mount, {
        reducedMotion: prefersReducedMotion(),
        coarse: isCoarsePointer(),
        autoRotate: true,
        onContextLost: () => setWebglFailed(true),
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    stageRef.current = stage;
    try {
      const result = buildPrintScene(stage, mesh, appearance, bedSize, layerHeightMm);
      materialsRef.current = result.materials as unknown as Array<{ wireframe: boolean }>;
      setExceedsBed(result.exceedsBed);
      setReady(true);
    } catch {
      stage.dispose();
      stageRef.current = null;
      setWebglFailed(true);
      return;
    }
    return () => {
      stage.dispose();
      stageRef.current = null;
      materialsRef.current = [];
      setReady(false);
    };
    // bedSize is compared by value: callers often pass a new object literal each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3d, mesh, appearance, bedSize?.x, bedSize?.y, bedSize?.z, layerHeightMm]);

  useEffect(() => {
    for (const m of materialsRef.current) m.wireframe = wireframe;
    stageRef.current?.invalidate();
  }, [wireframe, ready]);

  useEffect(() => {
    stageRef.current?.setOverlayVisible(dimensions);
  }, [dimensions, ready]);

  if (!buffer) {
    return (
      <div
        className={
          className ??
          "flex h-[420px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground sm:h-[460px]"
        }
      >
        Upload an STL to preview the model
      </div>
    );
  }

  const size = mesh ? [mesh.max[0] - mesh.min[0], mesh.max[2] - mesh.min[2], mesh.max[1] - mesh.min[1]] : null;
  const onView = (preset: ViewPreset) => stageRef.current?.setView(preset);
  const qty = Math.max(1, Number(stats?.quantity) || 1);
  const weight = Number(stats?.weightGrams);
  const minutes = Number(stats?.timeMinutes);

  return (
    <div ref={frameRef} className={className ?? cn(PREVIEW_FRAME_CLASS, "h-[420px] sm:h-[460px]")} data-testid="stl-preview-frame">
      <div className={PREVIEW_SCENE_CLASS}>
      {use3d ? (
        <div ref={mountRef} className="absolute inset-0" data-testid="stl-preview-3d" />
      ) : mesh ? (
        <SoftwareView mesh={mesh} color={appearance.color} />
      ) : null}

      {progress && (
        <PreviewLoading label={`${PHASE_LABEL[progress.phase]}…`} value={progress.value > 0 ? progress.value : null} />
      )}
      {loadError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <p className="max-w-sm rounded-md border border-destructive-border bg-destructive-subtle p-3 text-center text-xs text-destructive-subtle-foreground">
            The preview could not draw this file: {loadError}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1.5">
        <div className="flex min-w-0 max-w-full flex-col items-start gap-1 sm:max-w-[65%]">
          {size && (
            <PreviewChip testId="stl-preview-size">
              <span className="font-medium tabular-nums">
                {formatMm(size[0])} × {formatMm(size[1])} × {formatMm(size[2])} mm
              </span>
              <span className="text-muted-foreground">(W × D × H)</span>
            </PreviewChip>
          )}
          {!webgl && (
            <PreviewNotice testId="stl-preview-webgl-off">
              Interactive 3D needs WebGL, which is turned off or not supported in this browser. Showing a still view.
            </PreviewNotice>
          )}
          {webgl && webglFailed && (
            <PreviewNotice testId="stl-preview-webgl-off">The 3D view stopped working on this device. Showing a still view.</PreviewNotice>
          )}
          {exceedsBed && bedSize && use3d && (
            <PreviewNotice testId="stl-preview-exceeds">
              Larger than the {bedSize.x} × {bedSize.y} × {bedSize.z} mm build volume.
            </PreviewNotice>
          )}
          {mesh?.simplified && (
            <PreviewChip testId="stl-preview-simplified" className="text-muted-foreground">
              Simplified for the preview: {mesh.sourceTriangleCount.toLocaleString()} → {mesh.triangleCount.toLocaleString()} triangles
            </PreviewChip>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1 sm:flex-col sm:items-end">
          <PreviewChip testId="stl-preview-material">
            <span
              className="inline-block h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: appearance.color }}
              aria-hidden
            />
            {appearance.label}
          </PreviewChip>
          {(Number.isFinite(weight) && weight > 0) || (Number.isFinite(minutes) && minutes > 0) ? (
            <PreviewChip testId="stl-preview-stats">
              {Number.isFinite(weight) && weight > 0 && <span>{Math.ceil(weight)} g</span>}
              {Number.isFinite(minutes) && minutes > 0 && <span>· {formatMinutes(minutes)}</span>}
              {qty > 1 && <span className="text-muted-foreground">each</span>}
            </PreviewChip>
          ) : null}
        </div>
      </div>
      </div>

      {use3d && mesh && (
        <PreviewToolbar
          onView={onView}
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
          wireframe={wireframe}
          onWireframeChange={setWireframe}
          onShowSheet={() => onView("sheet")}
          sheetLabel="Plate"
          fullscreen={fullscreen}
          hint={touchHint()}
        />
      )}
    </div>
  );
}

export default StlModelPreview;
