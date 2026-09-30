import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Mode = "form" | "reset-request" | "reset-verify";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Sign-in options. Channel i users (IITR students, faculty, OIC, Lab Operator) choose whether email sign-in is
 * allowed; everyone else signs in with email and password and only sees the password form.
 */
export function LoginPasswordCard() {
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [hasToggle, setHasToggle] = useState(false);
  const [emailLoginEnabled, setEmailLoginEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [mode, setMode] = useState<Mode>("form");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiClient.getAccountPasswordStatus().then((res) => {
      if (cancelled) return;
      if (res.data) {
        setHasPassword(Boolean(res.data.has_password));
        setEmail(res.data.email || "");
        setHasToggle(Boolean(res.data.email_login_toggle));
        setEmailLoginEnabled(res.data.email_login_enabled !== false);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await apiClient.setEmailLoginEnabled(enabled);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not update sign-in options.");
        return;
      }
      setEmailLoginEnabled(res.data.email_login_enabled);
      setHasPassword(res.data.has_password);
      setMode("form");
      resetFields();
      toast.success(res.data.message);
    } finally {
      setToggling(false);
    }
  };

  const showPasswordSection = !hasToggle || emailLoginEnabled;

  const resetFields = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setOtp("");
  };

  const validateNew = (): boolean => {
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return false;
    }
    if (next !== confirm) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  };

  const submitPassword = async () => {
    if (hasPassword && !current) {
      toast.error("Enter your current password, or use \u201cSet new password with email OTP\u201d.");
      return;
    }
    if (!validateNew()) return;
    setSaving(true);
    try {
      const res = await apiClient.setAccountPassword({
        ...(hasPassword ? { current_password: current } : {}),
        new_password: next,
        new_password_confirm: confirm,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Password saved.");
      setHasPassword(true);
      resetFields();
    } finally {
      setSaving(false);
    }
  };

  const requestResetOtp = async () => {
    setSaving(true);
    try {
      const res = await apiClient.requestForgotPasswordOtp(email);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "OTP sent to your email.");
      setOtp("");
      setMode("reset-verify");
    } finally {
      setSaving(false);
    }
  };

  const submitReset = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }
    if (!validateNew()) return;
    setSaving(true);
    try {
      const res = await apiClient.verifyForgotPasswordOtpAndSetPassword(email, otp, next, confirm);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Password reset.");
      setHasPassword(true);
      resetFields();
      setMode("form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto mt-6 border-border/70 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          {hasToggle ? "Sign-in options" : "Login password"}
        </CardTitle>
        <CardDescription>
          {hasToggle
            ? `${CHANNEL_I_DISPLAY_NAME} is the preferred way to sign in. You can also allow signing in with your email.`
            : "You sign in with your email and password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {hasToggle && (
              <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Sign in with {CHANNEL_I_DISPLAY_NAME}</p>
                    <p className="text-xs text-muted-foreground">Official IIT Roorkee sign-in. Always available.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Always on
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Label htmlFor="email-login-toggle" className="text-sm font-medium">
                      Sign in with email
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Use <span className="font-medium text-foreground">{email}</span> with a password or a one-time code
                      (OTP) sent to your email.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      id="email-login-toggle"
                      checked={emailLoginEnabled}
                      disabled={toggling}
                      onCheckedChange={(v) => void handleToggle(v)}
                    />
                  </div>
                </div>
              </div>
            )}

            {hasToggle && !emailLoginEnabled && (
              <p className="text-sm text-muted-foreground">
                Email sign-in is off, so only {CHANNEL_I_DISPLAY_NAME} can be used to sign in to your account.
              </p>
            )}

            {showPasswordSection && (
            <>
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              <ShieldCheck
                className={`mt-0.5 h-4 w-4 shrink-0 ${hasPassword ? "text-emerald-600" : "text-muted-foreground"}`}
                aria-hidden
              />
              <p className="text-muted-foreground">
                {hasPassword ? (
                  <>
                    A password already exists for <span className="font-medium text-foreground">{email}</span>. If you did
                    not set it yourself (for example, the account was created for you) or do not remember it, use{" "}
                    <span className="font-medium text-foreground">Set new password with email OTP</span>; your current
                    password is not needed.
                  </>
                ) : (
                  <>
                    No password is set yet. Set one to sign in with{" "}
                    <span className="font-medium text-foreground">{email}</span> and a password
                    {hasToggle ? "; until then you can still use an email OTP on the sign-in page." : "."}
                  </>
                )}
              </p>
            </div>

            {mode === "form" && (
              <div className="space-y-4">
                {hasPassword && (
                  <PasswordField
                    id="current-password"
                    label="Current password"
                    value={current}
                    onChange={setCurrent}
                    autoComplete="current-password"
                  />
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PasswordField id="new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
                  <PasswordField
                    id="confirm-password"
                    label="Confirm new password"
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">At least 8 characters; avoid common or easily guessed passwords.</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {hasPassword ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetFields();
                        setMode("reset-request");
                      }}
                      disabled={saving}
                    >
                      Set new password with email OTP
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button onClick={() => void submitPassword()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {hasPassword ? "Change password" : "Set password"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "reset-request" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We will email a 6-digit OTP to <span className="font-medium text-foreground">{email}</span>. Enter it with
                  your new password; your current password is not needed.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMode("form")} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={() => void requestResetOtp()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send OTP
                  </Button>
                </div>
              </div>
            )}

            {mode === "reset-verify" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Enter the 6-digit OTP sent to {email}</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup className="gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PasswordField id="reset-new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
                  <PasswordField
                    id="reset-confirm-password"
                    label="Confirm new password"
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setMode("form")} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="ghost" onClick={() => void requestResetOtp()} disabled={saving}>
                    Resend OTP
                  </Button>
                  <Button onClick={() => void submitReset()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Set new password
                  </Button>
                </div>
              </div>
            )}
            </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default LoginPasswordCard;
