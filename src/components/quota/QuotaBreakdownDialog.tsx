import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Info, Loader2, Users } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  formatRequestedAt,
  requestAloneExceedsLimit,
  requestAloneText,
  type QuotaBreakdown,
  type QuotaBreakdownRequest,
  type QuotaBreakdownRow,
} from "@/lib/quotaBreakdown";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const IST = "Asia/Kolkata";
const PERIOD_RULE = "Weeks run Monday to Sunday and months by calendar month, in Indian time.";
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });
const whenFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Tue, 6 Oct, 10:00–11:30" (IST); spans over midnight show both days. */
export function formatSlotSpan(start: string | null, end: string | null): string {
  const s = parse(start);
  if (!s) return "—";
  const e = parse(end);
  const day = dayFmt.format(s);
  if (!e) return `${day}, ${timeFmt.format(s)}`;
  const endDay = dayFmt.format(e);
  return endDay === day
    ? `${day}, ${timeFmt.format(s)}–${timeFmt.format(e)}`
    : `${day}, ${timeFmt.format(s)} – ${endDay}, ${timeFmt.format(e)}`;
}

function min(n: number | null | undefined): string {
  return `${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("en-IN")} min`;
}

type PanelProps = {
  request: QuotaBreakdownRequest;
  /** Opens a booking in place (staff pages); otherwise rows link to My Bookings. */
  onOpenBooking?: (bookingId: number) => void;
  className?: string;
  /** inline: embedded in another view (e.g. attempt details), so it carries the period rule itself. */
  variant?: "dialog" | "inline";
};

function BookingCell({ row, onOpenBooking }: { row: QuotaBreakdownRow; onOpenBooking?: (id: number) => void }) {
  const label = row.display_booking_id || (row.booking_id != null ? `#${row.booking_id}` : "—");
  if (!row.can_open || row.booking_id == null) return <span className="font-mono text-xs">{label}</span>;
  if (onOpenBooking) {
    const id = row.booking_id;
    return (
      <button
        type="button"
        onClick={() => onOpenBooking(id)}
        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
      >
        {label}
      </button>
    );
  }
  return (
    <a
      href={`/my-bookings?booking=${encodeURIComponent(row.display_booking_id || String(row.booking_id))}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
    >
      {label}
    </a>
  );
}

function RowsTable({
  rows,
  reasonColumn,
  onOpenBooking,
  total,
  headSupervisorId,
}: {
  rows: QuotaBreakdownRow[];
  reasonColumn?: boolean;
  onOpenBooking?: (id: number) => void;
  total?: number;
  /** The supervisor shown in the summary; rows only repeat a different one. */
  headSupervisorId?: number | null;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Slot (IST)</TableHead>
            <TableHead className="hidden md:table-cell">Requested on</TableHead>
            <TableHead className="text-right">Minutes</TableHead>
            <TableHead>{reasonColumn ? "Why not counted" : "Status"}</TableHead>
            <TableHead>Booked by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={`${row.booking_id ?? "x"}-${row.slot_start}-${idx}`} className={cn(row.is_viewer && "bg-primary/5")}>
              <TableCell className="whitespace-nowrap">
                <BookingCell row={row} onOpenBooking={onOpenBooking} />
              </TableCell>
              <TableCell className="min-w-[8rem]">
                <div className="text-sm">{row.equipment_name}</div>
                {row.equipment_code && <div className="text-xs text-muted-foreground">{row.equipment_code}</div>}
              </TableCell>
              <TableCell className="min-w-[10rem] text-sm">
                <div className="whitespace-nowrap">{formatSlotSpan(row.slot_start, row.slot_end)}</div>
                {!reasonColumn && row.note && <div className="text-xs text-muted-foreground">{row.note}</div>}
                {row.requested_at && (
                  <div className="text-xs text-muted-foreground md:hidden">
                    Requested {formatRequestedAt(row.requested_at)}
                    {row.requested_note ? ` · ${row.requested_note}` : ""}
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden min-w-[9rem] text-sm md:table-cell" data-testid="requested-on">
                <div className="whitespace-nowrap tabular-nums">{formatRequestedAt(row.requested_at)}</div>
                {row.requested_note && <div className="text-xs text-muted-foreground">{row.requested_note}</div>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{Math.round(row.minutes)}</TableCell>
              <TableCell className="min-w-[7rem] text-sm">
                {reasonColumn ? row.note || row.status_label : row.status_label}
              </TableCell>
              <TableCell className="min-w-[7rem] text-sm">
                {row.user_name || "—"}
                {row.is_viewer && <span className="text-xs text-muted-foreground"> (you)</span>}
                {row.supervisor_name && row.supervisor_id !== headSupervisorId && (
                  <div className="text-xs text-muted-foreground">Supervisor: {row.supervisor_name}</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {total != null && rows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-sm font-medium">
                Total counted
              </TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="text-right font-semibold tabular-nums">{Math.round(total)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "bad" && "text-red-700 dark:text-red-400",
          tone === "good" && "text-green-700 dark:text-green-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function attemptNoteLines(data: QuotaBreakdown): string[] {
  const a = data.attempt;
  if (!a) return [];
  const lines: string[] = [];
  const attempted = parse(a.attempted_at);
  lines.push(
    `Worked out now from current bookings${attempted ? ` (attempt made ${whenFmt.format(attempted)})` : ""}; bookings cancelled or changed since then are reflected.`,
  );
  if (a.period_source === "matched_usage") {
    lines.push("The requested slot wasn't recorded for this attempt; this is the period whose usage matches the logged figure.");
  } else if (a.period_source === "attempt_time") {
    lines.push("The requested slot wasn't recorded for this attempt, so this shows the period the attempt was made in.");
  }
  if (a.limit_changed && a.logged_limit_minutes != null) {
    lines.push(`Limit now ${min(data.limit_minutes)} (was ${min(a.logged_limit_minutes)} at the time of the attempt).`);
  }
  if (a.usage_changed && a.logged_used_minutes != null) {
    lines.push(`${min(a.logged_used_minutes)} were counted at the time of the attempt.`);
  }
  return lines;
}

function SupervisorLine({ data }: { data: QuotaBreakdown }) {
  if (data.supervisor === undefined) return null;
  const p = data.supervisor;
  const head = data.scope === "group" && p != null && p.id === data.group_owner?.id;
  const department = p?.department_name
    ? `${p.department_name}${p.department_code ? ` (${p.department_code})` : ""}`
    : null;
  return (
    <p className="text-sm" data-testid="quota-supervisor">
      <span className="text-muted-foreground">{head ? "Group head" : "Supervisor"}: </span>
      {p ? (
        <>
          <span className="font-medium">{p.name}</span>
          {[department, p.id_number ? `Emp. ID ${p.id_number}` : null].filter(Boolean).map((bit) => (
            <span key={bit} className="text-muted-foreground"> · {bit}</span>
          ))}
          {p.email && (
            <>
              <span className="text-muted-foreground"> · </span>
              <a href={`mailto:${p.email}`} className="break-all text-primary underline-offset-2 hover:underline">
                {p.email}
              </a>
            </>
          )}
        </>
      ) : (
        "—"
      )}
    </p>
  );
}

export function QuotaBreakdownPanel({ request, onOpenBooking, className, variant = "dialog" }: PanelProps) {
  const [data, setData] = useState<QuotaBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(request);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    apiClient
      .getQuotaBreakdown(request)
      .then((res) => {
        if (cancelled) return;
        if (res.error || !Array.isArray(res.data?.counted)) setError(res.error || "Could not load the bookings for this limit.");
        else setData(res.data!);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the bookings for this limit.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)} role="status" aria-label="Loading bookings counted">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className={cn("rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200", className)}>
        {error || "Could not load the bookings for this limit."}
      </p>
    );
  }

  const isGroup = data.scope === "group";
  const target = data.equipment_group_name || data.equipment.name;
  const over = data.over_by_minutes > 0;
  const share = data.limit_minutes > 0 ? Math.min(100, (data.used_minutes / data.limit_minutes) * 100) : 0;
  const notes = attemptNoteLines(data);
  const aloneOver =
    !data.effectively_unlimited &&
    (data.request_exceeds_limit ?? requestAloneExceedsLimit(data.requested_minutes, data.limit_minutes));
  const studentGroupView = isGroup && !data.full_details;
  const people = data.group_members_count;
  const groupBits = [
    data.group_owner ? `${data.group_owner.name}'s group` : null,
    people ? `${people} ${people === 1 ? "person" : "people"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("space-y-4", className)} data-testid="quota-breakdown">
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold">{data.period_label}</p>
            <p className="text-sm text-muted-foreground">
              {isGroup
                ? `Research group limit on ${target}${groupBits ? ` (${groupBits})` : ""}`
                : `${data.viewer_access === "self" ? "Your" : `${data.subject.name}'s`} limit on ${target}`}
            </p>
          </div>
          <Badge variant="outline">{data.scope_label}</Badge>
        </div>
        <SupervisorLine data={data} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Limit" value={data.effectively_unlimited ? "No limit" : min(data.limit_minutes)} />
          <Figure label="Used" value={min(data.used_minutes)} />
          {data.requested_minutes > 0 && <Figure label="This request" value={min(data.requested_minutes)} />}
          {over ? (
            <Figure label="Over by" value={min(data.over_by_minutes)} tone="bad" />
          ) : (
            <Figure
              label={data.requested_minutes > 0 ? "Left after this" : "Left"}
              value={min(data.remaining_minutes - data.requested_minutes)}
              tone="good"
            />
          )}
        </div>
        {data.limit_minutes > 0 && !data.effectively_unlimited && (
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full", over || share >= 100 ? "bg-red-600" : share >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${share}%` }} />
          </div>
        )}
      </div>

      {aloneOver && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100"
          data-testid="quota-request-alone"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {requestAloneText(data.requested_minutes, data.limit_minutes, data.period)} It can't fit even with no other
            bookings in the period.
          </span>
        </p>
      )}

      {(notes.length > 0 || data.excluded_booking_id != null || studentGroupView) && (
        <div className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            {notes.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {data.excluded_booking_id != null && (
              <p>The booking being changed isn't listed; its new time is shown as “This request”.</p>
            )}
            {studentGroupView && <p>You can see who in your group booked; only your own bookings can be opened.</p>}
          </div>
        </div>
      )}

      {isGroup && data.members.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Users className="h-4 w-4" aria-hidden /> By person
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Minutes by person">
            {data.members.map((m) => (
              <li key={m.user_id} className={cn("rounded-full border px-3 py-1 text-xs", m.is_viewer && "border-primary/50 bg-primary/5")}>
                <span className="font-medium">{m.name}</span>
                {m.is_viewer && " (you)"}: {min(m.minutes)} · {m.bookings} {m.bookings === 1 ? "booking" : "bookings"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium">Bookings counted ({data.counted.length})</p>
        {data.counted.length === 0 ? (
          <p className="rounded-md border px-3 py-4 text-center text-sm text-muted-foreground">
            {aloneOver
              ? "No other bookings count toward this limit in this period; the request alone is over the limit."
              : "No bookings count toward this limit in this period."}
          </p>
        ) : (
          <RowsTable
            rows={data.counted}
            onOpenBooking={onOpenBooking}
            total={data.used_minutes}
            headSupervisorId={data.supervisor?.id ?? null}
          />
        )}
      </div>

      {data.not_counted.length > 0 && (
        <details className="group text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
            Not counted ({data.not_counted.length}
            {data.not_counted_truncated ? "+" : ""})
          </summary>
          <div className="mt-2">
            <RowsTable
              rows={data.not_counted}
              reasonColumn
              onOpenBooking={onOpenBooking}
              headSupervisorId={data.supervisor?.id ?? null}
            />
          </div>
        </details>
      )}

      {variant === "inline" && (
        <p className="text-xs text-muted-foreground">{PERIOD_RULE}</p>
      )}
    </div>
  );
}

type DialogProps = {
  request: QuotaBreakdownRequest | null;
  onClose: () => void;
  onOpenBooking?: (bookingId: number) => void;
};

export function QuotaBreakdownDialog({ request, onClose, onOpenBooking }: DialogProps) {
  return (
    <Dialog open={request != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl lg:max-w-5xl grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bookings counted toward this limit</DialogTitle>
          <DialogDescription>{PERIOD_RULE}</DialogDescription>
        </DialogHeader>
        {request && <QuotaBreakdownPanel request={request} onOpenBooking={onOpenBooking} />}
      </DialogContent>
    </Dialog>
  );
}

export default QuotaBreakdownDialog;
