import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchFile } from "@/lib/myResearchTypes";

export async function downloadResearchFile(file: Pick<ResearchFile, "id">) {
  const res = await apiClient.getResearchFileUrl(file.id, "attachment");
  if (res.error || !res.data) {
    toast.error(res.error || "Could not start the download.");
    return;
  }
  const a = document.createElement("a");
  a.href = res.data.url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
