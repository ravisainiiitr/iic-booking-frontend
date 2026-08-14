/** Presentation helpers for the R14 analysis data browser. */

export type DataBrowserFile = {
  name: string;
  relative_path?: string;
  size?: number;
  size_bytes?: number;
  type?: string;
  modified_at?: string | null;
  source?: string;
  entry_key?: string;
};

export type DataBrowserFolder = {
  name: string;
  path: string;
  files: DataBrowserFile[];
  file_count?: number;
  total_size_bytes?: number;
  has_more_files?: boolean;
};

export type DataBrowserDataset = {
  booking_id: string;
  booking_pk: number;
  booking_reference?: string;
  virtual_booking_id?: string;
  equipment_name?: string;
  equipment_code?: string;
  sample_name?: string;
  booking_date?: string | null;
  booking_time?: string | null;
  is_current?: boolean;
  file_count?: number;
  total_size_bytes?: number;
  folders: DataBrowserFolder[];
};

/** Prefer portal virtual booking id. Never use a bare numeric sample/index as the heading. */
export function datasetBookingLabel(ds: DataBrowserDataset): string {
  const virtual = String(ds.virtual_booking_id || ds.booking_reference || "").trim();
  if (virtual && !/^\d+$/.test(virtual)) return virtual;
  const bookingId = String(ds.booking_id || "").trim();
  if (bookingId && !/^\d+$/.test(bookingId)) return bookingId;
  if (virtual) return virtual;
  if (bookingId) return bookingId;
  return "Untitled booking";
}

export function formatBytes(n?: number) {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBookingWhen(date?: string | null, time?: string | null): string {
  if (!date) return "";
  try {
    const iso = time ? `${date}T${time}` : date;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return [date, time].filter(Boolean).join(" · ");
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: time ? "2-digit" : undefined,
      minute: time ? "2-digit" : undefined,
    });
  } catch {
    return [date, time].filter(Boolean).join(" · ");
  }
}

export function isInternalNumericId(value: unknown): boolean {
  return typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()));
}
