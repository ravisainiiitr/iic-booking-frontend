/**
 * Large result downloads without buffering the file in memory.
 *
 * Where the browser supports the File System Access API (Chrome / Edge on desktop) the user picks the save
 * location first and the response is written to disk as it arrives, so the progress shown is the real number of
 * bytes saved. Elsewhere the browser downloads a signed link natively and shows progress in its own downloads UI.
 */

export type ResultsDownloadProgress = {
  phase: "preparing" | "downloading" | "done";
  receivedBytes: number;
  /** 0 when unknown. */
  totalBytes: number;
  /** null while the total is unknown. Held at 99 until the last byte is written. */
  percent: number | null;
};

/** "saved": written to disk with in-page progress; "browser": handed to the browser's downloads; "cancelled": save dialog dismissed. */
export type ResultsDownloadMode = "saved" | "browser" | "cancelled";

type WritableFileStream = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
};

type SaveFileHandle = { createWritable(): Promise<WritableFileStream> };

type SaveFilePicker = (options: { suggestedName?: string }) => Promise<SaveFileHandle>;

export function getSaveFilePicker(): SaveFilePicker | null {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (typeof picker !== "function") return null;
  try {
    if (window.self !== window.top) return null;
  } catch {
    return null;
  }
  return picker.bind(window);
}

export function progressFor(receivedBytes: number, totalBytes: number): ResultsDownloadProgress {
  const percent = totalBytes > 0 ? Math.min(99, Math.floor((receivedBytes / totalBytes) * 100)) : null;
  return { phase: "downloading", receivedBytes, totalBytes, percent };
}

export function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/** Ask where to save; null when the user dismissed the dialog. Throws when the picker cannot be shown. */
export async function pickSaveTarget(picker: SaveFilePicker, suggestedName: string): Promise<WritableFileStream | null> {
  try {
    const handle = await picker({ suggestedName });
    return await handle.createWritable();
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  }
}

/** Copy ``body`` into ``target`` chunk by chunk, reporting progress; aborts ``target`` (no partial file) on failure. */
export async function pipeToFile(
  body: ReadableStream<Uint8Array>,
  target: WritableFileStream,
  totalBytes: number,
  onProgress?: (progress: ResultsDownloadProgress) => void,
): Promise<void> {
  const reader = body.getReader();
  let received = 0;
  onProgress?.(progressFor(0, totalBytes));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      await target.write(value);
      received += value.byteLength;
      onProgress?.(progressFor(received, totalBytes));
    }
    await target.close();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await target.abort(error).catch(() => undefined);
    throw error;
  }
  onProgress?.({ phase: "done", receivedBytes: received, totalBytes: Math.max(totalBytes, received), percent: 100 });
}

/** Start a native browser download of a URL that answers with ``Content-Disposition: attachment``. */
export function startBrowserDownload(url: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
