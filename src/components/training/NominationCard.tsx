import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trainingApi } from "@/lib/trainingApi";
import type { Nomination } from "@/lib/trainingTypes";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { deadlineCountdown, formatDateTime, formatScore, humanizeCode } from "./trainingHelpers";
import { PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";

const SOP_ACK = "I have read the instrument SOP and safety rules and will attend every session.";

type Props = {
  nomination: Nomination;
  /** "student" shows the nominator; "faculty" shows the student. */
  viewer: "student" | "faculty";
  onChanged: () => void;
};

/** One nomination with its result, score breakdown and the actions allowed by `permissions`. */
export function NominationCard({ nomination: n, viewer, onChanged }: Props) {
  const [showScore, setShowScore] = useState(false);
  const [dialog, setDialog] = useState<"withdraw" | "confirm" | "accept" | "decline" | "appeal" | null>(null);
  const perms = n.permissions;
  const result = n.result;
  const countdown = n.confirm_deadline ? deadlineCountdown(n.confirm_deadline) : "";

  const done = async (call: Parameters<typeof runTrainingAction>[0], message: string) => {
    const res = await runTrainingAction(call, message);
    if (res.error) return false;
    onChanged();
    return true;
  };

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {n.call.reference} · {n.call.equipment.code}
          </p>
          <p className="font-medium">{n.call.title || n.call.equipment.name}</p>
          <p className="text-xs text-muted-foreground">
            {viewer === "faculty" ? `Student: ${n.student.name}` : `Nominated by ${n.nominator?.name ?? "—"}`} ·{" "}
            {n.need_category_label || humanizeCode(n.need_category)}
            {n.expected_hours_month ? ` · ${n.expected_hours_month} h/month` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusChip kind="nomination" status={n.status} label={n.status_label} />
          {n.selected_on_appeal ? <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Selected on appeal</span> : null}
          {n.promoted_from_waitlist ? <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Promoted from waitlist</span> : null}
        </div>
      </div>

      {n.call.status === "OPEN" ? (
        <p className="mt-1 text-xs text-muted-foreground">Nominations close {formatDateTime(n.call.deadline)}</p>
      ) : null}
      {n.ineligible_reason ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{n.ineligible_reason}</p> : null}
      {countdown && (perms.confirm_interest || perms.accept_seat) ? (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Respond by {formatDateTime(n.confirm_deadline)} · {countdown}
        </p>
      ) : null}
      {n.confirmed_at ? <p className="mt-1 text-xs text-muted-foreground">Seat confirmed {formatDateTime(n.confirmed_at)}</p> : null}
      {n.student_confirmed_at && !n.confirmed_at ? (
        <p className="mt-1 text-xs text-muted-foreground">Interest confirmed {formatDateTime(n.student_confirmed_at)}</p>
      ) : null}

      {result ? (
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <StatusChip kind="outcome" status={result.outcome} label={result.outcome_label} />
            {result.rank ? <span>Rank {result.rank}</span> : null}
            {result.waitlist_position ? <span>Waitlist #{result.waitlist_position}</span> : null}
            {result.seat_type ? <span className="text-xs text-muted-foreground">{humanizeCode(result.seat_type)} seat</span> : null}
            <button
              type="button"
              onClick={() => setShowScore((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-sky-300"
              aria-expanded={showScore}
            >
              {showScore ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Score {formatScore(result.score_total)}
            </button>
          </div>
          {showScore ? <ScoreBreakdown className="mt-2" breakdown={result.score_breakdown} total={result.score_total} /> : null}
          {result.note ? <p className="mt-1.5 text-xs text-muted-foreground">{result.note}</p> : null}
          {result.appeals?.length ? (
            <ul className="mt-2 space-y-1">
              {result.appeals.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Gavel className="h-3 w-3" aria-hidden /> Appeal
                  </span>{" "}
                  <StatusChip kind="appeal" status={a.status} className="ml-1" /> <span className="text-muted-foreground">{formatDateTime(a.created_at)}</span>
                  {a.decision_note ? <span className="block text-muted-foreground">Decision: {a.decision_note}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {perms.withdraw || perms.confirm_interest || perms.accept_seat || perms.decline_seat || perms.appeal ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {perms.appeal && result ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setDialog("appeal")}>
              <Gavel className="mr-1.5 h-4 w-4" /> Appeal
            </Button>
          ) : null}
          {perms.withdraw ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setDialog("withdraw")}>
              Withdraw
            </Button>
          ) : null}
          {perms.decline_seat ? (
            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDialog("decline")}>
              Decline seat
            </Button>
          ) : null}
          {perms.confirm_interest ? (
            <Button type="button" size="sm" onClick={() => setDialog("confirm")}>
              Confirm interest
            </Button>
          ) : null}
          {perms.accept_seat ? (
            <Button type="button" size="sm" onClick={() => setDialog("accept")}>
              Accept seat
            </Button>
          ) : null}
        </div>
      ) : null}

      <PromptDialog
        open={dialog === "withdraw"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Withdraw this nomination?"
        label=""
        required={false}
        confirmLabel="Withdraw"
        destructive
        onConfirm={() => done(trainingApi.withdrawNomination(n.id), "Nomination withdrawn.")}
      />
      <PromptDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Confirm your interest"
        description="Only students who confirm are considered in the selection."
        label=""
        required={false}
        acknowledgement={SOP_ACK}
        confirmLabel="Confirm interest"
        onConfirm={() => done(trainingApi.confirmInterest(n.id, true), "Interest confirmed.")}
      />
      <PromptDialog
        open={dialog === "accept"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Accept your seat"
        description={countdown ? `You have ${countdown.replace(" left", "")} to accept.` : undefined}
        label=""
        required={false}
        acknowledgement={SOP_ACK}
        confirmLabel="Accept seat"
        onConfirm={() => done(trainingApi.acceptSeat(n.id, true), "Seat accepted. See your sessions under My Trainings.")}
      />
      <PromptDialog
        open={dialog === "decline"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Decline your seat?"
        description="The seat goes to the next student on the waitlist. This cannot be undone."
        label=""
        required={false}
        confirmLabel="Decline seat"
        destructive
        onConfirm={() => done(trainingApi.declineSeat(n.id), "Seat declined.")}
      />
      <PromptDialog
        open={dialog === "appeal"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Appeal the result"
        description="Explain what was missed or wrong in the assessment. The OIC decides; the decision is final."
        minLength={20}
        confirmLabel="Submit appeal"
        onConfirm={(reason) => (result ? done(trainingApi.appealEntry(result.entry_id, reason), "Appeal submitted.") : false)}
      />
    </article>
  );
}
