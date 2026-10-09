import DOMPurify from "dompurify";

export type FlashTone = "INFO" | "NOTICE" | "IMPORTANT" | "SUCCESS";
export type FlashAudience = "ALL" | "INTERNAL" | "EXTERNAL" | "USER_TYPES";
export type FlashStatus = "LIVE" | "SCHEDULED" | "EXPIRED" | "OFF";

/** A live message as returned on the equipment detail payload (`flash_messages`). */
export interface PublicFlashMessage {
  id: number;
  message: string;
  tone: FlashTone;
  end_at: string;
  link_url: string;
  link_label: string;
  from_base_instrument?: boolean;
  /** Staff only: who the message is shown to. */
  audience?: FlashAudience;
  audience_display?: string;
}

export interface FlashMessageRecord {
  id: number;
  equipment_id: number;
  equipment_name: string;
  equipment_code: string;
  equipment_has_modes: boolean;
  department_name: string;
  message: string;
  message_plain: string;
  tone: FlashTone;
  tone_display: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  status: FlashStatus;
  status_display: string;
  audience: FlashAudience;
  audience_display: string;
  audience_user_types: string[];
  show_on_modes: boolean;
  link_url: string;
  link_label: string;
  created_by_name: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface FlashMessageHistoryEntry {
  action: string;
  actor_name: string;
  actor_role: string;
  changes: Record<string, [unknown, unknown]>;
  at: string;
}

export interface FlashMessageDetail extends FlashMessageRecord {
  history: FlashMessageHistoryEntry[];
}

export interface FlashEquipmentOption {
  id: number;
  name: string;
  code: string;
  department_id: number | null;
  department_name: string;
  has_modes: boolean;
  is_mode: boolean;
}

export interface FlashMessageOptions {
  equipment_options: FlashEquipmentOption[];
  tones: { value: FlashTone; label: string }[];
  audiences: { value: FlashAudience; label: string }[];
  user_types: { value: string; label: string }[];
  limits: {
    message_max_chars: number;
    max_duration_days: number;
    max_start_ahead_days: number;
    link_label_max_chars: number;
  };
  can_filter_department?: boolean;
}

export interface FlashMessageListResponse extends Partial<FlashMessageOptions> {
  count: number;
  page: number;
  page_size: number;
  results: FlashMessageRecord[];
  summary: { live: number; scheduled: number; expired: number; off: number };
}

export interface FlashMessagePayload {
  equipment?: number;
  message?: string;
  tone?: FlashTone;
  start_at?: string | null;
  end_at?: string;
  is_active?: boolean;
  audience?: FlashAudience;
  audience_user_types?: string[];
  show_on_modes?: boolean;
  link_url?: string;
  link_label?: string;
  duplicated_from?: number;
}

export const FLASH_MESSAGE_MAX_CHARS = 300;
export const FLASH_ROTATE_MS = 6000;

export const FLASH_TONE_LABELS: Record<FlashTone, string> = {
  INFO: "Info",
  NOTICE: "Notice",
  IMPORTANT: "Important",
  SUCCESS: "Success",
};

export const FLASH_STATUS_LABELS: Record<FlashStatus, string> = {
  LIVE: "Live",
  SCHEDULED: "Scheduled",
  EXPIRED: "Expired",
  OFF: "Off",
};

export const FLASH_AUDIENCE_LABELS: Record<FlashAudience, string> = {
  ALL: "Everyone (including signed-out visitors)",
  INTERNAL: "Internal (IITR) users",
  EXTERNAL: "External users",
  USER_TYPES: "Selected user types",
};

/** Portal palette per tone: pill surface, accent (dot, rule) and the soft glow behind the dot. */
export const FLASH_TONE_STYLES: Record<FlashTone, { pill: string; dot: string; ring: string; chip: string }> = {
  INFO: {
    pill: "border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-sky-50 text-sky-950 dark:border-sky-800/60 dark:from-sky-950/60 dark:via-slate-900 dark:to-sky-950/60 dark:text-sky-100",
    dot: "bg-sky-600 dark:bg-sky-400",
    ring: "bg-sky-500/40",
    chip: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  NOTICE: {
    pill: "border-amber-200/90 bg-gradient-to-r from-amber-50 via-white to-amber-50 text-amber-950 dark:border-amber-700/50 dark:from-amber-950/50 dark:via-slate-900 dark:to-amber-950/50 dark:text-amber-100",
    dot: "bg-amber-500 dark:bg-amber-400",
    ring: "bg-amber-400/45",
    chip: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  IMPORTANT: {
    pill: "border-rose-200/90 bg-gradient-to-r from-rose-50 via-white to-rose-50 text-rose-950 dark:border-rose-800/60 dark:from-rose-950/50 dark:via-slate-900 dark:to-rose-950/50 dark:text-rose-100",
    dot: "bg-rose-600 dark:bg-rose-400",
    ring: "bg-rose-500/35",
    chip: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  },
  SUCCESS: {
    pill: "border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:from-emerald-950/50 dark:via-slate-900 dark:to-emerald-950/50 dark:text-emerald-100",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    ring: "bg-emerald-500/35",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
};

export const FLASH_STATUS_STYLES: Record<FlashStatus, string> = {
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  EXPIRED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  OFF: "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400",
};

export const FLASH_DURATION_PRESETS: { key: string; label: string; days: number }[] = [
  { key: "1d", label: "1 day", days: 1 },
  { key: "3d", label: "3 days", days: 3 },
  { key: "1w", label: "1 week", days: 7 },
];

let purifier: ReturnType<typeof DOMPurify> | null = null;

/** Bold, italic and links only (mirrors `flash_message_service.sanitize_flash_html`). */
export function sanitizeFlashHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  if (!purifier) {
    purifier = DOMPurify(window);
    purifier.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }
  return purifier.sanitize(html.replace(/<\/?(p|div|br|li|ul|ol|h[1-6])(\s[^>]*)?\/?>/gi, " "), {
    ALLOWED_TAGS: ["strong", "b", "em", "i", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
  }).replace(/\s+/g, " ").trim();
}

export function flashPlainText(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const el = document.createElement("div");
  el.innerHTML = sanitizeFlashHtml(html);
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

const DISMISS_KEY = "iic.flashMessages.dismissed";

export function readDismissedFlash(): Set<number> {
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((v): v is number => typeof v === "number") : []);
  } catch {
    return new Set();
  }
}

export function dismissFlash(id: number): void {
  try {
    const next = readDismissedFlash();
    next.add(id);
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...next].slice(-200)));
  } catch {
    /* storage unavailable: dismissal lasts until the page reloads */
  }
}

/** "YYYY-MM-DDTHH:mm" in local time (DateTimeInput / datetime-local value). */
export function toLocalInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string (with offset) for a "YYYY-MM-DDTHH:mm" local value; "" when empty or invalid. */
export function localInputToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
