/** Client-side STL mesh analysis for 3D print quoting (test / MVP). */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
  size: Vec3;
}

export interface PrintMaterial {
  id: string;
  label: string;
  densityGPerCm3: number;
  pricePerGram: number;
}

export interface PrintSettings {
  layerHeightMm: number;
  infillPercent: number;
  perimeterSpeedMmPerSec: number;
  flowRateMm3PerSec: number;
  startupMinutes: number;
}

export interface StlAnalysisResult {
  triangleCount: number;
  volumeMm3: number;
  volumeCm3: number;
  surfaceAreaMm2: number;
  boundingBox: BoundingBox;
  weightGrams: number;
  estimatedTimeMinutes: number;
  materialCost: number;
  warnings: string[];
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  layerHeightMm: 0.2,
  infillPercent: 20,
  perimeterSpeedMmPerSec: 45,
  flowRateMm3PerSec: 8,
  startupMinutes: 2,
};

export const PRINT_MATERIALS: PrintMaterial[] = [
  { id: "pla", label: "PLA", densityGPerCm3: 1.24, pricePerGram: 2.5 },
  { id: "petg", label: "PETG", densityGPerCm3: 1.27, pricePerGram: 3.0 },
  { id: "abs", label: "ABS", densityGPerCm3: 1.04, pricePerGram: 3.5 },
  { id: "tpu", label: "TPU", densityGPerCm3: 1.21, pricePerGram: 4.5 },
];

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function triangleArea(v1: Vec3, v2: Vec3, v3: Vec3): number {
  const ab = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
  const ac = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
  const c = cross(ab, ac);
  return 0.5 * Math.sqrt(dot(c, c));
}

/** Signed tetrahedron volume contribution per triangle (mesh must be watertight). */
function signedTetraVolume(v1: Vec3, v2: Vec3, v3: Vec3): number {
  return dot(v1, cross(v2, v3)) / 6;
}

function updateBounds(bounds: BoundingBox, v: Vec3): void {
  bounds.min.x = Math.min(bounds.min.x, v.x);
  bounds.min.y = Math.min(bounds.min.y, v.y);
  bounds.min.z = Math.min(bounds.min.z, v.z);
  bounds.max.x = Math.max(bounds.max.x, v.x);
  bounds.max.y = Math.max(bounds.max.y, v.y);
  bounds.max.z = Math.max(bounds.max.z, v.z);
}

function finalizeBounds(bounds: BoundingBox): BoundingBox {
  return {
    min: bounds.min,
    max: bounds.max,
    size: {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    },
  };
}

function emptyBounds(): BoundingBox {
  const inf = Number.POSITIVE_INFINITY;
  const ninf = Number.NEGATIVE_INFINITY;
  return finalizeBounds({
    min: { x: inf, y: inf, z: inf },
    max: { x: ninf, y: ninf, z: ninf },
    size: { x: 0, y: 0, z: 0 },
  });
}

function readFloatLE(view: DataView, offset: number): number {
  return view.getFloat32(offset, true);
}

function parseBinaryStl(buffer: ArrayBuffer): { triangles: Vec3[][] } {
  const view = new DataView(buffer);
  if (buffer.byteLength < 84) {
    throw new Error("File is too small to be a valid binary STL.");
  }
  const triangleCount = view.getUint32(80, true);
  const expectedSize = 84 + triangleCount * 50;
  if (buffer.byteLength < expectedSize) {
    throw new Error("Binary STL header reports more triangles than the file contains.");
  }

  const triangles: Vec3[][] = [];
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    offset += 12; // normal — unused
    const v1: Vec3 = {
      x: readFloatLE(view, offset),
      y: readFloatLE(view, offset + 4),
      z: readFloatLE(view, offset + 8),
    };
    const v2: Vec3 = {
      x: readFloatLE(view, offset + 12),
      y: readFloatLE(view, offset + 16),
      z: readFloatLE(view, offset + 20),
    };
    const v3: Vec3 = {
      x: readFloatLE(view, offset + 24),
      y: readFloatLE(view, offset + 28),
      z: readFloatLE(view, offset + 32),
    };
    triangles.push([v1, v2, v3]);
    offset += 36 + 2;
  }
  return { triangles };
}

function parseAsciiStl(text: string): { triangles: Vec3[][] } {
  const triangles: Vec3[][] = [];
  const vertexPattern =
    /vertex\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;

  const facetChunks = text.split(/endfacet/gi);
  for (const chunk of facetChunks) {
    const vertices: Vec3[] = [];
    let match: RegExpExecArray | null;
    vertexPattern.lastIndex = 0;
    while ((match = vertexPattern.exec(chunk)) !== null) {
      vertices.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: parseFloat(match[3]),
      });
    }
    if (vertices.length >= 3) {
      triangles.push([vertices[0], vertices[1], vertices[2]]);
    }
  }

  if (triangles.length === 0) {
    throw new Error("No triangles found in ASCII STL.");
  }
  return { triangles };
}

function isAsciiStl(buffer: ArrayBuffer): boolean {
  const preview = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, 256));
  const trimmed = preview.trimStart().toLowerCase();
  return trimmed.startsWith("solid") && preview.includes("facet");
}

export function parseStl(buffer: ArrayBuffer): { triangles: Vec3[][] } {
  if (isAsciiStl(buffer)) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseAsciiStl(text);
  }
  return parseBinaryStl(buffer);
}

/** Shell + infill factor: walls ~25% of solid volume plus infill share of remainder. */
export function materialUsageFactor(infillPercent: number): number {
  const infill = Math.min(100, Math.max(0, infillPercent)) / 100;
  const shellShare = 0.28;
  return shellShare + (1 - shellShare) * infill;
}

export function estimatePrintTimeMinutes(
  volumeMm3: number,
  surfaceAreaMm2: number,
  bboxHeightMm: number,
  settings: PrintSettings,
): number {
  const usage = materialUsageFactor(settings.infillPercent);
  const materialVolumeMm3 = volumeMm3 * usage;
  const extrudeSec = materialVolumeMm3 / Math.max(settings.flowRateMm3PerSec, 0.1);
  const layers = Math.max(1, bboxHeightMm / Math.max(settings.layerHeightMm, 0.05));
  const perimeterSec = surfaceAreaMm2 / Math.max(settings.perimeterSpeedMmPerSec, 1);
  const layerOverheadSec = layers * 1.5;
  const totalSec = extrudeSec + perimeterSec + layerOverheadSec + settings.startupMinutes * 60;
  return Math.max(1, Math.round(totalSec / 60));
}

export function analyzeStlMesh(
  triangles: Vec3[][],
  material: PrintMaterial,
  settings: PrintSettings,
  bedSizeMm?: Vec3,
): StlAnalysisResult {
  const warnings: string[] = [];
  if (triangles.length === 0) {
    throw new Error("STL contains no triangles.");
  }

  let signedVolume = 0;
  let surfaceArea = 0;
  const bounds = emptyBounds();
  bounds.min = { x: Infinity, y: Infinity, z: Infinity };
  bounds.max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const [v1, v2, v3] of triangles) {
    signedVolume += signedTetraVolume(v1, v2, v3);
    surfaceArea += triangleArea(v1, v2, v3);
    updateBounds(bounds, v1);
    updateBounds(bounds, v2);
    updateBounds(bounds, v3);
  }

  const bbox = finalizeBounds(bounds);
  const volumeMm3 = Math.abs(signedVolume);
  const volumeCm3 = volumeMm3 / 1000;

  if (volumeMm3 < 1e-6) {
    warnings.push("Computed volume is near zero — mesh may be open or invalid.");
  }

  const usage = materialUsageFactor(settings.infillPercent);
  const weightGrams = volumeCm3 * material.densityGPerCm3 * usage;
  const estimatedTimeMinutes = estimatePrintTimeMinutes(
    volumeMm3,
    surfaceArea,
    bbox.size.z,
    settings,
  );
  const materialCost = weightGrams * material.pricePerGram;

  if (bedSizeMm) {
    if (bbox.size.x > bedSizeMm.x || bbox.size.y > bedSizeMm.y || bbox.size.z > bedSizeMm.z) {
      warnings.push(
        `Model (${bbox.size.x.toFixed(1)}×${bbox.size.y.toFixed(1)}×${bbox.size.z.toFixed(1)} mm) exceeds bed (${bedSizeMm.x}×${bedSizeMm.y}×${bedSizeMm.z} mm).`,
      );
    }
  }

  if (triangles.length < 12) {
    warnings.push("Very low triangle count — model may be overly simplified.");
  }

  return {
    triangleCount: triangles.length,
    volumeMm3,
    volumeCm3,
    surfaceAreaMm2: surfaceArea,
    boundingBox: bbox,
    weightGrams,
    estimatedTimeMinutes,
    materialCost,
    warnings,
  };
}

export async function analyzeStlFile(
  file: File,
  material: PrintMaterial,
  settings: PrintSettings,
  bedSizeMm?: Vec3,
): Promise<StlAnalysisResult> {
  const buffer = await file.arrayBuffer();
  const { triangles } = parseStl(buffer);
  return analyzeStlMesh(triangles, material, settings, bedSizeMm);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
