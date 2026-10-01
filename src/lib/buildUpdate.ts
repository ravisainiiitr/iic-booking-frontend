const ENTRY_SCRIPT_RE = /<script\b[^>]*\bsrc="([^"]*\/assets\/index-[\w-]+\.js)"/i;
const CHUNK_RELOAD_KEY = "iic-chunk-reload-at";
const CHUNK_RELOAD_GAP_MS = 60_000;

/** The hashed Vite entry script referenced by an index.html, e.g. "/assets/index-DvyoLwho.js". */
export function entryScriptFromHtml(html: string): string | null {
  return ENTRY_SCRIPT_RE.exec(html)?.[1] ?? null;
}

/** The entry script this page was loaded with, or null in dev (unhashed /src/main.tsx). */
export function loadedEntryScript(doc: Document = document): string | null {
  const src = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute("src");
  return src ?? null;
}

/** True when the server's index.html points at a different build than the one running. */
export async function isNewBuildDeployed(current: string): Promise<boolean> {
  try {
    const res = await fetch("/", { cache: "no-store", headers: { Accept: "text/html" } });
    if (!res.ok) return false;
    const latest = entryScriptFromHtml(await res.text());
    return latest !== null && latest !== current;
  } catch {
    return false;
  }
}

/**
 * A tab opened before a deploy asks for lazy chunks that the new image no longer has. Reload once
 * so it picks up the new build instead of showing a broken page.
 */
export function installChunkReloadHandler(): void {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last < CHUNK_RELOAD_GAP_MS) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}
