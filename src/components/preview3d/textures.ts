import * as THREE from "three";

/** Procedural canvas textures, so the preview ships no image assets. Sizes are in millimetres. */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  return ctx ? [c, ctx] : null;
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function finish(c: HTMLCanvasElement, opts: { srgb?: boolean; repeatMm?: number; anisotropy?: number } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (opts.srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeatMm) tex.repeat.set(1 / opts.repeatMm, 1 / opts.repeatMm);
  tex.anisotropy = opts.anisotropy ?? 4;
  tex.needsUpdate = true;
  return tex;
}

/** Plywood / solid wood face: soft growth rings with fine grain streaks. Tile covers `tileMm`. */
export function woodGrainTexture(baseHex: string, tileMm = 160) {
  const made = canvas(512, 512);
  if (!made) return null;
  const [c, ctx] = made;
  const base = new THREE.Color(baseHex);
  const rand = seeded(7);
  const img = ctx.createImageData(512, 512);
  const phase = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const u = x / 512;
      const v = y / 512;
      const warp =
        Math.sin(v * Math.PI * 2 * 2 + phase[0]) * 0.035 +
        Math.sin(v * Math.PI * 2 * 5 + phase[1]) * 0.012 +
        Math.sin((u + v) * Math.PI * 2 * 3 + phase[2]) * 0.01;
      const ring = 0.5 + 0.5 * Math.sin((u + warp) * Math.PI * 2 * 9 + Math.sin(v * Math.PI * 2 + phase[3]) * 1.5);
      const streak = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 64 + Math.sin(v * Math.PI * 2 * 3 + phase[4]) * 4);
      const shade = 1 - 0.16 * Math.pow(ring, 3) - 0.05 * streak + (rand() - 0.5) * 0.035;
      const i = (y * 512 + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, base.r * 255 * shade));
      img.data[i + 1] = Math.max(0, Math.min(255, base.g * 255 * shade));
      img.data[i + 2] = Math.max(0, Math.min(255, base.b * 255 * shade * 0.97));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, repeatMm: tileMm });
}

/** MDF face: uniform pressed fibre with a faint speckle. */
export function mdfTexture(baseHex: string, tileMm = 120) {
  const made = canvas(256, 256);
  if (!made) return null;
  const [c, ctx] = made;
  const base = new THREE.Color(baseHex);
  const rand = seeded(11);
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i += 1) {
    const shade = 1 + (rand() - 0.5) * 0.09 + (rand() < 0.02 ? -0.08 : 0);
    img.data[i * 4] = Math.min(255, base.r * 255 * shade);
    img.data[i * 4 + 1] = Math.min(255, base.g * 255 * shade);
    img.data[i * 4 + 2] = Math.min(255, base.b * 255 * shade);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, repeatMm: tileMm });
}

/** Brushed metal: long horizontal streaks, used as a roughness map (and a faint colour variation). */
export function brushedTexture(tileMm = 140) {
  const made = canvas(512, 512);
  if (!made) return null;
  const [c, ctx] = made;
  const rand = seeded(23);
  const img = ctx.createImageData(512, 512);
  const rows = new Float32Array(512);
  for (let y = 0; y < 512; y += 1) rows[y] = rand();
  for (let y = 0; y < 512; y += 1) {
    let run = rows[y];
    for (let x = 0; x < 512; x += 1) {
      run = run * 0.985 + rand() * 0.015;
      const v = 150 + (rows[y] - 0.5) * 70 + (run - 0.5) * 60;
      const i = (y * 512 + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { repeatMm: tileMm, anisotropy: 8 });
}

/** Textured PEI build plate with a 10 mm grid (50 mm major lines), mapped once over the plate. */
export function buildPlateTexture(widthMm: number, depthMm: number) {
  const scale = Math.min(4, 1024 / Math.max(widthMm, depthMm, 1));
  const w = Math.max(64, Math.round(widthMm * scale));
  const h = Math.max(64, Math.round(depthMm * scale));
  const made = canvas(w, h);
  if (!made) return null;
  const [c, ctx] = made;
  ctx.fillStyle = "#2b2d31";
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(5);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i += 1) {
    const n = (rand() - 0.5) * 18;
    img.data[i * 4] += n;
    img.data[i * 4 + 1] += n;
    img.data[i * 4 + 2] += n + 2;
  }
  ctx.putImageData(img, 0, 0);
  const line = (mm: number, major: boolean) => {
    ctx.strokeStyle = major ? "rgba(214, 222, 232, 0.32)" : "rgba(214, 222, 232, 0.13)";
    ctx.lineWidth = major ? 1.5 : 1;
    ctx.beginPath();
    const x = mm * scale;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  };
  const lineY = (mm: number, major: boolean) => {
    ctx.strokeStyle = major ? "rgba(214, 222, 232, 0.32)" : "rgba(214, 222, 232, 0.13)";
    ctx.lineWidth = major ? 1.5 : 1;
    ctx.beginPath();
    const y = mm * scale;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  };
  // Grid from the plate centre so the origin cross sits in the middle.
  const cx = widthMm / 2;
  const cy = depthMm / 2;
  for (let d = 0; d <= Math.max(cx, cy); d += 10) {
    const major = d % 50 === 0;
    if (cx + d <= widthMm) line(cx + d, major);
    if (d > 0 && cx - d >= 0) line(cx - d, major);
    if (cy + d <= depthMm) lineY(cy + d, major);
    if (d > 0 && cy - d >= 0) lineY(cy - d, major);
  }
  ctx.strokeStyle = "rgba(240, 244, 248, 0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  const tex = finish(c, { srgb: true, anisotropy: 8 });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Laser honeycomb bed tile (seamless), `cellMm` across a cell. */
export function honeycombTexture(cellMm = 9) {
  const r = 24;
  const tileW = r * 3;
  const tileH = Math.round(Math.sqrt(3) * r);
  const made = canvas(tileW * 2, tileH * 2);
  if (!made) return null;
  const [c, ctx] = made;
  ctx.fillStyle = "#15171a";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#5b6067";
  ctx.lineWidth = 2.2;
  const hex = (x: number, y: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k += 1) {
      const a = (Math.PI / 3) * k;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };
  for (let gy = -1; gy <= 4; gy += 1) {
    for (let gx = -1; gx <= 4; gx += 1) {
      hex(gx * 1.5 * r, gy * tileH + (Math.abs(gx) % 2 === 1 ? tileH / 2 : 0));
    }
  }
  const tex = finish(c, { srgb: true, anisotropy: 8 });
  const tileMm = cellMm * 2 * (tileW / (2 * r));
  tex.repeat.set(1 / tileMm, 1 / ((tileMm * c.height) / c.width));
  return tex;
}

/** Soft dark blob laid under an object as a contact shadow. */
export function contactShadowTexture() {
  const made = canvas(128, 128);
  if (!made) return null;
  const [c, ctx] = made;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.55, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Pill label for dimension sprites; returns the texture and its aspect ratio. */
export function labelTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } | null {
  const font = "600 30px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  const probe = canvas(8, 8);
  if (!probe) return null;
  probe[1].font = font;
  const textW = Math.ceil(probe[1].measureText(text).width || text.length * 16);
  const w = textW + 28;
  const h = 46;
  const made = canvas(w, h);
  if (!made) return null;
  const [c, ctx] = made;
  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  const rr = 14;
  ctx.beginPath();
  ctx.moveTo(rr, 0);
  ctx.arcTo(w, 0, w, h, rr);
  ctx.arcTo(w, h, 0, h, rr);
  ctx.arcTo(0, h, 0, 0, rr);
  ctx.arcTo(0, 0, w, 0, rr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = font;
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 1);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, aspect: w / h };
}
