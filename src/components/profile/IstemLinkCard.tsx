import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Link2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { IstemLinkError, istemLinkApi, type IstemLinkStatus } from "@/lib/istemLinkApi";

type LookupBy = "email" | "mobile";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Profile card: an external user who already has an I-STEM account links it to the portal. They give the email or
 * mobile number registered on I-STEM; the portal finds the account and emails an OTP to the I-STEM email; once the
 * OTP is entered the accounts are linked and blank billing details are filled from I-STEM. Hidden unless the server
 * says linking is available to this user (or the user already has a link to show).
 */
export default function IstemLinkCard({ onLinked }: { onLinked?: () => void }) {
  const [status, setStatus] = useState<IstemLinkStatus | null>(null);
  const [lookupBy, setLookupBy] = useState<LookupBy>("email");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"find" | "send" | "verify" | null>(null);
  const [searching, setSearching] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const load = useCallback(async () => {
    try {
      setStatus(await istemLinkApi.status());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    setBusy("send");
    try {
      const sent = await istemLinkApi.sendOtp();
      toast.success(`OTP sent to ${sent.email_masked}.`);
      setOtp("");
      setResendIn(60);
      await load();
    } catch (e) {
      if (e instanceof IstemLinkError && e.retryAfter) setResendIn(e.retryAfter);
      toast.error(errorText(e));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const find = async () => {
    const v = value.trim();
    if (!v) return;
    setBusy("find");
    try {
      await istemLinkApi.findAccount(lookupBy === "email" ? { email: v } : { mobile: v });
      setSearching(false);
      setBusy(null);
      await sendOtp();
    } catch (e) {
      toast.error(errorText(e));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return;
    setBusy("verify");
    try {
      const res = await istemLinkApi.verifyOtp(otp);
      toast.success(res.message || "Your I-STEM account is linked.");
      setOtp("");
      await load();
      onLinked?.();
    } catch (e) {
      toast.error(errorText(e));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!status) return null;
  const state = status.state;
  if (!status.linking_available && state !== "LINKED" && state !== "NEEDS_REVIEW" && !status.otp_required) return null;

  const awaitingOtp = status.otp_required && !searching;
  const paused = Boolean(status.paused_until);
  const profile = status.istem_profile ?? {};
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <Card className="max-w-2xl mx-auto mt-6 border-border/70 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" aria-hidden /> I-STEM account
        </CardTitle>
        <CardDescription>
          External bookings are also recorded on I-STEM, the national facility portal. If you already have an I-STEM
          account, link it here so your bookings are recorded against it. If you do not have one, nothing is needed:
          an I-STEM account is created for you with your first booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "LINKED" ? (
          <div className="rounded-lg border p-4 space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Linked to I-STEM
              {status.public_user_id ? <span className="text-muted-foreground">(user {status.public_user_id})</span> : null}
            </p>
            {name || profile.email ? (
              <p className="text-muted-foreground">
                {[name, profile.email].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {profile.organisation ? <p className="text-muted-foreground">{profile.organisation}</p> : null}
          </div>
        ) : state === "NEEDS_REVIEW" && !status.linking_available ? (
          <p className="rounded-lg border p-4 text-sm">
            The IIC office is checking the link between your portal account and I-STEM. You will be told when it is
            done; you can keep booking meanwhile.
          </p>
        ) : awaitingOtp ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                We found your I-STEM account. Enter the 6-digit OTP sent to <strong>{status.email_masked}</strong>, the
                email registered on I-STEM.
                {status.otp?.expires_at ? ` It is valid until ${formatWhen(status.otp.expires_at)}.` : ""}
              </span>
            </p>
            {paused ? (
              <p className="text-sm text-destructive">
                Too many wrong codes. Linking is paused until {formatWhen(status.paused_until)}.
              </p>
            ) : (
              <>
                <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label="I-STEM OTP">
                  <InputOTPGroup className="gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {status.otp?.attempts_left != null ? (
                  <p className="text-xs text-muted-foreground">{status.otp.attempts_left} attempt(s) left.</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={verify} disabled={otp.length !== 6 || busy !== null}>
                    {busy === "verify" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    Verify and link
                  </Button>
                  <Button variant="outline" onClick={sendOtp} disabled={busy !== null || resendIn > 0}>
                    {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    {status.otp ? (resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP") : "Send OTP"}
                  </Button>
                  <Button variant="ghost" onClick={() => setSearching(true)} disabled={busy !== null}>
                    Use different details
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2" role="radiogroup" aria-label="Find my I-STEM account by">
              {(["email", "mobile"] as LookupBy[]).map((by) => (
                <Button
                  key={by}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={lookupBy === by}
                  variant={lookupBy === by ? "default" : "outline"}
                  onClick={() => {
                    setLookupBy(by);
                    setValue("");
                  }}
                >
                  {by === "email" ? "Email" : "Mobile number"}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="istem-lookup">
                {lookupBy === "email" ? "Email registered on I-STEM" : "Mobile number registered on I-STEM"}
              </Label>
              <Input
                id="istem-lookup"
                type={lookupBy === "email" ? "email" : "tel"}
                inputMode={lookupBy === "email" ? "email" : "numeric"}
                maxLength={lookupBy === "email" ? 254 : 10}
                value={value}
                onChange={(e) => setValue(lookupBy === "email" ? e.target.value : e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void find();
                }}
                placeholder={lookupBy === "email" ? "name@example.com" : "10-digit mobile number"}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={find}
                disabled={busy !== null || (lookupBy === "email" ? !value.includes("@") : value.length !== 10)}
              >
                {busy === "find" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Find my I-STEM account
              </Button>
              {searching ? (
                <Button variant="ghost" onClick={() => setSearching(false)} disabled={busy !== null}>
                  Back
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              We send a one-time password to the email registered on I-STEM to confirm the account is yours.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
