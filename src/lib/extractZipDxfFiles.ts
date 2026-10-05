export interface ZipDxfEntry {
  filename: string;
  text: string;
}

/** Extract .dxf drawings from a ZIP for the local preview (same filtering as the backend). */
export async function extractDxfFilesFromZip(file: Blob): Promise<ZipDxfEntry[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const entries: ZipDxfEntry[] = [];
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const normalized = path.replace(/\\/g, "/");
    const base = normalized.split("/").pop() || "";
    if (!base || base.startsWith(".") || normalized.includes("__MACOSX")) continue;
    if (!base.toLowerCase().endsWith(".dxf")) continue;
    entries.push({ filename: base, text: await zipEntry.async("string") });
  }
  if (!entries.length) {
    throw new Error("The ZIP contains no .dxf files.");
  }
  return entries;
}
