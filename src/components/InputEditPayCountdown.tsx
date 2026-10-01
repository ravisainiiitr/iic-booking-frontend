import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Server deadline (identifies the payment window; a new edit gives a new deadline). */
  deadline: string;
  /** Seconds left according to the server when the booking was loaded (avoids client clock skew). */
  secondsRemaining: number;
  /** Called once when the countdown reaches zero. */
  onExpire: () => void;
};

/** Visible countdown for paying the extra amount after an input edit raised the charge. */
export default function InputEditPayCountdown({ deadline, secondsRemaining, onExpire }: Props) {
  const endsAtRef = useRef(Date.now() + Math.max(0, secondsRemaining) * 1000);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const [left, setLeft] = useState(Math.max(0, secondsRemaining));

  useEffect(() => {
    endsAtRef.current = Date.now() + Math.max(0, secondsRemaining) * 1000;
    firedRef.current = false;
    setLeft(Math.max(0, secondsRemaining));
    // Restart only for a new payment window, not on every booking refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setLeft(next);
      if (next === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        left <= 15
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200",
      )}
      role="timer"
      aria-live="polite"
    >
      <Timer className="h-4 w-4 shrink-0" />
      <span>
        Pay within <span className="tabular-nums">{mm}:{ss}</span> or your edit is cancelled and the previous values
        are restored.
      </span>
    </div>
  );
}
