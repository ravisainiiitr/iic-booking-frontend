import { format, formatDistanceToNow } from "date-fns";
import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { ResearchFile } from "@/lib/myResearchTypes";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, withTime ? "dd MMM yyyy, hh:mm a" : "dd MMM yyyy");
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fileIcon(file: Pick<ResearchFile, "detected_type" | "name">): LucideIcon {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpeg", "gif", "webp", "tiff"].includes(file.detected_type)) return FileImage;
  if (file.detected_type === "pdf" || ["txt", "md", "log", "doc", "docx"].includes(ext)) return FileText;
  if (["csv", "tsv", "xls", "xlsx"].includes(ext)) return FileSpreadsheet;
  if (["zip", "gzip"].includes(file.detected_type) || ["zip", "gz", "tar", "7z", "rar"].includes(ext)) return FileArchive;
  return FileIcon;
}

export const RESEARCH_GRADIENT = "from-violet-600 to-fuchsia-600";
