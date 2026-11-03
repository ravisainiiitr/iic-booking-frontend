import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { apiClient, type AssistantTrialMetrics as Metrics } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const OUTCOME_LABELS: Record<string, string> = {
  action_suggested: "Answered with a next step",
  answered: "Answered",
  clarification: "Asked which one / to clarify",
  completed: "Completed (setting changed, booking made)",
  refused: "Refused (not allowed for the role)",
  not_found: "Nothing found",
  unrecognised: "Not understood (passed to the general assistant)",
  failure: "Error",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Main Administrator",
  dept_admin: "Department Administrator",
  oic: "Officer in Charge",
  lab: "Lab staff",
  accounts: "Accounts",
  user: "Booking users",
  student: "Students",
  faculty: "Faculty",
  external: "External users",
};

function intentLabel(intent: string): string {
  return intent.replace(/^assistant:?/, "").replace(/^portal:/, "page: ").replace(/_/g, " ") || "general";
}

function percent(rate: number | null): string {
  return rate == null ? "–" : `${Math.round(rate * 100)}%`;
}

/** IITR Assistant trial numbers for the Main Administrator: counts only, no message text is kept. */
export default function AssistantTrialMetrics({ days }: { days: number }) {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    apiClient.assistantTrialMetrics(days).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) setError(res.error || "Could not load the trial metrics.");
      else setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading trial metrics...
      </div>
    );
  }

  const outcomes = Object.entries(data.outcomes).sort((a, b) => b[1] - a[1]);
  const roles = Object.entries(data.roles).sort((a, b) => b[1] - a[1]);
  const tiles: Array<[string, string | number]> = [
    ["Assistant turns", data.turns],
    ["Understood", `${percent(data.recognition_rate)} (${data.recognised})`],
    ["Asked to clarify", data.outcomes.clarification ?? 0],
    ["Helpful / not helpful", `${data.feedback.up} / ${data.feedback.down}`],
  ];

  return (
    <section className="space-y-3" data-testid="assistant-trial-metrics">
      <div>
        <h3 className="text-base font-semibold">IITR Assistant trial</h3>
        <p className="text-xs text-muted-foreground">
          One count per assistant reply: what it understood and how the turn ended. Message text is not stored.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <CardDescription>{k}</CardDescription>
              <CardTitle className="text-2xl">{v}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How turns ended</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {outcomes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              outcomes.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="truncate">{OUTCOME_LABELS[k] ?? k.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.top_intents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              data.top_intents.slice(0, 12).map((row) => (
                <div key={row.intent} className="flex justify-between gap-2">
                  <span className="truncate">{intentLabel(row.intent)}</span>
                  <span className="text-muted-foreground">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Who used it</CardTitle>
            <CardDescription className="text-xs">
              Typed {data.sources.typed ?? 0} · buttons {data.sources.button ?? 0}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {roles.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              roles.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="truncate">{ROLE_LABELS[k] ?? k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
