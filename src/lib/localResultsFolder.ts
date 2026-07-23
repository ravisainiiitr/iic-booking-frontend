import { toast } from "sonner";

/**
 * Create Sample Accepted booking folders on the operator's local PC.
 * Uses the File System Access API (Chrome/Edge). Falls back to a downloadable .bat.
 */

const IDB_NAME = "iic-results-folder";
const IDB_STORE = "handles";
const IDB_KEY = "results-base";

export type ResultsFolderSpec = {
  results_base_location?: string;
  results_folder_segments?: string[];
  results_folder_relative_path?: string;
  in_analysis_folder_path?: string;
  virtual_booking_id?: string;
};

export type LocalFolderCreateResult = {
  path: string;
  method: "filesystem-access" | "bat-download";
  reselectedBase: boolean;
};

function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function getStoredBaseHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function storeBaseHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: picker will be shown next time.
  }
}

async function ensureReadWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  // queryPermission / requestPermission exist on FileSystemHandle in Chromium.
  const anyHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  };
  if (anyHandle.queryPermission) {
    const state = await anyHandle.queryPermission(opts);
    if (state === "granted") return true;
  }
  if (anyHandle.requestPermission) {
    const state = await anyHandle.requestPermission(opts);
    return state === "granted";
  }
  return true;
}

async function pickBaseDirectory(hintPath?: string): Promise<FileSystemDirectoryHandle> {
  const pickerOpts: DirectoryPickerOptions = {
    id: "iic-results-base",
    mode: "readwrite",
  };
  // startIn only accepts well-known values or a prior handle — not an absolute Windows path.
  void hintPath;
  return window.showDirectoryPicker(pickerOpts);
}

function segmentsFromSpec(spec: ResultsFolderSpec): string[] {
  if (spec.results_folder_segments?.length) {
    return spec.results_folder_segments.map((s) => String(s).trim()).filter(Boolean);
  }
  const relative = (spec.results_folder_relative_path || "").replace(/\//g, "\\");
  if (relative) {
    return relative.split("\\").map((s) => s.trim()).filter(Boolean);
  }
  const full = (spec.in_analysis_folder_path || "").replace(/\//g, "\\");
  const base = (spec.results_base_location || "").replace(/\//g, "\\").replace(/\\+$/, "");
  if (full && base && full.toLowerCase().startsWith(base.toLowerCase())) {
    return full
      .slice(base.length)
      .replace(/^\\+/, "")
      .split("\\")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function createNestedDirs(
  base: FileSystemDirectoryHandle,
  segments: string[],
  markerText: string
): Promise<FileSystemDirectoryHandle> {
  let current = base;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  try {
    const marker = await current.getFileHandle(".iic_results_folder", { create: true });
    const writable = await marker.createWritable();
    await writable.write(markerText);
    await writable.close();
  } catch {
    // Marker is optional.
  }
  return current;
}

function downloadBatFallback(spec: ResultsFolderSpec, segments: string[]): string {
  const fullPath =
    (spec.in_analysis_folder_path || "").replace(/\//g, "\\") ||
    [spec.results_base_location || "D:\\Results", ...segments].join("\\");
  const bookingId = spec.virtual_booking_id || "booking";
  const bat = [
    "@echo off",
    "setlocal",
    `set "TARGET=${fullPath}"`,
    'echo Creating folder: %TARGET%',
    'mkdir "%TARGET%" 2>nul',
    `echo booking=${bookingId}> "%TARGET%\\.iic_results_folder"`,
    'if exist "%TARGET%" (',
    '  explorer "%TARGET%"',
    "  exit /b 0",
    ") else (",
    "  echo Failed to create folder.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
  ].join("\r\n");
  const blob = new Blob([bat], { type: "application/x-bat" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Create_Results_Folder_${bookingId.replace(/[^\w.-]+/g, "_")}.bat`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return fullPath;
}

/**
 * Create the results folder tree on the local machine under a user-chosen base directory
 * (typically the same as equipment results_base_location, e.g. D:\\Results).
 */
export async function createLocalResultsFolder(spec: ResultsFolderSpec): Promise<LocalFolderCreateResult> {
  const segments = segmentsFromSpec(spec);
  if (!segments.length) {
    throw new Error("Missing results folder path segments from the server.");
  }

  const markerText = `booking=${spec.virtual_booking_id || ""}\ncreated_at=${new Date().toISOString()}\n`;
  const suggestedPath =
    (spec.in_analysis_folder_path || "").replace(/\//g, "\\") ||
    [spec.results_base_location || "D:\\Results", ...segments].join("\\");

  if (!supportsDirectoryPicker()) {
    const path = downloadBatFallback(spec, segments);
    return { path, method: "bat-download", reselectedBase: false };
  }

  let reselectedBase = false;
  let base = await getStoredBaseHandle();
  if (base) {
    const ok = await ensureReadWritePermission(base);
    if (!ok) base = null;
  }
  if (!base) {
    toastPickHint(spec.results_base_location);
    base = await pickBaseDirectory(spec.results_base_location);
    await storeBaseHandle(base);
    reselectedBase = true;
  }

  await createNestedDirs(base, segments, markerText);
  // Prefer the configured absolute path for display when the operator picked that base.
  const displayPath = suggestedPath || [base.name, ...segments].join("\\");
  return { path: displayPath, method: "filesystem-access", reselectedBase };
}

function toastPickHint(baseHint?: string) {
  toast.message(
    baseHint
      ? `Select your Results base folder (usually ${baseHint}). Nested booking folders will be created under it.`
      : "Select your Results base folder on this PC. Nested booking folders will be created under it.",
    { duration: 8000 }
  );
}

/** Clear the remembered local results base so the next create asks again. */
export async function clearLocalResultsBaseHandle(): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
