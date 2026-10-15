import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trainingApi } from "@/lib/trainingApi";
import type { AuthorisationStatus } from "@/lib/trainingAuthTypes";
import { cn } from "@/lib/utils";
import { formatDate, formatWindow } from "./trainingHelpers";
import { PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";

/** Small "Training required" pill for equipment cards and search results. */
export function TrainingRequiredBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
        className,
      )}
      title="Booking needs authorisation (training) on this equipment"
    >
      <GraduationCap className="h-3 w-3" aria-hidden />
      Training required
    </span>
  );
}

export function RequestTrainingDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
  reasonRequired = false,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: number;
  equipmentName: string;
  reasonRequired?: boolean;
  onDone?: () => void;
}) {
  return (
    <PromptDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request training"
      description={`Ask the OIC and Lab Operators of ${equipmentName} to train and authorise you. They will schedule a session or reply with a reason.`}
      label={reasonRequired ? "Why are you asking again?" : "Message to the OIC"}
      placeholder="Your experience with this equipment, the samples you plan to run, preferred days…"
      required={reasonRequired}
      confirmLabel="Send request"
      onConfirm={async (text) => {
        const res = await runTrainingAction(trainingApi.requestTraining(equipmentId, text), "Training request sent");
        if (res.error) return false;
        onDone?.();
        return true;
      }}
    />
  );
}

function statusLine(status: AuthorisationStatus): string {
  const until = status.valid_until ? formatDate(status.valid_until) : "";
  switch (status.status) {
    case "AUTHORISED":
      return until ? `You are authorised (${status.level_name}) until ${until}.` : `You are authorised (${status.level_name}).`;
    case "EXPIRING":
    case "GRACE":
    case "EXPIRED":
    case "SUSPENDED":
    case "REVOKED":
    case "NOT_AUTHORISED":
      return status.message;
    default:
      return "";
  }
}

/**
 * "Authorisation required" panel shown on the equipment and booking pages. When the user may not book,
 * it takes the place of the Book button and offers "Request training".
 */
export function AuthorisationGateCard({
  status,
  equipmentId,
  equipmentName,
  onChanged,
  subjectName,
  className,
}: {
  status: AuthorisationStatus;
  equipmentId: number;
  equipmentName: string;
  onChanged?: () => void;
  /** Staff booking for someone else: whose status this is. */
  subjectName?: string;
  className?: string;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const blocked = !status.allowed;
  const staffView = Boolean(subjectName);
  const req = status.open_request;
  const Icon = blocked ? ShieldAlert : ShieldCheck;
  const tone = blocked
    ? "border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/30"
    : status.status === "AUTHORISED"
      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
      : "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30";

  return (
    <section
      role={blocked ? "alert" : "status"}
      aria-label="Authorisation required"
      className={cn("rounded-xl border-2 px-3.5 py-3 text-sm shadow-sm", tone, className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon
          className={cn("h-5 w-5 shrink-0", blocked ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}
          aria-hidden
        />
        <h3 className="font-semibold text-foreground">Authorisation required</h3>
        <StatusChip kind="authorisation" status={status.status} label={status.status_label} />
      </div>
      {staffView ? (
        <p className="mt-1.5 text-foreground">
          {subjectName} is {status.status_label.toLowerCase()} on this equipment.
          {blocked ? " Your staff booking goes ahead and is recorded in the training audit log." : ""}
        </p>
      ) : (
        <p className="mt-1.5 text-foreground">{statusLine(status)}</p>
      )}
      {req ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Training request {req.reference}: <StatusChip kind="authRequest" status={req.status} label={req.status_label} className="mx-1" />
          {req.status === "SCHEDULED" && req.scheduled_start
            ? `${formatWindow(req.scheduled_start, req.scheduled_end)}${req.location ? ` at ${req.location}` : ""}`
            : "waiting for the OIC or Lab Operator."}
        </p>
      ) : null}
      {!staffView ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {status.can_request ? (
            <Button type="button" size="sm" onClick={() => setRequestOpen(true)} className="gap-1.5">
              <GraduationCap className="h-4 w-4" aria-hidden />
              {status.status === "EXPIRING" || status.status === "EXPIRED" ? "Request refresher training" : "Request training"}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/my-authorisations">My authorisations</Link>
          </Button>
        </div>
      ) : null}
      <RequestTrainingDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        equipmentId={equipmentId}
        equipmentName={equipmentName}
        reasonRequired={status.status === "SUSPENDED" || status.status === "REVOKED"}
        onDone={onChanged}
      />
    </section>
  );
}
