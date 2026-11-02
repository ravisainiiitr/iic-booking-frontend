import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarRange, CheckCircle2, KeyRound, Loader2, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type ProfileOnboarding as Onboarding, type ProfileOnboardingStep } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const LATER_KEY = "profile_onboarding_later";

const STEP_META: Record<ProfileOnboardingStep, { title: string; description: string; icon: typeof UserRound }> = {
  organisation: { title: "Your organisation", description: "Choose your State / Union Territory, then your organisation.", icon: Building2 },
  gender: { title: "Gender", description: "As on your identity documents.", icon: UserRound },
  mobile: { title: "Mobile number", description: "For booking updates and urgent messages from the lab.", icon: Phone },
  programme: { title: "Access validity", description: "Until when you need to book instruments (project or programme end).", icon: CalendarRange },
  password: { title: "Set a password", description: "For your next sign-in. Until then, sign in with a one-time code sent to your email.", icon: KeyRound },
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

function OrganisationStep({ hints, value, onChange, request, onRequest }: {
  hints: Onboarding["hints"];
  value: string;
  onChange: (departmentId: string) => void;
  /** Name of an unlisted organisation to ask the IIC office to add ("" = choosing from the list). */
  request: string;
  onRequest: (name: string, state: string) => void;
}) {
  const [states, setStates] = useState<Array<{ value: string; label: string }>>([]);
  const [state, setState] = useState(hints.state || "");
  const [orgs, setOrgs] = useState<Array<{ id: number; name: string }>>([]);
  const [search, setSearch] = useState(hints.organisation || "");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void apiClient.getIndianStates().then((r) => setStates(r.data?.states ?? []));
  }, []);

  useEffect(() => {
    if (!state) {
      setOrgs([]);
      return;
    }
    setLoading(true);
    void apiClient
      .getDepartments("external", false, hints.subcategory || undefined, state)
      .then((r) => {
        const list = (r.data?.departments ?? []).map((d) => ({ id: d.id, name: d.name }));
        setOrgs(list);
        const exact = hints.organisation ? list.find((d) => norm(d.name) === norm(hints.organisation!)) : undefined;
        if (exact) onChange(String(exact.id));
      })
      .finally(() => setLoading(false));
    // Only when the State/UT changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const words = norm(search).split(" ").filter(Boolean);
  const shown = orgs.filter((d) => words.every((w) => norm(d.name).includes(w))).slice(0, 50);

  return (
    <div className="space-y-3">
      {hints.organisation ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          On I-STEM: <span className="font-medium text-foreground">{hints.organisation}</span>
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="onb-state">State / Union Territory</Label>
        <select
          id="onb-state"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            onChange("");
            setAsking(false);
            onRequest("", e.target.value);
          }}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Select State / Union Territory</option>
          {states.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      {state ? (
        <div className="space-y-1.5">
          <Label htmlFor="onb-org-search">Organisation</Label>
          <Input id="onb-org-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organisation" />
          <div role="listbox" aria-label="Organisations" className="max-h-48 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
            ) : shown.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No organisation matches. Clear the search, or choose “My organisation is not listed” below.
              </p>
            ) : (
              shown.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="option"
                  aria-selected={value === String(d.id)}
                  onClick={() => {
                    onChange(String(d.id));
                    setAsking(false);
                    onRequest("", state);
                  }}
                  className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                    value === String(d.id) && "bg-primary/10 font-medium")}
                >
                  {d.name}
                  {value === String(d.id) ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> : null}
                </button>
              ))
            )}
          </div>
          {asking ? (
            <div className="space-y-1.5 rounded-md border border-dashed p-3">
              <Label htmlFor="onb-org-request">Organisation to add</Label>
              <Input
                id="onb-org-request"
                value={request}
                onChange={(e) => onRequest(e.target.value, state)}
                placeholder="Full name of your organisation"
              />
              <p className="text-xs text-muted-foreground">
                The IIC office adds it to the list and your account is moved to it. You can finish your profile meanwhile.
              </p>
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  setAsking(false);
                  onRequest("", state);
                }}
              >
                Choose from the list instead
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setAsking(true);
                onChange("");
                onRequest(search.trim() || hints.organisation || "", state);
              }}
            >
              My organisation is not listed
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Accounts created from a verified I-STEM account start without a password and may miss what the registration form
 * asks. This asks for each missing item, one at a time, and last for a password. "Later" hides it for this session.
 */
export default function ProfileOnboarding() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<Onboarding | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let later = false;
    try {
      later = sessionStorage.getItem(LATER_KEY) === String(user.id);
    } catch {
      /* storage blocked */
    }
    void apiClient.getOnboarding().then((r) => {
      if (!r.data?.required) return;
      setData(r.data);
      setTotal(r.data.steps.length);
      setValues({ ...r.data.values, mobile: r.data.values.mobile || "" });
      if (!later) setOpen(true);
    });
  }, [user?.id]);

  const step = data?.steps[0];
  const done = total - (data?.steps.length ?? 0);
  const meta = step ? STEP_META[step] : null;
  const set = (k: string) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const save = async () => {
    if (!step) return;
    setSaving(true);
    setError("");
    const payload: Record<string, string> =
      step === "organisation"
        ? values.org_request
          ? { request_organisation: "1", organisation_name: values.org_request, state: values.org_state || "" }
          : { department: values.department || "" }
        : step === "gender" ? { gender: values.gender || "" }
          : step === "mobile" ? { mobile: values.mobile || "" }
            : step === "programme" ? { program_start_date: values.program_start_date || "", program_end_date: values.program_end_date || "" }
              : { password: values.password || "", password_confirm: values.password_confirm || "" };
    const res = await apiClient.saveOnboardingStep(step, payload);
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error || "Not saved. Please try again.");
      return;
    }
    if (step === "organisation" && res.data.organisation_requested) {
      toast.success(`Sent to the IIC office to add: ${res.data.organisation_requested}`);
    }
    setData(res.data);
    if (!res.data.required) {
      setOpen(false);
      toast.success("Your profile is complete.");
      void refreshUser?.();
    }
  };

  const later = () => {
    try {
      if (user?.id) sessionStorage.setItem(LATER_KEY, String(user.id));
    } catch {
      /* storage blocked */
    }
    setOpen(false);
  };

  if (!data || !step || !meta) return null;
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
      <DialogContent className="max-w-md" data-testid="profile-onboarding">
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Complete your profile · step {done + 1} of {total}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
          </div>
          <DialogTitle className="flex items-center gap-2 pt-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden /> {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="py-1">
          {step === "organisation" ? (
            <OrganisationStep
              hints={data.hints}
              value={values.department || ""}
              onChange={set("department")}
              request={values.org_request || ""}
              onRequest={(name, state) => setValues((prev) => ({ ...prev, org_request: name, org_state: state }))}
            />
          ) : step === "gender" ? (
            <div role="radiogroup" aria-label="Gender" className="grid grid-cols-3 gap-2">
              {[["male", "Male"], ["female", "Female"], ["other", "Other"]].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={values.gender === v}
                  onClick={() => set("gender")(v)}
                  className={cn("rounded-md border px-3 py-2 text-sm", values.gender === v ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : step === "mobile" ? (
            <div className="space-y-1.5">
              <Label htmlFor="onb-mobile">Mobile number</Label>
              <Input id="onb-mobile" inputMode="numeric" value={values.mobile || ""} onChange={(e) => set("mobile")(e.target.value)} placeholder="10-digit mobile number" />
            </div>
          ) : step === "programme" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="onb-start">From (optional)</Label>
                <Input id="onb-start" type="date" value={values.program_start_date || ""} onChange={(e) => set("program_start_date")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onb-end">Until</Label>
                <Input id="onb-end" type="date" min={today} value={values.program_end_date || ""} onChange={(e) => set("program_end_date")(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Access for more than a year needs supporting documents before booking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="onb-password">Password</Label>
                <Input id="onb-password" type="password" autoComplete="new-password" value={values.password || ""} onChange={(e) => set("password")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onb-password2">Confirm password</Label>
                <Input id="onb-password2" type="password" autoComplete="new-password" value={values.password_confirm || ""} onChange={(e) => set("password_confirm")(e.target.value)} />
              </div>
            </div>
          )}
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={later}>Later</Button>
          <Button onClick={() => void save()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {data.steps.length === 1 ? "Finish" : "Save and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
