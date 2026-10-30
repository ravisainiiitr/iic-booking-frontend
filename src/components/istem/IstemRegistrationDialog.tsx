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

/**
 * Registration of an external user: "Already registered on I-STEM?". If yes, the user gives the email and mobile
 * number registered on I-STEM, enters the OTP sent to that email, and the form is filled from I-STEM. Nothing about
 * the I-STEM account is shown before the OTP is verified (the server enforces it).
 */
export default function IstemRegistrationDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (result: IstemRegistrationResult) => void;
}) {
  const [step, setStep] = useState<Step>("ask");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
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
      const sent = await istemRegisterApi.lookup(email.trim(), mobile);
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
      onVerified({ profile: res.profile, linkToken: res.link_token, email: email.trim().toLowerCase(), mobile });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The OTP could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const validDetails = email.includes("@") && mobile.length === 10;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Already registered on I-STEM?</DialogTitle>
          <DialogDescription>
            {step === "ask"
              ? "If you have an account on I-STEM, the national facility portal, we can fill in this form from it."
              : step === "details"
                ? "Enter the email and mobile number registered on I-STEM. We send a one-time password to that email."
                : `Enter the 6-digit OTP sent to ${masked}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "details" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="istem-reg-email">Email registered on I-STEM</Label>
              <Input id="istem-reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="istem-reg-mobile">Mobile number registered on I-STEM</Label>
              <Input
                id="istem-reg-mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(-10))}
                placeholder="10-digit mobile number"
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
                Verify and fill the form
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
