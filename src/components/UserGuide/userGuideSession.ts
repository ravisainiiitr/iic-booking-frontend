/** Per-tab, per-login auto-show bookkeeping for the role user guide. */

function sessionAutoShowKey(userId: number) {
  return `iic_user_guide_autoshow_${userId}`;
}

export function hasUserGuideAutoShownThisLogin(userId: number): boolean {
  try {
    return sessionStorage.getItem(sessionAutoShowKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markUserGuideAutoShownThisLogin(userId: number) {
  try {
    sessionStorage.setItem(sessionAutoShowKey(userId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Call from logout so the next login can auto-show once again. */
export function clearUserGuideAutoShownThisLogin(userId: number) {
  try {
    sessionStorage.removeItem(sessionAutoShowKey(userId));
  } catch {
    /* ignore */
  }
}