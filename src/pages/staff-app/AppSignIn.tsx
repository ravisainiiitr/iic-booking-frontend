import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronRight, ExternalLink, GraduationCap, KeyRound, Loader2, Mail } from "lucide-react";
import iitrLogo256 from "@/assets/iitr-logo-256.webp";
import mainBuilding from "@/assets/iitr-main-building.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { appAudienceRefused, APP_AUDIENCE_CODE, APP_NOT_AVAILABLE_PATH, openInBrowser } from "@/lib/nativeApp";
import { storeOmniportState } from "@/lib/omniportAuth";

const EMAIL_LOGIN_DISABLED_CODE = "email_login_disabled";
const SETUP_LOCK_PATH = "/app/setup-lock";
const RESEND_AFTER_SECONDS = 30;
const APP_DISPLAY_NAME = "IITR Equipment Booking";
const PORTAL_ORIGIN = "https://equip.iitr.ac.in";
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
      setError("Enter your email address.");
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

  const otpTab = mode !== "password";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background">
      <section className="relative isolate h-[32dvh] min-h-[260px] max-h-[320px] overflow-hidden">
        <img
          src={mainBuilding}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_40%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0b1d3f]/90 via-[#12306a]/75 to-[#12306a]/55"
        />
        <div className="flex h-full flex-col items-center justify-center px-6 pb-9 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
          <div className="rounded-full bg-[#ffffff] p-1.5 shadow-xl ring-4 ring-white/25">
            <img src={iitrLogo256} width={64} height={64} alt="IIT Roorkee" className="h-16 w-16 rounded-full bg-[#ffffff] object-contain" />
          </div>
          <h1 className="mt-3 font-serif text-[1.5rem] font-semibold leading-tight min-[380px]:text-[1.65rem] tracking-tight text-white">
            {APP_DISPLAY_NAME}
          </h1>
          <p className="mt-1 text-sm text-white/80">Indian Institute of Technology Roorkee</p>
          <span aria-hidden="true" className="mt-3 h-0.5 w-10 rounded-full bg-[#c9a227]" />
        </div>
      </section>

      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[1.75rem] bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 shadow-[0_-12px_32px_-18px_rgba(11,29,63,0.45)]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Welcome</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to discover and book research equipment and facilities.</p>
          </div>

          <div role="tablist" aria-label="Sign-in method" className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
            {([
              ["otp-email", "Email code", Mail],
              ["password", "Password", KeyRound],
            ] as const).map(([target, label, Icon]) => {
              const selected = target === "password" ? !otpTab : otpTab;
              return (
                <button
                  key={target}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={busy !== null}
                  onClick={() => !selected && switchMode(target)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all ${
                    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4">
            {error && (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && !error && (
              <p role="status" className="rounded-xl border border-emerald-600/30 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
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
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <Button type="submit" className="h-12 w-full rounded-xl text-base shadow-sm" disabled={busy !== null}>
                  {busy === "otp" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                  Send sign-in code
                </Button>
                <p className="text-center text-xs text-muted-foreground">We'll email you a 6-digit code. No password needed.</p>
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
                    className="h-14 rounded-xl text-center text-2xl font-semibold tracking-[0.5em]"
                  />
                </div>
                <Button type="submit" className="h-12 w-full rounded-xl text-base shadow-sm" disabled={busy !== null || otp.length !== 6}>
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
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl text-base"
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
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <Button type="submit" className="h-12 w-full rounded-xl text-base shadow-sm" disabled={busy !== null}>
                  {busy === "password" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Sign in
                </Button>
              </form>
            )}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            IIT Roorkee member?
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="h-12 w-full rounded-xl border-primary/30 text-base font-medium"
            onClick={() => void signInWithChannelI()}
            disabled={busy !== null}
          >
            {busy === "channeli" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GraduationCap className="mr-2 h-5 w-5 text-primary" aria-hidden="true" />
            )}
            Sign in with {CHANNEL_I_DISPLAY_NAME}
          </Button>

          <div className="mt-6 space-y-2 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 text-left text-foreground"
              onClick={() => void openInBrowser(`${PORTAL_ORIGIN}/auth?mode=register`)}
            >
              <span>
                New to the portal? <span className="font-medium text-primary">Create an account</span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
            <Link to="/equipments" className="flex items-center justify-between py-1 text-foreground">
              <span>
                <span className="font-medium text-primary">Browse equipment</span> without signing in
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
            Indian Institute of Technology Roorkee ·{" "}
            <a href="/privacy-policy/" className="underline-offset-4 hover:underline">
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
