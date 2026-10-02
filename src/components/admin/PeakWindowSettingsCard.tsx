import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient, type PeakWindowSettings } from "@/lib/api";
import { formatPeakClock, refreshPeakStatus } from "@/lib/peakWindow";

type Form = Omit<PeakWindowSettings, "updated_at" | "status">;

const LIMITS = { lead_minutes: 120, trail_minutes: 240, external_notice_minutes: 240 } as const;

function describeWindow(s: PeakWindowSettings["status"]): string {
  if (!s) return "";
  if (s.peak_window_active && s.starts_at && s.ends_at) {
    return `A peak window is open now (${formatPeakClock(s.starts_at)} – ${formatPeakClock(s.ends_at)}).`;
  }
  const w = s.next_window;
  if (!w) return "No upcoming slot opening is configured.";
  const day = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(w.starts_at));
  return `Next window: ${day}, ${formatPeakClock(w.starts_at)} – ${formatPeakClock(w.ends_at)} (opening ${formatPeakClock(w.opening_at)}).`;
}

/** Main-admin controls for the weekly slot-opening peak window. */
export default function PeakWindowSettingsCard() {
  const [form, setForm] = useState<Form | null>(null);
  const [status, setStatus] = useState<PeakWindowSettings["status"]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getPeakWindowSettings().then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error || "Could not load peak window settings.");
        return;
      }
      const { status: st, updated_at: _u, ...rest } = res.data;
      setForm(rest);
      setStatus(st);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    for (const [key, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
      const v = Number(form[key]);
      if (!Number.isInteger(v) || v < 0 || v > max) {
        toast.error(`Minutes must be a whole number between 0 and ${max}.`);
        return;
      }
    }
    setSaving(true);
    const res = await apiClient.updatePeakWindowSettings(form);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save peak window settings.");
      return;
    }
    const { status: st, updated_at: _u, ...rest } = res.data;
    setForm(rest);
    setStatus(st);
    toast.success("Peak window settings saved.");
    void refreshPeakStatus();
  };

  const minutesField = (key: keyof typeof LIMITS, label: string, help: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`peak-${key}`}>{label}</Label>
      <Input
        id={`peak-${key}`}
        type="number"
        min={0}
        max={LIMITS[key]}
        value={form ? form[key] : ""}
        onChange={(e) => set(key, Number(e.target.value))}
        className="max-w-[120px]"
        aria-describedby={`peak-${key}-help`}
      />
      <p id={`peak-${key}-help`} className="text-xs text-muted-foreground">
        {help}
      </p>
    </div>
  );

  const toggle = (key: "enabled" | "block_external_users" | "defer_background_tasks", label: string, help: string) => (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label htmlFor={`peak-${key}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch id={`peak-${key}`} checked={Boolean(form?.[key])} onCheckedChange={(v) => set(key, v)} />
    </div>
  );

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Peak booking window
        </CardTitle>
        <CardDescription>
          Around each weekly slot opening, internal users go straight to booking from the catalog and external users are
          paused. The window runs from the opening time minus the lead minutes to the opening time plus the trail minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !form ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            {status ? <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{describeWindow(status)}</p> : null}
            {toggle("enabled", "Peak window on", "Turn the whole feature on or off.")}
            <div className="grid gap-4 sm:grid-cols-3">
              {minutesField("lead_minutes", "Minutes before opening", "Default 5.")}
              {minutesField("trail_minutes", "Minutes after opening", "Default 15.")}
              {minutesField("external_notice_minutes", "External notice (min)", "Banner shown before the window. Default 30.")}
            </div>
            {toggle(
              "block_external_users",
              "Pause external users",
              "External, Industry, R&D and other non-IITR users cannot sign in or use the portal during the window. Admins, OICs and staff are never paused.",
            )}
            {toggle(
              "defer_background_tasks",
              "Defer background jobs",
              "Reminder emails, reports and other scheduled jobs wait until the window ends.",
            )}
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
