import { apiClient } from "@/lib/api";
import type { ResearchFile } from "@/lib/myResearchTypes";

export type ResearchUploadStage = "preparing" | "uploading" | "verifying";

export class ResearchUploadCancelled extends Error {
  constructor() {
    super("Upload cancelled.");
    this.name = "ResearchUploadCancelled";
  }
}

export interface ResearchUploadOptions {
  workspaceId: string;
  file: File;
  folderId?: string | null;
  bookingId?: number | null;
  onProgress?: (loaded: number, total: number) => void;
  onStage?: (stage: ResearchUploadStage) => void;
}

export interface ResearchUploadHandle {
  promise: Promise<ResearchFile>;
  cancel: () => void;
}

/** Hashing needs the whole file in memory, so only small single-PUT uploads get an end-to-end checksum. */
const CHECKSUM_MAX_BYTES = 32 * 1024 * 1024;
const PART_CONCURRENCY = 4;
const PART_URL_BATCH = 20;
const PART_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sha256Hex(file: File): Promise<string | undefined> {
  if (file.size > CHECKSUM_MAX_BYTES || typeof crypto === "undefined" || !crypto.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

function putWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ResearchUploadCancelled());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(body.size);
        resolve(xhr.getResponseHeader("ETag") || "");
      } else {
        reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    xhr.onabort = () => reject(new ResearchUploadCancelled());
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function uploadParts(
  fileId: string,
  file: File,
  partSize: number,
  partCount: number,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<Array<{ part_number: number; etag: string }>> {
  const loaded = new Map<number, number>();
  const report = () => onProgress(Array.from(loaded.values()).reduce((a, b) => a + b, 0));
  const batches = new Map<number, Promise<Map<number, string>>>();

  const fetchUrls = async (numbers: number[]) => {
    const res = await apiClient.presignResearchUploadParts(fileId, numbers);
    if (res.error || !res.data) throw new Error(res.error || "Could not prepare the upload.");
    return new Map(res.data.parts.map((p) => [p.part_number, p.url]));
  };
  const batchUrl = async (n: number) => {
    const start = Math.floor((n - 1) / PART_URL_BATCH) * PART_URL_BATCH + 1;
    let batch = batches.get(start);
    if (!batch) {
      const numbers = Array.from({ length: Math.min(PART_URL_BATCH, partCount - start + 1) }, (_, i) => start + i);
      batch = fetchUrls(numbers);
      batches.set(start, batch);
    }
    const url = (await batch).get(n);
    if (!url) throw new Error("Could not prepare the upload.");
    return url;
  };

  const etags: Array<{ part_number: number; etag: string }> = [];
  let next = 1;
  const worker = async () => {
    for (;;) {
      if (signal.aborted) throw new ResearchUploadCancelled();
      const n = next++;
      if (n > partCount) return;
      const start = (n - 1) * partSize;
      const blob = file.slice(start, Math.min(start + partSize, file.size));
      for (let attempt = 1; ; attempt++) {
        try {
          // A retry may be caused by an expired URL, so fetch a fresh one.
          const url = attempt === 1 ? await batchUrl(n) : (await fetchUrls([n])).get(n)!;
          const etag = await putWithProgress(
            url,
            blob,
            {},
            (value) => {
              loaded.set(n, value);
              report();
            },
            signal,
          );
          if (!etag) {
            throw new Error("Storage did not return an upload receipt (ETag). Please contact the IIC team.");
          }
          etags.push({ part_number: n, etag });
          break;
        } catch (err) {
          if (err instanceof ResearchUploadCancelled || attempt >= PART_ATTEMPTS) throw err;
          loaded.set(n, 0);
          report();
          await sleep(1000 * attempt);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, worker));
  return etags.sort((a, b) => a.part_number - b.part_number);
}

async function completeWithRetry(fileId: string, parts?: Array<{ part_number: number; etag: string }>) {
  for (let attempt = 1; ; attempt++) {
    const res = await apiClient.completeResearchUpload(fileId, parts);
    if (!res.error && res.data) return res.data;
    // S3 can take a moment to report a just-finished object; the server keeps the file pending meanwhile.
    const retryable = res.errorCode === "upload_not_found" || res.errorCode === "storage_unavailable";
    if (!retryable || attempt >= 3) throw new Error(res.error || "Could not verify the upload.");
    await sleep(1500 * attempt);
  }
}

export function startResearchUpload(options: ResearchUploadOptions): ResearchUploadHandle {
  const controller = new AbortController();
  const { workspaceId, file, folderId, bookingId, onProgress, onStage } = options;
  let fileId: string | null = null;
  let transferred = false;

  const run = async (): Promise<ResearchFile> => {
    onStage?.("preparing");
    const sha256 = await sha256Hex(file);
    if (controller.signal.aborted) throw new ResearchUploadCancelled();
    const init = await apiClient.initiateResearchUpload(workspaceId, {
      filename: file.name,
      size: file.size,
      content_type: file.type || undefined,
      folder_id: folderId ?? null,
      booking_id: bookingId ?? null,
      sha256,
    });
    if (init.error || !init.data) throw new Error(init.error || "Could not start the upload.");
    fileId = init.data.file.id;
    const instruction = init.data.upload;
    onStage?.("uploading");
    const progress = (loaded: number) => onProgress?.(Math.min(loaded, file.size), file.size);

    if (instruction.mode === "single") {
      await putWithProgress(instruction.url, file, instruction.headers, progress, controller.signal);
      transferred = true;
      onStage?.("verifying");
      return completeWithRetry(fileId);
    }
    const parts = await uploadParts(
      fileId,
      file,
      instruction.part_size,
      instruction.part_count,
      progress,
      controller.signal,
    );
    transferred = true;
    onStage?.("verifying");
    return completeWithRetry(fileId, parts);
  };

  const promise = run().catch(async (err) => {
    // Once the bytes are in storage, a failed verification is either already recorded by the server
    // or temporary; the hourly cleanup task finalizes it, so never discard the object here.
    if (fileId && !transferred) {
      await apiClient.abortResearchUpload(fileId).catch(() => undefined);
    }
    throw err;
  });

  return { promise, cancel: () => controller.abort() };
}
