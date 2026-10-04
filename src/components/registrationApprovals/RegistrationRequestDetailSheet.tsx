import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, FileText, Loader2, Mail, Send, UserCog, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import type { RegistrationExtension, RegistrationPerson, RegistrationRequestDetail } from "@/lib/registrationApprovalTypes";
import { formatDeadlineIst } from "@/lib/registrationDeadline";
import {
  EventTimeline,
  ExtensionStatusBadge,
  formatDay,
  formatMoment,
  RegistrationStatusBadge,
  roleLabel,
  SIX_MONTH_NOTE,
} from "./shared";

type ActionKind = "approve" | "reject" | "faculty" | "extend" | "ext-approve" | "ext-deny";

interface Props {
  userId: number | null;
  onClose: () => void;
  onChanged: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function FacultyPicker({ value, onChange }: { value: RegistrationPerson | null; onChange: (p: RegistrationPerson | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistrationPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setLoading(true);
      const res = await apiClient.searchFacultyForSignup(query.trim(), 15);
      setLoading(false);
      setResults(
        (res.data?.results ?? []).map((f) => ({ id: f.id, name: f.name, email: f.email, department: f.department ?? "" })),
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border p-2.5">
        <div className="min-w-0 text-sm">
          <p className="font-medium">{value.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {value.department || "—"} · {value.email}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search IITR faculty by name or email" />
      {loading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
      {results.length ? (
        <div className="max-h-48 divide-y overflow-y-auto rounded-lg border">
          {results.map((f) => (
            <button
              key={f.id}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-muted/60"
              onClick={() => {
                onChange(f);
                setQuery("");
                setResults([]);
              }}
            >
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.department || "—"} · {f.email}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function RegistrationRequestDetailSheet({ userId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<RegistrationRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; ext?: RegistrationExtension } | null>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [faculty, setFaculty] = useState<RegistrationPerson | null>(null);
  const [forwardAfter, setForwardAfter] = useState(true);

  const load = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    const res = await apiClient.getRegistrationRequest(userId);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the request.");
      return;
    }
    setDetail(res.data);
  }, [userId]);

  useEffect(() => {
    setDetail(null);
    void load();
  }, [load]);

  const openAction = (kind: ActionKind, ext?: RegistrationExtension) => {
    setReason("");
    setFaculty(null);
    setForwardAfter(true);
    const max = ext?.max_until ?? detail?.extension_max_until ?? "";
    setUntil(kind === "extend" || kind === "ext-approve" ? max : "");
    setAction({ kind, ext });
  };

  const finish = (message: string, next?: RegistrationRequestDetail) => {
    toast.success(message);
    setAction(null);
    if (next) setDetail(next);
    else void load();
    onChanged();
  };

  const runUserAction = async (kind: "approve" | "reject" | "forward" | "remind" | "change-faculty" | "extend", body = {}) => {
    if (!detail) return;
    setBusy(true);
    const res = await apiClient.registrationRequestAction(detail.user_id, kind, body);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "The action failed.");
      return;
    }
    finish(res.data.message, res.data.request);
  };

  const submitDialog = async () => {
    if (!action || !detail) return;
    if (action.kind === "approve") return runUserAction("approve", { reason });
    if (action.kind === "reject") return runUserAction("reject", { reason });
    if (action.kind === "faculty") {
      return runUserAction("change-faculty", { faculty_id: faculty?.id, reason, forward: forwardAfter });
    }
    if (action.kind === "extend") return runUserAction("extend", { until, reason });
    if (!action.ext) return;
    setBusy(true);
    const res = await apiClient.decideRegistrationExtensionAsAdmin(action.ext.id, {
      decision: action.kind === "ext-approve" ? "approve" : "disapprove",
      until: action.kind === "ext-approve" ? until : undefined,
      reason,
    });
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "The action failed.");
      return;
    }
    finish(res.data.message, res.data.request);
  };

  const remindExtension = async (ext: RegistrationExtension) => {
    setBusy(true);
    const res = await apiClient.remindRegistrationExtension(ext.id);
    setBusy(false);
    if (res.error || !res.data) toast.error(res.error || "Could not send the reminder.");
    else finish(res.data.message);
  };

  const d = detail;
  const pending = d && ["pending_admin", "pending_faculty", "rejected", "unverified"].includes(d.status);
  const canForward = d && d.claims_iitr && d.faculty && d.email_verified && d.status === "pending_admin";
  const canExtend = d && d.claims_iitr && d.programme_validity && ["approved", "expired", "disabled"].includes(d.status);
  const dialogInvalid =
    !action ||
    ((action.kind === "reject" || action.kind === "ext-deny" || action.kind === "faculty" || action.kind === "extend") &&
      !reason.trim()) ||
    (action.kind === "faculty" && !faculty) ||
    ((action.kind === "extend" || action.kind === "ext-approve") && !until);
  const maxUntil = action?.ext?.max_until ?? d?.extension_max_until ?? undefined;

  return (
    <Sheet open={userId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {d?.name || "Registration request"}
            {d ? <RegistrationStatusBadge status={d.status} /> : null}
          </SheetTitle>
          <SheetDescription>{d ? `${d.email} · ${d.user_type_label}` : "Loading…"}</SheetDescription>
        </SheetHeader>

        {loading && !d ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : d ? (
          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap gap-2">
              {pending ? (
                <>
                  <Button size="sm" disabled={busy} onClick={() => openAction("approve")}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                  {d.status !== "rejected" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => openAction("reject")}>
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                  ) : null}
                </>
              ) : null}
              {canForward ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => runUserAction("forward")}>
                  <Send className="mr-1.5 h-4 w-4" />
                  Send to faculty
                </Button>
              ) : null}
              {d.status === "pending_faculty" ? (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => runUserAction("remind")} title="Same deadline">
                    <Mail className="mr-1.5 h-4 w-4" />
                    Resend reminder
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => runUserAction("forward")} title="Starts a new decision window">
                    <Send className="mr-1.5 h-4 w-4" />
                    Send again (new window)
                  </Button>
                </>
              ) : null}
              {d.claims_iitr && d.status !== "approved" ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => openAction("faculty")}>
                  <UserCog className="mr-1.5 h-4 w-4" />
                  {d.faculty ? "Change faculty" : "Set faculty"}
                </Button>
              ) : null}
              {canExtend ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => openAction("extend")}>
                  <CalendarClock className="mr-1.5 h-4 w-4" />
                  Extend validity
                </Button>
              ) : null}
            </div>

            {d.faculty_missing ? (
              <Alert>
                <AlertDescription>
                  This request claims to be from an IITR user but names no faculty member. Set the faculty to send it for approval, or decide it yourself.
                </AlertDescription>
              </Alert>
            ) : null}
            {d.status === "pending_faculty" && d.approval ? (
              <Alert>
                <AlertDescription>
                  With {d.approval.faculty?.name || "the faculty member"} since {formatMoment(d.approval.forwarded_at)}
                  {d.approval.first_viewed_at ? `; first opened ${formatMoment(d.approval.first_viewed_at)}` : "; not opened yet"}.
                  {d.approval.decision_deadline
                    ? ` Decision due by ${formatDeadlineIst(d.approval.decision_deadline)}; after that it is treated as declined and the pending account removed. A reminder keeps this deadline; Send again starts a new window.`
                    : " Sent before the decision window was introduced, so it does not time out."}{" "}
                  Approving or rejecting here overrides the faculty decision and is logged as an override.
                </AlertDescription>
              </Alert>
            ) : null}

            <Section title="User details">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Registered as">{d.user_type_label}</Field>
                <Field label="Department / organisation">{d.department}</Field>
                <Field label="Employee / student ID">{d.employee_id}</Field>
                <Field label="Phone">{d.phone}</Field>
                <Field label="Registered">{formatMoment(d.registered_at)}</Field>
                <Field label="Email verified">{d.email_verified ? "Yes" : "No"}</Field>
                <Field label="Programme start">{formatDay(d.programme_start)}</Field>
                <Field label="Programme validity">{formatDay(d.programme_validity)}</Field>
                <Field label="Claimed IITR faculty">
                  {d.faculty ? `${d.faculty.name} (${d.faculty.email})` : d.claims_iitr ? "Not named" : "Not applicable"}
                </Field>
                <Field label="Account">
                  {d.is_active ? "Active" : "Inactive"}
                  {d.force_inactive ? " · disabled" : ""}
                  {d.access_on_hold ? " · access on hold" : ""}
                </Field>
              </dl>
            </Section>

            {d.approval?.decided_at ? (
              <Section title="Decision">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Decided by">
                    {d.approval.decided_by} ({roleLabel(d.approval.decided_role)})
                  </Field>
                  <Field label="When">{formatMoment(d.approval.decided_at)}</Field>
                  {d.approval.decision_reason ? <Field label="Reason">{d.approval.decision_reason}</Field> : null}
                </dl>
                {d.approval.disclaimer_text ? (
                  <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                    “{d.approval.disclaimer_text}” <span className="not-italic">(version {d.approval.disclaimer_version})</span>
                  </blockquote>
                ) : null}
              </Section>
            ) : null}

            <Section title="Documents">
              {d.documents.length ? (
                <ul className="space-y-1 text-sm">
                  {d.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {doc.document_type || doc.description || `Document ${doc.id}`}
                        </a>
                      ) : (
                        <span>{doc.document_type || doc.description || `Document ${doc.id}`}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatMoment(doc.uploaded_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              )}
            </Section>

            {d.extensions.length ? (
              <Section title="Extension requests">
                <ul className="space-y-2">
                  {d.extensions.map((ext) => (
                    <li key={ext.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          From {formatDay(ext.previous_end_date)} · up to {formatDay(ext.max_until)}
                          {ext.approved_until ? ` · granted until ${formatDay(ext.approved_until)}` : ""}
                        </span>
                        <ExtensionStatusBadge status={ext.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {formatMoment(ext.created_at)} · {ext.faculty ? `to ${ext.faculty.name}` : "no faculty named"}
                        {ext.decided_at ? ` · decided by ${ext.decided_by} (${roleLabel(ext.decided_role)})` : ""}
                      </p>
                      {ext.user_reason ? <p className="mt-1 text-xs">User: {ext.user_reason}</p> : null}
                      {ext.decision_reason ? <p className="mt-1 text-xs">Reason: {ext.decision_reason}</p> : null}
                      {ext.status === "pending" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => openAction("ext-approve", ext)}>
                            Grant
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => openAction("ext-deny", ext)}>
                            Decline
                          </Button>
                          {ext.faculty ? (
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => remindExtension(ext)}>
                              Remind faculty
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Future bookings">
              {d.future_bookings.length ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Bookings are never cancelled automatically when access ends. Review them with the Officer In Charge.
                  </p>
                  <ul className="space-y-1 text-sm">
                    {d.future_bookings.map((b) => (
                      <li key={b.booking_id}>
                        {b.display_id} · {b.equipment} · {formatMoment(b.starts_at)} · {b.status}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
              )}
            </Section>

            <Section title="Timeline">
              <EventTimeline events={d.timeline} emptyText="No events recorded yet. Older registrations have no history before this feature." />
            </Section>
          </div>
        ) : null}

        <Dialog open={action != null} onOpenChange={(open) => !open && setAction(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {
                  {
                    approve: "Approve registration",
                    reject: "Reject registration",
                    faculty: d?.faculty ? "Change faculty" : "Set faculty",
                    extend: "Extend programme validity",
                    "ext-approve": "Grant extension",
                    "ext-deny": "Decline extension",
                  }[action?.kind ?? "approve"]
                }
              </DialogTitle>
              <DialogDescription>
                {action?.kind === "approve"
                  ? "The account becomes active immediately and the user is emailed."
                  : action?.kind === "reject"
                    ? "The reason is emailed to the user."
                    : action?.kind === "faculty"
                      ? "Earlier approval links stop working. The change and reason are logged."
                      : action?.kind === "ext-deny"
                        ? "The reason is emailed to the user and the faculty member."
                        : SIX_MONTH_NOTE}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {action?.kind === "faculty" ? (
                <div className="space-y-1.5">
                  <Label>IITR faculty member</Label>
                  <FacultyPicker value={faculty} onChange={setFaculty} />
                  <label className="flex items-center gap-2 pt-1 text-sm">
                    <Checkbox checked={forwardAfter} onCheckedChange={(v) => setForwardAfter(v === true)} />
                    Send the request to this faculty member now
                  </label>
                </div>
              ) : null}
              {action?.kind === "extend" || action?.kind === "ext-approve" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="reg-until">New validity date</Label>
                  <Input id="reg-until" type="date" value={until} max={maxUntil} onChange={(e) => setUntil(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Latest date allowed: {formatDay(maxUntil)} (six months).</p>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="reg-reason">
                  {action?.kind === "approve" || action?.kind === "ext-approve" ? "Note (optional)" : "Reason"}
                </Label>
                <Textarea id="reg-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submitDialog} disabled={busy || dialogInvalid}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
