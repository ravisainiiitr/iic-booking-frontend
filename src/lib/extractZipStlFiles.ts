import JSZip from "jszip";

export interface ZipStlEntry {
  filename: string;
  buffer: ArrayBuffer;
}

/** Extract .stl files from a ZIP archive for local 3D preview (same rules as backend). */
export async function extractStlFilesFromZip(file: File): Promise<ZipStlEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const entries: ZipStlEntry[] = [];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const normalized = path.replace(/\\/g, "/");
    const base = normalized.split("/").pop() || "";
    if (!base || base.startsWith(".")) continue;
    if (normalized.includes("__MACOSX") || base.startsWith("._")) continue;
    if (!base.toLowerCase().endsWith(".stl")) continue;

    const buffer = await zipEntry.async("arraybuffer");
    entries.push({ filename: base, buffer });
  }

  entries.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" }));
  if (!entries.length) {
    throw new Error("ZIP contains no .stl files.");
  }
  return entries;
}
