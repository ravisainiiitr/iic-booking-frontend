import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type MobileAppRelease } from "@/lib/api";
import { SHOW_ANDROID_APP_BANNER } from "@/lib/androidAppBanner";
import { isNativeApp } from "@/lib/nativeApp";
import { isStaffAppUserType } from "@/lib/staffApp";
import { cn } from "@/lib/utils";
import { APP_DOWNLOAD_PAGE_URL, downloadLatestApk, formatBytes } from "./androidApp";
import QrCode from "./QrCode";

function dismissKey(userId: unknown, versionCode: number) {
  return `iic_android_app_card_dismissed:${String(userId ?? "")}:${versionCode}`;
}

/**
 * "Get the Android app" on the Officer In Charge and Lab Operator dashboards (website only).
 * Dismissing hides it until a newer version is published. Off for everyone while SHOW_ANDROID_APP_BANNER is false.
 */
export default function AndroidAppCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const eligible = SHOW_ANDROID_APP_BANNER && !isNativeApp() && isStaffAppUserType(user?.user_type);
  const [release, setRelease] = useState<MobileAppRelease | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    void apiClient.getMobileAppLatest().then((res) => {
      const latest = res.data?.release ?? null;
      if (cancelled || !latest) return;
      try {
        setDismissed(localStorage.getItem(dismissKey(user?.id, latest.version_code)) === "1");
      } catch {
        /* ignore */
      }
      setRelease(latest);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, user?.id]);

  if (!eligible || !release || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(user?.id, release.version_code), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const download = async () => {
    setBusy(true);
    try {
      const error = await downloadLatestApk();
      if (error) toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="android-app-card-title"
      className={cn("relative rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-card p-4 shadow-sm sm:p-5", className)}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Hide the Android app card"
        title="Hide"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Smartphone className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 pr-6">
            <h2 id="android-app-card-title" className="text-base font-semibold text-foreground">
              Get the Android app
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Today's bookings, job sheets and your week calendar on your phone. Sign in once with OTP, then unlock with your fingerprint or PIN.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Version {release.version_name} · {formatBytes(release.size_bytes)} · {release.min_android}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] leading-snug text-muted-foreground" title="SHA-256 of the APK file">
              SHA-256 {release.sha256}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="h-9" onClick={() => void download()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download APK
              </Button>
              <Button size="sm" variant="outline" className="h-9" asChild>
                <Link to="/app-download">Install guide</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
          <QrCode value={APP_DOWNLOAD_PAGE_URL} size={112} label="QR code for the IIC Booking app download page" className="rounded-lg border border-border bg-white" />
          <span className="text-[11px] text-muted-foreground">Scan with your phone</span>
        </div>
      </div>
    </section>
  );
}
