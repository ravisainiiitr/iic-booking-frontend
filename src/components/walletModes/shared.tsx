import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banknote, CreditCard, Globe, HandCoins, Landmark, Loader2, Repeat, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { WalletModeDepartmentRow, WalletModeOptionKey } from "@/lib/api";
import { cn } from "@/lib/utils";

export const OPTION_ORDER: WalletModeOptionKey[] = [
  "project_grant",
  "direct_cash",
  "online_gateway",
  "peer_transfer",
  "credit",
  "direct_recharge",
];

export const OPTION_SHORT_LABEL: Record<WalletModeOptionKey, string> = {
  project_grant: "Project Grant",
  direct_cash: "Direct Cash",
  online_gateway: "Online gateway",
  peer_transfer: "Same-dept transfer",
  credit: "Credit Limit",
  direct_recharge: "Direct recharge",
};

export const OPTION_ICON: Record<WalletModeOptionKey, ReactNode> = {
  project_grant: <Landmark className="h-4 w-4" />,
  direct_cash: <Banknote className="h-4 w-4" />,
  online_gateway: <Globe className="h-4 w-4" />,
  peer_transfer: <Repeat className="h-4 w-4" />,
  credit: <CreditCard className="h-4 w-4" />,
  direct_recharge: <HandCoins className="h-4 w-4" />,
};

/** Admin-settings toggle key for each master switch. */
export const MASTER_SETTING_KEY = {
  project_grant: "project_grant_recharge_enabled",
  direct_cash: "direct_cash_recharge_enabled",
  online_gateway: "online_gateway_recharge_enabled",
  peer_transfer: "peer_transfer_enabled",
  credit: "credit_facility_enabled",
  direct_recharge: "direct_recharge_enabled",
} as const satisfies Record<WalletModeOptionKey, string>;

export type ChipTone = "on" | "off" | "muted" | "warn" | "info";

export function StatusChip({ tone, children, className }: { tone: ChipTone; children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-medium",
        tone === "on" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "off" && "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
        tone === "warn" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "info" && "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
        tone === "muted" && "border-border bg-muted/50 text-muted-foreground",
        className
      )}
    >
      {children}
    </Badge>
  );
}

/** Departments offered by the public equipment catalog (rows kept only for saved settings have ``listed: false``). */
export const isListedDepartment = (d: Pick<WalletModeDepartmentRow, "listed">) => d.listed !== false;

export function formatInr(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Card section heading used across the Wallet Payment Modes tabs. */
export function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-base">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary dark:text-sky-200">{icon}</span>
      {children}
    </span>
  );
}

/** Debounced search box that shows a result list below it. */
export function SearchPicker<T>({
  id,
  placeholder,
  search,
  renderItem,
  itemKey,
  onPick,
  disabled,
  minChars = 2,
}: {
  id: string;
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string | number;
  onPick: (item: T) => void;
  disabled?: boolean;
  minChars?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    const q = query.trim();
    if (q.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchRef.current(q)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, minChars]);

  const showList = open && query.trim().length >= minChars;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        className="pl-9"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-results`}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {loading ? <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {showList ? (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {!loading && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : null}
          {results.map((item) => (
            <li key={itemKey(item)} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(item);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
