import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell } from "@/components/PageShell";
import { formatDay, formatMoment, SIX_MONTH_NOTE } from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { ProgrammeValidity } from "@/lib/registrationApprovalTypes";

/** Request a programme validity extension: from the expiry email / sign-in page (signed link) or while signed in. */
export default function ProgrammeExtension() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const channel = searchParams.get("from") === "login" ? "login" : "email_link";
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [validity, setValidity] = useState<ProgrammeValidity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = token ? await apiClient.getProgrammeValidityByLink(token) : await apiClient.getMyProgrammeValidity();
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not load your programme validity.");
      return;
    }
    setError(null);
    setValidity(res.data);
  }, [token]);

  useEffect(() => {
    if (token) {
      void load();
      return;
    }
    if (authLoading) return;
    if (isAuthenticated) void load();
    else setLoading(false);
  }, [token, authLoading, isAuthenticated, load]);

  const submit = async () => {
    setBusy(true);
    const res = token
      ? await apiClient.requestProgrammeExtensionByLink(token, reason, channel)
      : await apiClient.requestMyProgrammeExtension(reason);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not send your request.");
      return;
    }
    setSent(res.data.message);
    setValidity(res.data.validity);
  };

  const pending = validity?.pending_extension;
  const noAccess = !token && !authLoading && !isAuthenticated;

  return (
    <PageShell withHeader={isAuthenticated}>
      <main className="container mx-auto max-w-2xl space-y-4 px-3 py-6 sm:px-4">
        <PageHero
          compact
          title="Extend your access"
          description="Ask your IITR faculty supervisor to extend your programme validity on the booking portal."
          icon={<CalendarClock className="h-5 w-5" />}
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noAccess ? (
          <Alert>
            <AlertDescription>
              <Link to="/auth" className="underline underline-offset-2">
                Sign in
              </Link>{" "}
              to request an extension. If your access has already ended, the sign-in page offers a link to request one.
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : validity ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{validity.name}</CardTitle>
              <CardDescription>
                {validity.programme_validity
                  ? validity.expired
                    ? `Your programme validity ended on ${formatDay(validity.programme_validity)}.`
                    : `Your access is valid until ${formatDay(validity.programme_validity)} (${validity.days_left} day(s) left).`
                  : "No programme validity date is recorded for your account."}
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
              ) : pending ? (
                <Alert>
                  <AlertDescription>
                    You asked for an extension on {formatMoment(pending.created_at)}. It is waiting for{" "}
                    {pending.faculty ? pending.faculty.name : "the IIC administrator"}. You will be emailed when it is decided.
                  </AlertDescription>
                </Alert>
              ) : validity.can_request_extension ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Your request goes to{" "}
                    <span className="font-medium">{validity.faculty ? validity.faculty.name : "the IIC administrator"}</span>
                    {validity.faculty ? `, who confirms you still work under their supervision.` : "."}
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ext-reason">Message to your supervisor (optional)</Label>
                    <Textarea
                      id="ext-reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={2000}
                      placeholder="For example: project extended until March; extension letter issued."
                    />
                  </div>
                  <Button onClick={submit} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Request extension
                  </Button>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Extensions through your supervisor are available to approved IITR post-docs, research associates and startup members with a
                    programme validity date. For anything else, raise a support ticket.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </PageShell>
  );
}
