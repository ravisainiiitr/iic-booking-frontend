import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Lock, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_SUSPENDED_EVENT, bannerKind } from "@/lib/accountLifecycle";
import { formatDay } from "@/components/registrationApprovals/shared";

const DISMISS_KEY = "iic.lifecycleBannerDismissed";
const TOAST_GAP_MS = 8000;

/** Site-wide notice for accounts past (or near) their programme / employment end date. */
export default function AccountLifecycleBanner() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const lastToast = useRef(0);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onSuspended = (e: Event) => {
      const message = (e as CustomEvent<{ message: string }>).detail?.message || "Your account is suspended.";
      if (Date.now() - lastToast.current > TOAST_GAP_MS) {
        lastToast.current = Date.now();
        toast.error(message, {
          action: { label: "Request extension", onClick: () => navigate("/programme-extension") },
        });
      }
      void refreshUser();
    };
    window.addEventListener(ACCOUNT_SUSPENDED_EVENT, onSuspended);
    return () => window.removeEventListener(ACCOUNT_SUSPENDED_EVENT, onSuspended);
  }, [navigate, refreshUser]);

  const status = isAuthenticated ? user?.account_lifecycle ?? null : null;
  const kind = bannerKind(status);
  if (!status || !kind) return null;
  const end = formatDay(status.programme_end_date);
  const dismissKey = `${kind}:${status.programme_end_date ?? ""}`;
  if (kind !== "suspended" && dismissed === dismissKey) return null;

  const suspended = kind === "suspended";
  const text =
    kind === "suspended"
      ? `Your account is suspended: your programme / employment end date (${end}) has passed. You can still view past bookings and download results, but you cannot book or upload until your supervisor extends it.`
      : kind === "end_date_missing"
        ? "Please record your programme / employment end date. Your supervisor can extend it later in six-month steps."
        : `Your programme / employment end date is ${end} (${status.days_left} day(s) left). After that your account is suspended until your supervisor extends it.`;

  return (
    <div
      role={suspended ? "alert" : "status"}
      className={
        suspended
          ? "sticky top-0 z-[60] flex flex-wrap items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/80 dark:text-red-100"
          : "sticky top-0 z-[60] flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100"
      }
    >
      {suspended ? <Lock className="h-4 w-4 shrink-0" aria-hidden /> : <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />}
      <p className="min-w-0 flex-1">{text}</p>
      <Button size="sm" variant={suspended ? "destructive" : "outline"} onClick={() => navigate("/programme-extension")}>
        {kind === "end_date_missing" ? "Add end date" : "Request extension"}
      </Button>
      {!suspended ? (
        <button
          type="button"
          aria-label="Dismiss notice"
          className="rounded p-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-900"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, dismissKey);
            } catch {
              /* private mode */
            }
            setDismissed(dismissKey);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
