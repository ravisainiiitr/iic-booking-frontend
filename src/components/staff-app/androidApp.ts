import { apiClient } from "@/lib/api";

export const APP_DOWNLOAD_PAGE_URL = "https://equip.iitr.ac.in/app-download";

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Starts the APK download with a short-lived link. Returns an error message, or null on success. */
export async function downloadLatestApk(): Promise<string | null> {
  const res = await apiClient.createMobileAppDownloadTicket();
  if (!res.data?.url) return res.error || "The download could not be started. Please try again.";
  window.location.assign(res.data.url);
  return null;
}
