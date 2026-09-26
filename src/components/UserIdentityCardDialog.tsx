import { useEffect, useState, type ReactNode } from "react";
import { Building2, GraduationCap, IdCard, Loader2, Mail, Phone, UserRound, UsersRound } from "lucide-react";

import { apiClient, type UserIdentityCard } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground break-words">{value?.trim() ? value : "—"}</div>
      </div>
    </div>
  );
}

type UserIdentityCardDialogProps = {
  userId: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackName?: string;
  fallbackEmail?: string;
  userNotes?: string | null;
};

export function UserIdentityCardDialog({
  userId,
  open,
  onOpenChange,
  fallbackName,
  fallbackEmail,
  userNotes,
}: UserIdentityCardDialogProps) {
  const [card, setCard] = useState<UserIdentityCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCard(null);
    setPhotoFailed(false);
    void apiClient.getUserIdentityCard(userId).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) setError(res.error || "Could not load user details.");
      else setCard(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const name = card?.name || fallbackName || fallbackEmail || "User";
  const email = card?.email || fallbackEmail || "";
  const photo = card?.profile_picture_url && !photoFailed ? card.profile_picture_url : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-muted/40">
          <DialogTitle className="flex items-center gap-2 text-base">
            <IdCard className="h-5 w-5 text-primary" />
            User identity card
          </DialogTitle>
          <DialogDescription className="sr-only">Contact and academic details of the requesting user.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4">
          {!userId ? (
            <p className="text-sm text-muted-foreground">User details are not available for this request.</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading user details…
            </div>
          ) : (
            <>
              {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-sky-500" />
                <div className="flex flex-col sm:flex-row gap-5 p-5">
                  <div className="flex sm:flex-col items-center gap-3 sm:w-40 shrink-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt={name}
                        className="h-32 w-28 sm:h-40 sm:w-36 rounded-lg object-cover border bg-muted"
                        onError={() => setPhotoFailed(true)}
                      />
                    ) : (
                      <div className="h-32 w-28 sm:h-40 sm:w-36 rounded-lg border bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center text-3xl font-semibold text-primary">
                        {initialsOf(name)}
                      </div>
                    )}
                    <div className="text-center space-y-0.5">
                      {card?.user_type_display ? (
                        <div className="text-xs font-medium text-muted-foreground">{card.user_type_display}</div>
                      ) : null}
                      {card?.emp_id ? <div className="text-xs font-mono text-muted-foreground">{card.emp_id}</div> : null}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 content-start">
                    <div className="sm:col-span-2">
                      <Field icon={<UserRound className="h-4 w-4" />} label="User name" value={name} />
                    </div>
                    <Field icon={<UsersRound className="h-4 w-4" />} label="Supervisor" value={card?.supervisor_name} />
                    <Field icon={<Building2 className="h-4 w-4" />} label="Department" value={card?.department_name} />
                    <Field icon={<GraduationCap className="h-4 w-4" />} label="Programme" value={card?.programme} />
                    <Field icon={<Phone className="h-4 w-4" />} label="Mobile number" value={card?.phone_number} />
                    <div className="sm:col-span-2">
                      <Field icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
                    </div>
                  </div>
                </div>
              </div>

              {userNotes?.trim() ? (
                <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">User notes</div>
                  <p className="text-sm whitespace-pre-wrap break-words">{userNotes}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RequesterButtonProps = {
  userId: number | null | undefined;
  name?: string;
  email?: string;
  userNotes?: string | null;
  showEmail?: boolean;
  className?: string;
};

export function RequesterIdentityButton({
  userId,
  name,
  email,
  userNotes,
  showEmail = true,
  className,
}: RequesterButtonProps) {
  const [open, setOpen] = useState(false);
  const label = name || email || "—";
  if (!userId) {
    return (
      <div className={className}>
        <div className="font-medium">{label}</div>
        {showEmail && name && email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
      </div>
    );
  }
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
        title="View user details"
      >
        <div className="font-medium text-primary group-hover:underline inline-flex items-center gap-1">
          {label}
          <IdCard className="h-3.5 w-3.5 opacity-60" />
        </div>
        {showEmail && name && email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
      </button>
      <UserIdentityCardDialog
        userId={userId}
        open={open}
        onOpenChange={setOpen}
        fallbackName={name}
        fallbackEmail={email}
        userNotes={userNotes}
      />
    </span>
  );
}
