export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
}

let webglCache: boolean | null = null;

/** Whether this browser can create a WebGL context (checked once). */
export function isWebGLAvailable(): boolean {
  if (webglCache !== null) return webglCache;
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const w = window as unknown as { WebGLRenderingContext?: unknown; WebGL2RenderingContext?: unknown };
  if (!w.WebGLRenderingContext && !w.WebGL2RenderingContext) {
    webglCache = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    webglCache = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** Tests only. */
export function resetWebGLCache(value: boolean | null = null): void {
  webglCache = value;
}

export function formatMm(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000 || Math.abs(value - Math.round(value)) < 0.005) return String(Math.round(value));
  return value.toFixed(value >= 10 ? 1 : 2);
}
