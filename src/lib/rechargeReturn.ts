/**
 * "Back to your booking" marker written by the booking page before sending the user to the wallet
 * (recharge or supervisor-wallet link) and read by the wallet page.
 */

export const RETURN_TO_BOOKING_KEY = "returnToBookEquipment";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ReturnToBooking = {
  path: string;
  equipmentName?: string | null;
  reason?: "recharge" | "wallet_link";
  savedAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Only in-app booking paths are accepted, so the marker can never redirect elsewhere. */
export function isSafeBookingPath(path: unknown): path is string {
  return typeof path === "string" && /^\/book-equipment(\?|$|\/)/.test(path) && !path.includes("//");
}

export function saveReturnToBooking(
  value: Omit<ReturnToBooking, "savedAt">,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage || !isSafeBookingPath(value.path)) return;
  try {
    storage.setItem(RETURN_TO_BOOKING_KEY, JSON.stringify({ ...value, savedAt: now }));
  } catch {
    // ignore
  }
}

export function readReturnToBooking(now: number = Date.now(), storage: StorageLike | null = defaultStorage()): ReturnToBooking | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(RETURN_TO_BOOKING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  // Older builds stored the bare path.
  if (raw.startsWith("/")) {
    return isSafeBookingPath(raw) ? { path: raw, savedAt: now } : null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ReturnToBooking>;
    if (!isSafeBookingPath(parsed.path)) return null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : now;
    if (now - savedAt > MAX_AGE_MS) {
      clearReturnToBooking(storage);
      return null;
    }
    return {
      path: parsed.path,
      equipmentName: typeof parsed.equipmentName === "string" ? parsed.equipmentName : null,
      reason: parsed.reason === "wallet_link" ? "wallet_link" : parsed.reason === "recharge" ? "recharge" : undefined,
      savedAt,
    };
  } catch {
    return null;
  }
}

export function clearReturnToBooking(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(RETURN_TO_BOOKING_KEY);
  } catch {
    // ignore
  }
}
