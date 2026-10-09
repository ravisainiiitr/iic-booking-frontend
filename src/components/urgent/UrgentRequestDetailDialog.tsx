import type { ReactNode } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Loader2, MessageSquareQuote, UserCheck, XCircle } from "lucide-react";
import type { UrgentRequestRequirement } from "@/lib/api";
import type { BookingInputFieldDef, BookingInputValues } from "@/lib/bookingInputDisplay";
import { bookingSampleSummary, formatSampleSummary } from "@/lib/sampleCount";
import { formatINRAmount } from "@/lib/money";
import { formatRequiredTime } from "@/components/booking/UrgentTypeBRequestPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type UrgentWalletCheck = {
  has_wallet: boolean;
  available: string;
  sufficient: boolean;
  shortfall: string;
  message: string;
};

export type UrgentHoldBookingSummary = {
  booking_id: string | number;
  real_booking_id?: number;
  total_charge: string | null;
  total_time_minutes: number;
  slot_times: Array<{ start: string | null; end: string | null; label?: string | null }>;
  input_values: Record<string, unknown>;
  input_values_by_key?: BookingInputValues;
  input_fields?: BookingInputFieldDef[];
  charge_breakdown?: Array<{ description: string; amount: number }> | null;
};

/** One urgent request as the list and detail endpoints return it (supervisor and OIC/Admin views). */
export type UrgentRequestDetailData = {
  id: number;
  request_type: string;
  user_id: number;
  user_name: string;
  user_email: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  requested_at: string | null;
  number_of_samples: number;
  slots_requested: number;
  duration_minutes: number | null;
  evidence_file_url: string | null;
  evidence_original_name: string;
  reviewer_comment?: string;
  wallet_approved_at: string | null;
  wallet_approved_by_name: string | null;
  wallet_notes: string;
  pending_wallet_approval: boolean;
  supervisor_approval_required?: boolean;
  supervisor_decision?: string;
  supervisor_name?: string | null;
  supervisor_decided_at?: string | null;
  requester_category?: string;
  wallet_check?: UrgentWalletCheck | null;
  status: string;
  admin_notes: string;
  decided_at: string | null;
  decided_by_name: string | null;
  expiry_at?: string | null;
  requester_approved_urgent_last_6_months?: Array<{ id: number; requested_at: string | null; decided_at: string | null }>;
  hold_booking_id: number | null;
  hold_booking_summary: UrgentHoldBookingSummary | null;
  requires_slot_allocation?: boolean;
  requirement?: UrgentRequestRequirement | null;
};

export type UrgentDecisionFacts = {
  samples: string;
  slots: number | null;
  requiredMinutes: number | null;
  amount: string | null;
};

/**
 * Samples, slots, time and amount worked out from what the user actually entered: the requirement for Type B
 * without slots, the held booking otherwise. The stored counters are only a fallback for old requests.
 */
export function urgentDecisionFacts(detail: UrgentRequestDetailData): UrgentDecisionFacts {
  const req = detail.requirement;
  const hold = detail.hold_booking_summary;
  if (req) {
    return {
      samples: formatSampleSummary(bookingSampleSummary(req.input_fields, req.input_values_by_key)),
      slots: req.required_slots ?? null,
      requiredMinutes: req.required_minutes ?? null,
      amount: req.estimated_charge ?? null,
    };
  }
  const storedSamples = detail.number_of_samples
    ? `${detail.number_of_samples} ${detail.number_of_samples === 1 ? "sample" : "samples"}`
    : "";
  if (hold) {
    const values = hold.input_fields?.length ? hold.input_values_by_key : undefined;
    return {
      samples: formatSampleSummary(bookingSampleSummary(hold.input_fields, values)) || storedSamples,
      slots: hold.slot_times?.length || null,
      requiredMinutes: hold.total_time_minutes || null,
      amount: hold.total_charge ?? null,
    };
  }
  return {
    samples: storedSamples,
    slots: detail.slots_requested || null,
    requiredMinutes: detail.duration_minutes ?? null,
    amount: null,
  };
}

const fmtDate = (iso: string | null | undefined, pattern = "dd MMM yyyy, HH:mm") => (iso ? format(new Date(iso), pattern) : "—");

export const URGENT_TYPE_LABELS: Record<string, string> = {
  NO_SLOT: "Type A · rush relief",
  REVIEWER_URGENT: "Type B · 50% surcharge",
};

function StatusBadge({ detail }: { detail: UrgentRequestDetailData }) {
  if (detail.status === "APPROVED") return <Badge className="bg-green-700 text-white hover:bg-green-700">Approved</Badge>;
  if (detail.status === "REJECTED") return <Badge className="bg-red-600 hover:bg-red-600">Rejected</Badge>;
  if (detail.status === "EXPIRED") return <Badge className="bg-gray-500 hover:bg-gray-500">Expired</Badge>;
  if (detail.pending_wallet_approval) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
        Awaiting supervisor
      </Badge>
    );
  }
  return <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Pending decision</Badge>;
}

function Fact({ label, value, hint, tone, testId }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "warn" | "bad"; testId?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-background px-3 py-2",
        tone === "ok" && "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20",
        tone === "warn" && "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20",
        tone === "bad" && "border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20",
      )}
      data-testid={testId}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function WalletFact({ check }: { check: UrgentWalletCheck | null | undefined }) {
  if (!check) return <Fact label="Wallet" value="—" hint="Checked when the slots are allocated" testId="urgent-fact-wallet" />;
  if (check.sufficient) {
    return <Fact label="Wallet" value="Sufficient" hint={`${formatINRAmount(check.available)} available`} tone="ok" testId="urgent-fact-wallet" />;
  }
  return (
    <Fact
      label="Wallet"
      value={Number(check.shortfall) > 0 ? `Short by ${formatINRAmount(check.shortfall)}` : "Not sufficient"}
      hint={check.has_wallet ? `${formatINRAmount(check.available)} available` : check.message || "No wallet for this department"}
      tone="bad"
      testId="urgent-fact-wallet"
    />
  );
}

/** The supervisor's decision and comment, or why there is none yet. */
export function SupervisorCommentBlock({ detail }: { detail: UrgentRequestDetailData }) {
  const decision = (detail.supervisor_decision || "").toUpperCase();
  const decidedAt = detail.supervisor_decided_at || detail.wallet_approved_at;
  const who = detail.wallet_approved_by_name || detail.supervisor_name || "";
  let state: ReactNode;
  let body: ReactNode = null;
  if (detail.supervisor_approval_required === false) {
    state = <Badge variant="outline">Not required</Badge>;
    body = <p className="text-sm text-muted-foreground">The user pays from their own wallet, so no supervisor approval is needed.</p>;
  } else if (detail.pending_wallet_approval) {
    state = (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
        <Clock className="mr-1 h-3 w-3" /> Awaiting supervisor
      </Badge>
    );
    body = (
      <p className="text-sm text-muted-foreground">
        {detail.supervisor_name ? `Waiting for ${detail.supervisor_name} to approve or reject.` : "Waiting for the supervisor to approve or reject."}
      </p>
    );
  } else if (decision === "APPROVED" || decision === "REJECTED" || detail.wallet_approved_at) {
    const approved = decision !== "REJECTED";
    state = approved ? (
      <Badge className="bg-green-700 text-white hover:bg-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
      </Badge>
    ) : (
      <Badge className="bg-red-600 hover:bg-red-600">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
    body = detail.wallet_notes?.trim() ? (
      <p className="whitespace-pre-wrap text-sm" data-testid="urgent-supervisor-comment">
        {detail.wallet_notes}
      </p>
    ) : (
      <p className="text-sm italic text-muted-foreground" data-testid="urgent-supervisor-comment">
        No comment added.
      </p>
    );
  } else {
    state = <Badge variant="outline">—</Badge>;
    body = <p className="text-sm text-muted-foreground">No supervisor decision recorded.</p>;
  }
  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card p-3" aria-labelledby="urgent-supervisor-heading" data-testid="urgent-supervisor-block">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="urgent-supervisor-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <UserCheck className="h-4 w-4 text-muted-foreground" /> Supervisor comment
        </h3>
        {state}
      </div>
      {body}
      {!detail.pending_wallet_approval && detail.supervisor_approval_required !== false && (who || decidedAt) ? (
        <p className="mt-auto pt-2 text-xs text-muted-foreground">
          {[who, decidedAt ? fmtDate(decidedAt) : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function ReasonBlock({ reason }: { reason?: string }) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card p-3" aria-labelledby="urgent-reason-heading" data-testid="urgent-reason-block">
      <h3 id="urgent-reason-heading" className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquareQuote className="h-4 w-4 text-muted-foreground" /> Reason given by user
      </h3>
      {reason?.trim() ? (
        <p className="whitespace-pre-wrap text-sm">{reason}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No reason given.</p>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

function RequirementGrid({ detail }: { detail: UrgentRequestDetailData }) {
  const items: Array<{ key: string; label: string; value: string }> = detail.requirement
    ? detail.requirement.input_summary ?? []
    : Object.entries(detail.hold_booking_summary?.input_values ?? {})
        .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
        .map(([k, v]) => ({ key: k, label: k, value: String(v) }));
  if (items.length === 0) return null;
  return (
    <section data-testid="urgent-requirement-grid">
      <SectionTitle>Requirement &amp; sample details</SectionTitle>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="break-words font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Props = {
  detail: UrgentRequestDetailData | null;
  onClose: () => void;
  viewer: "supervisor" | "oic";
  description?: ReactNode;
  /** Requester name/email (the OIC view shows the identity card button). */
  requester?: ReactNode;
  notes?: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; show: boolean };
  onOpenEvidence?: () => void;
  evidenceLoading?: boolean;
  onViewParams?: () => void;
  /** Extra sections (e.g. recent booking attempts). */
  children?: ReactNode;
  /** Left side of the footer (e.g. Delete). */
  footerStart?: ReactNode;
  /** Decision buttons. */
  actions?: ReactNode;
};

/** Urgent request details laid out for a decision: who and what, the key facts, reason and supervisor comment side by side. */
export function UrgentRequestDetailDialog({
  detail,
  onClose,
  viewer,
  description,
  requester,
  notes,
  onOpenEvidence,
  evidenceLoading,
  onViewParams,
  children,
  footerStart,
  actions,
}: Props) {
  const facts = detail ? urgentDecisionFacts(detail) : null;
  const isTypeB = detail?.request_type === "REVIEWER_URGENT";
  const priorApproved = detail?.requester_approved_urgent_last_6_months ?? [];
  const hasEvidence = !!(detail?.evidence_file_url || detail?.evidence_original_name);
  const heldSlots = detail?.hold_booking_summary?.slot_times ?? [];
  const preferred = detail?.requirement?.preferred_schedule?.trim();

  return (
    <Dialog open={!!detail} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col gap-0 overflow-y-auto p-0 sm:overflow-hidden"
        data-testid={`urgent-detail-${viewer}`}
      >
        {detail && facts ? (
          <>
            <DialogHeader className="space-y-2 border-b px-5 pb-4 pt-5 pr-12 text-left sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={isTypeB ? "border-amber-500 text-amber-800 dark:text-amber-300" : ""}>
                  {URGENT_TYPE_LABELS[detail.request_type] ?? detail.request_type}
                </Badge>
                {detail.requires_slot_allocation ? (
                  <Badge variant="outline" className="border-sky-500 text-sky-800 dark:text-sky-300">
                    No slots · OIC allocates
                  </Badge>
                ) : null}
                <StatusBadge detail={detail} />
              </div>
              <DialogTitle className="text-xl leading-snug">
                Urgent request #{detail.id}
                <span className="block text-base font-medium text-muted-foreground">
                  {detail.equipment_name}
                  {detail.equipment_code ? ` (${detail.equipment_code})` : ""}
                </span>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="min-w-0">{requester ?? `${detail.user_name}${detail.user_email ? ` · ${detail.user_email}` : ""}`}</span>
                {detail.requester_category ? <span className="text-muted-foreground">{detail.requester_category}</span> : null}
                <span className="text-muted-foreground">Requested {fmtDate(detail.requested_at)}</span>
              </div>
              {description ? <DialogDescription className="text-left">{description}</DialogDescription> : null}
            </DialogHeader>

            <div className="space-y-5 px-5 py-4 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain sm:px-6">
              <section aria-label="Decision summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="urgent-decision-summary">
                <Fact label="Required time" value={facts.requiredMinutes ? formatRequiredTime(facts.requiredMinutes) : "—"} testId="urgent-fact-time" />
                <Fact label="Slots" value={facts.slots ?? "—"} testId="urgent-fact-slots" />
                <Fact label="Samples" value={facts.samples || "—"} testId="urgent-fact-samples" />
                <Fact
                  label="Amount"
                  value={facts.amount != null ? formatINRAmount(facts.amount) : "—"}
                  hint={isTypeB ? "incl. 50% urgent surcharge" : "no surcharge"}
                  testId="urgent-fact-amount"
                />
                <WalletFact check={detail.wallet_check} />
                <Fact
                  label="Urgent approved (6 months)"
                  value={priorApproved.length}
                  tone={priorApproved.length > 0 ? "warn" : undefined}
                  hint={
                    priorApproved.length > 0
                      ? priorApproved.map((a) => fmtDate(a.decided_at, "dd MMM yyyy")).join(", ")
                      : "None before"
                  }
                  testId="urgent-fact-prior"
                />
              </section>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ReasonBlock reason={detail.reviewer_comment} />
                <SupervisorCommentBlock detail={detail} />
              </div>

              <RequirementGrid detail={detail} />

              <section>
                <SectionTitle>Evidence &amp; preferences</SectionTitle>
                <div className="space-y-3 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {hasEvidence && onOpenEvidence ? (
                      <Button type="button" variant="outline" size="sm" disabled={evidenceLoading} onClick={onOpenEvidence}>
                        {evidenceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        <span className="max-w-[240px] truncate">{detail.evidence_original_name || "Evidence"}</span>
                        <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">No evidence attached</span>
                    )}
                    {onViewParams && detail.hold_booking_id != null && detail.hold_booking_summary ? (
                      <Button type="button" variant="outline" size="sm" onClick={onViewParams}>
                        <FileText className="mr-2 h-4 w-4" />
                        Slots &amp; parameters
                      </Button>
                    ) : null}
                  </div>
                  {preferred ? (
                    <div>
                      <div className="text-xs text-muted-foreground">Preferred dates / notes</div>
                      <p className="whitespace-pre-wrap">{preferred}</p>
                    </div>
                  ) : detail.requires_slot_allocation ? (
                    <p className="text-muted-foreground">No preferred dates given.</p>
                  ) : null}
                  {heldSlots.length > 0 ? (
                    <div>
                      <div className="text-xs text-muted-foreground">Held slots</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {heldSlots.map((st, i) => (
                          <span key={i} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                            {st.label || (st.start && st.end ? `${format(new Date(st.start), "dd MMM HH:mm")} – ${format(new Date(st.end), "HH:mm")}` : "—")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {detail.wallet_check && !detail.wallet_check.sufficient && detail.wallet_check.message ? (
                <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {detail.wallet_check.message}
                </p>
              ) : null}

              {children}

              {notes?.show ? (
                <div className="space-y-1.5">
                  <Label htmlFor={notes.id}>{notes.label}</Label>
                  <Textarea id={notes.id} value={notes.value} onChange={(e) => notes.onChange(e.target.value)} placeholder={notes.placeholder} rows={2} />
                </div>
              ) : detail.admin_notes?.trim() && viewer === "oic" ? (
                <div>
                  <div className="text-xs text-muted-foreground">Decision notes</div>
                  <p className="whitespace-pre-wrap text-sm">{detail.admin_notes}</p>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-5 py-3 sm:static sm:bg-muted/30 sm:px-6">
              <div className="flex">{footerStart}</div>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="hidden sm:inline-flex" onClick={onClose}>
                  Close
                </Button>
                {actions}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
