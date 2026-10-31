import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  ExternalBookingApiError,
  describeWindow,
  externalBookingApi,
  formatDay,
  formatInstant,
  type PolicyTextInfo,
  type ServicesSettings,
  type WindowAdminPayload,
  type WindowRange,
} from "@/lib/externalBookingApi";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REASON_MIN = 10;

/** ISO instant -> "YYYY-MM-DDTHH:MM" in IST for a datetime-local input. */
export function isoToIstLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function rangeText(r: WindowRange | null | undefined): string {
  if (!r || r.enabled === false) return "Off (previous per-equipment rule)";
  if (!r.is_open || !r.first_date || !r.last_date) return "Closed";
  return `${formatDay(r.first_date)} to ${formatDay(r.last_date)}`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

function WindowCard() {
  const [data, setData] = useState<WindowAdminPayload | null>(null);
  const [form, setForm] = useState({ initial_open_at: "", first_week_start: "", initial_weeks: "4", expansion_weekday: "2", expansion_time: "21:00", min_lead_days: "0", enabled: false });
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ range_before: WindowRange; range_after: WindowRange; range_if_enabled: WindowRange } | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirmReduction, setConfirmReduction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [advanceWeeks, setAdvanceWeeks] = useState("1");

  const apply = (d: WindowAdminPayload) => {
    setData(d);
    setForm({
      initial_open_at: isoToIstLocal(d.config.initial_open_at),
      first_week_start: d.config.first_week_start ?? "",
      initial_weeks: String(d.config.initial_weeks),
      expansion_weekday: String(d.config.expansion_weekday),
      expansion_time: d.config.expansion_time ?? "21:00",
      min_lead_days: String(d.config.min_lead_days),
      enabled: d.config.enabled,
    });
  };
  const load = useCallback(() => {
    externalBookingApi.adminWindow().then(apply).catch((e) => toast.error(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const change = () => ({
    initial_open_at: form.initial_open_at ? `${form.initial_open_at}:00+05:30` : null,
    first_week_start: form.first_week_start || null,
    initial_weeks: Number(form.initial_weeks),
    expansion_weekday: Number(form.expansion_weekday),
    expansion_time: form.expansion_time,
    min_lead_days: Number(form.min_lead_days),
    enabled: form.enabled,
  });

  const doPreview = async () => {
    try {
      setPreview(await externalBookingApi.previewWindow(change()));
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      apply(await externalBookingApi.updateWindow({ ...change(), reason: reason.trim(), confirm_reduction: confirmReduction }));
      toast.success("External booking window saved.");
      setReason("");
      setPreview(null);
      setNeedsConfirm(false);
      setConfirmReduction(false);
    } catch (err) {
      if (err instanceof ExternalBookingApiError && err.code === "reduction_needs_confirmation") setNeedsConfirm(true);
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const simple = async (fn: () => Promise<WindowAdminPayload>, done: string) => {
    if (reason.trim().length < REASON_MIN) {
      toast.error(`Give a reason of at least ${REASON_MIN} characters.`);
      return;
    }
    setBusy(true);
    try {
      apply(await fn());
      toast.success(done);
      setReason("");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const w = data.window;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          External booking window
          <Badge variant="outline">{data.config.enabled ? (w.is_open ? "On" : "On · not open yet") : "Off"}</Badge>
        </CardTitle>
        <CardDescription>
          Dates external users may book ordinarily. Internal users are not affected. Times are IST. Correct mistakes here; every change is recorded with the dates it opens or closes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-1 sm:grid-cols-[220px_1fr]">
          <dt className="font-medium">Open now</dt>
          <dd>{rangeText(w)}</dd>
          <dt className="font-medium">Next opening</dt>
          <dd>{w.enabled && w.next_expansion_at ? `${formatInstant(w.next_expansion_at)} (week of ${formatDay(w.next_week_start)})` : w.enabled && !w.is_open ? formatInstant(w.opens_at) : "—"}</dd>
          <dt className="font-medium">Weekly expansion</dt>
          <dd>{data.config.auto_expand ? "Running" : "Paused"}</dd>
          <dt className="font-medium">Last week prepared</dt>
          <dd>{data.openings[0] ? `${formatDay(data.openings[0].week_start)} (slots ${data.openings[0].slots_prepared_at ? "ready" : "pending"})` : "—"}</dd>
          <dt className="font-medium">What users see</dt>
          <dd>{describeWindow(w) || "The previous per-equipment rule."}</dd>
        </dl>

        <form className="space-y-3" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="xw-open">Initial opening (IST)</Label>
              <Input id="xw-open" type="datetime-local" value={form.initial_open_at} onChange={(e) => setForm({ ...form, initial_open_at: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="xw-first">First week starts (Monday)</Label>
              <Input id="xw-first" type="date" value={form.first_week_start} onChange={(e) => setForm({ ...form, first_week_start: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="xw-weeks">Weeks at opening</Label>
              <Input id="xw-weeks" type="number" min={1} max={26} value={form.initial_weeks} onChange={(e) => setForm({ ...form, initial_weeks: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="xw-day">Weekly expansion day</Label>
              <Select value={form.expansion_weekday} onValueChange={(v) => setForm({ ...form, expansion_weekday: v })}>
                <SelectTrigger id="xw-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="xw-time">Expansion time (IST)</Label>
              <Input id="xw-time" type="time" value={form.expansion_time} onChange={(e) => setForm({ ...form, expansion_time: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="xw-lead">Minimum lead (days)</Label>
              <Input id="xw-lead" type="number" min={0} max={60} value={form.min_lead_days} onChange={(e) => setForm({ ...form, min_lead_days: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="xw-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <Label htmlFor="xw-enabled">Apply this window to external users</Label>
          </div>
          {preview ? (
            <p className="rounded-md border p-2" aria-live="polite">
              Now: {rangeText(preview.range_before)}. After saving: {rangeText(preview.range_after)}.
              {!form.enabled ? ` If enabled: ${rangeText(preview.range_if_enabled)}.` : ""}
            </p>
          ) : null}
          {needsConfirm ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:bg-amber-950">
              <Checkbox id="xw-confirm" checked={confirmReduction} onCheckedChange={(v) => setConfirmReduction(v === true)} />
              <Label htmlFor="xw-confirm">I understand this closes dates that are open now. Existing bookings are not cancelled.</Label>
            </div>
          ) : null}
          <div>
            <Label htmlFor="xw-reason">Reason for the change</Label>
            <Textarea id="xw-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Schedule approved by IIC on …" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={doPreview}>
              Preview dates
            </Button>
            <Button type="submit" disabled={busy || reason.trim().length < REASON_MIN}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
            {data.config.auto_expand ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => simple(() => externalBookingApi.pauseWindow(reason.trim()), "Weekly expansion paused.")}>
                Pause weekly expansion
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={busy} onClick={() => simple(() => externalBookingApi.resumeWindow(reason.trim()), "Weekly expansion resumed.")}>
                Resume weekly expansion
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Label htmlFor="xw-advance" className="sr-only">
                Weeks to open early
              </Label>
              <Input id="xw-advance" type="number" min={1} max={8} className="w-16" value={advanceWeeks} onChange={(e) => setAdvanceWeeks(e.target.value)} />
              <Button type="button" variant="outline" disabled={busy || !w.is_open} onClick={() => simple(() => externalBookingApi.advanceWindow(Number(advanceWeeks), reason.trim()), "Weeks opened.")}>
                Open weeks now
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Pausing keeps the weeks already open. Weeks that would have opened while paused are not opened later. “Open weeks now” adds weeks on top of the weekly schedule.</p>
        </form>

        <div>
          <p className="mb-1 font-medium">Change history</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Open dates before → after</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No changes yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatInstant(h.created_at)}</TableCell>
                    <TableCell>{h.action_label}</TableCell>
                    <TableCell>{h.actor ?? "—"}</TableCell>
                    <TableCell>
                      {rangeText(h.range_before)} → {rangeText(h.range_after)}
                    </TableCell>
                    <TableCell>{h.reason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const SWITCHES: Array<{ key: keyof ServicesSettings; label: string; help: string }> = [
  { key: "special_requests_enabled", label: "Special booking requests", help: "External users may ask for dates outside the open window." },
  { key: "special_request_surcharge", label: "Urgent surcharge on special requests", help: "Policy decision: off until approved." },
  { key: "invoice_requests_enabled", label: "GST invoice requests", help: "Users choose invoice timing; requests are queued for SRIC." },
  { key: "early_invoice_allowed", label: "Early GST invoice option", help: "Needs the approved early-invoice disclosure." },
  { key: "auto_request_without_preference", label: "Request invoices without a stated preference", help: "After analysis, also for users who never chose." },
  { key: "physical_copies_enabled", label: "Printed invoice copies by Speed Post", help: "" },
  { key: "sample_labels_enabled", label: "Sample shipment labels (booking ID, TO and FROM with mobiles)", help: "Downloaded with the filled requisition form as one PDF." },
  {
    key: "cancellation_policy_enabled",
    label: "Cancellation penalties and bank refunds",
    help: "Users cancel with the fixed penalties below; after a lab disruption they choose wallet or bank refund (sent to SRIC weekly).",
  },
];

function SettingsCard() {
  const [settings, setSettings] = useState<ServicesSettings | null>(null);
  const [policies, setPolicies] = useState<Record<string, PolicyTextInfo[]>>({});
  const [draft, setDraft] = useState<Partial<ServicesSettings>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [policyKey, setPolicyKey] = useState("short_notice");
  const [policyText, setPolicyText] = useState("");
  const [policyApproved, setPolicyApproved] = useState(false);
  const [policyNote, setPolicyNote] = useState("");

  const load = useCallback(() => {
    externalBookingApi
      .settings()
      .then((d) => {
        setSettings(d.settings);
        setPolicies(d.policies);
        setDraft({});
      })
      .catch((e) => toast.error(errorText(e)));
  }, []);
  useEffect(load, [load]);
  if (!settings) return null;
  const value = <K extends keyof ServicesSettings>(k: K): ServicesSettings[K] => (k in draft ? (draft[k] as ServicesSettings[K]) : settings[k]);

  const save = async () => {
    setBusy(true);
    try {
      await externalBookingApi.updateSettings({ ...draft, reason: reason.trim() });
      toast.success("Settings saved.");
      setReason("");
      load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const addPolicy = async () => {
    try {
      await externalBookingApi.addPolicy(policyKey, policyText.trim(), policyApproved, policyNote.trim());
      toast.success("New wording version added.");
      setPolicyText("");
      setPolicyNote("");
      setPolicyApproved(false);
      load();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">External services</CardTitle>
        <CardDescription>Every feature is off until switched on here. Changes need a reason and are recorded.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-2">
          {SWITCHES.map((s) => (
            <li key={s.key} className="flex items-start gap-2">
              <Switch id={`xs-${s.key}`} checked={Boolean(value(s.key))} onCheckedChange={(v) => setDraft({ ...draft, [s.key]: v })} />
              <div>
                <Label htmlFor={`xs-${s.key}`}>{s.label}</Label>
                {s.help ? <p className="text-xs text-muted-foreground">{s.help}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="xs-open">Open special requests per user</Label>
            <Input id="xs-open" type="number" min={1} max={20} value={value("max_open_special_requests")} onChange={(e) => setDraft({ ...draft, max_open_special_requests: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-short">Short notice under (days)</Label>
            <Input id="xs-short" type="number" min={1} max={60} value={value("short_notice_days")} onChange={(e) => setDraft({ ...draft, short_notice_days: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-pay">Hours to pay after approval</Label>
            <Input id="xs-pay" type="number" min={1} max={168} value={value("payment_window_hours")} onChange={(e) => setDraft({ ...draft, payment_window_hours: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-free">No penalty more than (hours before)</Label>
            <Input id="xs-free" type="number" min={1} max={720} value={value("cancellation_free_hours") ?? 48} onChange={(e) => setDraft({ ...draft, cancellation_free_hours: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-half">No refund less than (hours before)</Label>
            <Input id="xs-half" type="number" min={0} max={720} value={value("cancellation_half_hours") ?? 24} onChange={(e) => setDraft({ ...draft, cancellation_half_hours: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-pen">Penalty in between (%)</Label>
            <Input id="xs-pen" type="number" min={0} max={100} value={value("cancellation_half_penalty_percent") ?? 50} onChange={(e) => setDraft({ ...draft, cancellation_half_penalty_percent: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="xs-mode">SRIC sending</Label>
            <Select value={value("sric_dispatch_mode")} onValueChange={(v) => setDraft({ ...draft, sric_dispatch_mode: v as ServicesSettings["sric_dispatch_mode"] })}>
              <SelectTrigger id="xs-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off (keep queued)</SelectItem>
                <SelectItem value="test">Test address</SelectItem>
                <SelectItem value="live">Live (SRIC)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="xs-sric">SRIC invoice desk email</Label>
            <Input id="xs-sric" type="email" value={value("sric_recipient_email")} onChange={(e) => setDraft({ ...draft, sric_recipient_email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="xs-test">Test email</Label>
            <Input id="xs-test" type="email" value={value("sric_test_recipient_email")} onChange={(e) => setDraft({ ...draft, sric_test_recipient_email: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="xs-address">IIC postal address for labels (one line per row)</Label>
          <Textarea id="xs-address" rows={5} value={value("iic_postal_address")} onChange={(e) => setDraft({ ...draft, iic_postal_address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="xs-reason">Reason</Label>
          <Textarea id="xs-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button type="button" disabled={busy || reason.trim().length < REASON_MIN || Object.keys(draft).length === 0} onClick={save}>
          Save settings
        </Button>

        <div className="space-y-2 border-t pt-3">
          <p className="font-medium">Wording users must accept</p>
          {Object.entries(policies).map(([key, versions]) => (
            <div key={key}>
              <p className="text-xs font-medium uppercase text-muted-foreground">{key === "short_notice" ? "Short-notice conditions" : "Early GST invoice disclosure"}</p>
              {versions.length === 0 ? (
                <p className="text-muted-foreground">No wording yet.</p>
              ) : (
                <p>
                  v{versions[0].version} · {versions[0].approved ? "approved" : "awaiting approval"} — {versions[0].text}
                </p>
              )}
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
            <Select value={policyKey} onValueChange={setPolicyKey}>
              <SelectTrigger aria-label="Which wording">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short_notice">Short-notice conditions</SelectItem>
                <SelectItem value="early_invoice">Early GST invoice disclosure</SelectItem>
              </SelectContent>
            </Select>
            <Textarea aria-label="New wording" value={policyText} onChange={(e) => setPolicyText(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox id="xs-approved" checked={policyApproved} onCheckedChange={(v) => setPolicyApproved(v === true)} />
            <Label htmlFor="xs-approved">Approved by the responsible office</Label>
            <Input aria-label="Approval note" placeholder="Approval reference" className="w-64" value={policyNote} onChange={(e) => setPolicyNote(e.target.value)} />
            <Button type="button" variant="outline" disabled={policyText.trim().length < 20} onClick={addPolicy}>
              Add as new version
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminExternalBooking() {
  const { user, loading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero title="External booking" description="The window in which external users can book, special requests, GST invoice requests to SRIC, printed copies and sample labels." />
        </StandaloneOnly>
        {loading ? null : !isAdmin ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">Only the Main Administrator can change these settings.</p>
        ) : (
          <>
            <WindowCard />
            <SettingsCard />
          </>
        )}
      </main>
    </PageShell>
  );
}
