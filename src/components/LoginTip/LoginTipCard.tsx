import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, CalendarClock, FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dismissLoginTip,
  isLoginTipDismissed,
  pickLoginTip,
  type LoginTipUser,
  type NextSampleReminder,
} from "@/lib/loginTips";

const when = (iso: string) => format(new Date(iso), "EEE d MMM, h:mm a");

function hoursLabel(h: number) {
  return h === 1 ? "1 hour" : `${h} hours`;
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
  const navigate = useNavigate();
  const titleId = useId();
  const tip = pickLoginTip(user);
  const userId = user?.id ?? null;
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);

  if (!tip || userId == null) return null;
  const dismissKey = `${userId}:${tip.id}`;
  if (dismissedNow === dismissKey || isLoginTipDismissed(userId, tip.id)) return null;

  const dismiss = () => {
    dismissLoginTip(userId, tip.id);
    setDismissedNow(dismissKey);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  };

  const reminder = tip.showsNextSampleBooking ? nextSampleReminder : null;

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

          {reminder ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200/80 bg-white/70 px-3 py-2 text-sm text-foreground dark:border-sky-500/25 dark:bg-white/5">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
              <span className="min-w-0">
                Your next booking: <span className="font-medium">{reminder.equipmentName}</span> on{" "}
                <span className="font-medium">{when(reminder.startTime)}</span>.{" "}
                {reminder.deadlineAt ? (
                  <>
                    Please hand in your sample by <span className="font-medium">{when(reminder.deadlineAt)}</span>
                    {reminder.leadHours ? ` (${hoursLabel(reminder.leadHours)} before your slot)` : ""}.
                  </>
                ) : (
                  "Please hand in your sample before it starts."
                )}
              </span>
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button size="sm" onClick={dismiss} className="bg-sky-600 text-white hover:bg-sky-700">
              Got it
            </Button>
            {tip.guideSectionId ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                onClick={() => {
                  dismissLoginTip(userId, tip.id);
                  navigate(`/user-guide#guide-${tip.guideSectionId}`);
                }}
              >
                {tip.guideLinkLabel ?? "Read more"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
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
    </section>
  );
}
