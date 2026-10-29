import { useEffect, useState } from "react";
import { externalBookingApi, type ExternalWindow, type SpecialPolicy } from "@/lib/externalBookingApi";

/**
 * The central external booking window and special-request availability for the signed-in user. Both are null until
 * loaded, and stay null when the request fails (callers then keep today's behaviour; the server enforces the rules).
 */
export function useExternalWindow(enabled = true): { window: ExternalWindow | null; special: SpecialPolicy | null } {
  const [win, setWin] = useState<ExternalWindow | null>(null);
  const [special, setSpecial] = useState<SpecialPolicy | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    externalBookingApi
      .window()
      .then((w) => alive && setWin(w))
      .catch(() => alive && setWin(null));
    externalBookingApi
      .specialPolicy()
      .then((p) => alive && setSpecial(p))
      .catch(() => alive && setSpecial(null));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { window: win, special };
}
