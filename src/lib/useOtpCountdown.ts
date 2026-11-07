import { useEffect, useState } from "react";

/** Time left on a one-time code, updated every second. ``deadline`` is in milliseconds since the epoch. */
export function useOtpCountdown(deadline: number | null): { label: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (deadline === null) return { label: "", expired: false };
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (left === 0) return { label: "This code has expired. Please ask for a new one.", expired: true };
  const seconds = String(left % 60).padStart(2, "0");
  return { label: `This code expires in ${Math.floor(left / 60)}:${seconds}.`, expired: false };
}
