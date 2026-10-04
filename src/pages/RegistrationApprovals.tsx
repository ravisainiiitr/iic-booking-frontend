import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Clock, Loader2, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import {
  DisclaimerBox,
  ExtensionStatusBadge,
  formatDay,
  formatMoment,
  SIX_MONTH_NOTE,
} from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { deadlineRemaining, formatDeadlineIst } from "@/lib/registrationDeadline";
import { cn } from "@/lib/utils";
import type {
  FacultyApprovalsOverview,
  FacultyRegistrationRequest,
  RegistrationExtension,
} from "@/lib/registrationApprovalTypes";

type Item = { kind: "registration"; item: FacultyRegistrationRequest } | { kind: "extension"; item: RegistrationExtension };

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

function DeadlineNote({ deadline }: { deadline: string }) {
  const remaining = deadlineRemaining(deadline);
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        remaining?.urgent ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
      )}
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        Please respond by <strong>{formatDeadlineIst(deadline)}</strong>
        {remaining && !remaining.expired ? ` (${remaining.label})` : ""}. After that the request is treated as declined.
      </span>
    </p>
  );
}

function DecisionCard({
  entry,
  token,
  highlighted,
  onDone,
}: {
  entry: Item;
  token?: string;
  highlighted?: boolean;
  onDone: () => void;
}) {
  const isExt = entry.kind === "extension";
  const ext = isExt ? (entry.item as RegistrationExtension) : null;
  const reg = !isExt ? (entry.item as FacultyRegistrationRequest) : null;
  const person = isExt ? ext!.user : reg!.user;
  const [accepted, setAccepted] = useState(false);
  const [mode, setMode] = useState<"approve" | "disapprove">("approve");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState(ext?.max_until ?? "");
  const [busy, setBusy] = useState(false);

  const template = entry.item.disclaimer_template ?? "";
  const disclaimer = useMemo(() => {
    if (!ext || !ext.max_until || !until || until === ext.max_until) return template;
    return template.split(formatDay(ext.max_until)).join(formatDay(until));
  }, [ext, template, until]);

  const submit = async () => {
    setBusy(true);
    const body = {
      decision: mode,
      reason,
      disclaimer_accepted: mode === "approve" ? accepted : false,
      disclaimer_version: entry.item.disclaimer_version,
      token,
      until: isExt && mode === "approve" ? until : undefined,
    };
    const res = isExt ? await apiClient.decideFacultyExtension(entry.item.id, body) : await apiClient.decideFacultyRegistration(entry.item.id, body);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save your decision.");
      return;
    }
    toast.success(res.data.message);
    onDone();
  };

  const tooLate = isExt && until && ext?.max_until ? until > ext.max_until : false;
  const invalid = mode === "approve" ? !accepted || (isExt && (!until || tooLate)) : !reason.trim();

  return (
    <Card className={highlighted ? "border-primary shadow-md" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {isExt ? <CalendarClock className="h-4 w-4 text-primary" /> : <UserCheck className="h-4 w-4 text-primary" />}
          {person.name}
          <span className="text-sm font-normal text-muted-foreground">{person.email}</span>
        </CardTitle>
        <CardDescription>
          {isExt
            ? `Asks you to extend their access beyond ${formatDay(ext!.previous_end_date)}.`
            : `Registered as ${reg!.user_type_label} and named you as their IITR faculty supervisor.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Detail label="Registered as" value={isExt ? ext!.user_type_label : reg!.user_type_label} />
          <Detail label="Department / organisation" value={person.department} />
          {reg ? (
            <>
              <Detail label="Employee / student ID" value={reg.employee_id} />
              <Detail label="Phone" value={reg.phone} />
              <Detail label="Programme start" value={formatDay(reg.programme_start)} />
              <Detail label="Programme validity" value={formatDay(reg.programme_validity)} />
              <Detail label="Registered" value={formatMoment(reg.registered_at)} />
              <Detail label="Sent to you" value={formatMoment(reg.forwarded_at)} />
            </>
          ) : (
            <>
              <Detail label="Current validity" value={formatDay(ext!.previous_end_date)} />
              <Detail label="Latest date allowed" value={formatDay(ext!.max_until)} />
              <Detail label="Requested" value={formatMoment(ext!.created_at)} />
            </>
          )}
        </dl>
        {ext?.user_reason ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            <span className="font-medium">Message from the user: </span>
            {ext.user_reason}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button size="sm" variant={mode === "approve" ? "default" : "outline"} onClick={() => setMode("approve")}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {isExt ? "Grant extension" : "Approve"}
          </Button>
          <Button size="sm" variant={mode === "disapprove" ? "default" : "outline"} onClick={() => setMode("disapprove")}>
            <XCircle className="mr-1.5 h-4 w-4" />
            Decline
          </Button>
        </div>
        {reg?.decision_deadline ? <DeadlineNote deadline={reg.decision_deadline} /> : null}

        {mode === "approve" ? (
          <div className="space-y-3">
            {isExt ? (
              <div className="space-y-1.5">
                <Label htmlFor={`until-${entry.item.id}`}>Extend access until</Label>
                <Input
                  id={`until-${entry.item.id}`}
                  type="date"
                  value={until}
                  max={ext!.max_until ?? undefined}
                  onChange={(e) => setUntil(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">{SIX_MONTH_NOTE}</p>
                {tooLate ? <p className="text-xs text-destructive">Choose {formatDay(ext!.max_until)} or earlier.</p> : null}
              </div>
            ) : null}
            {disclaimer ? <DisclaimerBox text={disclaimer} /> : null}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <span>I confirm the statement above.</span>
            </label>
            {!isExt ? (
              <p className="text-xs text-muted-foreground">Once you approve, the account is active straight away. No further approval is needed.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${entry.item.id}`}>Reason (emailed to the user)</Label>
            <Textarea id={`reason-${entry.item.id}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
            {!isExt ? (
              <p className="text-xs text-muted-foreground">
                The request is cancelled and the pending account removed. The user is emailed your reason and can register again.
              </p>
            ) : null}
          </div>
        )}

        <Button onClick={submit} disabled={busy || invalid}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit decision
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RegistrationApprovals() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [overview, setOverview] = useState<FacultyApprovalsOverview | null>(null);
  const [focus, setFocus] = useState<Item | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaPending, setSchemaPending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      setPostLoginRedirect(`${location.pathname}${location.search}`);
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, user, navigate, location.pathname, location.search]);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, review] = await Promise.all([
      apiClient.getFacultyRegistrationApprovals(),
      token ? apiClient.reviewRegistrationApprovalToken(token) : Promise.resolve(null),
    ]);
    setLoading(false);
    if (list.errorCode === "schema_pending") {
      setSchemaPending(true);
      return;
    }
    if (list.error || !list.data) toast.error(list.error || "Could not load your approvals.");
    else setOverview(list.data);
    if (review) {
      if (review.error || !review.data) {
        setTokenError(review.error || "This approval link cannot be used.");
        setFocus(null);
      } else {
        setTokenError(null);
        setFocus(review.data as Item);
      }
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const afterDecision = () => {
    if (token) {
      const params = new URLSearchParams(searchParams);
      params.delete("token");
      setSearchParams(params, { replace: true });
      setFocus(null);
    }
    void load();
  };

  const focusPending = focus && focus.item.status === (focus.kind === "registration" ? "pending_faculty" : "pending") ? focus : null;
  const sameAsFocus = (kind: Item["kind"], id: number) => focusPending?.kind === kind && focusPending.item.id === id;
  const nothingPending = overview && !overview.registrations.length && !overview.extensions.length && !focusPending;

  return (
    <PageShell>
      <main className="container mx-auto max-w-4xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Registration Approvals"
            description="Confirm users who named you as their IITR faculty supervisor, and extend their access when their programme validity ends."
            icon={<UserCheck className="h-5 w-5" />}
          />
        </StandaloneOnly>

        {schemaPending ? (
          <Alert>
            <AlertDescription>Registration approvals are being set up. Try again after the database update.</AlertDescription>
          </Alert>
        ) : null}
        {tokenError ? (
          <Alert variant="destructive">
            <AlertTitle>This approval link cannot be used</AlertTitle>
            <AlertDescription>{tokenError} Any requests still waiting for you are listed below.</AlertDescription>
          </Alert>
        ) : null}

        {loading && !overview ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {focusPending ? <DecisionCard key={`focus-${focusPending.kind}-${focusPending.item.id}`} entry={focusPending} token={token} highlighted onDone={afterDecision} /> : null}

        {overview?.registrations
          .filter((r) => !sameAsFocus("registration", r.id))
          .map((r) => (
            <DecisionCard key={`reg-${r.id}`} entry={{ kind: "registration", item: r }} onDone={afterDecision} />
          ))}
        {overview?.extensions
          .filter((e) => !sameAsFocus("extension", e.id))
          .map((e) => (
            <DecisionCard key={`ext-${e.id}`} entry={{ kind: "extension", item: e }} onDone={afterDecision} />
          ))}

        {nothingPending ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing is waiting for your approval.</CardContent>
          </Card>
        ) : null}

        {overview && (overview.recent_registrations.length || overview.recent_extensions.length) ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your recent decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {overview.recent_registrations.map((r) => (
                  <li key={`rr-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {r.user.name} · registration {r.status === "approved" ? "approved" : "declined"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatMoment(r.decided_at)}</span>
                  </li>
                ))}
                {overview.recent_extensions.map((e) => (
                  <li key={`re-${e.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="flex items-center gap-2">
                      {e.user.name} · extension
                      {e.approved_until ? ` until ${formatDay(e.approved_until)}` : ""}
                      <ExtensionStatusBadge status={e.status} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatMoment(e.decided_at)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </PageShell>
  );
}
