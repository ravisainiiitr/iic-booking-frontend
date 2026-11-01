import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Loader2, Phone } from "lucide-react";

import { apiClient, type CallInfo } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useCalls } from "@/components/calls/CallProvider";
import { formatDuration } from "@/components/calls/CallScreen";
import { cn } from "@/lib/utils";

const OUTCOME_TONE: Record<string, string> = {
  ended: "text-emerald-700 dark:text-emerald-300",
  declined: "text-amber-700 dark:text-amber-300",
  missed: "text-rose-700 dark:text-rose-300",
  busy: "text-amber-700 dark:text-amber-300",
  failed: "text-rose-700 dark:text-rose-300",
};

function contextLink(c: CallInfo) {
  return c.context_type === "equipment" ? `/equipment/${c.context_id}` : "/my-bookings";
}

/** /calls: the user's own calls (no audio is ever stored). /calls/answer/:id answers a call from the phone's screen. */
export default function CallHistory() {
  const { callId } = useParams<{ callId?: string }>();
  const navigate = useNavigate();
  const { engine } = useCalls();
  const [rows, setRows] = useState<CallInfo[] | null>(null);

  useEffect(() => {
    if (callId && engine) {
      void engine.answerById(callId).finally(() => navigate("/calls", { replace: true }));
    }
  }, [callId, engine, navigate]);

  useEffect(() => {
    void apiClient.getCallHistory().then((r) => setRows(r.data?.results ?? []));
  }, [engine?.state.phase]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-3xl px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Phone className="h-6 w-6" aria-hidden /> Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your calls with lab staff through the portal. Calls are not recorded.</p>
        {rows === null ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 rounded-xl border p-6 text-center text-sm text-muted-foreground">No calls yet. Use “Call Lab Operator” on a booking or an instrument page.</p>
        ) : (
          <ul className="mt-5 divide-y rounded-xl border">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-label={c.direction === "incoming" ? "Incoming" : "Outgoing"}>
                  {c.direction === "incoming" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.other.name} <span className="font-normal text-muted-foreground">· {c.role_label}</span></p>
                  <p className="truncate text-xs text-muted-foreground">
                    <Link to={contextLink(c)} className="hover:underline">{c.context_label}</Link> · {new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className={cn("shrink-0 text-xs font-medium", OUTCOME_TONE[c.status] ?? "text-muted-foreground")}>
                  {c.status === "ended" ? formatDuration(c.duration_seconds) : c.status_display}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
