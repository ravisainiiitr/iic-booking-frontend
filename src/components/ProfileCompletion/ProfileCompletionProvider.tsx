import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";

import { useAuth, type User } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  INDIAN_MOBILE_ERROR,
  INDIAN_MOBILE_HINT,
  isMobilePromptPath,
  isMobilePromptSnoozed,
  normalizeIndianMobile,
  snoozeMobilePrompt,
  userNeedsMobileNumber,
} from "@/lib/mobileNumber";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileCompletionContextValue {
  /** True while the "Complete your profile" prompt is due or open; other post-login dialogs wait for it. */
  blocking: boolean;
}

const ProfileCompletionContext = createContext<ProfileCompletionContextValue>({ blocking: false });

const OPEN_DELAY_MS = 500;

/**
 * After sign-in, asks users other than IIT Roorkee faculty (and Officers In Charge) who have no valid mobile number
 * to add one. "Remind me later" hides it until the next sign-in; once a valid number is saved it never shows again.
 */
export function ProfileCompletionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [, setSnoozeTick] = useState(0);

  const userId = user?.id ?? null;
  const token = apiClient.getToken();
  const due =
    isAuthenticated && userId != null && userNeedsMobileNumber(user) && !isMobilePromptSnoozed(userId, token);

  useEffect(() => {
    if (!due) {
      setOpen(false);
      return;
    }
    if (open || authLoading || !isMobilePromptPath(pathname)) return;
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [due, open, authLoading, pathname]);

  const remindLater = useCallback(() => {
    if (userId != null) snoozeMobilePrompt(userId, apiClient.getToken());
    setSnoozeTick((n) => n + 1);
    setOpen(false);
  }, [userId]);

  return (
    <ProfileCompletionContext.Provider value={{ blocking: due }}>
      {children}
      {due && (
        <ProfileCompletionDialog
          open={open}
          onRemindLater={remindLater}
          onOpenProfile={() => {
            remindLater();
            navigate("/profile");
          }}
          onSaved={(data) => {
            updateUser({ ...data, needs_mobile_number: false });
            setOpen(false);
            toast.success("Mobile number saved. Thank you for completing your profile.");
          }}
        />
      )}
    </ProfileCompletionContext.Provider>
  );
}

export function useProfileCompletion() {
  return useContext(ProfileCompletionContext);
}

type SavedUser = Partial<User>;

function ProfileCompletionDialog({
  open,
  onRemindLater,
  onOpenProfile,
  onSaved,
}: {
  open: boolean;
  onRemindLater: () => void;
  onOpenProfile: () => void;
  onSaved: (data: SavedUser) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeIndianMobile(value);
    if (!normalized) {
      setError(INDIAN_MOBILE_ERROR);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiClient.updateProfile({ phone_number: normalized });
      if (res.error || !res.data) {
        setError(res.error || "Could not save your mobile number. Please try again.");
        return;
      }
      onSaved({ ...res.data, phone_number: res.data.phone_number || normalized });
    } finally {
      setSaving(false);
    }
  };

  const describedBy = error ? "profile-prompt-mobile-error" : "profile-prompt-mobile-hint";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onRemindLater();
      }}
    >
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader className="items-center sm:items-start">
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle>Complete your profile</DialogTitle>
          <DialogDescription>
            Please add your mobile number so the IIC team can reach you quickly when something needs your attention.
          </DialogDescription>
        </DialogHeader>

        <form id="profile-prompt-form" onSubmit={submit} noValidate className="space-y-2">
          <Label htmlFor="profile-prompt-mobile">Mobile number</Label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              +91
            </span>
            <Input
              id="profile-prompt-mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={16}
              placeholder="98765 43210"
              className="rounded-l-none"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              disabled={saving}
            />
          </div>
          {error ? (
            <p id="profile-prompt-mobile-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p id="profile-prompt-mobile-hint" className="text-xs text-muted-foreground">
              {INDIAN_MOBILE_HINT}
            </p>
          )}
        </form>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onRemindLater} disabled={saving}>
              Remind me later
            </Button>
            <Button type="submit" form="profile-prompt-form" disabled={saving}>
              {saving ? "Saving…" : "Save mobile number"}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            We will ask again at your next sign-in until a number is saved.{" "}
            <button
              type="button"
              onClick={onOpenProfile}
              disabled={saving}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open full profile
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
