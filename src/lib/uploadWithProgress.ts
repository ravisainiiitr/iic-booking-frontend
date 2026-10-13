/**
 * Multipart upload with real progress. ``fetch`` cannot report upload progress, so this uses XMLHttpRequest.
 */

export type UploadProgress = {
  /** "uploading": bytes leaving the browser; "processing": all sent, waiting for the server to store them. */
  phase: "uploading" | "processing";
  sentBytes: number;
  totalBytes: number;
  /** Held at 99 until the server answers. */
  percent: number;
  /** Average since the start; null until measurable. */
  bytesPerSecond: number | null;
  secondsLeft: number | null;
};

export type UploadResult = { ok: boolean; status: number; data: unknown; aborted?: boolean };

export function uploadProgress(sent: number, total: number, elapsedMs: number): UploadProgress {
  const done = total > 0 && sent >= total;
  const bytesPerSecond = elapsedMs >= 1000 && sent > 0 ? sent / (elapsedMs / 1000) : null;
  return {
    phase: done ? "processing" : "uploading",
    sentBytes: sent,
    totalBytes: total,
    percent: total > 0 ? Math.min(99, Math.floor((sent / total) * 100)) : 0,
    bytesPerSecond,
    secondsLeft: bytesPerSecond && !done ? Math.ceil((total - sent) / bytesPerSecond) : null,
  };
}

export function postFormWithProgress(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const started = Date.now();
    let total = 0;
    xhr.open("POST", url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      total = event.total;
      onProgress?.(uploadProgress(event.loaded, event.total, Date.now() - started));
    };
    xhr.upload.onload = () => {
      onProgress?.({ ...uploadProgress(total, total, Date.now() - started), phase: "processing" });
    };
    const finish = (result: UploadResult) => {
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort);
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      finish({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => finish({ ok: false, status: 0, data: { error: "Network error while uploading. Please try again." } });
    xhr.onabort = () => finish({ ok: false, status: 0, data: { error: "Upload cancelled." }, aborted: true });
    xhr.send(form);
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
