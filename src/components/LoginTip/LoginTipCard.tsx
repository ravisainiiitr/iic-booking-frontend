import { lazy, Suspense, useId, useState } from "react";
import { CalendarClock, FlaskConical, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dismissLoginTip,
  isLoginTipDismissed,
  pickLoginTip,
  type LoginTipUser,
  type NextSampleReminder,
} from "@/lib/loginTips";
import { bookingSampleDeadline, formatSlotTime, hoursLabel, sampleAtSlotShortList } from "@/lib/samplePolicy";
import { useSamplePolicyEquipment } from "./useSamplePolicyEquipment";

const SampleSubmissionPolicyDialog = lazy(() => import("./SampleSubmissionPolicyDialog"));

function NextBookingLine({ reminder, rows }: { reminder: NextSampleReminder; rows: Parameters<typeof bookingSampleDeadline>[1] }) {
  const d = bookingSampleDeadline(reminder, rows);
  return (
    <p
      className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200/80 bg-white/70 px-3 py-2 text-sm text-foreground dark:border-sky-500/25 dark:bg-white/5"
      data-testid="login-tip-next-booking"
    >
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
      <span className="min-w-0">
        Your next booking: <span className="font-medium">{reminder.equipmentName}</span> on{" "}
        <span className="font-medium">{formatSlotTime(reminder.startTime)}</span>.{" "}
        {d.kind === "at-slot" ? (
          "Please bring your sample at the start of your slot."
        ) : d.kind === "deadline" ? (
          <>
            Please submit your sample by <span className="font-medium">{formatSlotTime(d.deadlineAt)}</span>
            {d.leadHours ? ` (${hoursLabel(d.leadHours)} before your slot)` : ""}.
          </>
        ) : d.kind === "estimate" ? (
          `Please submit your sample at least ${hoursLabel(d.leadHours)} before your slot; the booking details show the exact deadline.`
        ) : (
          "Please submit your sample before the deadline shown in the booking details."
        )}
      </span>
    </p>
  );
}

/**
 * Dashboard card with the tip for the signed-in user. Stays until "Got it" and then stays hidden
 * for the rest of this sign-in (sessionStorage); the next sign-in shows it again.
 */
export function LoginTipCard({
  user,
  nextSampleReminder,
  className,
}: {
  user: (LoginTipUser & { id?: number | null }) | null | undefined;
  nextSampleReminder?: NextSampleReminder | null;
  className?: string;
}) {
  const titleId = useId();
  const tip = pickLoginTip(user);
  const userId = user?.id ?? null;
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyRequested, setPolicyRequested] = useState(false);
  const dismissKey = userId != null && tip ? `${userId}:${tip.id}` : "";
  const visible = !!tip && userId != null && dismissedNow !== dismissKey && !isLoginTipDismissed(userId, tip.id);
  const equipment = useSamplePolicyEquipment("default", visible && !!tip?.samplePolicy);

  if (!visible || !tip || userId == null) return null;

  const dismiss = () => {
    dismissLoginTip(userId, tip.id);
    setDismissedNow(dismissKey);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  };

  const atSlotNames = tip.samplePolicy ? sampleAtSlotShortList(equipment.rows) : "";
  const reminder = tip.samplePolicy ? nextSampleReminder : null;

  return (
    <section
      role="status"
      aria-labelledby={titleId}
      data-testid="login-tip"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-4 shadow-sm sm:px-5",
        "dark:border-sky-500/30 dark:from-sky-500/10 dark:via-card dark:to-emerald-500/10",
        className
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm sm:h-11 sm:w-11"
          aria-hidden
        >
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="pr-8 leading-snug">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              {tip.eyebrow}
              <span className="sr-only">:</span>
            </span>{" "}
            <span className="block text-base font-semibold text-foreground">{tip.title}</span>
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
          {tip.samplePolicy ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground" data-testid="login-tip-at-slot">
              {atSlotNames
                ? `For instruments where the sample is brought to the slot, such as ${atSlotNames}, please bring your sample at the start of your slot.`
                : "For instruments where the sample is brought to the slot, please bring your sample at the start of your slot."}
            </p>
          ) : null}

          {reminder ? <NextBookingLine reminder={reminder} rows={equipment.rows} /> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={dismiss} className="bg-sky-600 text-white hover:bg-sky-700">
              Got it
            </Button>
            {tip.samplePolicy ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-sky-300 text-sky-800 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-500/10"
                aria-haspopup="dialog"
                onClick={() => {
                  setPolicyRequested(true);
                  setPolicyOpen(true);
                }}
              >
                <Info className="h-4 w-4" aria-hidden />
                More information
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground"
        onClick={dismiss}
        aria-label="Dismiss tip"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
      {policyRequested ? (
        <Suspense fallback={null}>
          <SampleSubmissionPolicyDialog
            open={policyOpen}
            onOpenChange={setPolicyOpen}
            nextBooking={reminder ?? null}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
