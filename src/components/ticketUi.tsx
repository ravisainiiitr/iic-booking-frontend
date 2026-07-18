import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const TICKET_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const TICKET_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export const DEFAULT_TICKET_TYPE_OPTIONS = [
  { value: "booking", label: "Booking Issues" },
  { value: "equipment", label: "Equipment Support" },
  { value: "payment", label: "Payment Issues" },
  { value: "account", label: "Account Support" },
  { value: "technical", label: "Technical Problems" },
  { value: "laboratory", label: "Laboratory Requests" },
  { value: "general", label: "General Enquiries" },
  { value: "other", label: "Other" },
  { value: "quality_improvement", label: "Quality improvement suggestions/Bugs" },
] as const;

const STATUS_CLASS: Record<string, string> = {
  open: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100",
  in_progress:
    "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  resolved:
    "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
  closed: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  cancelled: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
};

const PRIORITY_CLASS: Record<string, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700",
  medium: "border-blue-200 bg-blue-50 text-blue-800",
  high: "border-orange-200 bg-orange-50 text-orange-900",
  urgent: "border-rose-300 bg-rose-100 text-rose-900 font-semibold",
};

export function TicketStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const key = String(status || "").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-medium", STATUS_CLASS[key] || STATUS_CLASS.open, className)}
    >
      {label || key.replace(/_/g, " ") || "—"}
    </Badge>
  );
}

export function TicketPriorityBadge({
  priority,
  label,
  className,
}: {
  priority: string;
  label?: string;
  className?: string;
}) {
  const key = String(priority || "").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", PRIORITY_CLASS[key] || PRIORITY_CLASS.medium, className)}
    >
      {label || key || "—"}
    </Badge>
  );
}

export function withAuthToken(url: string): string {
  const token = localStorage.getItem("auth_token");
  if (!token) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }
}
