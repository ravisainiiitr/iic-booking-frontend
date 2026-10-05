import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildRegions, type DxfGeometry } from "@/lib/dxfGeometry";

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
}

function formatMm(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}

function DxfSvgPreview({ geometry, className }: { geometry: DxfGeometry; className?: string }) {
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
        {geometry.paths.slice(0, 20_000).map((path, idx) => (
          <polyline
            key={idx}
            points={(path.closed ? [...path.points, path.points[0]] : path.points).map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ))}
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
}: DxfModelPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [view2d, setView2d] = useState(Boolean(force2d));

  const regions = useMemo(() => (geometry ? buildRegions(geometry) : []), [geometry]);
  const thickness = Math.max(Number(thicknessMm) || 0, 0.5);
  const scale = unitScale > 0 ? unitScale : 1;

  const localW = geometry?.bounds ? (geometry.bounds.maxX - geometry.bounds.minX) * scale : 0;
  const localH = geometry?.bounds ? (geometry.bounds.maxY - geometry.bounds.minY) * scale : 0;
  const shownW = widthMm != null && Number.isFinite(Number(widthMm)) ? Number(widthMm) : localW;
  const shownH = heightMm != null && Number.isFinite(Number(heightMm)) ? Number(heightMm) : localH;
  const areaM2 = (shownW * shownH) / 1_000_000;

  const use3d = !view2d && !webglFailed && regions.length > 0 && Boolean(geometry?.bounds);

  useEffect(() => {
    const mount = mountRef.current;
    if (!use3d || !mount || !geometry?.bounds) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1_000_000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const b = geometry.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const toVec = ([x, y]: [number, number]) => new THREE.Vector2((x - cx) * scale, (y - cy) * scale);

    const shapes = regions.map((region) => {
      const shape = new THREE.Shape(region.outer.map(toVec));
      shape.holes = region.holes.map((hole) => new THREE.Path(hole.map(toVec)));
      return shape;
    });
    const solid = new THREE.ExtrudeGeometry(shapes, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
    const solidMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.1, roughness: 0.55 });
    const mesh = new THREE.Mesh(solid, solidMaterial);

    const edgePositions: number[] = [];
    for (const path of geometry.paths) {
      const pts = path.closed ? [...path.points, path.points[0]] : path.points;
      for (let i = 0; i + 1 < pts.length; i += 1) {
        const a = toVec(pts[i]);
        const c = toVec(pts[i + 1]);
        edgePositions.push(a.x, a.y, thickness + 0.02, c.x, c.y, thickness + 0.02);
      }
    }
    const edges = new THREE.BufferGeometry();
    edges.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
    const lines = new THREE.LineSegments(edges, edgeMaterial);

    const part = new THREE.Group();
    part.add(mesh, lines);
    part.rotation.x = -Math.PI / 2;
    scene.add(part);

    const span = Math.max((b.maxX - b.minX) * scale, (b.maxY - b.minY) * scale, 10);
    const grid = new THREE.GridHelper(span * 1.4, 20, 0x475569, 0x334155);
    grid.position.y = -0.01;
    scene.add(grid);

    const fit = () => {
      const box = new THREE.Box3().setFromObject(part);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fov = (camera.fov * Math.PI) / 180;
      const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      camera.position.copy(center).add(new THREE.Vector3(0.6, 1.2, 0.9).normalize().multiplyScalar(distance));
      camera.near = Math.max(0.05, distance / 500);
      camera.far = distance * 200;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      fit();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(mount);
    requestAnimationFrame(resize);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      controls.dispose();
      solid.dispose();
      edges.dispose();
      grid.geometry.dispose();
      solidMaterial.dispose();
      edgeMaterial.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [use3d, geometry, regions, scale, thickness]);

  const frameClass = className ?? "relative h-[320px] w-full overflow-hidden rounded-lg border bg-[#0f172a]";

  if (!geometry?.bounds) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
        Upload a DXF to preview the part
      </div>
    );
  }

  return (
    <div className={frameClass}>
      {use3d ? (
        <div ref={mountRef} className="absolute inset-0" data-testid="dxf-preview-3d" />
      ) : (
        <div className="absolute inset-0 p-3">
          <DxfSvgPreview geometry={geometry} />
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-2 z-10 rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-100">
        <span data-testid="dxf-preview-size">
          {formatMm(shownW)} × {formatMm(shownH)} mm
        </span>
        <span className="ml-2 text-slate-300">({areaM2.toFixed(4)} m²)</span>
        {thicknessMm ? <span className="ml-2 text-slate-300">· {Number(thicknessMm)} mm thick</span> : null}
      </div>
      {!webglFailed && regions.length > 0 && (
        <button
          type="button"
          className="absolute bottom-2 left-3 z-10 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-100 hover:bg-slate-700"
          onClick={() => setView2d((v) => !v)}
        >
          {view2d ? "Show 3D" : "Show 2D"}
        </button>
      )}
      {use3d && (
        <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] text-slate-400">
          Drag to rotate · scroll to zoom
        </p>
      )}
      {!use3d && regions.length === 0 && (
        <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] text-slate-400">
          No closed outlines found, so a 2D view is shown
        </p>
      )}
    </div>
  );
}
