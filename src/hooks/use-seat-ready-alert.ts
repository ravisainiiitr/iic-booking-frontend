import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Perm = NotificationPermission | "unsupported";

export function notificationsPermission(): Perm {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestSeatNotifications(): Promise<Perm> {
  if (notificationsPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationsPermission();
  }
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* autoplay blocked — the toast and title still show */
  }
}

/** Announce a moment that needs the user, even when this tab is in the background. */
export function announce(title: string, body: string, { sound = true, tag = "iic-remote-analysis" } = {}) {
  toast.success(title, { description: body, duration: 15000 });
  if (sound) chime();
  if (document.visibilityState !== "visible" && notificationsPermission() === "granted") {
    try {
      const n = new Notification(title, { body, tag, requireInteraction: true });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
}

/**
 * When the user's request moves from waiting to "PC held for you", tell them loudly: toast, chime, a
 * browser notification if the tab is hidden, and a flashing tab title until they come back.
 */
export function useSeatReadyAlert(held: boolean, label: string) {
  const prev = useRef<boolean | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = held;
    if (was !== false || !held) return;
    announce("Your Analysis PC is ready", `${label}: join within the hold time shown on the page.`);
    const original = document.title;
    let on = false;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? "● Analysis PC ready — join now" : original;
    }, 1200);
    const stop = () => {
      if (document.visibilityState !== "visible") return;
      window.clearInterval(id);
      document.title = original;
    };
    document.addEventListener("visibilitychange", stop);
    if (document.visibilityState === "visible") window.setTimeout(stop, 6000);
    return () => {
      window.clearInterval(id);
      document.title = original;
      document.removeEventListener("visibilitychange", stop);
    };
  }, [held, label]);
}
