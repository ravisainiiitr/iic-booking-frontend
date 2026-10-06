import { buildStlMesh, type StlMeshData, type StlMeshOptions, type StlMeshProgress } from "./stlMesh";

interface Entry {
  buffer: ArrayBuffer;
  maxTriangles: number;
  promise: Promise<StlMeshData>;
}

// Recently viewed models, so moving back and forth between files of a ZIP is instant.
const recent: Entry[] = [];
const RECENT_LIMIT = 3;
let nextId = 1;

function runOnMainThread(buffer: ArrayBuffer, options: StlMeshOptions, onProgress?: StlMeshProgress): Promise<StlMeshData> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(buildStlMesh(buffer, options, onProgress));
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
}

function runInWorker(buffer: ArrayBuffer, options: StlMeshOptions, onProgress?: StlMeshProgress): Promise<StlMeshData> {
  if (typeof Worker === "undefined") return runOnMainThread(buffer, options, onProgress);
  let worker: Worker;
  try {
    worker = new Worker(new URL("./stlMesh.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return runOnMainThread(buffer, options, onProgress);
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    let started = false;
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { id: number; type: "progress"; phase: Parameters<StlMeshProgress>[0]; fraction: number }
        | { id: number; type: "done"; mesh: StlMeshData }
        | { id: number; type: "error"; message: string };
      if (msg.id !== id) return;
      started = true;
      if (msg.type === "progress") onProgress?.(msg.phase, msg.fraction);
      else if (msg.type === "done") {
        worker.terminate();
        resolve(msg.mesh);
      } else {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (ev) => {
      ev.preventDefault?.();
      worker.terminate();
      // A worker that never started (blocked or unsupported) falls back to the page thread.
      if (!started) runOnMainThread(buffer, options, onProgress).then(resolve, reject);
      else reject(new Error("Could not read the STL file."));
    };
    // The caller keeps its buffer (it is shown again when the user comes back), so send a copy.
    const copy = buffer.slice(0);
    worker.postMessage({ id, buffer: copy, options }, [copy]);
  });
}

/** Parse, simplify and shade an STL off the main thread when possible. */
export function loadStlMesh(
  buffer: ArrayBuffer,
  options: StlMeshOptions = {},
  onProgress?: StlMeshProgress,
): Promise<StlMeshData> {
  const maxTriangles = options.maxTriangles ?? 0;
  const hit = recent.find((e) => e.buffer === buffer && e.maxTriangles === maxTriangles);
  if (hit) {
    recent.splice(recent.indexOf(hit), 1);
    recent.unshift(hit);
    return hit.promise;
  }
  const promise = runInWorker(buffer, options, onProgress);
  const entry: Entry = { buffer, maxTriangles, promise };
  recent.unshift(entry);
  if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  promise.catch(() => {
    const i = recent.indexOf(entry);
    if (i >= 0) recent.splice(i, 1);
  });
  return promise;
}

/** Tests only. */
export function clearStlMeshCache(): void {
  recent.length = 0;
}
