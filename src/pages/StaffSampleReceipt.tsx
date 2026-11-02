import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Camera, CheckCircle2, Info, Loader2, LogIn, Package } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import {
  externalBookingApi,
  formatInstant,
  formatSlotRange,
  type ScanOutcome,
  type ScanResult,
} from "@/lib/externalBookingApi";

/** The label code from what was scanned or typed: a full label URL (…?code=XYZ) or the code itself. */
export function extractCode(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.searchParams.get("code")?.trim() ?? "";
  } catch {
    return text;
  }
}

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

function cameraScanSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

const BANNER: Record<ScanOutcome, { title: string; tone: string; icon: JSX.Element }> = {
  received_at_office: {
    title: "Received at Office",
    tone: "border-emerald-400 bg-emerald-50 text-emerald-950",
    icon: <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />,
  },
  payment_pending: {
    title: "Payment pending — not recorded",
    tone: "border-amber-400 bg-amber-50 text-amber-950",
    icon: <AlertTriangle className="h-9 w-9 text-amber-600" aria-hidden="true" />,
  },
  already_received: {
    title: "Already received at the office",
    tone: "border-slate-300 bg-white text-slate-900",
    icon: <Info className="h-9 w-9 text-slate-500" aria-hidden="true" />,
  },
  details: {
    title: "Booking details",
    tone: "border-slate-300 bg-white text-slate-900",
    icon: <Info className="h-9 w-9 text-slate-500" aria-hidden="true" />,
  },
};

/** Opening a sample label's QR link (2 Nov 2026: one scan, at the receiving office). The office's scan records
 * Received at Office; every later scan, and any scan by the lab, only shows the booking. */
export default function StaffSampleReceipt() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const handled = useRef("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const scan = useCallback(async (raw: string) => {
    const c = extractCode(raw);
    if (!c || handled.current === c) return;
    handled.current = c; // one request per scanned code (no double recording on re-render)
    setCode(c);
    setResult(null);
    setError("");
    setBusy(true);
    try {
      setResult(await externalBookingApi.scanSample(c));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This label was not found.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = params.get("code");
    if (!fromUrl || authLoading) return;
    if (isAuthenticated) void scan(fromUrl);
    else setCode(extractCode(fromUrl));
    params.delete("code"); // keep the code out of the address bar and history
    setParams(params, { replace: true });
  }, [params, setParams, authLoading, isAuthenticated, scan]);

  const staffSignIn = () => {
    setPostLoginRedirect(`/staff/sample-receipt?code=${encodeURIComponent(code)}`);
    navigate("/auth");
  };

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        while (!stop) {
          const found = await detector.detect(videoRef.current).catch(() => []);
          if (found[0]?.rawValue) {
            setScanning(false);
            handled.current = "";
            void scan(found[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        toast.error("The camera could not be used. Enter the code printed under the QR instead.");
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, scan]);

  const banner = result ? BANNER[result.outcome] : null;

  return (
    <PageShell>
      <main className="container mx-auto max-w-3xl space-y-4 px-4 py-5">
        {!authLoading && !isAuthenticated ? (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4 text-sm" data-testid="staff-sign-in">
            <p className="text-slate-700">Receiving office staff: sign in to record the receipt of this sample.</p>
            <Button variant="outline" onClick={staffSignIn}>
              <LogIn className="mr-1 h-4 w-4" aria-hidden="true" /> Staff sign in
            </Button>
          </section>
        ) : null}
        {busy && !result ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking the label…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        {result && banner ? (
          <>
            <section className={`flex items-start gap-3 rounded-xl border-2 p-4 ${banner.tone}`} data-testid="scan-outcome">
              {banner.icon}
              <div className="min-w-0 space-y-1">
                <h1 className="text-xl font-bold">{banner.title}</h1>
                {result.message ? <p className="text-sm">{result.message}</p> : null}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border bg-white p-4 text-sm text-slate-900" data-testid="scan-details">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lab</p>
                <p className="text-lg font-bold">{result.lab || "—"}</p>
              </div>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[170px_1fr]">
                <dt className="text-slate-500">Equipment</dt>
                <dd className="font-medium">
                  {result.equipment}
                  {result.equipment_code ? <span className="ml-1 font-mono text-xs text-slate-500">{result.equipment_code}</span> : null}
                </dd>
                <dt className="text-slate-500">Booking</dt>
                <dd className="font-mono">
                  {result.booking_reference} <span className="text-xs text-slate-500">· label {result.label_reference}</span>
                </dd>
                <dt className="text-slate-500">Booked by</dt>
                <dd>{result.user_name}</dd>
                <dt className="text-slate-500">Samples</dt>
                <dd>
                  {result.sample_count}
                  {result.description ? ` · ${result.description}` : ""}
                </dd>
                <dt className="text-slate-500">Slot (IST)</dt>
                <dd>{result.slot_ranges.map((s) => formatSlotRange(s.start, s.end)).join("; ") || "—"}</dd>
                <dt className="text-slate-500">Payment</dt>
                <dd>{result.payment_settled ? "Settled" : `Pending ₹${result.amount_due}`}</dd>
              </dl>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sample status</p>
                <ol className="space-y-1" data-testid="scan-timeline">
                  {result.timeline.length ? (
                    result.timeline.map((e, i) => (
                      <li key={`${e.status}-${i}`} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">{e.status === "FORWARDED_TO_LAB" ? "Received at Office" : e.label}</span>
                        <span className="text-slate-500">{formatInstant(e.at)}{e.by ? ` · ${e.by}` : ""}</span>
                        {e.reason ? <span className="w-full text-slate-600">{e.reason}</span> : null}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">Not received yet</li>
                  )}
                </ol>
              </div>
            </section>
          </>
        ) : null}

        {isAuthenticated ? (
          <section className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {cameraScanSupported() ? (
                <Button type="button" variant="outline" onClick={() => setScanning((s) => !s)}>
                  <Camera className="mr-1 h-4 w-4" aria-hidden="true" />
                  {scanning ? "Stop camera" : result ? "Scan another label" : "Scan a label"}
                </Button>
              ) : (
                <p className="flex items-center gap-2 text-slate-600">
                  <Package className="h-4 w-4" aria-hidden="true" /> Scan a label with the phone camera to open it here.
                </p>
              )}
            </div>
            {scanning ? <video ref={videoRef} className="w-full max-w-md rounded-md border" muted playsInline aria-label="Camera preview" /> : null}
            <details>
              <summary className="cursor-pointer text-slate-600">QR code damaged? Enter the code printed under it</summary>
              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  handled.current = "";
                  void scan(manual);
                }}
              >
                <div className="min-w-[240px] flex-1">
                  <Label htmlFor="sr-code">Code (8 letters) or label link</Label>
                  <Input id="sr-code" value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" />
                </div>
                <Button type="submit" variant="outline" disabled={busy}>
                  Open
                </Button>
              </form>
            </details>
          </section>
        ) : null}
      </main>
    </PageShell>
  );
}
