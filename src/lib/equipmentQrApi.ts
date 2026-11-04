/**
 * Equipment QR codes and the public equipment page.
 *
 * - `publicEquipment` reads the allowlisted public data (no login, no token sent).
 * - The QR endpoints are for the Main Admin and OICs; the backend scopes every call.
 */
import { API_BASE_URL, apiClient } from "@/lib/api";

export interface PublicEquipment {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  important_instruction: string;
  status: { key: "operational" | "unavailable"; label: string };
  category: string;
  department: { name: string; code: string } | null;
  make: string;
  model: string;
  image_url: string | null;
  specifications: Array<{ label: string; value: string }>;
  accessories: Array<{ name: string; optional: boolean }>;
  location: string;
  directions: {
    maps_url: string;
    source: "maps_url" | "coordinates" | "";
    latitude: number | null;
    longitude: number | null;
    embed_url: string;
  };
  enquiry_address: string;
  contacts: PublicContact[];
  public_url: string;
  booking_path: string;
  charges_path: string;
}

export interface PublicContact {
  role: "Officer In-charge" | "Lab Operator" | string;
  name: string;
  email: string;
  phones: string[];
  office: string;
  photo_url: string;
}

export interface QrRow {
  equipment_id: number;
  code: string;
  name: string;
  make: string;
  model: string;
  category: string;
  department: { id: number; name: string; code: string } | null;
  status: string;
  status_display: string;
  public_url: string;
  publicly_visible: boolean;
}

export interface QrList {
  results: QrRow[];
  count: number;
  departments: Array<{ id: number; name: string; code: string }>;
  statuses: Array<{ value: string; label: string }>;
  base_url: string;
  base_url_warning: string;
}

export type Result<T> = { data?: T; error?: string; status?: number };

function authHeaders(): Record<string, string> {
  const token = apiClient.getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

function errorOf(body: Record<string, unknown>, status: number): string {
  return typeof body.error === "string" ? body.error : typeof body.detail === "string" ? body.detail : `Request failed (HTTP ${status})`;
}

async function getJson<T>(path: string, withAuth: boolean): Promise<Result<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json", ...(withAuth ? authHeaders() : {}) },
      credentials: "omit",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { error: errorOf(body, res.status), status: res.status };
    return { data: body as T, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error occurred" };
  }
}

function query(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

async function downloadBlob(path: string, fallbackName: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders(), credentials: "omit" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return errorOf(body, res.status);
    }
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = match?.[1] || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Download failed";
  }
}

export const equipmentQrApi = {
  publicEquipment: (id: number | string) => getJson<PublicEquipment>(`/equipments/${encodeURIComponent(String(id))}/public/`, false),
  list: (params: { q?: string; department_id?: number | string; status?: string; ids?: number[] } = {}) =>
    getJson<QrList>(`/equipment-qr/${query({ ...params, ids: params.ids?.join(",") })}`, true),
  downloadPng: (id: number, size: "small" | "medium" | "large" = "large") =>
    downloadBlob(`/equipment-qr/${id}.png${query({ size, download: 1 })}`, `equipment-${id}-qr.png`),
  downloadSvg: (id: number) => downloadBlob(`/equipment-qr/${id}.svg${query({ download: 1 })}`, `equipment-${id}-qr.svg`),
  downloadZip: (ids: number[]) => downloadBlob(`/equipment-qr/batch.zip${query({ ids: ids.join(",") })}`, "equipment-qr-codes.zip"),
};

/** Copy text; true when it reached the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Native share sheet where supported; otherwise copies the link. Returns what happened. */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}

/** Display form of the public URL without the scheme, e.g. "equip.iitr.ac.in/equipment/38". */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
