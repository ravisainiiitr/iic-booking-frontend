import { toast } from "sonner";
import { API_BASE_URL, apiClient } from "@/lib/api";
import type { ResearchFile } from "@/lib/myResearchTypes";
import { formatBytes } from "./researchUtils";

function clickLink(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadResearchFile(file: Pick<ResearchFile, "id">) {
  const res = await apiClient.getResearchFileUrl(file.id, "attachment");
  if (res.error || !res.data) {
    toast.error(res.error || "Could not start the download.");
    return;
  }
  clickLink(res.data.url);
}

export function researchZipUrl(path: string, base: string = API_BASE_URL, origin: string = window.location.origin): string {
  const absoluteBase = new URL(base, origin).toString().replace(/\/+$/, "");
  return `${absoluteBase}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Zip of the whole project (folderId null) or one folder with its subfolders; the browser shows progress. */
export async function downloadResearchZip(workspaceId: string, folderId: string | null): Promise<boolean> {
  const res = await apiClient.requestResearchZip(workspaceId, folderId);
  if (res.error || !res.data) {
    toast.error(res.error || "Could not prepare the download.");
    return false;
  }
  const { path, filename, file_count, total_bytes } = res.data;
  clickLink(researchZipUrl(path));
  toast.success(`Downloading ${filename}`, {
    description: `${file_count} file${file_count === 1 ? "" : "s"} · ${formatBytes(total_bytes)}. Your browser shows the progress.`,
  });
  return true;
}
