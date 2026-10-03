import { Badge } from "@/components/ui/badge";
import {
  REGISTRATION_CHANNEL_LABEL,
  REGISTRATION_ROLE_LABEL,
  REGISTRATION_STATUS_LABEL,
  type RegistrationEvent,
  type RegistrationRequestStatus,
} from "@/lib/registrationApprovalTypes";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-03" → "03 Oct 2026" without a timezone shift; "—" when empty. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function formatMoment(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_TONE: Record<RegistrationRequestStatus, string> = {
  unverified: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  pending_faculty: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  pending_admin: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  approved: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  expired: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  disabled: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300",
};

export function RegistrationStatusBadge({ status, className }: { status: RegistrationRequestStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATUS_TONE[status], className)}>
      {REGISTRATION_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const EXTENSION_TONE: Record<string, string> = {
  pending: STATUS_TONE.pending_faculty,
  approved: STATUS_TONE.approved,
  denied: STATUS_TONE.rejected,
  cancelled: STATUS_TONE.disabled,
};

export function ExtensionStatusBadge({ status }: { status: string }) {
  const label = { pending: "Pending", approved: "Granted", denied: "Declined", cancelled: "Cancelled" }[status] ?? status;
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", EXTENSION_TONE[status])}>
      {label}
    </Badge>
  );
}

export function roleLabel(role: string): string {
  return REGISTRATION_ROLE_LABEL[role] ?? (role ? role.replace(/_/g, " ") : "—");
}

export function channelLabel(channel: string): string {
  return REGISTRATION_CHANNEL_LABEL[channel] ?? (channel || "—");
}

const DETAIL_LABELS: Record<string, string> = {
  reason: "Reason",
  decision: "Decision",
  previous_status: "Previous status",
  faculty_email: "Faculty",
  previous_faculty_email: "Previous faculty",
  programme_validity: "Programme validity",
  previous_end_date: "Previous validity",
  approved_until: "Extended until",
  max_until: "Latest date allowed",
  days: "Days before expiry",
  email_sent: "Email sent",
  automatic: "Automatic",
  enabled: "Automation on",
  disclaimer_version: "Disclaimer version",
  future_bookings_kept: "Future bookings kept",
  link_expires_at: "Link expires",
  template: "Email template",
  error: "Error",
};

const HIDDEN_DETAILS = new Set(["faculty_id", "previous_faculty_id", "claims_iitr", "disclaimer_text", "kind"]);

function detailValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (key === "link_expires_at") return formatMoment(String(value));
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDay(value);
  return String(value);
}

export function EventDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details || {}).filter(([k, v]) => !HIDDEN_DETAILS.has(k) && v !== "" && v !== null);
  const disclaimer = typeof details?.disclaimer_text === "string" ? details.disclaimer_text : "";
  if (!entries.length && !disclaimer) return null;
  return (
    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
      {entries.length ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium">{DETAIL_LABELS[k] ?? k.replace(/_/g, " ")}:</dt>
              <dd className="break-all">{detailValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {disclaimer ? (
        <blockquote className="border-l-2 border-primary/40 pl-2 italic">“{disclaimer}”</blockquote>
      ) : null}
    </div>
  );
}

export function EventTimeline({ events, emptyText = "No events yet." }: { events: RegistrationEvent[]; emptyText?: string }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{e.action_label}</span>
            <span className="text-xs text-muted-foreground">{formatMoment(e.at)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {e.actor_name || e.actor_email || roleLabel(e.actor_role)}
            {e.actor_name || e.actor_email ? ` · ${roleLabel(e.actor_role)}` : ""} · {channelLabel(e.channel)}
            {e.ip_address ? ` · IP ${e.ip_address}` : ""}
          </p>
          <EventDetails details={e.details} />
        </li>
      ))}
    </ol>
  );
}

/** The confirmation a faculty member must tick; the text comes from the server so the record matches. */
export function DisclaimerBox({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed", className)}>
      {text}
    </div>
  );
}

export const SIX_MONTH_NOTE =
  "An extension is valid for at most six months from the current validity date (or from today if it has already passed). Further extensions can be requested in the same way.";
