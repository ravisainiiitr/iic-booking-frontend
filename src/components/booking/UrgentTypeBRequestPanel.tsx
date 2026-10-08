import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINRAmount } from "@/lib/money";
import type { BookingWalletStatus } from "@/lib/bookingWalletStatus";

export const URGENT_REASON_MIN_LENGTH = 10;
export const URGENT_PREFERRED_SCHEDULE_MAX_LENGTH = 1000;

export function formatRequiredTime(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** Why the Type B request cannot be submitted yet (null when it can). */
export function urgentTypeBSubmitBlocker(opts: {
  blocker?: string | null;
  reason: string;
  disclaimerAccepted: boolean;
  requiredMinutes: number | null | undefined;
}): string | null {
  if (opts.blocker) return opts.blocker;
  if (!opts.requiredMinutes || opts.requiredMinutes <= 0) return "Fill in Step 1 to work out the required time.";
  if (opts.reason.trim().length < URGENT_REASON_MIN_LENGTH) {
    return `Give the reason (at least ${URGENT_REASON_MIN_LENGTH} characters).`;
  }
  if (!opts.disclaimerAccepted) return "Tick the confirmation to accept the 50% urgent surcharge.";
  return null;
}

function walletNote(status: BookingWalletStatus): string | null {
  switch (status.kind) {
    case "insufficient":
      return `Your wallet can cover ${formatINRAmount(status.spendable)} now, ${formatINRAmount(status.shortfall)} short of this amount. You can still submit, but the OIC cannot allocate the booking until the wallet has enough balance.`;
    case "zero_balance":
      return `Your wallet for ${status.departmentName} has no balance. The OIC cannot allocate the booking until it has enough balance.`;
    case "blocked":
      return status.message;
    default:
      return null;
  }
}

export interface UrgentTypeBRequestPanelProps {
  requiredMinutes: number | null | undefined;
  totalCharge: number | string | null | undefined;
  chargeBreakdown?: Array<{ description: string; amount: number | string }> | null;
  showBreakdown?: boolean;
  walletStatus: BookingWalletStatus;
  /** Something outside this panel that stops submission (missing Step 1 fields, wallet link, equipment down). */
  blocker?: string | null;
  preferredSchedule: string;
  onPreferredScheduleChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  evidenceFile: File | null;
  onEvidenceFileChange: (file: File | null) => void;
  disclaimerAccepted: boolean;
  onDisclaimerChange: (value: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Type B urgent request without slots: the user only describes the requirement (Step 1 inputs).
 * Shows the required time and the amount with the 50% surcharge before submitting; the OIC picks the slots later.
 */
export function UrgentTypeBRequestPanel(props: UrgentTypeBRequestPanelProps) {
  const {
    requiredMinutes,
    totalCharge,
    chargeBreakdown,
    showBreakdown = true,
    walletStatus,
    preferredSchedule,
    reason,
    evidenceFile,
    disclaimerAccepted,
    submitting,
  } = props;
  const blocker = urgentTypeBSubmitBlocker({
    blocker: props.blocker,
    reason,
    disclaimerAccepted,
    requiredMinutes,
  });
  const note = walletNote(walletStatus);

  return (
    <section
      className="mb-3 rounded-lg border-2 border-amber-400 bg-amber-50/60 p-4 dark:border-amber-700 dark:bg-amber-950/20"
      aria-labelledby="urgent-type-b-heading"
      data-testid="urgent-type-b-panel"
    >
      <h3 id="urgent-type-b-heading" className="text-base font-semibold">
        Step 3: Type B urgent request
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        You do not choose slots. Describe your requirement in Step 1; the OIC picks the day and time (any day,
        including weekends) and books it for you. Students need their supervisor&apos;s approval first. Your wallet is
        charged only when the OIC allocates the booking.
      </p>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md border bg-background p-3">
          <dt className="text-muted-foreground">Required time</dt>
          <dd className="text-lg font-semibold" data-testid="urgent-type-b-required-time">
            {requiredMinutes ? formatRequiredTime(requiredMinutes) : "—"}
          </dd>
        </div>
        <div className="rounded-md border bg-background p-3">
          <dt className="text-muted-foreground">Amount (with 50% urgent surcharge)</dt>
          <dd className="text-lg font-semibold text-primary" data-testid="urgent-type-b-amount">
            {totalCharge != null && totalCharge !== "" ? formatINRAmount(totalCharge) : "—"}
          </dd>
        </div>
      </dl>
      {showBreakdown && chargeBreakdown && chargeBreakdown.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {chargeBreakdown.map((item, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="min-w-0 whitespace-pre-line">{item.description}</span>
              <span className="shrink-0 tabular-nums">{formatINRAmount(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        The OIC checks this amount again when allocating; if rates change in between, the amount at allocation applies.
      </p>
      {note && (
        <p role="status" className="mt-2 rounded-md border border-amber-500 bg-amber-100/70 p-2 text-sm dark:bg-amber-950/40">
          {note}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="urgent-type-b-preferred">Preferred dates or times (optional)</Label>
          <Textarea
            id="urgent-type-b-preferred"
            value={preferredSchedule}
            maxLength={URGENT_PREFERRED_SCHEDULE_MAX_LENGTH}
            onChange={(e) => props.onPreferredScheduleChange(e.target.value)}
            placeholder="e.g. Any day before 20 Oct; mornings preferred"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urgent-type-b-reason">Reason (required)</Label>
          <Textarea
            id="urgent-type-b-reason"
            value={reason}
            onChange={(e) => props.onReasonChange(e.target.value)}
            placeholder={`Why is this booking urgent? (min. ${URGENT_REASON_MIN_LENGTH} characters)`}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urgent-type-b-evidence">Supporting document (optional)</Label>
          <Input
            id="urgent-type-b-evidence"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            onChange={(e) => props.onEvidenceFileChange(e.target.files?.[0] ?? null)}
          />
          {evidenceFile && <p className="text-xs text-muted-foreground">Selected: {evidenceFile.name}</p>}
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="urgent-type-b-disclaimer"
            checked={disclaimerAccepted}
            onCheckedChange={(c) => props.onDisclaimerChange(c === true)}
            className="mt-0.5"
          />
          <Label htmlFor="urgent-type-b-disclaimer" className="cursor-pointer text-sm font-normal">
            I confirm my reason is genuine and accept the 50% urgent surcharge.
          </Label>
        </div>
      </div>

      {blocker && <p className="mt-3 text-sm text-muted-foreground">{blocker}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={props.onSubmit} disabled={!!blocker || submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Type B request
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
