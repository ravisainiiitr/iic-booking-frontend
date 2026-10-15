import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCopy, Loader2, Sparkles, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { TicketTriageResponse } from "@/lib/automationTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ROUTE_LABEL: Record<string, string> = {
  oic: "Officer in Charge",
  operator: "Lab operator",
  admin: "Support team",
};

const TYPE_LABEL: Record<string, string> = {
  payment: "Payment",
  account: "Account",
  laboratory: "Laboratory",
  equipment: "Equipment",
  booking: "Booking",
  technical: "Technical",
  quality_improvement: "Quality improvement",
  general: "General",
};

type Props = {
  ticketId: number;
  /** Puts the draft in the reply box; the member of staff edits and sends it. */
  onUseDraft: (text: string) => void;
  onApplied?: () => void;
};

export default function TicketTriageCard({ ticketId, onUseDraft, onApplied }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<TicketTriageResponse | null>(null);
  const [busy, setBusy] = useState<"accept" | "dismiss" | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.ticketTriage(ticketId);
    setData(res.data ?? null);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data?.enabled || !data.topic || data.status === "dismissed") return null;

  const decide = async (accept: boolean) => {
    setBusy(accept ? "accept" : "dismiss");
    const res = await apiClient.ticketTriageDecision(ticketId, { accept });
    setBusy(null);
    if (res.error || !res.data) {
      toast({ title: "Could not save", description: res.error || "Try again.", variant: "destructive" });
      return;
    }
    setData(res.data);
    toast({ title: accept ? "Suggestion applied" : "Suggestion dismissed" });
    if (accept) onApplied?.();
  };

  const accepted = data.status === "accepted";
  const pct = Math.round((data.confidence ?? 0) * 100);

  return (
    <section
      className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20"
      aria-label="Suggested handling"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Suggested handling
        </h3>
        <div className="flex items-center gap-1.5">
          {accepted && <Badge variant="secondary">Accepted{data.decided_by ? ` by ${data.decided_by}` : ""}</Badge>}
          <Badge variant="outline" title="How sure the rules are">
            {pct}% sure
          </Badge>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd>{TYPE_LABEL[data.category ?? ""] ?? data.category}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Priority</dt>
          <dd className="capitalize">{data.priority}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Handled by</dt>
          <dd>
            {data.suggested_assignee?.name ?? ROUTE_LABEL[data.route_role ?? ""] ?? "Support team"}
            {data.suggested_assignee && data.route_role ? (
              <span className="text-muted-foreground"> ({ROUTE_LABEL[data.route_role] ?? data.route_role})</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Equipment</dt>
          <dd>{data.equipment ? data.equipment.code || data.equipment.name : "—"}</dd>
        </div>
      </dl>
      {data.reasons && data.reasons.length > 0 && (
        <p className="text-xs text-muted-foreground">Why: {data.reasons.join(" · ")}</p>
      )}
      {data.reply_draft && (
        <div className="rounded-lg border bg-background p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Reply draft
              {data.draft_sources?.[0]?.type === "copilot_answer" ? ` (from approved answer “${data.draft_sources[0].title}”)` : ""}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.reply_draft}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {data.reply_draft && (
          <Button type="button" size="sm" variant="outline" onClick={() => onUseDraft(data.reply_draft ?? "")}>
            <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
            Use draft
          </Button>
        )}
        {!accepted && (
          <>
            <Button type="button" size="sm" onClick={() => void decide(true)} disabled={busy !== null}>
              {busy === "accept" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Accept
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void decide(false)} disabled={busy !== null}>
              {busy === "dismiss" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
              Dismiss
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Accept sets the type, priority and handler. The draft is never sent by itself: Use draft puts it in the reply box.
      </p>
    </section>
  );
}
