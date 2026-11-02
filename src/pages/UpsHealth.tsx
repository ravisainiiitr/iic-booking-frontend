import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BatteryCharging, Loader2, RefreshCw, Sparkles, Zap } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { apiClient, type UpsHealth as UpsHealthInfo, type UpsLevel, type UpsUnit } from "@/lib/api";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<UpsLevel, string> = {
  ok: "Healthy",
  watch: "Keep an eye on",
  attention: "Needs attention",
  urgent: "Urgent",
};

const LEVEL_TONE: Record<UpsLevel, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  watch: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  attention: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  urgent: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
};

function LevelBadge({ level }: { level: UpsLevel }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", LEVEL_TONE[level])}>
      {LEVEL_LABEL[level]}
    </span>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function value(v: number | null | undefined, unit: string, digits = 0) {
  return v === null || v === undefined ? "–" : `${v.toFixed(digits)}${unit}`;
}

function Detail({ unit }: { unit: UpsUnit }) {
  const [health, setHealth] = useState<UpsHealthInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await apiClient.getUpsHealth(unit.id);
    if (res.data) setHealth(res.data);
    else setError(res.error || "Could not load the health check.");
  }, [unit.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    const res = await apiClient.runUpsHealth(unit.id);
    setRunning(false);
    if (res.error) setError(res.error);
    else void load();
  };

  const a = health?.latest;
  const r = unit.latest;
  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{unit.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[unit.manufacturer, unit.model, unit.department].filter(Boolean).join(" · ")}
            {unit.equipment.length ? ` · powers ${unit.equipment.map((e) => e.name).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {a ? <LevelBadge level={a.level} /> : null}
          <Button variant="outline" size="sm" onClick={() => void runNow()} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Check now
          </Button>
        </div>
      </div>

      {!unit.map_verified ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          The readings of this UPS are not verified yet, so no notices are sent. The department administrator verifies the
          register map in the UPS settings.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Power", r ? (r.reachable ? (r.on_battery ? "On battery" : "Mains") : "Not reachable") : "–"],
          ["Battery", value(r?.battery_percent, "%")],
          ["Backup time", value(r?.runtime_minutes, " min")],
          ["Load", value(r?.load_percent, "%")],
          ["Input", value(r?.input_voltage, " V")],
          ["Output", value(r?.output_voltage, " V")],
          ["Temperature", value(r?.temperature_c, " °C")],
          ["Last reading", r ? `${when(r.read_at)}${r.stale ? " (old)" : ""}` : "–"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {health === null && !error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : null}

      {health && !a ? (
        <p className="mt-4 text-sm text-muted-foreground">No health check yet. It runs every hour, or press Check now.</p>
      ) : null}

      {a ? (
        <>
          <div className="mt-4 rounded-md border-l-4 border-amber-400 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <p className="text-sm">{a.summary}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {a.summary_source === "ai" ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
              {a.summary_source === "ai" ? "Written by the portal's AI assistant from the readings" : "Composed from the readings"}
              {" · "}checked {when(a.created_at)} · risk {a.risk_score}/100
            </p>
          </div>

          {a.findings.length ? (
            <ul className="mt-4 space-y-2">
              {a.findings.map((f) => (
                <li key={f.code} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.title}</span>
                    <LevelBadge level={f.level} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                  <p className="mt-1 text-sm"><span className="font-medium">What to do:</span> {f.action}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nothing needs attention.</p>
          )}
        </>
      ) : null}

      {health ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-1 text-sm font-semibold"><Zap className="h-4 w-4" aria-hidden /> Recent power cuts</h3>
            {health.power_events.length ? (
              <ul className="mt-2 divide-y rounded-md border text-sm">
                {health.power_events.slice(0, 8).map((e) => (
                  <li key={e.started_at + e.kind} className="flex justify-between gap-2 p-2">
                    <span>{e.kind === "on_battery" ? "On battery" : e.kind === "on_bypass" ? "On bypass" : "Fault"} · {when(e.started_at)}</span>
                    <span className="text-muted-foreground">
                      {e.ended_at ? `${e.minutes.toFixed(0)} min` : "ongoing"}
                      {e.start_battery_percent !== null && e.end_battery_percent !== null
                        ? ` · ${e.start_battery_percent.toFixed(0)}→${e.end_battery_percent.toFixed(0)}%`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">None in the last 90 days.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Notices sent</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {health.notify_officers
                ? `To ${health.officers.join(", ") || "nobody mapped"}.`
                : "Notices are off for this UPS."}
            </p>
            {health.notices.length ? (
              <ul className="mt-2 divide-y rounded-md border text-sm">
                {health.notices.map((n) => (
                  <li key={n.at} className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{when(n.at)}</span>
                      <LevelBadge level={n.level} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No health notices in the last 90 days.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** /ups-health: the UPS units powering the user's instruments, with the hourly AI health check. */
export default function UpsHealth() {
  const [params, setParams] = useSearchParams();
  const [units, setUnits] = useState<UpsUnit[] | null>(null);
  const [error, setError] = useState("");
  const selected = Number(params.get("ups")) || units?.[0]?.id;

  useEffect(() => {
    void apiClient.getUpsList().then((res) => {
      if (res.data) setUnits(res.data.results);
      else setError(res.error || "Could not load the UPS units.");
    });
  }, []);

  const unit = units?.find((u) => u.id === selected);
  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BatteryCharging className="h-6 w-6" aria-hidden /> UPS health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The UPS units powering your instruments. Every hour the portal checks each one for problems and early signs of
          trouble, and emails the Officers in Charge when something needs attention.
        </p>
        {error ? <p className="mt-6 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        {units === null && !error ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : null}
        {units && units.length === 0 ? (
          <p className="mt-8 rounded-xl border p-6 text-center text-sm text-muted-foreground">
            No UPS is linked to instruments you look after.
          </p>
        ) : null}
        {units && units.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr]">
            <nav aria-label="UPS units" className="space-y-2">
              {units.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setParams({ ups: String(u.id) })}
                  aria-current={u.id === selected ? "true" : undefined}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60",
                    u.id === selected && "border-primary bg-muted/60",
                  )}
                >
                  <span className="block font-medium">{u.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {u.health ? <LevelBadge level={u.health.level} /> : "Not checked yet"}
                  </span>
                </button>
              ))}
            </nav>
            {unit ? <Detail key={unit.id} unit={unit} /> : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
