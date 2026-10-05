import { format, parseISO } from "date-fns";
import { apiClient } from "@/lib/api";
import type { AnalysisInputSource } from "@/lib/analysisSetupTypes";
import { isMissingEndpoint, plural } from "@/lib/analysisSync";

export const INPUT_SOURCES_PAGE_SIZE = 20;

export function formatBookingDate(date?: string | null): string {
  if (!date) return "";
  try {
    return format(parseISO(date), "dd MMM yyyy");
  } catch {
    return date;
  }
}

export function formatBookingStatus(status?: string | null): string {
  if (!status) return "";
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "DSA Test · 02 Oct 2026 · Completed · 1 file" */
export function inputSourceSummary(row: Pick<AnalysisInputSource, "equipment_name" | "date" | "status" | "file_count">): string {
  return [
    row.equipment_name,
    formatBookingDate(row.date),
    formatBookingStatus(row.status),
    row.file_count == null ? "" : plural(row.file_count, "file"),
  ]
    .filter(Boolean)
    .join(" · ");
}

type LegacyDataset = {
  booking_pk: number;
  booking_id?: string;
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  booking_date?: string | null;
  status?: string | null;
  is_current?: boolean;
  file_count?: number;
  folders?: Array<{ file_count?: number; files?: unknown[] }>;
};

function fromLegacyDataset(ds: LegacyDataset): AnalysisInputSource {
  const files =
    ds.file_count ??
    (ds.folders ?? []).reduce((sum, f) => sum + Number(f.file_count ?? f.files?.length ?? 0), 0);
  return {
    booking_id: ds.booking_pk,
    virtual_id: ds.virtual_booking_id || ds.booking_id || String(ds.booking_pk),
    equipment_name: ds.equipment_name || ds.equipment_code || "",
    date: ds.booking_date ?? null,
    status: ds.status ?? null,
    file_count: files,
    is_current: Boolean(ds.is_current),
    locked_reason: null,
  };
}

/**
 * The user's own bookings that have files, newest first. Uses input-sources; falls back to the
 * older data browser (same user, same equipment) when the backend doesn't serve input-sources yet.
 */
export async function loadInputSources(
  bookingId: number,
  { q = "", page = 1, preferLegacy = false }: { q?: string; page?: number; preferLegacy?: boolean } = {},
): Promise<{ rows: AnalysisInputSource[]; hasMore: boolean; legacy: boolean }> {
  const page_size = INPUT_SOURCES_PAGE_SIZE;
  if (!preferLegacy) {
    const res = await apiClient.listBookingAnalysisInputSources(bookingId, { q, page, page_size });
    if (!res.error && res.data) {
      return { rows: res.data.results ?? [], hasMore: page * page_size < Number(res.data.count || 0), legacy: false };
    }
    if (!isMissingEndpoint(res)) throw new Error(res.error || "Couldn't load your bookings.");
  }
  const res = await apiClient.getBookingAnalysisDataBrowser(bookingId, { q, scope: "all", page, page_size });
  if (res.error) throw new Error(res.error);
  const data = (res.data || {}) as { datasets?: LegacyDataset[]; pagination?: { has_more?: boolean } };
  return {
    rows: (data.datasets ?? []).map(fromLegacyDataset),
    hasMore: Boolean(data.pagination?.has_more),
    legacy: true,
  };
}
