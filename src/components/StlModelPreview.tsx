import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Layers3, TriangleAlert } from "lucide-react";
import * as THREE from "three";
import { printAppearance } from "@/lib/preview3d/appearance";
import { formatMm, isCoarsePointer, isWebGLAvailable, prefersReducedMotion } from "@/lib/preview3d/env";
import { loadStlMesh } from "@/lib/preview3d/loadStlMesh";
import { drawMeshToCanvas } from "@/lib/preview3d/softwareRender";
import type { StlMeshData, StlMeshPhase } from "@/lib/preview3d/stlMesh";
import { isIdentity, orientMesh, viewerToPrinter, type Orientation, type Vec3 } from "@/lib/preview3d/orientation";
import { computeSupports, type SupportColumns, type SupportViewMode } from "@/lib/preview3d/supportGeometry";
import { fitsOnlyWhenRotated, fitsPrintSize, formatPrintSizeLimit, type PrintSizeLimit } from "@/lib/printSizeLimit";
import { cn } from "@/lib/utils";
import { PreviewStage, type ViewPreset } from "@/components/preview3d/stage";
import { buildPrintScene, type PrintSceneResult } from "@/components/preview3d/printScene";
import {
  PREVIEW_BUTTON_CLASS,
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

export interface StlPreviewSupports {
  /** Supports as estimated (auto already resolved). */
  mode: SupportViewMode;
  angleDeg?: number | null;
  /** Support material look (a separate support material, else a lighter model colour). */
  color?: string | null;
  /** e.g. "Supports ~3.2 g": shown with the support toggle. */
  summary?: string | null;
}

export interface StlPreviewTimeline {
  /** Share of the print time done at each of equal heights (from the estimate). */
  progress?: number[] | null;
  printMinutes?: number | null;
  warmupMinutes?: number | null;
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
  /** The printer's maximum-size check for this model; replaces the generic build-volume notice. */
  sizeCheck?: StlPreviewSizeCheck | null;
  /** Print orientation (rotation of the STL, Z up); the model rests on the plate, centred. */
  orientation?: Orientation;
  /** With an orientation, the size check is redone for the turned model against this limit. */
  sizeLimit?: PrintSizeLimit | null;
  /** e.g. "User-selected orientation". */
  orientationNote?: string | null;
  supports?: StlPreviewSupports | null;
  timeline?: StlPreviewTimeline | null;
  /** Click a face of the model to lay it flat on the plate. */
  pickFace?: boolean;
  onFacePicked?: (normal: Vec3) => void;
}

export interface StlPreviewSizeCheck {
  tooLarge: boolean;
  /** Fits only after turning it; the lab re-orients it on the plate. */
  rotated: boolean;
  /** e.g. "220 × 220 × 250 mm". */
  limitLabel: string;
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

/** Elapsed print time when the print reaches `fraction` of its height (warm-up first). */
export function timeAtHeight(timeline: StlPreviewTimeline | null | undefined, fraction: number): number | null {
  const total = Number(timeline?.printMinutes);
  if (!Number.isFinite(total) || total <= 0) return null;
  const warm = Math.max(0, Number(timeline?.warmupMinutes) || 0);
  const p = timeline?.progress ?? [];
  const f = Math.min(1, Math.max(0, fraction));
  let share = f;
  if (p.length) {
    const x = f * p.length;
    const i = Math.floor(x);
    const lo = i <= 0 ? 0 : p[Math.min(i, p.length) - 1];
    const hi = p[Math.min(i, p.length - 1)];
    share = i >= p.length ? 1 : lo + (hi - lo) * (x - i);
  }
  return warm + share * Math.max(0, total - warm);
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

function lighten(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), amount);
  return `#${c.getHexString()}`;
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
  sizeCheck: sizeCheckProp,
  orientation: orientationProp = null,
  sizeLimit,
  orientationNote,
  supports: supportView,
  timeline,
  pickFace = false,
  onFacePicked,
}: StlModelPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<PreviewStage | null>(null);
  const sceneRef = useRef<PrintSceneResult | null>(null);
  const builtForRef = useRef<StlMeshData | null>(null);
  const fullscreen = useFullscreen(frameRef);
  const webgl = useMemo(() => isWebGLAvailable(), []);
  const coarse = useMemo(() => isCoarsePointer(), []);
  const [webglFailed, setWebglFailed] = useState(false);
  const [rawMesh, setRawMesh] = useState<StlMeshData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: StlMeshPhase; value: number } | null>(null);
  const [dimensions, setDimensions] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [showSupports, setShowSupports] = useState(true);
  const [showOverhangs, setShowOverhangs] = useState(false);
  const [cutFraction, setCutFraction] = useState(1);
  const [exceedsBed, setExceedsBed] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [supportState, setSupportState] = useState<{ mesh: StlMeshData; key: string; data: SupportColumns } | null>(null);

  const appearance = useMemo(
    () => printAppearance({ materialName, materialCode, colorHint }),
    [materialName, materialCode, colorHint],
  );
  const use3d = webgl && !webglFailed;
  // Callers pass new arrays each render: compare the orientation by value.
  const orientationKey = orientationProp ? orientationProp.join(",") : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orientation = useMemo(() => orientationProp, [orientationKey]);
  const mesh = useMemo(() => (rawMesh ? orientMesh(rawMesh, orientation) : null), [rawMesh, orientation]);
  const supportMode: SupportViewMode = supportView?.mode ?? "none";
  const supportAngle = Number(supportView?.angleDeg) || 45;
  const showSupportControls = !!supportView;

  const sizeCheck = useMemo<StlPreviewSizeCheck | null>(() => {
    if (!sizeLimit || !mesh || isIdentity(orientation)) return sizeCheckProp ?? null;
    const size: [number, number, number] = [mesh.max[0] - mesh.min[0], mesh.max[2] - mesh.min[2], mesh.max[1] - mesh.min[1]];
    const fits = fitsPrintSize(size, sizeLimit);
    return { tooLarge: !fits, rotated: fits && fitsOnlyWhenRotated(size, sizeLimit), limitLabel: formatPrintSizeLimit(sizeLimit) };
  }, [sizeLimit, mesh, orientation, sizeCheckProp]);
  const overLimit = !!sizeCheck?.tooLarge;

  useEffect(() => {
    setRawMesh(null);
    setLoadError(null);
    if (!buffer) return;
    let cancelled = false;
    setProgress({ phase: "parse", value: 0 });
    const maxTriangles = !use3d ? 60_000 : coarse ? 200_000 : 400_000;
    loadStlMesh(buffer, { maxTriangles }, (phase, fraction) => {
      if (cancelled) return;
      const [a, b] = PHASE_SPAN[phase];
      setProgress({ phase, value: a + (b - a) * fraction });
    })
      .then((data) => {
        if (cancelled) return;
        setRawMesh(data);
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
  }, [buffer, use3d, coarse]);

  // Support columns (and the faces that need them) follow the orientation; computed after the frame paints.
  const supportKey = `${supportMode}:${supportAngle}`;
  useEffect(() => {
    if (!mesh || !use3d || !showSupportControls) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const data = computeSupports(mesh.positions, { mode: supportMode, angleDeg: supportAngle, gridCells: coarse ? 70 : 120 });
      setSupportState({ mesh, key: supportKey, data });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mesh, use3d, showSupportControls, supportMode, supportAngle, supportKey, coarse]);
  const supportData =
    showSupportControls && supportState && supportState.mesh === mesh && supportState.key === supportKey ? supportState.data : null;
  // With supports shown, the scene waits for them (a moment) instead of drawing twice.
  const supportsPending = showSupportControls && use3d && !supportData;

  const hasMesh = !!rawMesh;
  useEffect(() => {
    const mount = mountRef.current;
    if (!use3d || !mount || !hasMesh) return;
    let created: PreviewStage;
    try {
      created = new PreviewStage(mount, {
        reducedMotion: prefersReducedMotion(),
        coarse,
        autoRotate: true,
        onContextLost: () => setWebglFailed(true),
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    setStage(created);
    return () => {
      created.dispose();
      sceneRef.current = null;
      builtForRef.current = null;
      setStage(null);
    };
  }, [use3d, hasMesh, coarse]);

  const supportColor = supportView?.color || lighten(appearance.color, 0.45);
  useEffect(() => {
    if (!stage || !mesh || !rawMesh || supportsPending) return;
    const keepView = builtForRef.current === rawMesh;
    try {
      if (sceneRef.current) stage.clearContent?.();
      const options = {
        overLimit,
        ...(supportData ? { supports: supportData, supportColor } : {}),
        ...(keepView ? { keepView: true } : {}),
      };
      const result = buildPrintScene(stage, mesh, appearance, bedSize, layerHeightMm, options);
      sceneRef.current = result;
      builtForRef.current = rawMesh;
      setExceedsBed(result.exceedsBed);
      setSceneVersion((v) => v + 1);
    } catch {
      stage.dispose();
      setStage(null);
      setWebglFailed(true);
    }
    // bedSize is compared by value: callers often pass a new object literal each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mesh, rawMesh, appearance, bedSize?.x, bedSize?.y, bedSize?.z, layerHeightMm, overLimit, supportData, supportColor, supportsPending]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const m of scene.materials as unknown as Array<{ wireframe: boolean }>) m.wireframe = wireframe;
    if (scene.supports) scene.supports.visible = showSupports;
    if (scene.overhangs) scene.overhangs.visible = showOverhangs;
    const height = mesh ? mesh.max[1] - mesh.min[1] : 0;
    scene.setCut?.(cutFraction >= 1 ? null : cutFraction * height);
    stage?.invalidate();
  }, [wireframe, showSupports, showOverhangs, cutFraction, sceneVersion, stage, mesh]);

  useEffect(() => {
    stage?.setOverlayVisible(dimensions);
  }, [dimensions, stage, sceneVersion]);

  useEffect(() => setCutFraction(1), [orientation, buffer]);

  // Lay flat: click a face; its outward normal (printer axes, current orientation) goes to the caller.
  useEffect(() => {
    if (!pickFace || !stage || !onFacePicked) return;
    const canvas = stage.renderer?.domElement;
    if (!canvas) return;
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, stage.camera);
      const model = stage.content.children.find((c) => c instanceof THREE.Group)?.children.find((c) => c instanceof THREE.Mesh);
      const hit = model ? ray.intersectObject(model, false)[0] : undefined;
      if (!hit?.face) return;
      const n = hit.face.normal.clone().normalize();
      onFacePicked(viewerToPrinter([n.x, n.y, n.z]));
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.style.cursor = "crosshair";
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.style.cursor = "";
    };
  }, [pickFace, stage, onFacePicked, sceneVersion]);

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
  const onView = (preset: ViewPreset) => stage?.setView(preset);
  const qty = Math.max(1, Number(stats?.quantity) || 1);
  const weight = Number(stats?.weightGrams);
  const minutes = Number(stats?.timeMinutes);
  const height = size ? size[2] : 0;
  const lh = Number(layerHeightMm) > 0 ? Number(layerHeightMm) : 0.2;
  const totalLayers = Math.max(1, Math.ceil(height / lh - 1e-9));
  const cutLayer = Math.max(1, Math.round(cutFraction * totalLayers));
  const cutTime = timeAtHeight(timeline, cutFraction);
  const totalTime = timeAtHeight(timeline, 1);

  const toggles = use3d && mesh && showSupportControls ? (
    <div className="flex items-center gap-1" role="group" aria-label="Supports">
      <button
        type="button"
        className={PREVIEW_BUTTON_CLASS}
        aria-pressed={showSupports}
        disabled={supportMode === "none"}
        onClick={() => setShowSupports((v) => !v)}
        title={supportMode === "none" ? "No supports for this model" : "Show supports"}
        data-testid="stl-preview-toggle-supports"
      >
        <Layers3 className="h-3.5 w-3.5" aria-hidden />
        <span>Supports</span>
      </button>
      <button
        type="button"
        className={PREVIEW_BUTTON_CLASS}
        aria-pressed={showOverhangs}
        onClick={() => setShowOverhangs((v) => !v)}
        title="Highlight overhangs (faces that need support) in red"
        data-testid="stl-preview-toggle-overhangs"
      >
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        <span>Overhangs</span>
      </button>
    </div>
  ) : null;

  return (
    <div ref={frameRef} className={className ?? cn(PREVIEW_FRAME_CLASS, "h-[460px] sm:h-[520px]")} data-testid="stl-preview-frame">
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
          {orientationNote && (
            <PreviewChip testId="stl-preview-orientation-note" className="border-primary/40">
              {orientationNote}
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
          {sizeCheck?.tooLarge && (
            <PreviewNotice testId="stl-preview-too-large" tone="destructive">
              Too large for this printer (maximum {sizeCheck.limitLabel}).
            </PreviewNotice>
          )}
          {sizeCheck && !sizeCheck.tooLarge && sizeCheck.rotated && (
            <PreviewChip testId="stl-preview-rotated">
              Fits the {sizeCheck.limitLabel} maximum when turned; the lab re-orients it on the plate.
            </PreviewChip>
          )}
          {!sizeCheck && exceedsBed && bedSize && use3d && (
            <PreviewNotice testId="stl-preview-exceeds">
              Larger than the {bedSize.x} × {bedSize.y} × {bedSize.z} mm build volume.
            </PreviewNotice>
          )}
          {mesh?.simplified && (
            <PreviewChip testId="stl-preview-simplified" className="text-muted-foreground">
              Simplified for the preview: {mesh.sourceTriangleCount.toLocaleString()} → {mesh.triangleCount.toLocaleString()} triangles
            </PreviewChip>
          )}
          {pickFace && (
            <PreviewChip testId="stl-preview-pick-hint" className="border-primary bg-primary/10">
              Click the face that should rest on the build plate
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
          {bedSize && bedSize.x > 0 && bedSize.y > 0 && (
            <PreviewChip testId="stl-preview-plate" className={cn(overLimit && "text-destructive")}>
              Build plate {formatMm(bedSize.x)} × {formatMm(bedSize.y)} mm
            </PreviewChip>
          )}
          {(Number.isFinite(weight) && weight > 0) || (Number.isFinite(minutes) && minutes > 0) ? (
            <PreviewChip testId="stl-preview-stats">
              {Number.isFinite(weight) && weight > 0 && <span>{Math.ceil(weight)} g</span>}
              {Number.isFinite(minutes) && minutes > 0 && <span>· {formatMinutes(minutes)}</span>}
              {qty > 1 && <span className="text-muted-foreground">each</span>}
            </PreviewChip>
          ) : null}
          {showSupportControls && use3d && mesh && (
            <PreviewChip testId="stl-preview-supports">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-border opacity-80"
                style={{ backgroundColor: supportColor }}
                aria-hidden
              />
              {supportMode === "none"
                ? "No supports"
                : supportView?.summary || `Supports: ${supportData?.count ?? 0} columns`}
            </PreviewChip>
          )}
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
          extra={toggles}
        />
      )}
      {use3d && mesh && height > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-2 py-1.5 text-xs" data-testid="stl-preview-layers">
          <label htmlFor="stl-preview-layer" className="flex items-center gap-1 font-medium">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Layer preview
          </label>
          <input
            id="stl-preview-layer"
            type="range"
            min={1}
            max={totalLayers}
            step={1}
            value={cutLayer}
            onChange={(e) => setCutFraction(Math.min(1, Number(e.target.value) / totalLayers))}
            className="h-6 min-w-[8rem] flex-1 accent-primary"
            aria-valuetext={`Layer ${cutLayer} of ${totalLayers}`}
            data-testid="stl-preview-layer-slider"
          />
          <span className="tabular-nums text-muted-foreground" data-testid="stl-preview-layer-label">
            Layer {cutLayer.toLocaleString()} / {totalLayers.toLocaleString()} · {formatMm(Math.min(height, cutLayer * lh))} mm
            {cutTime !== null && totalTime !== null
              ? cutFraction >= 1
                ? ` · done after ~${formatMinutes(totalTime)}`
                : ` · ~${formatMinutes(cutTime)} into the print`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default StlModelPreview;
