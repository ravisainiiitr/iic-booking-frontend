import { useEffect, useState } from "react";

/** Seconds left, resynced whenever the server value changes and ticked once per second in between. */
export function useCountdown(serverSeconds: number | null | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(typeof serverSeconds === "number" ? serverSeconds : null);

  useEffect(() => {
    setRemaining(typeof serverSeconds === "number" ? serverSeconds : null);
  }, [serverSeconds]);

  const running = remaining != null && remaining > 0;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setRemaining((r) => (r == null ? r : Math.max(0, r - 1))), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  return remaining;
}
