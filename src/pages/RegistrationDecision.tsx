import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, ShieldAlert, UserCheck, XCircle } from "lucide-react";

import { PageHero, PageShell } from "@/components/PageShell";
import { DisclaimerBox, formatDay } from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { deadlineRemaining, formatDeadlineIst } from "@/lib/registrationDeadline";
import type { EmailDecisionItem, EmailDecisionResult } from "@/lib/registrationApprovalTypes";
import { cn } from "@/lib/utils";

type Mode = "approve" | "decline";

interface Closed {
  code: string;
  message: string;
}

const CLOSED_TITLE: Record<string, string> = {
  timed_out: "Request timed out",
  already_decided: "Already decided",
  request_closed: "Request no longer open",
  token_used: "Link already used",
  token_expired: "Link expired",
  wrong_faculty: "Signed in as someone else",
  token_invalid: "Link not valid",
  schema_pending: "Please try again shortly",
};

const MIN_REASON = 1;

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-base">{value || "—"}</dd>
    </div>
  );
}

/** Opened from the Approve / Decline buttons in the faculty email; no sign-in needed. */
export default function RegistrationDecision() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>(searchParams.get("action") === "decline" ? "decline" : "approve");
  const [item, setItem] = useState<EmailDecisionItem | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailDecisionResult | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!token) {
      setClosed({ code: "token_invalid", message: "This link is incomplete. Open it again from the email." });
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiClient.getEmailDecisionRequest(token);
    setLoading(false);
    if (res.error || !res.data?.item) {
      setClosed({ code: res.errorCode || "token_invalid", message: res.error || "This link cannot be used." });
      return;
    }
    setItem(res.data.item);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = deadlineRemaining(item?.decision_deadline, now);
  const reasonTooShort = reason.trim().length < MIN_REASON;

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    const res = await apiClient.submitEmailDecision({
      token,
      decision: mode,
      reason: mode === "decline" ? reason.trim() : "",
      disclaimer_accepted: mode === "approve" ? accepted : false,
      disclaimer_version: item?.disclaimer_version,
    });
    setBusy(false);
    if (res.error || !res.data) {
      if (res.errorCode && res.errorCode in CLOSED_TITLE) {
        setClosed({ code: res.errorCode, message: res.error || "This request is no longer open." });
        return;
      }
      setSubmitError(res.error || "Could not save your decision. Please try again.");
      return;
    }
    setResult(res.data);
  };

  return (
    <PageShell withHeader={isAuthenticated}>
      <main className="container mx-auto max-w-2xl space-y-4 px-3 py-6 sm:px-4">
        <PageHero
          compact
          title="Registration approval"
          description="Confirm or decline a registration that named you as the IITR faculty supervisor."
          icon={<UserCheck className="h-5 w-5" />}
        />

        {loading ? (
          <div className="flex justify-center py-16" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Loading the request…</span>
          </div>
        ) : null}

        {closed ? (
          <Card role="alert" className={cn(closed.code === "timed_out" && "border-amber-400/70")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                {closed.code === "timed_out" ? (
                  <Clock className="h-6 w-6 text-amber-600" aria-hidden />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden />
                )}
                {CLOSED_TITLE[closed.code] ?? "This link cannot be used"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">{closed.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/registration-approvals">Open Pending approvals</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {result ? (
          <Card role="status">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                {result.decision === "approved" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" aria-hidden />
                )}
                {result.decision === "approved" ? "Registration approved" : "Registration declined"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">{result.message}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">You can close this page.</CardContent>
          </Card>
        ) : null}

        {item && !closed && !result ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">{item.user.name}</CardTitle>
              <CardDescription className="text-base">
                {item.user.email} · registered as {item.user_type_label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {item.decision_deadline ? (
                <div
                  className={cn(
                    "flex gap-3 rounded-xl border p-4",
                    remaining?.urgent
                      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
                      : "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100",
                  )}
                >
                  <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <p className="text-sm leading-relaxed">
                    <strong>Please respond by {formatDeadlineIst(item.decision_deadline)}</strong>
                    {remaining && !remaining.expired ? ` (${remaining.label})` : ""}. After that the request is treated as declined and the
                    applicant is told they can register again.
                  </p>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Department" value={item.department || item.user.department} />
                <Detail label="Employee / student ID" value={item.employee_id} />
                <Detail label="Phone" value={item.phone} />
                <Detail label="Programme validity" value={formatDay(item.programme_validity)} />
                <Detail label="Supervisor" value={item.faculty_name} />
              </dl>

              <div role="radiogroup" aria-label="Your decision" className="grid grid-cols-2 gap-3">
                {(["approve", "decline"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      mode === value
                        ? value === "approve"
                          ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                          : "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {value === "approve" ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <XCircle className="h-5 w-5" aria-hidden />}
                    {value === "approve" ? "Approve" : "Decline"}
                  </button>
                ))}
              </div>

              {mode === "approve" ? (
                <div className="space-y-3">
                  {item.disclaimer_template ? <DisclaimerBox text={item.disclaimer_template} className="text-base" /> : null}
                  <label className="flex items-start gap-3 text-base">
                    <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-1" />
                    <span>I confirm the statement above.</span>
                  </label>
                  <p className="text-sm text-muted-foreground">The account becomes active straight away and the applicant is emailed. You are copied.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="decline-reason" className="text-base">
                    Reason for declining <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="decline-reason"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                    placeholder="For example: not a member of my group"
                    className="text-base"
                    aria-describedby="decline-reason-hint"
                  />
                  <p id="decline-reason-hint" className="text-sm text-muted-foreground">
                    The request is cancelled and the pending account removed. The applicant is emailed this reason and can register again. You are
                    copied.
                  </p>
                </div>
              )}

              {submitError ? (
                <Alert variant="destructive">
                  <AlertTitle>Not saved</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                onClick={submit}
                disabled={busy || (mode === "approve" ? !accepted : reasonTooShort)}
                className={cn(
                  "h-12 w-full text-base font-semibold",
                  mode === "approve" ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800",
                )}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {mode === "approve" ? "Approve registration" : "Decline request"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Prefer the portal? <Link to="/registration-approvals" className="font-medium text-primary hover:underline">Open Pending approvals</Link>
              </p>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </PageShell>
  );
}
