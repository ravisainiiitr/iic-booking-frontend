import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { type IstemProfile, istemRegisterApi } from "@/lib/istemLinkApi";

export type IstemRegistrationResult = {
  profile: IstemProfile & { mobile?: string; state?: string };
  linkToken: string;
  email: string;
  mobile: string;
};

type Step = "ask" | "details" | "otp";

/** "name@example.com" -> email; anything else -> its last 10 digits as the mobile number. */
export function splitIdentifier(value: string): { email: string; mobile: string } {
  const v = value.trim();
  if (v.includes("@")) return { email: v.toLowerCase(), mobile: "" };
  return { email: "", mobile: v.replace(/\D/g, "").slice(-10) };
}

/**
 * Registration of an external user: "Already registered on I-STEM?". If yes, the user gives the email or the mobile
 * number registered on I-STEM (either is enough, 31 Oct 2026), enters the OTP sent to the email registered on I-STEM,
 * and the form is filled from I-STEM; submitting it confirms the registration at once. Nothing about the I-STEM
 * account is shown before the OTP is verified (the server enforces it).
 *
 * With ``userType`` and ``onSignedIn`` the account is created at once after the OTP (no password, no form) and the
 * user is signed in; the dashboard then asks for whatever is still missing. Without them the form is filled instead.
 */
export default function IstemRegistrationDialog({
  open,
  onOpenChange,
  onVerified,
  userType,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (result: IstemRegistrationResult) => void;
  userType?: string;
  onSignedIn?: (token: string, user: Record<string, unknown>) => void;
}) {
  const direct = Boolean(userType && onSignedIn);
  const [step, setStep] = useState<Step>("ask");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [masked, setMasked] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    onOpenChange(false);
    setStep("ask");
    setOtp("");
    setError("");
  };

  const lookup = async () => {
    setBusy(true);
    setError("");
    try {
      const { email, mobile } = splitIdentifier(identifier);
      const sent = await istemRegisterApi.lookup(email, mobile);
      setToken(sent.token);
      setMasked(sent.email_masked);
      setOtp("");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The look-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await istemRegisterApi.verify(token, otp);
      if (userType && onSignedIn) {
        try {
          const done = await istemRegisterApi.complete(res.link_token, userType);
          onSignedIn(done.token, done.user);
          close();
          return;
        } catch (e) {
          // An existing portal account (or an unexpected refusal): say so; the form below still works.
          setError(e instanceof Error ? e.message : "Your account could not be created. Please try again.");
          return;
        }
      }
      const given = splitIdentifier(identifier);
      const profileEmail = String(res.profile.email ?? "").trim().toLowerCase();
      const profileMobile = String(res.profile.mobile ?? "").replace(/\D/g, "").slice(-10);
      onVerified({
        profile: res.profile,
        linkToken: res.link_token,
        email: profileEmail || given.email,
        mobile: profileMobile || given.mobile,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The OTP could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const parsed = splitIdentifier(identifier);
  const validDetails = parsed.email ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parsed.email) : parsed.mobile.length === 10;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Already registered on I-STEM?</DialogTitle>
          <DialogDescription>
            {step === "ask"
              ? direct
                ? "If you have an account on I-STEM, the national facility portal, we can create your account from it: no form to fill."
                : "If you have an account on I-STEM, the national facility portal, we can fill in this form from it."
              : step === "details"
                ? "Enter the email or the mobile number registered on I-STEM. We send a one-time password to the email registered there."
                : `Enter the 6-digit OTP sent to ${masked}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "details" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="istem-reg-id">Email or mobile number registered on I-STEM</Label>
              <Input
                id="istem-reg-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="email"
                placeholder="name@example.com or 10-digit mobile number"
              />
            </div>
          </div>
        ) : null}

        {step === "otp" ? (
          <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label="OTP">
            <InputOTPGroup className="gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        ) : null}

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === "ask" ? (
            <>
              <Button type="button" variant="outline" onClick={close}>No, register normally</Button>
              <Button type="button" onClick={() => setStep("details")}>Yes, use my I-STEM account</Button>
            </>
          ) : step === "details" ? (
            <>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Register without I-STEM</Button>
              <Button type="button" onClick={lookup} disabled={busy || !validDetails}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Find my account
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("details")} disabled={busy}>Back</Button>
              <Button type="button" onClick={verify} disabled={busy || otp.length !== 6}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {direct ? "Verify and create my account" : "Verify and fill the form"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
