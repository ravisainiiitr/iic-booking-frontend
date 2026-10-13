/** Browser pop-up alerts for new notifications while the portal tab is in the background (opt-in per browser). */

const KEY = "desktop_notifications";

export function desktopAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function desktopAlertsEnabled(): boolean {
  if (!desktopAlertsSupported()) return false;
  try {
    return localStorage.getItem(KEY) === "on" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

/** Turns alerts on (asking the browser for permission) or off. Returns the resulting state. */
export async function setDesktopAlerts(on: boolean): Promise<"on" | "off" | "denied" | "unsupported"> {
  if (!desktopAlertsSupported()) return "unsupported";
  if (!on) {
    localStorage.setItem(KEY, "off");
    return "off";
  }
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") {
    localStorage.setItem(KEY, "off");
    return "denied";
  }
  localStorage.setItem(KEY, "on");
  return "on";
}

export function showDesktopAlert(title: string, body: string, link?: string | null, tag?: string) {
  if (!desktopAlertsEnabled() || typeof document === "undefined" || !document.hidden) return;
  // Browser push already shows this notice when it is on for this browser.
  if (localStorage.getItem("web_push_enabled") === "1") return;
  try {
    const n = new Notification(title, { body: body.slice(0, 240), tag, icon: "/favicon.ico" });
    n.onclick = () => {
      window.focus();
      if (link) window.location.assign(link);
      n.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
