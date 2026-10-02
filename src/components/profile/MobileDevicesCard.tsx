import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type MobileDeviceSession } from "@/lib/api";
import { getNativeAppInfo, isNativeApp, setNativeAppLock, type NativeAppInfo } from "@/lib/nativeApp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function formatWhen(value: string | null): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Phones that stay signed in through the IIC Booking app. Shown in a browser only when the
 * user has such phones, so they can sign out a lost one; inside the app it also offers app lock.
 */
export default function MobileDevicesCard() {
  const inApp = isNativeApp();
  const [devices, setDevices] = useState<MobileDeviceSession[] | null>(null);
  const [appInfo, setAppInfo] = useState<NativeAppInfo | null>(null);
  const [busyId, setBusyId] = useState<number | "others" | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiClient.listMobileDevices();
    setDevices(res.error || !res.data ? [] : res.data.results ?? []);
  }, []);

  useEffect(() => {
    void load();
    if (!inApp) return;
    void getNativeAppInfo().then(setAppInfo);
    // The user may come back from the phone's settings after setting a screen lock.
    const onVisible = () => {
      if (document.visibilityState === "visible") void getNativeAppInfo().then(setAppInfo);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [inApp, load]);

  const revoke = async (device: MobileDeviceSession) => {
    if (!window.confirm(`Sign out "${device.device_name || "this phone"}"? It will need to sign in again.`)) return;
    setBusyId(device.id);
    try {
      const res = await apiClient.revokeMobileDevice(device.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Phone signed out.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm("Sign out all other phones? They will need to sign in again.")) return;
    setBusyId("others");
    try {
      const res = await apiClient.revokeOtherMobileDevices();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Other phones signed out.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleLock = async (enabled: boolean) => {
    setLockBusy(true);
    try {
      await setNativeAppLock(enabled);
      setAppInfo(await getNativeAppInfo());
      toast.success(enabled ? "App lock is on." : "App lock is off.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message && !/cancel/i.test(message)) toast.error(message);
    } finally {
      setLockBusy(false);
    }
  };

  if (devices === null) return null;
  if (!inApp && devices.length === 0) return null;

  const others = devices.filter((d) => !d.is_current);
  const needsScreenLock = !!appInfo && !appInfo.deviceSecure && !appInfo.appLockEnabled && !appInfo.appLockRequired;

  return (
    <Card className="max-w-2xl mx-auto mt-6 border-border/70 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50">
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" aria-hidden />
          IIC Booking app
        </CardTitle>
        <CardDescription>
          Phones where you stay signed in to the app. Sign out any phone you no longer use or have lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {inApp && appInfo?.enrolled && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
            <div className="min-w-0">
              <Label htmlFor="app-lock-toggle" className="flex items-center gap-2 text-sm font-medium">
                <Fingerprint className="h-4 w-4 text-primary" aria-hidden />
                Lock the app with fingerprint, face or screen lock
              </Label>
              <p className="text-xs text-muted-foreground">
                {appInfo.appLockRequired
                  ? "Required for administrator accounts."
                  : "Asks for your fingerprint, face or phone PIN when you open the app."}
              </p>
              {needsScreenLock && (
                <p id="app-lock-hint" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Set a screen lock (PIN, pattern or fingerprint) in your phone's settings to use app lock.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lockBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                id="app-lock-toggle"
                checked={appInfo.appLockEnabled}
                disabled={lockBusy || appInfo.appLockRequired || (!appInfo.deviceSecure && !appInfo.appLockEnabled)}
                aria-describedby={needsScreenLock ? "app-lock-hint" : undefined}
                onCheckedChange={(v) => void toggleLock(v)}
              />
            </div>
          </div>
        )}

        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This phone will be remembered the next time you sign in.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {device.device_name || "Phone"}
                    {device.is_current && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        This phone
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last used {formatWhen(device.last_used_at ?? device.created_at)} · signed in{" "}
                    {formatWhen(device.created_at)}
                  </p>
                </div>
                {device.is_current ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Use Sign out to leave</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => void revoke(device)}
                  >
                    {busyId === device.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {others.length > 1 && (
          <Button variant="outline" disabled={busyId !== null} onClick={() => void revokeOthers()}>
            {busyId === "others" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign out all other phones
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
