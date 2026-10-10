import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Maximize, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { buildRegions, type DxfGeometry, type DxfPath } from "@/lib/dxfGeometry";
import { isEngraveLayer, laserAppearance } from "@/lib/preview3d/appearance";
import { formatMm, isCoarsePointer, isWebGLAvailable, prefersReducedMotion } from "@/lib/preview3d/env";
import { cn } from "@/lib/utils";
import { PreviewStage, type ViewPreset } from "@/components/preview3d/stage";
import { buildLaserScene } from "@/components/preview3d/laserScene";
import {
  PREVIEW_BUTTON_CLASS,
  PREVIEW_FRAME_CLASS,
  PREVIEW_SCENE_CLASS,
  PreviewChip,
  PreviewNotice,
  PreviewToolbar,
  touchHint,
  useFullscreen,
} from "@/components/preview3d/PreviewChrome";

interface DxfModelPreviewProps {
  geometry: DxfGeometry | null;
  /** Millimetres per drawing unit (from the chosen unit). */
  unitScale: number;
  /** Sheet thickness in mm; the part is extruded to this depth. */
  thicknessMm?: number | null;
  /** Backend measurement (authoritative) shown in the caption, when available. */
  widthMm?: number | null;
  heightMm?: number | null;
  className?: string;
  /** Force the 2D view (used by tests and when the user picks it). */
  force2d?: boolean;
  /** Sheet material of the part, for its look (acrylic, plywood, MDF, steel…). */
  materialName?: string | null;
  materialCode?: string | null;
  /** Laser sheet family (ACRYLIC, MDF, MS, SS, OTHER) when known. */
  materialFamily?: string | null;
  /** Stock sheet size in mm; the part is shown lying on a sheet of this size. */
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
  /** Height classes of the frame when no `className` is given (default 400 / 440 px). */
  heightClass?: string;
}

const MAX_ZOOM = 40;

function DxfSvgPreview({
  geometry,
  engraved,
  className,
  showCut = true,
  showEngrave = true,
}: {
  geometry: DxfGeometry;
  engraved: Set<DxfPath>;
  className?: string;
  showCut?: boolean;
  showEngrave?: boolean;
}) {
  const b = geometry.bounds!;
  const w = Math.max(b.maxX - b.minX, 1e-9);
  const h = Math.max(b.maxY - b.minY, 1e-9);
  const pad = Math.max(w, h) * 0.04;
  const strokeWidth = Math.max(w, h) / 400;
  const baseW = w + 2 * pad;
  const baseH = h + 2 * pad;
  const home = useMemo(() => ({ zoom: 1, cx: b.minX - pad + baseW / 2, cy: -(b.maxY + pad) + baseH / 2 }), [b.minX, b.maxY, pad, baseW, baseH]);
  const [view, setView] = useState(home);
  useEffect(() => setView(home), [home]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const vw = baseW / view.zoom;
  const vh = baseH / view.zoom;

  // Drawing units per screen pixel ("meet" fits the whole view box).
  const unitsPerPx = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return 0;
    return Math.max(vw / rect.width, vh / rect.height);
  }, [vw, vh]);

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) =>
      setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor));
        if (zoom === 1) return home;
        if (!at) return { ...v, zoom };
        const k = v.zoom / zoom;
        return { zoom, cx: at.x + (v.cx - at.x) * k, cy: at.y + (v.cy - at.y) * k };
      }),
    [home],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Native listener: React's wheel handler is passive and cannot stop the page scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const upp = Math.max((baseW / view.zoom) / rect.width, (baseH / view.zoom) / rect.height) || 0;
      const at = { x: view.cx + (e.clientX - rect.left - rect.width / 2) * upp, y: view.cy + (e.clientY - rect.top - rect.height / 2) * upp };
      zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, at);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [view, baseW, baseH, zoomBy]);

  const pan = (dx: number, dy: number) => setView((v) => (v.zoom === 1 ? v : { ...v, cx: v.cx + dx, cy: v.cy + dy }));
  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const step = (vw + vh) * 0.05;
    const keys: Record<string, () => void> = {
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
      "0": () => setView(home),
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, -step),
      ArrowDown: () => pan(0, step),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  return (
    <div className="relative h-full w-full">
    <svg
      ref={svgRef}
      data-testid="dxf-preview-2d"
      className={cn(className ?? "h-full w-full", "touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view.zoom > 1 && "cursor-grab")}
      viewBox={`${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="2D drawing preview. Plus and minus zoom, arrow keys pan, 0 resets."
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (!start) return;
        const upp = unitsPerPx();
        drag.current = { x: e.clientX, y: e.clientY };
        pan(-(e.clientX - start.x) * upp, -(e.clientY - start.y) * upp);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <g transform="scale(1,-1)">
        {geometry.paths.slice(0, 20_000).map((path, idx) => {
          const engrave = engraved.has(path);
          if (engrave ? !showEngrave : !showCut) return null;
          return (
            <polyline
              key={idx}
              points={(path.closed ? [...path.points, path.points[0]] : path.points).map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              className={engrave ? "stroke-amber-600 dark:stroke-amber-400" : "stroke-sky-700 dark:stroke-sky-400"}
              strokeWidth={strokeWidth}
              strokeDasharray={engrave ? "4 3" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    </svg>
      <div className="absolute bottom-2 right-2 flex gap-1" role="group" aria-label="Zoom the drawing">
        <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out" disabled={view.zoom <= 1}>
          <ZoomOut className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => setView(home)} aria-label="Fit the drawing" title="Fit">
          <Maximize className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function DxfModelPreview({
  geometry,
  unitScale,
  thicknessMm,
  widthMm,
  heightMm,
  className,
  force2d,
  materialName,
  materialCode,
  materialFamily,
  sheetWidthMm,
  sheetHeightMm,
  heightClass = "h-[400px] sm:h-[440px]",
}: DxfModelPreviewProps) {
  const [showCut, setShowCut] = useState(true);
  const [showEngrave, setShowEngrave] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<PreviewStage | null>(null);
  const materialsRef = useRef<Array<{ wireframe: boolean }>>([]);
  const [webglFailed, setWebglFailed] = useState(false);
  const [view2d, setView2d] = useState(Boolean(force2d));
  const [dimensions, setDimensions] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [sceneInfo, setSceneInfo] = useState<{ exceedsSheet: boolean; hasSheet: boolean } | null>(null);
  const fullscreen = useFullscreen(frameRef);
  const webgl = useMemo(() => isWebGLAvailable(), []);

  const { cutPaths, engravePaths, engraved } = useMemo(() => {
    const cut: DxfPath[] = [];
    const eng: DxfPath[] = [];
    for (const p of geometry?.paths ?? []) (isEngraveLayer(p.layer) ? eng : cut).push(p);
    return { cutPaths: cut, engravePaths: eng, engraved: new Set(eng) };
  }, [geometry]);
  const regions = useMemo(
    () => (geometry ? buildRegions(engravePaths.length ? { ...geometry, paths: cutPaths } : geometry) : []),
    [geometry, cutPaths, engravePaths.length],
  );
  const appearance = useMemo(
    () => laserAppearance({ family: materialFamily, materialName, materialCode }),
    [materialFamily, materialName, materialCode],
  );
  const thickness = Math.max(Number(thicknessMm) || 0, 0.5);
  const scale = unitScale > 0 ? unitScale : 1;
  const sheetW = Number(sheetWidthMm) || 0;
  const sheetH = Number(sheetHeightMm) || 0;

  const localW = geometry?.bounds ? (geometry.bounds.maxX - geometry.bounds.minX) * scale : 0;
  const localH = geometry?.bounds ? (geometry.bounds.maxY - geometry.bounds.minY) * scale : 0;
  const shownW = widthMm != null && Number.isFinite(Number(widthMm)) ? Number(widthMm) : localW;
  const shownH = heightMm != null && Number.isFinite(Number(heightMm)) ? Number(heightMm) : localH;
  const areaM2 = (shownW * shownH) / 1_000_000;

  const can3d = webgl && !webglFailed && regions.length > 0 && Boolean(geometry?.bounds);
  const use3d = can3d && !view2d;

  useEffect(() => {
    const mount = mountRef.current;
    if (!use3d || !mount || !geometry?.bounds) return;
    let stage: PreviewStage;
    try {
      stage = new PreviewStage(mount, {
        reducedMotion: prefersReducedMotion(),
        coarse: isCoarsePointer(),
        onContextLost: () => setWebglFailed(true),
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    stageRef.current = stage;
    const b = geometry.bounds;
    try {
      const result = buildLaserScene(stage, {
        regions,
        cutPaths,
        engravePaths,
        center: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2],
        scale,
        thicknessMm: thickness,
        appearance,
        sheet: sheetW > 0 && sheetH > 0 ? { widthMm: sheetW, heightMm: sheetH } : null,
        labelSize: shownW > 0 && shownH > 0 ? { widthMm: shownW, heightMm: shownH } : null,
      });
      materialsRef.current = result.materials as unknown as Array<{ wireframe: boolean }>;
      setSceneInfo({ exceedsSheet: result.exceedsSheet, hasSheet: result.hasSheet });
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
    };
    // shownW/shownH only change the label text with the geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3d, geometry, regions, cutPaths, engravePaths, scale, thickness, appearance, sheetW, sheetH]);

  useEffect(() => {
    for (const m of materialsRef.current) m.wireframe = wireframe;
    stageRef.current?.invalidate();
  }, [wireframe, sceneInfo]);

  useEffect(() => {
    stageRef.current?.setOverlayVisible(dimensions);
  }, [dimensions, sceneInfo]);

  const onView = (preset: ViewPreset) => stageRef.current?.setView(preset);

  if (!geometry?.bounds) {
    return (
      <div className={cn("flex w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground", heightClass)}>
        Upload a DXF to preview the part
      </div>
    );
  }

  const frameClass = className ?? cn(PREVIEW_FRAME_CLASS, heightClass);
  const layerToggles =
    !use3d && engravePaths.length > 0 ? (
      <div className="flex items-center gap-1" role="group" aria-label="Layers">
        <button
          type="button"
          className={PREVIEW_BUTTON_CLASS}
          aria-pressed={showCut}
          onClick={() => setShowCut((v) => !v)}
          data-testid="dxf-preview-layer-cut"
        >
          Cut
        </button>
        <button
          type="button"
          className={PREVIEW_BUTTON_CLASS}
          aria-pressed={showEngrave}
          onClick={() => setShowEngrave((v) => !v)}
          data-testid="dxf-preview-layer-engrave"
        >
          Engrave
        </button>
      </div>
    ) : null;
  const toggle2d = can3d ? (
    <button type="button" className={PREVIEW_BUTTON_CLASS} onClick={() => setView2d((v) => !v)} title={view2d ? "Show the 3D part" : "Show the flat 2D outline"}>
      {view2d ? "Show 3D" : "Outline"}
    </button>
  ) : null;

  return (
    <div ref={frameRef} className={frameClass} data-testid="dxf-preview-frame">
      <div className={PREVIEW_SCENE_CLASS}>
      {use3d ? (
        <div ref={mountRef} className="absolute inset-0" data-testid="dxf-preview-3d" />
      ) : (
        <div className="absolute inset-0 bg-background/60 p-3 pt-14">
          <DxfSvgPreview geometry={geometry} engraved={engraved} showCut={showCut} showEngrave={showEngrave} />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1.5">
        <div className="flex min-w-0 max-w-full flex-col items-start gap-1 sm:max-w-[65%]">
          <PreviewChip className="flex-wrap">
            <span data-testid="dxf-preview-size" className="font-medium tabular-nums">
              {formatMm(shownW)} × {formatMm(shownH)} mm
            </span>
            <span className="text-muted-foreground">({areaM2.toFixed(4)} m²)</span>
            {thicknessMm ? <span className="text-muted-foreground">· {Number(thicknessMm)} mm thick</span> : null}
          </PreviewChip>
          {!webgl && (
            <PreviewNotice testId="dxf-preview-webgl-off">
              3D preview needs WebGL, which is turned off or not supported in this browser. Showing the 2D outline.
            </PreviewNotice>
          )}
          {webgl && webglFailed && (
            <PreviewNotice testId="dxf-preview-webgl-off">The 3D view stopped working on this device. Showing the 2D outline.</PreviewNotice>
          )}
          {use3d && sceneInfo?.exceedsSheet && (
            <PreviewNotice testId="dxf-preview-exceeds">
              This part is larger than the {formatMm(sheetW)} × {formatMm(sheetH)} mm sheet.
            </PreviewNotice>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1 sm:flex-col sm:items-end">
          {(materialName || materialFamily) && <PreviewChip testId="dxf-preview-material">{appearance.label}</PreviewChip>}
          {engravePaths.length > 0 && (
            <PreviewChip testId="dxf-preview-legend">
              <span
                className={cn("inline-block h-0.5 w-4", use3d ? "bg-foreground" : "bg-sky-700 dark:bg-sky-400")}
                aria-hidden
              />
              Cut (solid)
              <span
                className={cn(
                  "ml-1.5 inline-block w-4 border-t-2 border-dashed",
                  use3d ? "border-foreground" : "border-amber-600 dark:border-amber-400",
                )}
                aria-hidden
              />
              Engrave (dashed)
            </PreviewChip>
          )}
        </div>
      </div>

      {!use3d && regions.length === 0 && (
        <p className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          No closed outlines found, so a 2D view is shown
        </p>
      )}
      </div>

      {use3d ? (
        <PreviewToolbar
          onView={onView}
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
          wireframe={wireframe}
          onWireframeChange={setWireframe}
          onShowSheet={sceneInfo?.hasSheet ? () => onView("sheet") : undefined}
          sheetLabel="Sheet"
          fullscreen={fullscreen}
          hint={touchHint()}
          extra={toggle2d}
        />
      ) : (
        (toggle2d || layerToggles || fullscreen.supported) && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border bg-muted/40 p-1.5">
            {toggle2d}
            {layerToggles}
            {fullscreen.supported && (
              <button
                type="button"
                className={PREVIEW_BUTTON_CLASS}
                aria-pressed={fullscreen.active}
                aria-label={fullscreen.active ? "Exit full screen" : "Full screen"}
                onClick={fullscreen.toggle}
              >
                {fullscreen.active ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
              </button>
            )}
            <p className="ml-auto hidden px-1 text-[11px] text-muted-foreground lg:block">Scroll to zoom · drag to pan</p>
          </div>
        )
      )}
    </div>
  );
}

export default DxfModelPreview;
