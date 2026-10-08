/** Wallet ledger (Main Administrator): filter state, query parameters and date presets. */

export const LEDGER_PAGE_SIZES = [25, 100, 500] as const;

export function formatLedgerAmount(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `−₹${abs}` : `₹${abs}`;
}

export function balanceTone(value: string | number | null | undefined): string | undefined {
  const n = Number(value ?? 0);
  if (n < 0) return "text-red-600 dark:text-red-400";
  if (n === 0) return "text-muted-foreground";
  return undefined;
}

export interface OwnerFilters {
  search: string;
  department: string;
  owner_type: string;
  sub_wallet_department: string;
  balance_state: string;
  balance_min: string;
  balance_max: string;
  status: string;
  activity_from: string;
  activity_to: string;
}

export const EMPTY_OWNER_FILTERS: OwnerFilters = {
  search: "",
  department: "",
  owner_type: "",
  sub_wallet_department: "",
  balance_state: "",
  balance_min: "",
  balance_max: "",
  status: "",
  activity_from: "",
  activity_to: "",
};

export interface TransactionFilters {
  search: string;
  booking: string;
  type: string;
  category: string;
  performer: string;
  sub_wallet: string;
  sub_wallet_department: string;
  owner_department: string;
  owner_type: string;
  date_preset: DatePreset;
  date_from: string;
  date_to: string;
  amount_min: string;
  amount_max: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  search: "",
  booking: "",
  type: "",
  category: "",
  performer: "",
  sub_wallet: "",
  sub_wallet_department: "",
  owner_department: "",
  owner_type: "",
  date_preset: "all",
  date_from: "",
  date_to: "",
  amount_min: "",
  amount_max: "",
};

export type DatePreset = "all" | "today" | "7d" | "30d" | "month" | "fy" | "custom";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "fy", label: "This financial year" },
  { value: "custom", label: "Custom range" },
];

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive date range for a preset; the Indian financial year runs 1 April – 31 March. */
export function presetRange(preset: DatePreset, today: Date = new Date()): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const back = (days: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - days);
  switch (preset) {
    case "today":
      return { from: iso(t), to: iso(t) };
    case "7d":
      return { from: iso(back(6)), to: iso(t) };
    case "30d":
      return { from: iso(back(29)), to: iso(t) };
    case "month":
      return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
    case "fy": {
      const startYear = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
      return { from: `${startYear}-04-01`, to: iso(t) };
    }
    default:
      return { from: "", to: "" };
  }
}

type Params = Record<string, string>;

function compact(obj: Record<string, string>): Params {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v != null));
}

export function ownerFilterParams(f: OwnerFilters, ordering: string): Params {
  return compact({ ...f, ordering });
}

export function transactionFilterParams(
  f: TransactionFilters,
  ordering: string,
  ownerId?: number | null,
  today?: Date,
): Params {
  const range = f.date_preset === "custom" ? { from: f.date_from, to: f.date_to } : presetRange(f.date_preset, today);
  return compact({
    search: f.search,
    booking: f.booking,
    type: f.type,
    category: f.category,
    performer: f.performer,
    sub_wallet: f.sub_wallet,
    sub_wallet_department: f.sub_wallet_department,
    owner_department: f.owner_department,
    owner_type: f.owner_type,
    amount_min: f.amount_min,
    amount_max: f.amount_max,
    date_from: range.from,
    date_to: range.to,
    owner: ownerId ? String(ownerId) : "",
    ordering,
  });
}

export function countActive<T extends object>(filters: T, empty: T, ignore: Array<keyof T> = []): number {
  return (Object.keys(filters) as Array<keyof T>).filter(
    (k) => !ignore.includes(k) && filters[k] !== empty[k],
  ).length;
}

/** Amount typed in a dialog: digits with at most two decimals. */
export const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export function newLedgerRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const CATEGORY_TONE: Record<string, string> = {
  manual_admin: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  direct_recharge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  recharge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  booking_charge: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  extra_charge: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  training_charge: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  refund: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
  legacy_sync: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  credit_facility: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  transfer: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
  withdrawal: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  other: "border-border bg-muted/50 text-muted-foreground",
};
