import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  appAudienceRefused,
  APP_NOT_AVAILABLE_PATH,
  APP_SIGN_IN_PATH,
  getNativeAppInfo,
  isMobileSessionToken,
  isNativeApp,
  setNativeAppLock,
  type NativeAppInfo,
} from "@/lib/nativeApp";
import { isStaffAppUserType } from "@/lib/staffApp";

const ENROL_WAIT_MS = 10_000;

/** Sign-in hands the web token to the app, which swaps it for a device session in the background. */
async function waitForDeviceSession(): Promise<"ready" | "refused" | "signed_out" | "timeout"> {
  const started = Date.now();
  while (Date.now() - started < ENROL_WAIT_MS) {
    if (appAudienceRefused()) return "refused";
    const token = apiClient.getToken();
    if (!token) return "signed_out";
    if (isMobileSessionToken(token)) return "ready";
    await new Promise((r) => window.setTimeout(r, 250));
  }
  return "timeout";
}

export default function AppSetupLock() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState<NativeAppInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = isStaffAppUserType(user?.user_type) ? "/app" : "/dashboard";
  const finish = useCallback(() => navigate(home, { replace: true }), [navigate, home]);

  const refreshInfo = useCallback(async () => {
    const next = await getNativeAppInfo();
    setInfo(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isNativeApp()) {
        finish();
        return;
      }
      const outcome = await waitForDeviceSession();
      if (cancelled) return;
      if (outcome === "refused") {
        navigate(APP_NOT_AVAILABLE_PATH, { replace: true });
        return;
      }
      if (outcome === "signed_out") {
        navigate(APP_SIGN_IN_PATH, { replace: true });
        return;
      }
      const next = await refreshInfo();
      if (cancelled) return;
      // Not remembered on this phone (e.g. offline) or already protected: nothing to set up.
      if (!next?.enrolled || next.appLockEnabled || next.appLockRequired) {
        finish();
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [finish, navigate, refreshInfo]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshInfo();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshInfo]);

  const turnOn = async () => {
    setError(null);
    setBusy(true);
    try {
      await setNativeAppLock(true);
      finish();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message && !/cancel/i.test(message)) setError(message);
      void refreshInfo();
    } finally {
      setBusy(false);
    }
  };

  if (checking || !info) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Setting up this phone…</p>
      </main>
    );
  }

  const deviceSecure = info.deviceSecure;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Fingerprint className="h-10 w-10 text-primary" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Quick unlock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open the app with your fingerprint, face or phone PIN instead of signing in again. You stay signed in on this phone.
        </p>

        {!deviceSecure && (
          <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            First set a screen lock (PIN, pattern or fingerprint) in your phone's Settings, then come back here.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-auto w-full space-y-3 pt-10">
          <Button className="h-12 w-full text-base" onClick={() => void turnOn()} disabled={busy || !deviceSecure}>
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
            Turn on fingerprint / PIN unlock
          </Button>
          <Button variant="ghost" className="h-12 w-full text-base" onClick={finish} disabled={busy}>
            Not now
          </Button>
          <p className="text-xs text-muted-foreground">You can change this later under More → App lock.</p>
        </div>
      </div>
    </main>
  );
}
