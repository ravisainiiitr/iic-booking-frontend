import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import type { Orientation } from "@/lib/preview3d/orientation";

const MAX_TRIANGLES = 6000;
const SIZE = 112;
// Camera at the front-right-top of the plate (STL axes, Z up, front = −Y).
const VIEW: [number, number, number] = [1 / Math.sqrt(3), -1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const RIGHT: [number, number, number] = [Math.SQRT1_2, Math.SQRT1_2, 0];
const UP: [number, number, number] = (() => {
  const [vx, vy, vz] = VIEW;
  const [rx, ry, rz] = RIGHT;
  const u = [vy * rz - vz * ry, vz * rx - vx * rz, vx * ry - vy * rx];
  const len = Math.hypot(u[0], u[1], u[2]);
  return [u[0] / len, u[1] / len, u[2] / len];
})();
const LIGHT: [number, number, number] = (() => {
  const l = [0.3, -0.5, 1];
  const len = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / len, l[1] / len, l[2] / len];
})();

function rgbOf(color: string | null | undefined): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((color ?? "").trim());
  if (!m) return [96, 165, 250];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Sampled triangles of a binary STL (null for ASCII or unreadable files). */
function sampleTriangles(buffer: ArrayBuffer): Float32Array | null {
  if (buffer.byteLength < 84) return null;
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (!count || 84 + count * 50 !== buffer.byteLength) return null;
  const stride = Math.max(1, Math.ceil(count / MAX_TRIANGLES));
  const n = Math.ceil(count / stride);
  const out = new Float32Array(n * 9);
  let k = 0;
  for (let t = 0; t < count; t += stride) {
    const base = 84 + t * 50 + 12;
    for (let j = 0; j < 9; j++) out[k++] = view.getFloat32(base + j * 4, true);
  }
  return out;
}

function draw(canvas: HTMLCanvasElement, tris: Float32Array, orientation: Orientation, color: string | null | undefined) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const m = orientation ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const count = tris.length / 9;
  const pts = new Float32Array(count * 6);
  const depth = new Float32Array(count);
  const shade = new Float32Array(count);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let t = 0; t < count; t++) {
    for (let v = 0; v < 3; v++) {
      const x = tris[t * 9 + v * 3], y = tris[t * 9 + v * 3 + 1], z = tris[t * 9 + v * 3 + 2];
      const px = m[0] * x + m[1] * y + m[2] * z;
      const py = m[3] * x + m[4] * y + m[5] * z;
      const pz = m[6] * x + m[7] * y + m[8] * z;
      p[v * 3] = px;
      p[v * 3 + 1] = py;
      p[v * 3 + 2] = pz;
      const sx = px * RIGHT[0] + py * RIGHT[1] + pz * RIGHT[2];
      const sy = px * UP[0] + py * UP[1] + pz * UP[2];
      pts[t * 6 + v * 2] = sx;
      pts[t * 6 + v * 2 + 1] = sy;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2];
    const bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    shade[t] = 0.35 + 0.65 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len);
    const cx = (p[0] + p[3] + p[6]) / 3, cy = (p[1] + p[4] + p[7]) / 3, cz = (p[2] + p[5] + p[8]) / 3;
    depth[t] = cx * VIEW[0] + cy * VIEW[1] + cz * VIEW[2];
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = SIZE * 0.08;
  const scale = (SIZE - 2 * pad) / span;
  const offX = (SIZE - (maxX - minX) * scale) / 2;
  const offY = (SIZE - (maxY - minY) * scale) / 2;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => depth[a] - depth[b]);
  const [r, g, b] = rgbOf(color);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.6;
  for (const t of order) {
    const s = shade[t];
    const fill = `rgb(${Math.round(r * s)},${Math.round(g * s)},${Math.round(b * s)})`;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.beginPath();
    for (let v = 0; v < 3; v++) {
      const x = offX + (pts[t * 6 + v * 2] - minX) * scale;
      const y = SIZE - (offY + (pts[t * 6 + v * 2 + 1] - minY) * scale);
      if (v === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

const isJsdom = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/** Small shaded picture of an STL as placed on the plate (no WebGL; for part lists). */
export function StlThumbnail({
  buffer,
  orientation,
  color,
}: {
  buffer: ArrayBuffer | null;
  orientation?: Orientation;
  color?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tris, setTris] = useState<Float32Array | null>(null);
  const orientationKey = orientation ? orientation.join(",") : "";

  useEffect(() => {
    setTris(null);
    if (!buffer || isJsdom) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setTris(sampleTriangles(buffer));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buffer]);

  useEffect(() => {
    if (canvasRef.current && tris) draw(canvasRef.current, tris, orientation ?? null, color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tris, orientationKey, color]);

  if (!tris) {
    return (
      <span className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
        <Box className="h-6 w-6" />
      </span>
    );
  }
  return <canvas ref={canvasRef} width={SIZE} height={SIZE} className="h-full w-full" aria-hidden />;
}
