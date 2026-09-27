import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "iic:chunk-reload-at";
const RELOAD_WINDOW_MS = 30_000;

function shouldReloadForChunkError(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * React.lazy for route pages. A deploy replaces hashed chunks, so a tab opened before it can
 * 404 on the dynamic import; reload once to pick up the new index.html, otherwise surface the
 * error to the nearest ErrorBoundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (shouldReloadForChunkError()) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
