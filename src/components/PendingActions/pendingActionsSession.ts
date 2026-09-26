/** Per-tab, per-login bookkeeping so the pending-actions popup opens once after each sign-in. */

function key(userId: number) {
  return `iic_pending_actions_shown_${userId}`;
}

export function hasPendingActionsShownThisLogin(userId: number): boolean {
  try {
    return sessionStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function markPendingActionsShownThisLogin(userId: number) {
  try {
    sessionStorage.setItem(key(userId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPendingActionsShownThisLogin(userId: number) {
  try {
    sessionStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
