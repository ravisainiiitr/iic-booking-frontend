import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, ToggleRight } from "lucide-react";
import { toast } from "sonner";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { formatWhen } from "@/components/courier/courierHelpers";
import { StatusBadge } from "@/components/courier/ShipmentStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { courierTrackingApi, type AdminOverview, type CourierSettings } from "@/lib/courierTrackingApi";

type NumericKey = {
  [K in keyof CourierSettings]: CourierSettings[K] extends number ? K : never;
}[keyof CourierSettings];
type BoolKey = { [K in keyof CourierSettings]: CourierSettings[K] extends boolean ? K : never }[keyof CourierSettings];

const NUMBER_FIELDS: [NumericKey, string, string][] = [
  ["monthly_quota_fallback", "Monthly quota (until the provider reports it)", "requests"],
  ["safety_reserve", "Reserve for first lookups and staff checks", "requests"],
  ["alert_threshold_percent", "Alert at usage", "%"],
  ["scheduled_interval_hours", "Check in-transit shipments every", "hours"],
  ["priority_interval_hours", "Check out-for-delivery / problem shipments every", "hours"],
  ["user_refresh_interval_hours", "User refresh at most every", "hours"],
  ["user_refresh_daily_limit", "User refreshes per day", "per user"],
  ["max_lookups_per_shipment", "Automatic checks per shipment", "max"],
  ["arrival_reminder_after_days", "Remind to choose an arrival method after", "days"],
  ["stalled_after_days", "Treat as not progressing after", "days"],
  ["reminder_interval_days", "Days between reminders", "days"],
  ["reminder_max_count", "Reminders per kind and booking", "max"],
];
const BOOL_FIELDS: [BoolKey, string][] = [
  ["scheduled_lookups_enabled", "Run scheduled checks (no live webhooks on the free plan)"],
  ["user_status_emails_enabled", "Send status emails to users who opted in"],
  ["staff_delivery_in_app", "Also notify staff in the portal when a delivery is reported (email is always sent)"],
];

export default function AdminCourierTracking() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [data, setData] = useState<AdminOverview | null>(null);
  const [draft, setDraft] = useState<Partial<CourierSettings>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await courierTrackingApi.adminOverview());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const changed = data
    ? (Object.keys(draft) as (keyof CourierSettings)[]).filter((k) => draft[k] !== data.settings[k])
    : [];

  const save = async () => {
    if (!data || changed.length === 0) return;
    if (reason.trim().length < 5) {
      toast.error("Give a reason of at least 5 characters.");
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(changed.map((k) => [k, draft[k]])) as Partial<CourierSettings>;
      const res = await courierTrackingApi.updateSettings({ ...payload, reason: reason.trim() });
      toast.success(res.message);
      setDraft({});
      setReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The action failed.");
    }
  };

  const value = <K extends keyof CourierSettings>(k: K): CourierSettings[K] | undefined =>
    (k in draft ? draft[k] : data?.settings[k]) as CourierSettings[K] | undefined;

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="Courier Tracking"
            description="TrackCourier.io usage, unresolved shipments, alerts and settings. Switch tracking on or off per department in Department Modules."
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-4 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Settings
            </Button>
          </PageHero>
        </StandaloneOnly>

        {authLoading ? null : !isAdmin ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">Only the Main Administrator can manage courier tracking.</p>
        ) : failed ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg border p-6 text-sm">
            The overview could not be loaded.
            <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
          </div>
        ) : !data ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            <section aria-labelledby="ct-usage" className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4 md:col-span-2">
                <h2 id="ct-usage" className="text-sm font-semibold">Tracking requests — {data.quota.period}</h2>
                <p className="mt-2 text-2xl font-semibold">
                  {data.quota.used} <span className="text-base font-normal text-muted-foreground">of {data.quota.quota}</span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0}
                  aria-valuemax={data.quota.quota} aria-valuenow={data.quota.used} aria-label="Monthly tracking requests used">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, data.quota.percent)}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.quota.remaining} left, {data.quota.reserve} kept in reserve. Quota from{" "}
                  {data.quota.quota_source === "provider" ? `the provider (${data.quota.plan || "plan unknown"}, ${formatWhen(data.quota.provider_seen_at)})` : "settings (the provider has not reported it yet)"}.
                  Local count {data.quota.local_consumed}{data.quota.provider_used != null ? `, provider count ${data.quota.provider_used}` : ""}.
                </p>
                {data.quota.blocked_outcome ? (
                  <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
                    Lookups are paused ({data.quota.blocked_outcome}).
                    {data.quota.blocked_outcome !== "QUOTA_EXCEEDED" ? (
                      <Button size="sm" variant="outline" onClick={() => {
                        const why = window.prompt("Reason for clearing the block (after fixing the key or account):") ?? "";
                        if (why.trim()) void act(() => courierTrackingApi.clearBlock(why.trim()), "Lookups resumed.");
                      }}>
                        Clear block
                      </Button>
                    ) : <span>It clears when the month ends.</span>}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 rounded-lg border p-4 text-sm">
                <p><Badge variant={data.configured ? "secondary" : "destructive"}>{data.configured ? "API key configured" : "No API key"}</Badge></p>
                <p><Badge variant="secondary">{data.webhooks_configured ? "Webhooks configured" : "No webhooks (scheduled checks)"}</Badge></p>
                <p>Active courier shipments: {data.counts.active_courier} ({data.counts.in_flight} in progress)</p>
                <p>Reported delivered, awaiting lab confirmation: {data.counts.delivery_reported_unconfirmed}</p>
                <p>Manual deliveries: {data.counts.manual}</p>
                <p>Departments with tracking on: {data.departments_enabled.length}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => navigate("/admin/department-modules")}>
                    <ToggleRight className="mr-1 h-4 w-4" aria-hidden="true" /> Department switches
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void act(() => courierTrackingApi.refreshCatalog(), "Courier list refreshed.")}>
                    <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" /> Refresh courier list
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Courier list updated {formatWhen(data.settings.catalog_refreshed_at)} (not counted against the quota).</p>
              </div>
            </section>

            {data.alerts.length ? (
              <section aria-labelledby="ct-alerts" className="space-y-2">
                <h2 id="ct-alerts" className="text-sm font-semibold">Alerts</h2>
                <ul className="space-y-2">
                  {data.alerts.map((a) => (
                    <li key={a.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span><Badge variant="outline" className="mr-2">{a.kind}</Badge>{a.message}</span>
                      <Button size="sm" variant="outline" onClick={() => void act(() => courierTrackingApi.resolveAlert(a.id), "Alert resolved.")}>
                        Mark resolved
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="ct-unresolved" className="space-y-2">
              <h2 id="ct-unresolved" className="text-sm font-semibold">Unresolved shipments ({data.unresolved.length})</h2>
              {data.unresolved.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.unresolved.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                      <span className="font-medium">Booking {a.booking_reference}</span>
                      <StatusBadge arrival={a} />
                      <span>{a.courier?.name} <span className="font-mono">{a.tracking_number}</span></span>
                      <span className="text-muted-foreground">{a.equipment.name}</span>
                      {a.problem ? <Badge variant="outline">{a.problem}</Badge> : null}
                      {a.expected_arrival_date ? <span className="text-muted-foreground">expected {a.expected_arrival_date}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="ct-failures" className="space-y-2">
              <h2 id="ct-failures" className="text-sm font-semibold">Recent lookup problems (30 days)</h2>
              {data.recent_failures.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.recent_failures.slice(0, 20).map((f, i) => (
                    <li key={`${f.at}-${i}`}>{formatWhen(f.at)} · {f.trigger} · {f.outcome}{f.code ? ` (${f.code})` : ""}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Webhook deliveries (30 days): {Object.entries(data.webhook_events).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(", ")}
              </p>
            </section>

            <section aria-labelledby="ct-settings" className="space-y-3 rounded-lg border p-4">
              <h2 id="ct-settings" className="text-sm font-semibold">Settings</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {NUMBER_FIELDS.map(([key, label, unit]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`ct-${key}`}>{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`ct-${key}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(value(key) ?? "")}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {BOOL_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Switch checked={Boolean(value(key))} onCheckedChange={(v) => setDraft((d) => ({ ...d, [key]: v }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct-reason">Reason for the change</Label>
                <Textarea id="ct-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </div>
              <Button onClick={() => void save()} disabled={saving || changed.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save {changed.length ? `(${changed.length} change${changed.length === 1 ? "" : "s"})` : ""}
              </Button>
            </section>

            <section aria-labelledby="ct-audit" className="space-y-2">
              <h2 id="ct-audit" className="text-sm font-semibold">History</h2>
              {data.audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.audit.slice(0, 30).map((h) => (
                    <li key={h.id}>
                      {formatWhen(h.created_at)} · {h.department || "All departments"} · {h.action} · {h.actor ?? "system"}
                      {h.reason ? ` — ${h.reason}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </PageShell>
  );
}
