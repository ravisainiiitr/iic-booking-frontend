/** Browser push: portal notifications that arrive while the portal is closed (opt-in per browser). */
import { apiClient } from "@/lib/api";

const SW_URL = "/push-sw.js";
const FLAG = "web_push_enabled";

export type WebPushState = "on" | "off" | "denied" | "unsupported" | "error";

export function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True when this browser was subscribed from this device (checked without network calls). */
export function webPushFlagged(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === wanted.length && a.every((v, i) => v === wanted[i]);
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (!webPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

async function subscribe(publicKey: string): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Asks for permission, subscribes this browser and registers it with the portal. */
export async function enableWebPush(): Promise<WebPushState> {
  if (!webPushSupported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  try {
    const status = await apiClient.getWebPushStatus();
    if (status.error || !status.data?.public_key) return "error";
    const sub = await subscribe(status.data.public_key);
    const saved = await apiClient.saveWebPushSubscription(sub.toJSON());
    if (saved.error || !saved.data) return "error";
    localStorage.setItem(FLAG, "1");
    return "on";
  } catch {
    return "error";
  }
}

export async function disableWebPush(): Promise<void> {
  localStorage.removeItem(FLAG);
  try {
    const sub = await existingSubscription();
    if (!sub) return;
    await apiClient.deleteWebPushSubscription(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* the server drops subscriptions the browser no longer honours */
  }
}

/** On sign-in: keep this browser's subscription registered (re-subscribing if the server key changed). */
export async function refreshWebPush(): Promise<void> {
  if (!webPushFlagged() || !webPushSupported() || Notification.permission !== "granted") return;
  try {
    const status = await apiClient.getWebPushStatus();
    if (status.error || !status.data?.public_key) return;
    const sub = await subscribe(status.data.public_key);
    await apiClient.saveWebPushSubscription(sub.toJSON());
  } catch {
    /* retried on the next sign-in */
  }
}
