import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, Mail } from "lucide-react";
import iitrLogo256 from "@/assets/iitr-logo-256.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { appAudienceRefused, APP_AUDIENCE_CODE, APP_NOT_AVAILABLE_PATH } from "@/lib/nativeApp";
import { storeOmniportState } from "@/lib/omniportAuth";

const EMAIL_LOGIN_DISABLED_CODE = "email_login_disabled";
const SETUP_LOCK_PATH = "/app/setup-lock";
const RESEND_AFTER_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "otp-email" | "otp-code" | "password";

function friendlyError(code: string | undefined, message: string | undefined): string {
  if (code === EMAIL_LOGIN_DISABLED_CODE) {
    return `Email sign-in is turned off for this account. Use ${CHANNEL_I_DISPLAY_NAME}, or turn on email sign-in in My Profile on the website.`;
  }
  return message || "Something went wrong. Please try again.";
}

export default function AppSignIn() {
  const navigate = useNavigate();
  const { isAuthenticated, setUserFromAuth } = useAuth();
  const [mode, setMode] = useState<Mode>("otp-email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "otp" | "verify" | "password" | "channeli">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);
  const signedInHere = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (mode === "otp-code") otpRef.current?.focus();
  }, [mode]);

  if (isAuthenticated && !signedInHere.current) return <Navigate to="/app" replace />;

  const cleanEmail = email.trim().toLowerCase();

  const handleFailure = (res: { error?: string; errorCode?: string }) => {
    if (res.errorCode === APP_AUDIENCE_CODE || appAudienceRefused()) {
      navigate(APP_NOT_AVAILABLE_PATH, { replace: true });
      return;
    }
    setError(friendlyError(res.errorCode, res.error));
  };

  const signedIn = (user: Parameters<typeof setUserFromAuth>[0] | undefined) => {
    signedInHere.current = true;
    if (user) setUserFromAuth(user);
    navigate(SETUP_LOCK_PATH, { replace: true });
  };

  const requestOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter your institute email address.");
      return;
    }
    setBusy("otp");
    try {
      const res = await apiClient.requestLoginOtp(cleanEmail);
      if (res.error) {
        handleFailure(res);
        return;
      }
      setNotice(res.data?.message || "We sent a 6-digit code to your email.");
      setOtp("");
      setMode("otp-code");
      setResendIn(RESEND_AFTER_SECONDS);
    } finally {
      setBusy(null);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy("verify");
    try {
      const res = await apiClient.verifyLoginOtp(cleanEmail, otp);
      if (res.error || !res.data?.token) {
        handleFailure(res);
        return;
      }
      signedIn(res.data.user);
    } finally {
      setBusy(null);
    }
  };

  const signInWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(cleanEmail) || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy("password");
    try {
      const res = await apiClient.signIn(cleanEmail, password);
      if (res.error || !res.data?.token) {
        handleFailure(res);
        return;
      }
      setPassword("");
      signedIn(res.data.user);
    } finally {
      setBusy(null);
    }
  };

  const signInWithChannelI = async () => {
    setError(null);
    setBusy("channeli");
    const res = await apiClient.getOmniportAuthUrl();
    if (res.error || !res.data?.auth_url) {
      setBusy(null);
      setError(res.error || `Could not reach ${CHANNEL_I_DISPLAY_NAME}. Please try again.`);
      return;
    }
    setPostLoginRedirect(SETUP_LOCK_PATH);
    storeOmniportState(res.data.auth_url, res.data.state);
    window.location.href = res.data.auth_url;
  };

  const switchMode = (next: Mode) => {
    setError(null);
    setNotice(null);
    setMode(next);
  };

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <img src={iitrLogo256} width={80} height={80} alt="IIT Roorkee" className="h-20 w-20 object-contain" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">IIC Booking – Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">For Officers In Charge and Lab Operators</p>
        </div>

        <div className="mt-8 space-y-4">
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && !error && (
            <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {notice}
            </p>
          )}

          {mode === "otp-email" && (
            <form onSubmit={requestOtp} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="app-email">Email address</Label>
                <Input
                  id="app-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="name@iitr.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy !== null}>
                {busy === "otp" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                Sign in with OTP
              </Button>
            </form>
          )}

          {mode === "otp-code" && (
            <form onSubmit={verifyOtp} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="app-otp">6-digit code sent to {cleanEmail}</Label>
                <Input
                  id="app-otp"
                  ref={otpRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 text-center text-xl tracking-[0.5em]"
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy !== null || otp.length !== 6}>
                {busy === "verify" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Verify and sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="py-2 text-primary underline-offset-4 hover:underline" onClick={() => switchMode("otp-email")}>
                  Use a different email
                </button>
                <button
                  type="button"
                  className="py-2 text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
                  disabled={resendIn > 0 || busy !== null}
                  onClick={() => void requestOtp()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {mode === "password" && (
            <form onSubmit={signInWithPassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="app-pw-email">Email address</Label>
                <Input
                  id="app-pw-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-password">Password</Label>
                <Input
                  id="app-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy !== null}>
                {busy === "password" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Sign in
              </Button>
            </form>
          )}
        </div>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          {mode === "password" ? (
            <Button variant="outline" className="h-12 w-full text-base" onClick={() => switchMode("otp-email")} disabled={busy !== null}>
              <Mail className="mr-2 h-5 w-5" />
              Sign in with OTP
            </Button>
          ) : (
            <Button variant="outline" className="h-12 w-full text-base" onClick={() => switchMode("password")} disabled={busy !== null}>
              <KeyRound className="mr-2 h-5 w-5" />
              Sign in with password
            </Button>
          )}
          <Button variant="outline" className="h-12 w-full text-base" onClick={() => void signInWithChannelI()} disabled={busy !== null}>
            {busy === "channeli" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Sign in with {CHANNEL_I_DISPLAY_NAME}
          </Button>
        </div>

        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          Indian Institute of Technology Roorkee · Institute Instrumentation Centre
        </p>
      </div>
    </main>
  );
}
