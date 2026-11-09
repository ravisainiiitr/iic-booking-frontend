import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";

/** The portal's own I-STEM record for a booking (automatic FBR, 2 Nov 2026), from the booking APIs. */
export interface IstemAutomatic {
  automatic: true;
  step: "queued" | "registered" | "confirmed" | "executed" | "cancelled" | "attention";
  label: string;
  fbr_no: string;
  request_id: string;
  confirmation_id: string;
  payment_id: string;
  /** While queued (booking detail only): plain-words reasons the booking is not on I-STEM yet. */
  waiting_reasons?: string[];
  /** While queued: the exact missing fields, for staff. */
  waiting_detail?: string[];
  /** The furthest step I-STEM accepted, also while the record is held for the team (newer servers). */
  reached?: "queued" | "registered" | "confirmed" | "executed" | "cancelled";
  /** The booking is completed, so FBR Execute is due rather than waiting for completion (newer servers). */
  booking_completed?: boolean;
}

const ORDER = ["registered", "confirmed", "executed"] as const;

export function istemAutomaticOf(booking: unknown): IstemAutomatic | null {
  const value = (booking as { istem_automatic?: IstemAutomatic | null } | null)?.istem_automatic;
  return value && value.automatic ? value : null;
}

/** Progress of the I-STEM record the portal creates for the booking: registered (FBR number), slot confirmed, FBR
 * executed. Nothing for the user to do; the IIC team handles anything held back. */
export function IstemAutomaticStatus({
  status,
  compact = false,
  showDetail = false,
}: {
  status: IstemAutomatic;
  compact?: boolean;
  /** Staff only: also list the exact missing fields. */
  showDetail?: boolean;
}) {
  const held = status.step === "attention";
  // While held, the steps I-STEM already accepted stay ticked; the next one is marked as held.
  const progress = held ? status.reached ?? "queued" : status.step;
  const reached = ORDER.indexOf(progress as (typeof ORDER)[number]);
  const reasons = status.step === "queued" ? status.waiting_reasons ?? [] : [];
  const detail = showDetail && status.step === "queued" ? status.waiting_detail ?? [] : [];
  const executeWaiting = status.booking_completed ? "Being recorded on I-STEM now that the booking is completed" : "After your booking is completed";
  const rows: { key: (typeof ORDER)[number]; title: string; detail: string }[] = [
    { key: "registered", title: "Registered on I-STEM", detail: status.fbr_no ? `FBR ${status.fbr_no}` : "FBR number assigned by I-STEM" },
    { key: "confirmed", title: "Slot confirmed on I-STEM", detail: status.confirmation_id ? `Confirmation ${status.confirmation_id}` : "Your booked hours" },
    { key: "executed", title: "FBR executed", detail: status.payment_id ? `With the amount charged at payment · record ${status.payment_id}` : executeWaiting },
  ];
  const heldNote = (
    <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300" data-testid="istem-held">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      IIT Roorkee Equipment Booking team is completing the I-STEM record for this booking. Nothing is needed from you.
    </p>
  );
  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:bg-emerald-950/20" data-testid="istem-automatic">
      <div>
        <p className="font-semibold">I-STEM: handled by the portal</p>
        {!compact ? (
          <p className="text-muted-foreground">
            This booking is registered on the national I-STEM portal for you. There is no FBR number to enter.
          </p>
        ) : null}
      </div>
      {held && reached < 0 ? (
        heldNote
      ) : status.step === "cancelled" ? (
        <p className="text-muted-foreground">The I-STEM record was cancelled with this booking.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const done = reached >= i;
            const current = !done && (i === reached + 1);
            const isHeld = held && current;
            return (
              <li key={row.key} className="flex items-start gap-2" data-state={done ? "done" : isHeld ? "held" : current ? "current" : "todo"}>
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : isHeld ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                ) : current ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                )}
                <span>
                  <span className={done ? "font-medium" : "text-muted-foreground"}>{row.title}</span>
                  {done || (current && !isHeld) ? <span className="block font-mono text-xs text-muted-foreground">{row.detail}</span> : null}
                  {isHeld ? <span className="mt-0.5 block">{heldNote}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {reasons.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" data-testid="istem-waiting">
          <p className="font-medium">Why it is not on I-STEM yet</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {detail.length ? (
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-amber-800/90 dark:text-amber-300/90" data-testid="istem-waiting-detail">
              {detail.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
