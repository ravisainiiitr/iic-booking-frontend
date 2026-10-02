import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Clock, Mail, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SupervisorInvite, type SupervisorInviteLimits } from "@/lib/api";
import { applyFacultyNamePrefix } from "@/lib/displayName";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const DEFAULT_INVITE_LIMITS: SupervisorInviteLimits = {
  max_active: 3,
  valid_days: 30,
  resend_hours: 24,
  allowed_domains: ["iitr.ac.in"],
};

const MAX_MESSAGE = 1000;

/** Returns a plain-language problem with the email, or null when it can be sent. */
export function validateInviteEmail(
  raw: string,
  { allowedDomains, selfEmail }: { allowedDomains: string[]; selfEmail?: string | null }
): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return "Enter your supervisor's email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  const domain = email.split("@")[1];
  const domains = allowedDomains.length ? allowedDomains : DEFAULT_INVITE_LIMITS.allowed_domains;
  if (!domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return `Use your supervisor's institute email address (ending in ${domains.map((d) => `@${d}`).join(", ")}).`;
  }
  if (selfEmail && email === selfEmail.trim().toLowerCase()) {
    return "You cannot invite yourself. Enter your supervisor's email address.";
  }
  return null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

type Department = { id: number; name: string };

type InviteFormProps = {
  selfEmail?: string | null;
  limits: SupervisorInviteLimits;
  initialEmail?: string;
  onSent: (invite: SupervisorInvite) => void;
  onCancel: () => void;
  /** The email belongs to a faculty member who is already on the portal. */
  onFacultyOnPortal?: (email: string) => void;
};

export function SupervisorInviteForm({
  selfEmail,
  limits,
  initialEmail = "",
  onSent,
  onCancel,
  onFacultyOnPortal,
}: InviteFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [message, setMessage] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    void apiClient
      .getDepartments("internal")
      .then((res) => {
        if (!alive || res.error || !res.data) return;
        const rows = (res.data.departments || [])
          .filter((d) => String(d.department_type || "").toLowerCase() === "internal")
          .map((d) => ({ id: d.id, name: d.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateInviteEmail(email, { allowedDomains: limits.allowed_domains, selfEmail });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await apiClient.createSupervisorInvite({
        email: email.trim(),
        supervisor_name: name.trim() || undefined,
        department_id: departmentId ? Number(departmentId) : null,
        message: message.trim() || undefined,
      });
      if (res.error || !res.data) {
        setError(res.error || "Could not send the invitation. Please try again.");
        if (res.errorCode === "faculty_on_portal") onFacultyOnPortal?.(email.trim());
        return;
      }
      toast.success(res.data.message || "Invitation sent.");
      onSent(res.data.invite);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="supervisor-invite-title"
      className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"
      data-testid="supervisor-invite-form"
    >
      <div>
        <h3 id="supervisor-invite-title" className="text-base font-semibold text-foreground">
          Invite your supervisor
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We will email your supervisor a link to sign in with their usual IIT Roorkee login. Your request will be
          waiting for them there. Nothing is linked until they approve it.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supervisor-invite-email">Supervisor's IIT Roorkee email</Label>
        <Input
          id="supervisor-invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={`name@${limits.allowed_domains[0] || "iitr.ac.in"}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "supervisor-invite-error" : undefined}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="supervisor-invite-name">Supervisor's name (optional)</Label>
          <Input
            id="supervisor-invite-name"
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Prof. A. Sharma"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supervisor-invite-department">Department (optional)</Label>
          <select
            id="supervisor-invite-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Not specified</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supervisor-invite-message">Message (optional)</Label>
        <Textarea
          id="supervisor-invite-message"
          value={message}
          maxLength={MAX_MESSAGE}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. I am a PhD student in your group and need to book the FE-SEM."
        />
      </div>

      {error && (
        <p id="supervisor-invite-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        You can have up to {limits.max_active} pending invitations. Each one expires after {limits.valid_days} days.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending}>
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

function InviteStatusBadge({ invite }: { invite: SupervisorInvite }) {
  switch (invite.status) {
    case "pending":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden />
          Waiting for your supervisor to sign in
        </Badge>
      );
    case "accepted":
      return (
        <Badge className="flex items-center gap-1 bg-green-600 hover:bg-green-600">
          <CheckCircle className="h-3 w-3" aria-hidden />
          Supervisor signed in
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" aria-hidden />
          Expired
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <X className="h-3 w-3" aria-hidden />
          Cancelled
        </Badge>
      );
  }
}

type InviteListProps = {
  invites: SupervisorInvite[];
  onChanged: (invite: SupervisorInvite) => void;
};

export function SupervisorInviteList({ invites, onChanged }: InviteListProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  if (invites.length === 0) return null;

  const resend = async (invite: SupervisorInvite) => {
    setBusyId(invite.id);
    try {
      const res = await apiClient.resendSupervisorInvite(invite.id);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not resend the invitation.");
        return;
      }
      toast.success(res.data.message || "Invitation sent again.");
      onChanged(res.data.invite);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (invite: SupervisorInvite) => {
    setBusyId(invite.id);
    try {
      const res = await apiClient.cancelSupervisorInvite(invite.id);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not cancel the invitation.");
        return;
      }
      toast.success(res.data.message || "Invitation cancelled.");
      onChanged(res.data.invite);
    } finally {
      setBusyId(null);
      setConfirmCancelId(null);
    }
  };

  return (
    <section aria-labelledby="supervisor-invites-heading" className="space-y-3" data-testid="supervisor-invite-list">
      <h3 id="supervisor-invites-heading" className="text-sm font-semibold text-foreground">
        Invitations you sent
      </h3>
      <ul className="space-y-3">
        {invites.map((invite) => {
          const busy = busyId === invite.id;
          const pending = invite.status === "pending";
          const supervisorLabel =
            invite.supervisor_display_name || applyFacultyNamePrefix(invite.supervisor_name, "faculty");
          return (
            <li key={invite.id} className="rounded-lg border p-4" data-testid={`supervisor-invite-${invite.id}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">
                      {supervisorLabel ? `${supervisorLabel} · ` : ""}
                      {invite.email}
                    </span>
                  </p>
                  {invite.department_name && <p className="text-xs text-muted-foreground">{invite.department_name}</p>}
                  <InviteStatusBadge invite={invite} />
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDate(invite.last_sent_at || invite.created_at)}
                    {pending && invite.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : ""}
                  </p>
                  {invite.status === "accepted" && (
                    <p className="text-sm text-muted-foreground">
                      Your request is now with your supervisor. See My Join Requests below.
                    </p>
                  )}
                  {invite.status === "expired" && (
                    <p className="text-sm text-muted-foreground">
                      Your supervisor did not sign in in time. You can send a new invitation.
                    </p>
                  )}
                </div>
                {pending && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {confirmCancelId === invite.id ? (
                      <>
                        <span className="self-center text-sm">Cancel this invitation?</span>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancel(invite)}>
                          Yes, cancel
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmCancelId(null)}>
                          No
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || !invite.can_resend}
                          title={
                            invite.can_resend || !invite.can_resend_at
                              ? undefined
                              : `You can resend after ${formatDateTime(invite.can_resend_at)}`
                          }
                          onClick={() => void resend(invite)}
                        >
                          <Send className="mr-1 h-4 w-4" />
                          Resend
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmCancelId(invite.id)}>
                          <X className="mr-1 h-4 w-4" />
                          Cancel invitation
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {pending && !invite.can_resend && invite.can_resend_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  You can resend once every 24 hours (next after {formatDateTime(invite.can_resend_at)}).
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type SectionProps = {
  selfEmail?: string | null;
  /** Show the prominent prompt (e.g. the faculty search found nobody). */
  supervisorNotFound?: boolean;
  /** Text the student typed in the faculty search, used to pre-fill the email when it looks like one. */
  searchQuery?: string;
  onFacultyOnPortal?: (email: string) => void;
  formOpen?: boolean;
  onFormOpenChange?: (open: boolean) => void;
};

/** Invite prompt + form + the student's pending invitations, for the wallet link page. */
export default function SupervisorInviteSection({
  selfEmail,
  supervisorNotFound = false,
  searchQuery = "",
  onFacultyOnPortal,
  formOpen: formOpenProp,
  onFormOpenChange,
}: SectionProps) {
  const [invites, setInvites] = useState<SupervisorInvite[]>([]);
  const [limits, setLimits] = useState<SupervisorInviteLimits>(DEFAULT_INVITE_LIMITS);
  const [formOpenState, setFormOpenState] = useState(false);
  const formOpen = formOpenProp ?? formOpenState;
  const setFormOpen = (open: boolean) => {
    setFormOpenState(open);
    onFormOpenChange?.(open);
  };

  const load = useCallback(async () => {
    const res = await apiClient.getSupervisorInvites();
    if (res.error || !res.data) return;
    setInvites(res.data.invites || []);
    if (res.data.limits) setLimits({ ...DEFAULT_INVITE_LIMITS, ...res.data.limits });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = (invite: SupervisorInvite) =>
    setInvites((prev) => [invite, ...prev.filter((i) => i.id !== invite.id)]);

  const prefill = searchQuery.includes("@") ? searchQuery.trim() : "";

  return (
    <div className="space-y-4" data-testid="supervisor-invite-section">
      {!formOpen && (
        <div
          className={
            supervisorNotFound
              ? "rounded-lg border-2 border-primary/40 bg-primary/5 p-4"
              : "rounded-lg border border-dashed p-4"
          }
        >
          <p className="text-sm font-medium text-foreground">
            {supervisorNotFound ? "Can't find your supervisor?" : "Supervisor not in the list?"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The search only shows faculty who have signed in to this portal at least once. You can invite your
            supervisor by email instead.
          </p>
          <Button type="button" className="mt-3" variant={supervisorNotFound ? "default" : "outline"} onClick={() => setFormOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Invite your supervisor
          </Button>
        </div>
      )}

      {formOpen && (
        <SupervisorInviteForm
          selfEmail={selfEmail}
          limits={limits}
          initialEmail={prefill}
          onCancel={() => setFormOpen(false)}
          onFacultyOnPortal={onFacultyOnPortal}
          onSent={(invite) => {
            upsert(invite);
            setFormOpen(false);
          }}
        />
      )}

      <SupervisorInviteList invites={invites} onChanged={upsert} />
    </div>
  );
}
