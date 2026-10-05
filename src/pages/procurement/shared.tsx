import { createContext, useCallback, useContext, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  pmDownload,
  pmGet,
  type PmBootstrap,
  type PmDepartment,
  type PmDocument,
} from "@/lib/procurementApi";

// ---------------------------------------------------------------------------
// Bootstrap + department context
// ---------------------------------------------------------------------------
export const BOOTSTRAP_KEY = ["procurement", "bootstrap"] as const;

export function useProcurementBootstrap(enabled = true) {
  return useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn: () => pmGet<PmBootstrap>("bootstrap/"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

const DEPT_KEY = "iic:procurement:department";

interface PmContextValue {
  boot: PmBootstrap;
  dept: PmDepartment | null;
  deptId: number | null;
  setDeptId: (id: number) => void;
  hasPerm: (perm: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
  /** OC Stores / Office / HOD / Auditor / Main Admin in the selected department. */
  wide: boolean;
}

const PmContext = createContext<PmContextValue | null>(null);

const DEPT_WIDE = ["OC_STORES", "OFFICE", "HOD", "AUDITOR", "MAIN_ADMIN"];

export function ProcurementProvider({ boot, children }: { boot: PmBootstrap; children: ReactNode }) {
  const [stored, setStored] = useState<number | null>(() => {
    const raw = Number(window.localStorage.getItem(DEPT_KEY) || 0);
    return raw > 0 ? raw : null;
  });
  const dept = boot.departments.find((d) => d.department.id === stored) ?? boot.departments[0] ?? null;
  const setDeptId = useCallback((id: number) => {
    window.localStorage.setItem(DEPT_KEY, String(id));
    setStored(id);
  }, []);
  const value: PmContextValue = {
    boot,
    dept,
    deptId: dept?.department.id ?? null,
    setDeptId,
    hasPerm: (perm) => !!dept?.permissions.includes(perm),
    hasRole: (...roles) => !!dept && roles.some((r) => dept.roles.includes(r)),
    wide: !!dept && dept.roles.some((r) => DEPT_WIDE.includes(r)),
  };
  return <PmContext.Provider value={value}>{children}</PmContext.Provider>;
}

export function usePm(): PmContextValue {
  const ctx = useContext(PmContext);
  if (!ctx) throw new Error("usePm must be used inside ProcurementProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? inr.format(n) : String(value);
}

export function qty(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(Number(value));
}

export function fmtDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return withTime
    ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function humanize(code: string | null | undefined): string {
  if (!code) return "—";
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const TONES: [RegExp, string][] = [
  [/REJECT|CANCEL|LOST|DAMAGED|CONDEMNED|DISPOSED|EXPIRED|NON_COMPLIANT|FLAGGED|REAPPROVAL|NOT_AVAILABLE/, "bg-red-100 text-red-800 border-red-200"],
  [/HOLD|PENDING|REVIEW|PARTIAL|UNDER_|AWAITING|REQUESTED|SENT/, "bg-amber-100 text-amber-900 border-amber-200"],
  [/APPROVED|COMPLETED|PAID|ACTIVE|IN_USE|ISSUED|CLEARED|WITHIN|ACCEPTED|AVAILABLE|PROCURED|RETURNED|COMPLIANT/, "bg-emerald-100 text-emerald-800 border-emerald-200"],
  [/PROCUREMENT|PROGRESS|PO_ISSUED|DELIVERED|INVOICED|SUBMITTED|CONSOLIDAT|OPEN|IN_STORE|TRANSFERRED|RENEWED/, "bg-sky-100 text-sky-800 border-sky-200"],
];

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const tone = TONES.find(([re]) => re.test(status))?.[1] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", tone, className)}>
      {label || humanize(status)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function NativeSelect({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyRow({ colSpan, text = "Nothing here yet." }: { colSpan: number; text?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </TableCell>
    </TableRow>
  );
}

export function Pager({ page, count, pageSize, onPage }: { page: number; count: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / Math.max(1, pageSize)));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {count} total
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
/** Runs an async action with a busy flag and toast feedback. Returns true on success. */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  required = true,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  required?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (text: string) => Promise<boolean>;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await onConfirm(text.trim());
    setBusy(false);
    if (ok) {
      setText("");
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <Field label={required ? `${label} (required)` : label}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={busy || (required && !text.trim())}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function FilePicker({
  files,
  onChange,
  multiple = true,
  label = "Attach files",
  capture,
  hideList = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  /** Opens the camera directly on phones (bill capture). */
  capture?: boolean;
  hideList?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={DOC_ACCEPT}
        multiple={multiple}
        {...(capture ? { capture: "environment" as const } : {})}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        <Paperclip className="mr-2 h-4 w-4" />
        {label}
      </Button>
      {hideList ? null : files.length ? (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
              <span className="truncate">
                {multiple ? `Page ${i + 1}: ` : ""}
                {f.name} <span className="text-muted-foreground">({Math.ceil(f.size / 1024)} KB)</span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">PDF, JPG or PNG. Multi-page bills can be added as several files.</p>
      )}
    </div>
  );
}

export function DocumentList({ docs, empty = "No documents attached." }: { docs: PmDocument[] | undefined; empty?: string }) {
  if (!docs?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const download = async (d: PmDocument) => {
    try {
      await pmDownload(`documents/${d.id}/download/`, undefined, d.original_name);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <ul className="divide-y rounded-md border">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{d.original_name}</span>
            <Badge variant="outline">{humanize(d.doc_type)}</Badge>
            {d.page_group ? <span className="text-xs text-muted-foreground">page {d.page_number}</span> : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {d.uploaded_by?.name ?? ""} · {fmtDate(d.uploaded_at, true)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => download(d)} aria-label={`Download ${d.original_name}`}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ExportButtons({ path, query, name }: { path: string; query?: Record<string, string | number | undefined>; name: string }) {
  const { busy, run } = useRunner();
  return (
    <div className="flex gap-1">
      {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
        <Button
          key={fmt}
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(() => pmDownload(path, { ...query, export: fmt }, `${name}.${fmt}`))}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          {fmt.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" }) {
  return (
    <Card className={cn(tone === "warn" && "border-amber-300", tone === "bad" && "border-red-300")}>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
