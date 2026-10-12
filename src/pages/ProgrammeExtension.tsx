import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell } from "@/components/PageShell";
import { formatDay, formatMoment, SIX_MONTH_NOTE } from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { EXTENSION_BLOCK_REASON, type AccountLifecycleStatus } from "@/lib/accountLifecycle";
import type { ProgrammeValidity, RegistrationExtension, RegistrationPerson } from "@/lib/registrationApprovalTypes";

function PendingNotice({ pending }: { pending: RegistrationExtension }) {
  return (
    <Alert>
      <AlertDescription>
        You asked for an extension on {formatMoment(pending.created_at)}. It is waiting for{" "}
        {pending.faculty ? pending.faculty.name : "the IIC administrator"}. You will be emailed when it is decided.
      </AlertDescription>
    </Alert>
  );
}

function RequestForm({
  faculty,
  busy,
  onSubmit,
}: {
  faculty: RegistrationPerson | null;
  busy: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Your request goes to <span className="font-medium">{faculty ? faculty.name : "the IIC administrator"}</span>
        {faculty ? ", who confirms you still work under their supervision." : "."}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="ext-reason">Message to your supervisor (optional)</Label>
        <Textarea
          id="ext-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          placeholder="For example: thesis submission pending; project extended until March."
        />
      </div>
      <Button onClick={() => onSubmit(reason)} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Request extension
      </Button>
    </div>
  );
}

function EndDateForm({ busy, onSubmit }: { busy: boolean; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        No programme / employment end date is recorded for your account. Enter the date your appointment, project or
        incubation ends. Your supervisor is told, and can extend it later in six-month steps.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="end-date">End date</Label>
        <Input id="end-date" type="date" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-xs" />
      </div>
      <Button onClick={() => onSubmit(value)} disabled={busy || !value}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save end date
      </Button>
    </div>
  );
}

/** Signed-in view: end date, how it was set, suspension, and the extension request. */
function MyLifecycle() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<AccountLifecycleStatus | null>(null);
  const [outOfScope, setOutOfScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getMyAccountLifecycle();
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load your programme end date.");
      return;
    }
    setError(null);
    if (!res.data.in_scope) {
      setOutOfScope(true);
      return;
    }
    setStatus(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const request = async (reason: string) => {
    setBusy(true);
    const res = await apiClient.requestAccountExtension(reason);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not send your request.");
      return;
    }
    setSent(res.data.message);
    setStatus(res.data.status);
  };

  const saveEndDate = async (value: string) => {
    setBusy(true);
    const res = await apiClient.provideAccountEndDate(value);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the date.");
      return;
    }
    toast.success(res.data.message);
    setStatus(res.data.status);
    void refreshUser();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (outOfScope || !status) {
    return (
      <Alert>
        <AlertDescription>
          Programme end dates and extensions apply to IITR students, post-docs, research associates and IITR Startups. For anything else,
          raise a support ticket.
        </AlertDescription>
      </Alert>
    );
  }

  const end = status.programme_end_date ? formatDay(status.programme_end_date) : null;
  const pending = status.pending_extension;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{status.category_label}</CardTitle>
        <CardDescription>
          {end
            ? status.suspended
              ? `Your programme / employment end date was ${end}.`
              : status.days_left != null && status.days_left < 0
                ? `Your programme / employment end date was ${end}.`
                : `Your programme / employment end date is ${end} (${status.days_left} day(s) left).`
            : "No programme / employment end date is recorded for your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.suspended ? (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Account suspended</AlertTitle>
            <AlertDescription>
              You can view past bookings and download results. Booking and uploads resume as soon as your supervisor extends your end date.
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {status.category === "iitr_student" ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Degree</dt>
              <dd>{status.degree_name || "Not available"}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How the date was set</dt>
            <dd>{status.end_date_source_note}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supervisor</dt>
            <dd>{status.supervisor ? status.supervisor.name : "Not linked (requests go to the IIC administrator)"}</dd>
          </div>
        </dl>

        {status.end_date_required ? (
          <EndDateForm busy={busy} onSubmit={saveEndDate} />
        ) : (
          <>
            <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              {SIX_MONTH_NOTE}
              {status.extension_max_until ? ` The latest date your supervisor can choose now is ${formatDay(status.extension_max_until)}.` : ""}
            </p>
            {sent ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{sent}</AlertDescription>
              </Alert>
            ) : pending ? (
              <PendingNotice pending={pending} />
            ) : status.can_request_extension ? (
              <RequestForm faculty={status.supervisor} busy={busy} onSubmit={request} />
            ) : (
              <Alert>
                <AlertDescription>
                  {EXTENSION_BLOCK_REASON[status.extension_block_reason] || "You cannot request an extension right now."}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Opened from the expiry email / sign-in page with a signed link (no sign-in). */
function LinkExtension({ token, channel }: { token: string; channel: "email_link" | "login" }) {
  const [validity, setValidity] = useState<ProgrammeValidity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    void apiClient.getProgrammeValidityByLink(token).then((res) => {
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error || "Could not load your programme validity.");
        return;
      }
      setValidity(res.data);
    });
  }, [token]);

  const submit = async (reason: string) => {
    setBusy(true);
    const res = await apiClient.requestProgrammeExtensionByLink(token, reason, channel);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not send your request.");
      return;
    }
    setSent(res.data.message);
    setValidity(res.data.validity);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !validity) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{validity.name}</CardTitle>
        <CardDescription>
          {validity.programme_validity
            ? validity.expired
              ? `Your programme / employment end date was ${formatDay(validity.programme_validity)}.`
              : `Your access is valid until ${formatDay(validity.programme_validity)} (${validity.days_left} day(s) left).`
            : "No programme / employment end date is recorded for your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          {SIX_MONTH_NOTE}
          {validity.extension_max_until ? ` The latest date your supervisor can choose now is ${formatDay(validity.extension_max_until)}.` : ""}
        </p>
        {sent ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{sent}</AlertDescription>
          </Alert>
        ) : validity.pending_extension ? (
          <PendingNotice pending={validity.pending_extension} />
        ) : validity.can_request_extension ? (
          <RequestForm faculty={validity.faculty} busy={busy} onSubmit={submit} />
        ) : (
          <Alert>
            <AlertDescription>
              An extension cannot be requested for this account right now. Sign in to see why, or raise a support ticket.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/** Request a programme / employment end date extension, or record a missing end date. */
export default function ProgrammeExtension() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const channel = searchParams.get("from") === "login" ? "login" : "email_link";
  const { isAuthenticated, loading: authLoading } = useAuth();

  return (
    <PageShell withHeader={isAuthenticated}>
      <main className="container mx-auto max-w-2xl space-y-4 px-3 py-6 sm:px-4">
        <PageHero
          compact
          title="Programme end date and extension"
          description="See your programme / employment end date and ask your IITR faculty supervisor to extend it."
          icon={<CalendarClock className="h-5 w-5" />}
        />
        {token ? (
          <LinkExtension token={token} channel={channel} />
        ) : authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isAuthenticated ? (
          <MyLifecycle />
        ) : (
          <Alert>
            <AlertDescription>
              <Link to="/auth" className="underline underline-offset-2">
                Sign in
              </Link>{" "}
              to see your end date and request an extension. If your access has already ended, the sign-in page offers a link to request one.
            </AlertDescription>
          </Alert>
        )}
      </main>
    </PageShell>
  );
}
