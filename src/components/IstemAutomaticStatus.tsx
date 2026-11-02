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
}

const ORDER = ["registered", "confirmed", "executed"] as const;

export function istemAutomaticOf(booking: unknown): IstemAutomatic | null {
  const value = (booking as { istem_automatic?: IstemAutomatic | null } | null)?.istem_automatic;
  return value && value.automatic ? value : null;
}

/** Progress of the I-STEM record the portal creates for the booking: registered (FBR number), slot confirmed, FBR
 * executed. Nothing for the user to do; the IIC team handles anything held back. */
export function IstemAutomaticStatus({ status, compact = false }: { status: IstemAutomatic; compact?: boolean }) {
  const reached = ORDER.indexOf(status.step as (typeof ORDER)[number]);
  const rows: { key: (typeof ORDER)[number]; title: string; detail: string }[] = [
    { key: "registered", title: "Registered on I-STEM", detail: status.fbr_no ? `FBR ${status.fbr_no}` : "FBR number assigned by I-STEM" },
    { key: "confirmed", title: "Slot confirmed on I-STEM", detail: status.confirmation_id ? `Confirmation ${status.confirmation_id}` : "Your booked hours" },
    { key: "executed", title: "FBR executed", detail: status.payment_id ? `With the amount charged at payment · record ${status.payment_id}` : "After your booking is completed" },
  ];
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
      {status.step === "attention" ? (
        <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The IIC team is completing the I-STEM record for this booking. Nothing is needed from you.
        </p>
      ) : status.step === "cancelled" ? (
        <p className="text-muted-foreground">The I-STEM record was cancelled with this booking.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const done = reached >= i;
            const current = !done && (i === reached + 1);
            return (
              <li key={row.key} className="flex items-start gap-2" data-state={done ? "done" : current ? "current" : "todo"}>
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : current ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                )}
                <span>
                  <span className={done ? "font-medium" : "text-muted-foreground"}>{row.title}</span>
                  {done || current ? <span className="block font-mono text-xs text-muted-foreground">{row.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
