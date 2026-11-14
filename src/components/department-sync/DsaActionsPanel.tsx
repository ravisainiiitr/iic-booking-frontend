import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type DsaFleetDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { CheckIcon } from "./DsaTraceBits";
import { ACTION_HELP, actionKeyFor, commandOutcome, exactTime, formatBytes, relativeTime } from "./dsaTrace";

/** Remote actions with their latest result next to each button, and the full history below. */
export function DsaActionsPanel({
  detail,
  only,
  onDone,
  compact,
}: {
  detail: DsaFleetDetail;
  only?: string[];
  onDone: () => void;
  compact?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const retired = Boolean(detail.agent.retired);
  const actions = detail.actions.filter((a) => !only || only.includes(a.key));

  const run = async (key: string, label: string) => {
    const name = detail.agent.agent_name;
    if (key === "restart_service" && !window.confirm(`Restart the Department Sync Agent service on ${name}? Uploads resume after restart.`)) {
      return;
    }
    setBusy(key);
    let res = await apiClient.runDepartmentSyncFleetAction(detail.agent.id, key, reason.trim(), false);
    if (res.error && key === "restart_service" && /less than/i.test(res.error)) {
      if (window.confirm(`${res.error} Send it anyway?`)) {
        res = await apiClient.runDepartmentSyncFleetAction(detail.agent.id, key, reason.trim(), true);
      }
    }
    setBusy("");
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${label} sent. The agent picks it up within a minute.`);
    setReason("");
    onDone();
  };

  const download = async (bundleId: string, fileName: string) => {
    const res = await apiClient.getDepartmentSyncBundleBlob(bundleId);
    if (!res.blob) {
      toast.error(res.error || "Download failed.");
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "dsa-support.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestFor = (key: string) => detail.commands.find((c) => actionKeyFor(c.command_type) === key);
  const history = detail.commands.filter((c) => !only || only.includes(actionKeyFor(c.command_type)));

  return (
    <div className="space-y-3">
      {retired ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          This agent is retired. Remote actions are disabled; history is kept for reference.
        </p>
      ) : (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (recorded in the audit log)"
          maxLength={300}
          className="rounded-xl"
        />
      )}
      <ul className="space-y-2" aria-label="Remote actions">
        {actions.map((a) => {
          const last = latestFor(a.key);
          const outcome = last ? commandOutcome(last) : null;
          return (
            <li key={a.key} className="rounded-xl border border-border/60 p-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.label}</p>
                  {!compact ? <p className="text-xs text-muted-foreground">{ACTION_HELP[a.key]}</p> : null}
                  {last && outcome ? (
                    <p className="mt-1 flex items-start gap-1.5 text-xs" data-testid={`action-result-${a.key}`}>
                      <CheckIcon state={outcome.state} className="mt-px h-3.5 w-3.5" />
                      <span>
                        <span className="font-medium">{last.status.toLowerCase()}</span> {relativeTime(last.created_at)} ·{" "}
                        {outcome.text}
                      </span>
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={a.key === "restart_service" ? "destructive" : "outline"}
                  disabled={retired || !a.supported || Boolean(busy)}
                  title={a.supported ? ACTION_HELP[a.key] : "Update this agent to use this action"}
                  onClick={() => void run(a.key, a.label)}
                  aria-label={a.label}
                >
                  {busy === a.key ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  {a.supported ? "Run" : "Needs update"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {!detail.agent.diagnostics_supported ? (
        <p className="text-xs text-muted-foreground">
          This agent version sends no remote diagnostics; some actions need DSA 1.0.7 or later.
        </p>
      ) : null}

      {!compact ? (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</p>
            {history.length ? (
              <ol className="space-y-1.5 border-l border-border pl-3 text-xs" aria-label="Action history">
                {history.slice(0, 15).map((c) => {
                  const o = commandOutcome(c);
                  return (
                    <li key={c.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[17px] top-1 h-2 w-2 rounded-full",
                          o.state === "pass" ? "bg-emerald-500" : o.state === "fail" ? "bg-red-500" : o.state === "warn" ? "bg-amber-500" : "bg-muted-foreground/50",
                        )}
                        aria-hidden
                      />
                      <span className="font-medium">{c.command_type}</span>{" "}
                      <span className="text-muted-foreground" title={exactTime(c.created_at)}>
                        · {c.status.toLowerCase()} · {relativeTime(c.created_at)}
                        {c.created_by ? ` · ${c.created_by}` : ""}
                      </span>
                      <span className="block">{o.text}</span>
                      {c.reason ? <span className="block text-muted-foreground">Reason: {c.reason}</span> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No actions sent yet.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Support bundles</p>
            {detail.bundles.length ? (
              <ul className="space-y-1 text-sm">
                {detail.bundles.map((b) => (
                  <li key={b.id} className="min-w-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 max-w-full justify-start px-2"
                      onClick={() => void download(b.id, b.file_name)}
                      title={b.file_name}
                    >
                      <Download className="mr-1 h-3.5 w-3.5 shrink-0" /> <span className="truncate">{b.file_name}</span>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(b.size_bytes)} · {relativeTime(b.created_at)}
                      {b.truncated ? " · trimmed" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Use “Collect support bundle” to fetch redacted logs and diagnostics.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
