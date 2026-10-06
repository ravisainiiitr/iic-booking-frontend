import { useEffect, useMemo, useRef, useState } from "react";
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
}

function DxfSvgPreview({ geometry, engraved, className }: { geometry: DxfGeometry; engraved: Set<DxfPath>; className?: string }) {
  const b = geometry.bounds!;
  const w = Math.max(b.maxX - b.minX, 1e-9);
  const h = Math.max(b.maxY - b.minY, 1e-9);
  const pad = Math.max(w, h) * 0.04;
  const strokeWidth = Math.max(w, h) / 400;
  return (
    <svg
      data-testid="dxf-preview-2d"
      className={className ?? "h-full w-full"}
      viewBox={`${b.minX - pad} ${-(b.maxY + pad)} ${w + 2 * pad} ${h + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="2D drawing preview"
    >
      <g transform="scale(1,-1)">
        {geometry.paths.slice(0, 20_000).map((path, idx) => {
          const engrave = engraved.has(path);
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
}: DxfModelPreviewProps) {
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
      <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground sm:h-[440px]">
        Upload a DXF to preview the part
      </div>
    );
  }

  const frameClass = className ?? cn(PREVIEW_FRAME_CLASS, "h-[400px] sm:h-[440px]");
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
          <DxfSvgPreview geometry={geometry} engraved={engraved} />
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
        toggle2d && <div className="flex border-t border-border bg-muted/40 p-1.5">{toggle2d}</div>
      )}
    </div>
  );
}

export default DxfModelPreview;
