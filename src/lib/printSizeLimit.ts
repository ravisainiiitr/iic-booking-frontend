/**
 * Maximum print size of a 3D printer and the check of an STL model against it.
 *
 * Same rule as the server (`iic_booking/equipment/print_size_limit.py`): STL units are millimetres, each axis
 * may exceed the maximum by PRINT_SIZE_TOLERANCE_MM, and when rotation is allowed the model fits if its sorted
 * dimensions fit the sorted maximum dimensions. A blank axis has no limit.
 */
import { parseStlPositions } from "@/lib/preview3d/stlMesh";

export const PRINT_SIZE_TOLERANCE_MM = 0.5;
export const TINY_MODEL_MM = 1;

export type Size3 = [number, number, number];

export interface PrintSizeLimit {
  x: number | null;
  y: number | null;
  z: number | null;
  allowRotation: boolean;
}

/** Shape returned by the equipment detail and print-materials APIs (`max_print_size`). */
export interface MaxPrintSizePayload {
  x: number | string | null;
  y: number | string | null;
  z: number | string | null;
  allow_rotation?: boolean | null;
  tolerance_mm?: number;
}

function positiveOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function printSizeLimitFrom(raw: MaxPrintSizePayload | null | undefined): PrintSizeLimit | null {
  if (!raw) return null;
  const x = positiveOrNull(raw.x);
  const y = positiveOrNull(raw.y);
  const z = positiveOrNull(raw.z);
  if (x === null && y === null && z === null) return null;
  return { x, y, z, allowRotation: raw.allow_rotation !== false };
}

/** Width, depth and height of the model's bounding box, in file units (taken as mm). */
export function stlModelSize(buffer: ArrayBuffer): Size3 {
  const pos = parseStlPositions(buffer);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const z = pos[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  if (!Number.isFinite(min[0])) throw new Error("The STL file has no triangles.");
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

export function fitsPrintSize(size: Size3, limit: PrintSizeLimit | null, tolerance = PRINT_SIZE_TOLERANCE_MM): boolean {
  if (!limit) return true;
  let maxima = [limit.x, limit.y, limit.z].map((m) => (m === null ? Infinity : m));
  let dims = [...size];
  if (limit.allowRotation) {
    dims = dims.sort((a, b) => a - b);
    maxima = maxima.sort((a, b) => a - b);
  }
  return dims.every((d, i) => d <= maxima[i] + tolerance);
}

export function fitsOnlyWhenRotated(size: Size3, limit: PrintSizeLimit | null): boolean {
  if (!limit || !limit.allowRotation) return false;
  return fitsPrintSize(size, limit) && !fitsPrintSize(size, { ...limit, allowRotation: false });
}

function fmt(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function formatPrintSize(size: ReadonlyArray<number | null>): string {
  return `${size.map((v) => (v === null ? "any" : fmt(v))).join(" × ")} mm`;
}

export function formatPrintSizeLimit(limit: PrintSizeLimit): string {
  return formatPrintSize([limit.x, limit.y, limit.z]);
}

export function printSizeError(filename: string, size: Size3, limit: PrintSizeLimit | null): string | null {
  if (!limit || fitsPrintSize(size, limit)) return null;
  const rotation = limit.allowRotation ? " even when rotated" : "";
  return (
    `${filename} is ${formatPrintSize(size)} (W × D × H), larger than this printer's maximum print size of ` +
    `${formatPrintSizeLimit(limit)}${rotation}. Scale the model down or split it into parts, then upload it again.`
  );
}

export function tinyModelWarning(size: Size3): string | null {
  const largest = Math.max(...size);
  if (!(largest > 0) || largest >= TINY_MODEL_MM) return null;
  return (
    `The model is only ${formatPrintSize(size)}. STL sizes are read in millimetres; if it was exported in metres ` +
    "or inches, export it again in millimetres."
  );
}

/** Build plate (and height) drawn by the 3D preview when the OIC has not set a maximum print size. */
export const DEFAULT_PREVIEW_BED = { x: 220, y: 220, z: 250 } as const;

/** Build volume for the 3D preview: the printer's maximum print size set by the OIC. A blank plate axis is
 * drawn at the default 220 mm and a blank height draws no build-volume frame; nothing set = 220 × 220 × 250. */
export function previewBedSize(limit: PrintSizeLimit | null): { x: number; y: number; z: number } {
  if (!limit) return { ...DEFAULT_PREVIEW_BED };
  return { x: limit.x ?? DEFAULT_PREVIEW_BED.x, y: limit.y ?? DEFAULT_PREVIEW_BED.y, z: limit.z ?? 0 };
}

export interface StlSizeCheck {
  filename: string;
  size: Size3 | null;
  /** Set when the model is larger than the printer: blocks the upload. */
  error: string | null;
  /** Set for suspiciously small models: shown, not blocking. */
  warning: string | null;
  rotated: boolean;
}

export function checkStlSize(filename: string, buffer: ArrayBuffer, limit: PrintSizeLimit | null): StlSizeCheck {
  let size: Size3;
  try {
    size = stlModelSize(buffer);
  } catch {
    // The server analysis reports unreadable files.
    return { filename, size: null, error: null, warning: null, rotated: false };
  }
  return {
    filename,
    size,
    error: printSizeError(filename, size, limit),
    warning: tinyModelWarning(size),
    rotated: fitsOnlyWhenRotated(size, limit),
  };
}
