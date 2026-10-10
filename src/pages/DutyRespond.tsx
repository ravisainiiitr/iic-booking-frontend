import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, ShieldAlert, UserCog, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatHours, minutesToHours } from "@/components/training/dutyHelpers";
import { formatDateTime, formatWindow } from "@/components/training/trainingHelpers";
import { StatusChip } from "@/components/training/trainingUi";
import { trainingApi } from "@/lib/trainingApi";
import type { PublicDuty } from "@/lib/trainingOpsTypes";

/** Public page behind the signed Confirm / Decline link in the duty email; works without signing in. */
export default function DutyRespond() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [duty, setDuty] = useState<PublicDuty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"choose" | "decline">(params.get("action") === "decline" ? "decline" : "choose");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This link is incomplete. Open it again from the email, or answer from My operator duty after signing in.");
      setLoading(false);
      return;
    }
    void trainingApi.dutyRespondView(token).then((res) => {
      setLoading(false);
      if (res.error) setError(res.error);
      else setDuty(res.data ?? null);
    });
  }, [token]);

  const respond = async (action: "confirm" | "decline") => {
    setBusy(true);
    const res = await trainingApi.dutyRespond(token, action, action === "decline" ? reason.trim() : undefined);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDuty(res.data ?? null);
    setDone(action === "confirm" ? "Thank you — your duty is confirmed. The OIC has been told." : "You have declined this duty. The OIC has been told so it can go to someone else.");
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <UserCog className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Operator duty</span>
          </div>
          <CardTitle>{duty ? duty.title || duty.equipment.name : "Duty allocation"}</CardTitle>
          {duty ? (
            <CardDescription>
              {duty.reference} · {duty.equipment.name} · for {duty.operator_name}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          {done ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{done}</span>
            </div>
          ) : null}
          {duty ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusChip kind="duty" status={duty.status} label={duty.status_label} />
                <span>{formatHours(minutesToHours(duty.planned_minutes))} in total</span>
                {duty.can_respond && duty.confirm_by ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> answer by {formatDateTime(duty.confirm_by)}
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-border/60 rounded-md border border-border/70 text-sm">
                {duty.shifts.map((s) => (
                  <li key={s.start_at} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{formatWindow(s.start_at, s.end_at)}</span>
                    <StatusChip kind="shift" status={s.status} />
                  </li>
                ))}
              </ul>
              {duty.note ? <p className="text-sm italic">“{duty.note}”</p> : null}

              {duty.can_respond && !done ? (
                mode === "decline" ? (
                  <div className="space-y-2">
                    <Label htmlFor="decline-reason">Why can't you take it? *</Label>
                    <Textarea id="decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Conference travel that week" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="destructive" onClick={() => void respond("decline")} disabled={busy || !reason.trim()}>
                        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                        Decline duty
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setMode("choose")} disabled={busy}>
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void respond("confirm")} disabled={busy}>
                      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                      Confirm duty
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMode("decline")} disabled={busy}>
                      <XCircle className="mr-1.5 h-4 w-4" /> Decline
                    </Button>
                  </div>
                )
              ) : !done ? (
                <p className="text-sm text-muted-foreground">This duty no longer needs an answer.</p>
              ) : null}
            </>
          ) : null}
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            You can also manage duty after signing in at{" "}
            <Link to="/my-duty" className="text-primary hover:underline">
              My operator duty
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
