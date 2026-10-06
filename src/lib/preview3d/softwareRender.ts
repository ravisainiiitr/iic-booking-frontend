import type { StlMeshData } from "./stlMesh";

/**
 * Static shaded 3D-style view of a mesh drawn with the 2D canvas API, for browsers without WebGL.
 * Painter's algorithm (far triangles first) with simple diffuse shading; meant for up to ~60k triangles.
 */
export function drawMeshToCanvas(canvas: HTMLCanvasElement, mesh: StlMeshData, colorHex: string): boolean {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return false;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pos = mesh.positions;
  const tris = pos.length / 9;
  if (!tris) return false;

  const cx = (mesh.min[0] + mesh.max[0]) / 2;
  const cy = (mesh.min[1] + mesh.max[1]) / 2;
  const cz = (mesh.min[2] + mesh.max[2]) / 2;
  const yaw = Math.PI / 4;
  const pitch = 0.55;
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const project = (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const rx = dx * cyaw - dz * syaw;
    const rz = dx * syaw + dz * cyaw;
    const ry = dy * cp - rz * sp;
    const depth = dy * sp + rz * cp;
    return [rx, ry, depth];
  };

  const proj = new Float32Array(tris * 9);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const depth = new Float32Array(tris);
  for (let t = 0; t < tris; t += 1) {
    let d = 0;
    for (let v = 0; v < 3; v += 1) {
      const i = t * 9 + v * 3;
      const [px, py, pz] = project(pos[i], pos[i + 1], pos[i + 2]);
      proj[i] = px;
      proj[i + 1] = py;
      proj[i + 2] = pz;
      d += pz;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    depth[t] = d;
  }
  const scale = Math.min((w * 0.82) / Math.max(maxX - minX, 1e-6), (h * 0.82) / Math.max(maxY - minY, 1e-6));
  const ox = w / 2 - ((minX + maxX) / 2) * scale;
  const oy = h / 2 + ((minY + maxY) / 2) * scale;
  // The viewer sits on +depth, so the smallest depth is farthest and is painted first.
  const order = Array.from({ length: tris }, (_, i) => i).sort((a, b) => depth[a] - depth[b]);

  const base = Number.parseInt(colorHex.replace("#", ""), 16) || 0xd9dce1;
  const br = (base >> 16) & 255;
  const bg = (base >> 8) & 255;
  const bb = base & 255;
  const light = [0.35, 0.85, 0.4];
  const ll = Math.hypot(light[0], light[1], light[2]);
  for (const t of order) {
    const i = t * 9;
    const ax = proj[i + 3] - proj[i];
    const ay = proj[i + 4] - proj[i + 1];
    const az = proj[i + 5] - proj[i + 2];
    const bx = proj[i + 6] - proj[i];
    const by = proj[i + 7] - proj[i + 1];
    const bz = proj[i + 8] - proj[i + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nz < 0) continue;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const diffuse = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / (nl * ll));
    const k = 0.35 + 0.65 * diffuse;
    ctx.fillStyle = `rgb(${Math.round(br * k)},${Math.round(bg * k)},${Math.round(bb * k)})`;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(ox + proj[i] * scale, oy - proj[i + 1] * scale);
    ctx.lineTo(ox + proj[i + 3] * scale, oy - proj[i + 4] * scale);
    ctx.lineTo(ox + proj[i + 6] * scale, oy - proj[i + 7] * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return true;
}
