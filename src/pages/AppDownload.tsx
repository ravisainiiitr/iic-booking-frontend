import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Download, Fingerprint, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type MobileAppRelease } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { APP_DOWNLOAD_PAGE_URL, downloadLatestApk, formatBytes } from "@/components/staff-app/androidApp";
import QrCode from "@/components/staff-app/QrCode";

const STEPS = [
  "Open this page on your Android phone and tap Download APK.",
  "Open the downloaded file (from the notification or the Downloads folder).",
  "If Android asks, allow your browser to install unknown apps, then tap Install.",
  "Open IIC Booking and sign in with OTP (a code is sent to your email).",
  "Turn on fingerprint / PIN unlock so next time the app opens straight to your bookings.",
];

export default function AppDownload() {
  const { isAuthenticated, loading } = useAuth();
  const [release, setRelease] = useState<MobileAppRelease | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "refused" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void apiClient.getMobileAppLatest().then((res) => {
      if (cancelled) return;
      if (res.data) {
        setRelease(res.data.release);
        setState(res.data.release ? "ready" : "none");
      } else {
        setMessage(res.error ?? null);
        setState(res.status === 403 ? "refused" : "error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!loading && !isAuthenticated) {
    setPostLoginRedirect("/app-download");
    return <Navigate to="/auth" replace />;
  }

  const download = async () => {
    setBusy(true);
    try {
      const error = await downloadLatestApk();
      if (error) setMessage(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <DashboardHeader />
      <main id="main-content" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Smartphone className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">IIC Booking for Android</h1>
            <p className="text-sm text-muted-foreground">For Officers In Charge and Lab Operators, on the go.</p>
          </div>
        </div>

        {state === "loading" && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading…
          </div>
        )}
        {state === "refused" && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">{message}</CardContent>
          </Card>
        )}
        {state === "none" && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">The Android app has not been published yet. Please check again soon.</CardContent>
          </Card>
        )}
        {state === "error" && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{message || "Could not load the app details."}</CardContent>
          </Card>
        )}

        {state === "ready" && release && (
          <>
            <Card className="overflow-hidden">
              <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd className="font-medium text-foreground">
                      {release.version_name} (build {release.version_code})
                    </dd>
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="text-foreground">{formatBytes(release.size_bytes)}</dd>
                    <dt className="text-muted-foreground">Needs</dt>
                    <dd className="text-foreground">{release.min_android}</dd>
                    {release.release_date && (
                      <>
                        <dt className="text-muted-foreground">Released</dt>
                        <dd className="text-foreground">{release.release_date}</dd>
                      </>
                    )}
                  </dl>
                  <Button className="h-11" onClick={() => void download()} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download APK
                  </Button>
                  {message && <p className="text-sm text-destructive">{message}</p>}
                  {release.release_notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{release.release_notes}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <QrCode value={APP_DOWNLOAD_PAGE_URL} size={152} label="QR code for this download page" className="rounded-lg border border-border bg-white" />
                  <span className="max-w-[10rem] text-center text-xs text-muted-foreground">On a computer? Scan this with your phone.</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How to install</CardTitle>
                <CardDescription>Takes about a minute. The app is signed by IIT Roorkee and is not on the Play Store yet.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {STEPS.map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-foreground">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                  Check the file (optional)
                </CardTitle>
                <CardDescription>The downloaded file's SHA-256 checksum should match:</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">{release.sha256}</p>
                {release.signing_cert_sha256 && (
                  <p className="text-muted-foreground">
                    Signing certificate SHA-256:{" "}
                    <span className="break-all font-mono text-xs text-foreground">{release.signing_cert_sha256}</span>
                  </p>
                )}
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  The app only signs in to equip.iitr.ac.in. Your sign-in stays on the phone and can be signed out from Profile → IIC Booking app on the website.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
