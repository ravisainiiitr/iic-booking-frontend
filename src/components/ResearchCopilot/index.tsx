import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient, type CopilotCommandGroup } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Archive,
  ArchiveRestore,
  Bot,
  Copy,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { prepareBookingAssistantHandoff } from "@/lib/bookingAssistantPrefill";
import { ASSISTANT_CARD_TYPES, AssistantCard, type AssistantActionHandler } from "./AssistantCards";
import { INTELLIGENCE_CARD_TYPES, IntelligenceCard, renderedChoiceKeys } from "./IntelligenceCards";
import { isViteCopilotEnabled } from "./softGate";

const FEEDBACK_REASONS: Array<{ value: string; label: string }> = [
  { value: "incorrect", label: "Wrong answer" },
  { value: "missing_information", label: "Incomplete" },
  { value: "not_useful", label: "Not relevant" },
  { value: "action_failed", label: "Action didn't work" },
  { value: "other", label: "Other" },
];

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isServerMessageId(id: string): boolean {
  return UUID_RE.test(id);
}

type CopilotCard = {
  type?: string;
  title?: string;
  message?: string;
  window?: string;
  equipment_id?: number;
  balance?: number | string | null;
  estimate?: number | string | null;
  currency?: string;
  items?: Array<Record<string, unknown>>;
  action?: string;
  proposal_id?: string;
  confirmation_token?: string;
  executable?: boolean;
  expires_at?: string;
  equipment_name?: string;
  booking_id?: number | string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  sample_count?: number;
  estimated_amount?: number | string | null;
  wallet_balance?: number | string | null;
  approx_balance_after?: number | string | null;
  expected_balance_after?: number | string | null;
  amount?: number | string | null;
  requested_amount?: number | string | null;
  outstanding?: number | string | null;
  outstanding_credit?: number | string | null;
  purpose?: string;
  sufficient?: boolean | null;
  cancellation_policy_note?: string;
  portal_href?: string;
  error?: string;
  department?: string;
  department_id?: number | null;
  user_type?: string | number;
  can_book?: boolean;
  sub_wallets?: Array<{ department_id?: number | null; department?: string | null; balance?: string | null }>;
  message_type?: string;
  inputs?: Array<{ key: string; label: string; value: unknown }>;
  slot_count?: number;
  charge?: number | null;
  gst_percent?: number | null;
  gst_amount?: number | null;
  total_amount?: number | null;
  balance_after_total?: number | null;
  wallet_label?: string;
  when_label?: string;
  policy_note?: string;
  cancel_mode?: string;
  refund_amount?: number | string | null;
  new_charge?: number | string | null;
  slots_to_keep_count?: number | null;
  slots_to_release?: Array<{ id?: number; start_datetime?: string; end_datetime?: string }>;
};

type CopilotAction = {
  id: string;
  label: string;
  href?: string;
  prompt?: string;
  enabled?: boolean;
  hint?: string;
  requires_confirmation?: boolean;
  proposal_id?: string;
  confirmation_token?: string;
  mutation_action?: string;
  type?: string;
  payload?: {
    equipment_id?: number;
    slot_ids?: number[];
    number_of_samples?: number;
    booking_id?: number;
    technique?: string;
    equipment_query?: string;
    topic?: string;
  } & Record<string, unknown>;
  choice?: { kind: string; value: string };
  escalate?: { reason: string };
  primary?: boolean;
  /** Structured conversational action: sent back to the conversation, validated server-side. */
  action_type?: string;
  utterance?: string;
  style?: "primary" | "secondary";
  confirmation_required?: boolean;
};

type StructuredAction = { type: string; payload: Record<string, unknown> };

type CopilotEnvelope = {
  content?: string;
  cards?: CopilotCard[];
  suggested_actions?: CopilotAction[];
  escalate_hint?: boolean;
  response_kind?: string;
};

type PendingConfirm = {
  proposal_id: string;
  confirmation_token: string;
  mutation_action?: string;
  label: string;
  card?: CopilotCard;
  idempotency_key: string;
};

const CONFIRM_WARNINGS: Record<string, string> = {
  CREATE_BOOKING: "This books the slot in your name. Charges are debited from your wallet under the usual portal rules.",
  CANCEL_BOOKING: "This cancels the booking. Any refund follows the portal cancellation policy.",
  RESCHEDULE_BOOKING: "This moves your booking to the new slot and releases the old one.",
  WALLET_CREDIT: "This submits a wallet credit request. The Main Administrator must approve it.",
  WALLET_RECHARGE: "This starts a wallet recharge.",
};

function newIdempotencyKey(): string {
  const c = typeof crypto !== "undefined" ? (crypto as Crypto & { randomUUID?: () => string }) : undefined;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number | null;
  escalate_hint?: boolean;
  citations?: Array<{
    n?: number;
    source_id?: string;
    document_id?: string;
    title: string;
    snippet?: string;
    score?: number;
    url?: string;
    category?: string;
    source_type?: string;
    page?: number | null;
    page_label?: string;
    has_file?: boolean;
    file_endpoint?: string;
  }>;
  suggested_actions?: CopilotAction[];
  cards?: CopilotCard[];
  response_kind?: string;
  metadata?: Record<string, unknown>;
};

type ConversationSummary = {
  id: string;
  title: string;
  updated_at?: string | null;
  created_at?: string | null;
  last_query?: string;
  is_archived?: boolean;
};

type CommandAction = {
  id: string;
  label: string;
  href?: string;
  prompt?: string;
  choice?: { kind: string; value: string };
};

const DEFAULT_COMMANDS: CommandAction[] = [
  { id: "ba_options", label: "FESEM tomorrow?", prompt: "I need FESEM tomorrow — what are my options?" },
  { id: "ba_upcoming", label: "Upcoming bookings", prompt: "Show my upcoming bookings." },
  { id: "ba_capability", label: "Which instrument?", prompt: "Which equipment can do x-ray diffraction?" },
  { id: "ba_charges", label: "Charges", prompt: "What are the charges for XRD?" },
  { id: "ba_cancel_rules", label: "Cancellation rules", prompt: "How do I cancel a booking?" },
  { id: "find_equipment", label: "Find equipment", prompt: "Help me find suitable equipment for my sample." },
  { id: "search_slots", label: "Find available slots", prompt: "Search available slots for FESEM this week." },
  { id: "estimate_cost", label: "Estimate cost", prompt: "Estimate the cost of booking FESEM for 2 hours." },
  { id: "my_bookings", label: "My bookings", prompt: "List my recent bookings." },
  { id: "next_booking", label: "Next booking", prompt: "What is my next booking?" },
  { id: "reschedule", label: "Reschedule booking", prompt: "Reschedule my next booking." },
  { id: "cancel_booking", label: "Cancel booking", prompt: "Cancel my next booking." },
  { id: "wallet", label: "Wallet balance", prompt: "What is my wallet balance?" },
  { id: "ra_status", label: "Remote Analysis", prompt: "What is my Remote Analysis status?" },
  { id: "research_help", label: "Research Help", prompt: "How do I prepare a sample for FESEM?" },
];

const PUBLIC_DEFAULT_COMMANDS: CommandAction[] = [
  { id: "hold_meaning", label: "What is HOLD?", prompt: "What does HOLD mean on a booking?" },
  { id: "find_equipment", label: "Find equipment", href: "/equipments", prompt: "Help me find suitable equipment for my sample." },
  { id: "search_slots", label: "Search available slots", prompt: "Search available slots for FESEM this week." },
  { id: "estimate_cost", label: "Estimate booking cost", prompt: "Estimate the cost of booking FESEM." },
  { id: "sign_in", label: "Sign in to book", href: "/auth" },
  { id: "research_help", label: "Research Help", prompt: "How do I prepare a sample for FESEM?" },
];

function copilotErrorMessage(res: { error?: string | null; status?: number | null }) {
  const status = res.status ?? 0;
  const raw = (res.error || "").toLowerCase();
  if (status === 401 || status === 403) {
    return "Your session expired or you are not signed in. Sign in again to continue with personal bookings and wallet, or ask a general question while signed out.";
  }
  if (status === 429 || raw.includes("throttl") || raw.includes("rate")) {
    return "Booking Assistant AI replies are temporarily rate-limited. Wait a moment and Retry — live lookups (slots, wallet, bookings) usually still work. You do not need to abandon the Booking Assistant for those questions.";
  }
  if (status === 503 || raw.includes("disabled") || raw.includes("not enabled")) {
    return "Booking Assistant is not enabled on this environment right now.";
  }
  if (status === 0 || raw.includes("network") || raw.includes("failed to fetch")) {
    return "Unable to reach Booking Assistant. Check your network connection, then try again.";
  }
  if (raw.includes("busy") || status === 409) {
    return "Booking Assistant is busy. Please try again in a moment.";
  }
  return res.error || "Booking Assistant could not complete that request. You can continue using the booking portal.";
}
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const html = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code class=\"rounded bg-black/10 px-1 py-0.5 text-xs\">$1</code>");
        const isBullet = /^\s*[-*]\s+/.test(line);
        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted-foreground">•</span>
              <span dangerouslySetInnerHTML={{ __html: html.replace(/^\s*[-*]\s+/, "") }} />
            </div>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

function CopilotCards({
  cards,
  onNavigate,
  onPrompt,
  onBookSlot,
  busy,
  intelligence = false,
  interactive = false,
  onChoice,
  onAssistantAction,
}: {
  cards?: CopilotCard[];
  onNavigate: (href: string) => void;
  onPrompt?: (prompt: string) => void;
  onBookSlot?: (equipmentId: number, slotId: number) => void;
  busy?: boolean;
  intelligence?: boolean;
  interactive?: boolean;
  onChoice?: (kind: string, value: string, label: string) => void;
  onAssistantAction?: AssistantActionHandler;
}) {
  if (!cards?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {cards.map((card, idx) => {
        const title = card.title || card.type || "Result";
        if (onAssistantAction && card.type && ASSISTANT_CARD_TYPES.has(card.type)) {
          return (
            <AssistantCard
              key={idx}
              card={card as unknown as Record<string, unknown>}
              busy={busy}
              onAction={onAssistantAction}
              onNavigate={onNavigate}
              onHandoff={(href, prefill) => onNavigate(prepareBookingAssistantHandoff(href, prefill))}
            />
          );
        }
        if (intelligence && card.type && INTELLIGENCE_CARD_TYPES.has(card.type)) {
          return (
            <IntelligenceCard
              key={idx}
              card={card as unknown as Record<string, unknown>}
              interactive={interactive}
              busy={busy}
              onChoice={(kind, value, label) => onChoice?.(kind, value, label)}
              onText={(text) => onPrompt?.(text)}
            />
          );
        }
        if (
          (card.type === "equipment_choice" ||
            card.type === "equipment_list" ||
            card.type === "equipment_compare") &&
          card.items?.length
        ) {
          const isCompare = card.type === "equipment_compare";
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
                {isCompare ? " · comparison" : ""}
              </div>
              {isCompare ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-1 pr-2 font-medium">Equipment</th>
                        <th className="py-1 pr-2 font-medium">Dept</th>
                        <th className="py-1 pr-2 font-medium">Location</th>
                        <th className="py-1 font-medium">Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.items.slice(0, 6).map((item, i) => {
                        const name = String(item.name || item.label || `Option ${i + 1}`);
                        const prompt =
                          typeof item.prompt === "string"
                            ? item.prompt
                            : `Search available slots for ${name}`;
                        return (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5 pr-2">
                              <button
                                type="button"
                                className="font-medium text-primary underline-offset-2 hover:underline"
                                onClick={() => onPrompt?.(prompt)}
                              >
                                {name}
                              </button>
                            </td>
                            <td className="py-1.5 pr-2">{String(item.department || "—")}</td>
                            <td className="py-1.5 pr-2">{String(item.location || "—")}</td>
                            <td className="py-1.5">{String(item.mode || "—")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {card.items.slice(0, 8).map((item, i) => {
                    const name = String(item.name || item.label || `Option ${i + 1}`);
                    const href = typeof item.href === "string" ? item.href : undefined;
                    const prompt =
                      typeof item.prompt === "string"
                        ? item.prompt
                        : `Search available slots for ${name}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                        onClick={() => {
                          if (onPrompt) onPrompt(prompt);
                          else if (href) onNavigate(href);
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        if (card.type === "daily_dashboard") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
              Research dashboard · live portal data
            </div>
          );
        }
        if (card.type === "user_profile") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-xs">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</div>
              <div>Department: {String(card.department || "—")}</div>
              <div>User type: {String(card.user_type || "—")}</div>
            </div>
          );
        }
        if (card.type === "slots" && card.items?.length) {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
                {card.window ? ` · ${card.window}` : ""}
              </div>
              <ul className="space-y-1 text-xs">
                {card.items.slice(0, 8).map((item, i) => {
                  const day = String(item.date || "");
                  const start = String(item.start || "").slice(11, 16);
                  const end = String(item.end || "").slice(11, 16);
                  const slotId = Number(item.slot_id);
                  const canBook = Boolean(card.can_book && onBookSlot && card.equipment_id && slotId);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
                      <span>{day}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {start}
                        {end ? `–${end}` : ""}
                        {canBook ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                            onClick={() => onBookSlot?.(Number(card.equipment_id), slotId)}
                          >
                            Book
                          </button>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
        if (card.type === "wallet") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wallet</div>
              <div className="mt-1 font-semibold">
                {card.currency || "INR"} {card.balance ?? "—"}
              </div>
            </div>
          );
        }
        if (card.type === "recharge_guidance") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {card.title || "Recharge your wallet"}
              </div>
              {card.wallet_balance != null ? (
                <div className="mt-1 font-semibold">Balance: ₹{String(card.wallet_balance)}</div>
              ) : null}
              {card.sub_wallets?.length ? (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {card.sub_wallets.slice(0, 6).map((s, i) => (
                    <li key={i}>
                      {s.department || "Department"}: ₹{String(s.balance ?? "—")}
                    </li>
                  ))}
                </ul>
              ) : null}
              {card.portal_href ? (
                <Button type="button" size="sm" className="mt-2 h-8 text-xs" onClick={() => onNavigate(card.portal_href!)}>
                  {card.amount ? `Recharge ₹${String(card.amount)}` : "Open recharge form"}
                </Button>
              ) : null}
            </div>
          );
        }
        if (card.type === "manual_sources") {
          return null;
        }
        if (card.type === "transactions") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent transactions
              </div>
              <ul className="space-y-1 text-xs">
                {(card.items || []).slice(0, 6).map((item, i) => (
                  <li key={i}>
                    {String(item.type || "")} {item.amount != null ? `₹${String(item.amount)}` : ""} —{" "}
                    {String(item.description || "").slice(0, 80)}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (card.type === "credit_status") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credit status</div>
              <div className="mt-1 text-xs">Outstanding: {card.outstanding != null ? `₹${String(card.outstanding)}` : "—"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Main Admin approves all credit. Booking Assistant cannot approve.</div>
            </div>
          );
        }
        if (card.type === "estimate") {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estimate</div>
              <div className="mt-1 font-semibold">
                {card.currency || "INR"} {card.estimate ?? "—"}
              </div>
              {card.wallet_balance != null ? (
                <div className="mt-1 text-xs">Wallet: ₹{String(card.wallet_balance)}</div>
              ) : null}
              {card.sufficient === false ? (
                <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">Balance may be insufficient.</div>
              ) : null}
              <div className="mt-1 text-[11px] text-muted-foreground">Portal calculate remains authoritative.</div>
            </div>
          );
        }
        if (
          card.type === "booking_proposal" ||
          card.type === "cancellation_proposal" ||
          card.type === "reschedule_proposal" ||
          card.type === "recharge_proposal" ||
          card.type === "credit_proposal"
        ) {
          return (
            <div key={idx} className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 dark:bg-amber-950/20">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                {title}
              </div>
              <ul className="space-y-1 text-xs">
                {card.equipment_name ? (
                  <li>
                    <strong>Equipment:</strong> {card.equipment_name}
                  </li>
                ) : null}
                {card.booking_id ? (
                  <li>
                    <strong>Booking:</strong> {String(card.booking_id)}
                  </li>
                ) : null}
                {card.amount != null || card.requested_amount != null ? (
                  <li>
                    <strong>Amount:</strong> ₹{String(card.amount ?? card.requested_amount)}
                  </li>
                ) : null}
                {card.purpose ? (
                  <li>
                    <strong>Purpose:</strong> {String(card.purpose)}
                  </li>
                ) : null}
                {card.date ? (
                  <li>
                    <strong>Date:</strong> {card.date}
                  </li>
                ) : null}
                {card.start_time || card.end_time ? (
                  <li>
                    <strong>Time:</strong> {String(card.start_time || "").slice(11, 16)}
                    {card.end_time ? `–${String(card.end_time).slice(11, 16)}` : ""}
                  </li>
                ) : null}
                {card.duration_minutes ? (
                  <li>
                    <strong>Duration:</strong> {card.duration_minutes} min
                  </li>
                ) : null}
                {card.sample_count ? (
                  <li>
                    <strong>Samples:</strong> {card.sample_count}
                  </li>
                ) : null}
                {card.inputs?.map((inp) => (
                  <li key={inp.key}>
                    <strong>{inp.label}:</strong> {String(inp.value ?? "")}
                  </li>
                ))}
                {card.charge != null ? (
                  <li>
                    <strong>Estimated charge:</strong> ₹{String(card.charge)}
                  </li>
                ) : card.estimated_amount != null ? (
                  <li>
                    <strong>Estimated charge:</strong> ₹{String(card.estimated_amount)}
                  </li>
                ) : null}
                {card.gst_percent ? (
                  <li>
                    <strong>GST ({card.gst_percent}%):</strong> ₹{String(card.gst_amount ?? 0)}
                  </li>
                ) : null}
                {card.total_amount != null ? (
                  <li>
                    <strong>Estimated total:</strong> ₹{String(card.total_amount)}
                  </li>
                ) : null}
                {card.refund_amount != null ? (
                  <li>
                    <strong>Refund:</strong> ₹{String(card.refund_amount)}
                  </li>
                ) : null}
                {card.new_charge != null ? (
                  <li>
                    <strong>New charge for the remaining booking:</strong> ₹{String(card.new_charge)}
                  </li>
                ) : null}
                {card.slots_to_keep_count != null ? (
                  <li>
                    <strong>Slots that stay booked:</strong> {card.slots_to_keep_count}
                  </li>
                ) : null}
                {card.wallet_balance != null ? (
                  <li>
                    <strong>Wallet:</strong> ₹{String(card.wallet_balance)}
                  </li>
                ) : null}
                {card.balance_after_total != null ? (
                  <li>
                    <strong>After booking (approx):</strong> ₹{String(card.balance_after_total)}
                  </li>
                ) : null}
                {card.policy_note ? <li>{card.policy_note}</li> : null}
                {card.balance_after_total == null && card.approx_balance_after != null ? (
                  <li>
                    <strong>After booking (approx):</strong> ₹{String(card.approx_balance_after)}
                  </li>
                ) : null}
                {card.expected_balance_after != null ? (
                  <li>
                    <strong>After recharge (approx):</strong> ₹{String(card.expected_balance_after)}
                  </li>
                ) : null}
                {card.outstanding_credit != null ? (
                  <li>
                    <strong>Outstanding credit:</strong> ₹{String(card.outstanding_credit)}
                  </li>
                ) : null}
                {card.cancellation_policy_note ? <li>{card.cancellation_policy_note}</li> : null}
              </ul>
              {!card.executable ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Booking Assistant can&apos;t complete this action for your account yet. Use the portal link instead.
                </p>
              ) : null}
            </div>
          );
        }
        if (card.type === "booking_success") {
          return (
            <div key={idx} className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 p-3 text-sm dark:bg-emerald-950/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-100">
                {card.action === "CANCEL_BOOKING"
                  ? "Booking cancelled"
                  : card.action === "RESCHEDULE_BOOKING"
                    ? "Booking rescheduled"
                    : "Booking confirmed"}
              </div>
              <div className="mt-1">Booking ID: {String(card.booking_id || "—")}</div>
            </div>
          );
        }
        if (card.type === "booking_error") {
          return (
            <div key={idx} className="rounded-xl border border-red-300/50 bg-red-50/40 p-3 text-sm dark:bg-red-950/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-100">
                Action could not complete
              </div>
              <div className="mt-1 text-xs whitespace-pre-wrap">
                {String(card.message || card.error || "Please try again or use the portal.")}
              </div>
            </div>
          );
        }
        if (card.items?.length) {
          return (
            <div key={idx} className="rounded-xl border bg-background/70 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
              <ul className="space-y-1 text-xs">
                {card.items.slice(0, 6).map((item, i) => (
                  <li key={i}>{String(item.name || item.label || item.equipment || item.booking_id || JSON.stringify(item).slice(0, 80))}</li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

type ResearchCopilotProps = {
  /** Mount with the panel already open (the lazy launcher loads this module on first click). */
  initialOpen?: boolean;
  /** Enabled flag already resolved by the launcher; skips the duplicate mount-time bootstrap. */
  initialBackendEnabled?: boolean | null;
};

export default function ResearchCopilot({
  initialOpen = false,
  initialBackendEnabled = null,
}: ResearchCopilotProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  // Analysis desktop controls (Fullscreen/Reconnect) sit bottom-right; Copilot must not cover them.
  const hideOnAnalysisDesktop =
    location.pathname.startsWith("/analysis-launch") ||
    location.pathname.startsWith("/analysis-workspace");
  const isEmbed = new URLSearchParams(location.search).get("embed") === "1";
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [backendEnabled, setBackendEnabled] = useState<boolean | null>(initialBackendEnabled);
  const skipMountGate = useRef(initialBackendEnabled !== null);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [commands, setCommands] = useState<CommandAction[]>(
    isAuthenticated ? DEFAULT_COMMANDS : PUBLIC_DEFAULT_COMMANDS,
  );
  const [assistantName, setAssistantName] = useState("IIC Booking Assistant");
  const [commandGroups, setCommandGroups] = useState<CopilotCommandGroup[]>([]);
  const [intelligenceOn, setIntelligenceOn] = useState(false);
  const [canEscalate, setCanEscalate] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<{ messageId: string | null; step: "reason" | "done" } | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [usedProposals, setUsedProposals] = useState<Set<string>>(() => new Set());
  const [quickOpen, setQuickOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasUserMessages = messages.some((m) => m.role === "user");
  const showQuick = !hasUserMessages || quickOpen;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const appendEnvelope = useCallback((envelope: CopilotEnvelope | undefined, fallback: string, isError = false) => {
    setMessages((m) => [
      ...m,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: envelope?.content || fallback,
        cards: envelope?.cards || [],
        suggested_actions: envelope?.suggested_actions,
        escalate_hint: isError || Boolean(envelope?.escalate_hint),
        response_kind: envelope?.response_kind,
      },
    ]);
  }, []);

  const prepareBooking = async (equipmentId: number, slotIds: number[], samples?: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiClient.researchCopilotPrepareMutation({
        action: "CREATE_BOOKING",
        equipment_id: equipmentId,
        slot_ids: slotIds,
        number_of_samples: samples,
        conversation_id: conversationId,
      });
      if (res.error || !res.data) {
        appendEnvelope(undefined, copilotErrorMessage(res), true);
        return;
      }
      appendEnvelope(
        res.data.response as CopilotEnvelope | undefined,
        String((res.data as { message?: string }).message || "Could not prepare that booking."),
        !res.data.ok,
      );
    } finally {
      setLoading(false);
    }
  };

  const runConfirm = async (pc: PendingConfirm) => {
    setPendingConfirm(null);
    setUsedProposals((s) => new Set(s).add(pc.proposal_id));
    setLoading(true);
    try {
      const res = await apiClient.researchCopilotConfirmMutation({
        proposal_id: pc.proposal_id,
        confirmation_token: pc.confirmation_token,
        action: pc.mutation_action,
        idempotency_key: pc.idempotency_key,
      });
      if (res.error || !res.data) {
        setUsedProposals((s) => {
          const next = new Set(s);
          next.delete(pc.proposal_id);
          return next;
        });
        appendEnvelope(undefined, copilotErrorMessage(res), true);
        return;
      }
      const data = res.data as { ok?: boolean; message?: string; response?: CopilotEnvelope };
      appendEnvelope(data.response, String(data.message || "Confirmation processed."), !data.ok);
    } finally {
      setLoading(false);
    }
  };

  const openManual = async (documentId: string, page?: number | null) => {
    // Open synchronously so the browser treats it as user-initiated, then point it at the signed URL.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    const res = await apiClient.researchCopilotManualFileUrl(documentId);
    if (!res.data?.url) {
      win?.close();
      appendEnvelope(undefined, res.error || "This manual could not be opened right now.", true);
      return;
    }
    const href = page ? `${res.data.url}#page=${page}` : res.data.url;
    if (win) win.location.href = href;
    else window.location.assign(href);
  };

  const isCopilotEnabled = isViteCopilotEnabled && backendEnabled === true;

  const welcome = useMemo(
    () =>
      isAuthenticated && intelligenceOn
        ? `Hello! How can I help?\n\nAsk in your own words, for example **"I need FESEM tomorrow — what are my options?"**. I show live free slots you can tap to book, equipment details, charges, contacts and your bookings. Nothing is booked until you press **Confirm booking**.`
        : isAuthenticated
        ? `I am **${assistantName}** — your booking assistant for IIC IIT Roorkee.\n\nTry **"I need FESEM tomorrow — what are my options?"**, "Where is the XRD?", "What are the TEM charges?" or "Show my upcoming bookings". I use live portal data, and nothing is booked until you press **Confirm booking**.`
        : `I am **${assistantName}** (guest mode).\n\nAsk about equipment, free slots, rough charge estimates, HOLD meaning, sample acceptance, manuals, or Remote Analysis troubleshooting. Sign in to book, check wallet, or view your bookings.`,
    [assistantName, isAuthenticated, intelligenceOn],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const refreshList = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    const res = await apiClient.researchCopilotListConversations(showArchived);
    if (res.data?.results) setConversations(res.data.results);
  }, [isAuthenticated, showArchived]);

  useEffect(() => {
    if (open && isAuthenticated) void refreshList();
  }, [open, isAuthenticated, refreshList]);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    let res = await apiClient.researchCopilotCreateConversation();
    if (!res.data?.conversation?.id && (res.status === 0 || res.error)) {
      // one retry for transient network blips
      res = await apiClient.researchCopilotCreateConversation();
    }
    const id = res.data?.conversation?.id;
    if (!id) {
      const err = new Error(copilotErrorMessage(res));
      (err as Error & { status?: number | null }).status = res.status;
      throw err;
    }
    setConversationId(id);
    if (res.data?.suggested_prompts) setSuggested(res.data.suggested_prompts);
    await refreshList();
    return id;
  }, [conversationId, refreshList]);

  const bootstrap = useCallback(async () => {
    if (!isViteCopilotEnabled) return;
    setBootstrapping(true);
    try {
      const res = isAuthenticated
        ? await apiClient.researchCopilotBootstrap()
        : await apiClient.researchCopilotPublicBootstrap();
      if (res.data) {
        const enabled = res.data.enabled !== false;
        setBackendEnabled(enabled);
        if (!enabled) {
          setOpen(false);
          return;
        }
        setAssistantName(res.data.assistant_name || "IIC Booking Assistant");
        setSuggested(res.data.suggested_prompts || []);
        const ca = (res.data as { command_actions?: CommandAction[] }).command_actions;
        if (ca?.length) setCommands(ca);
        else setCommands(isAuthenticated ? DEFAULT_COMMANDS : PUBLIC_DEFAULT_COMMANDS);
        const extra = res.data as {
          command_groups?: CopilotCommandGroup[];
          intelligence?: { enabled?: boolean; knowledge?: boolean };
        };
        setCommandGroups(isAuthenticated ? extra.command_groups || [] : []);
        setIntelligenceOn(Boolean(isAuthenticated && extra.intelligence?.enabled));
        setCanEscalate(Boolean(isAuthenticated && (extra.intelligence?.enabled || extra.intelligence?.knowledge)));
      } else if (res.error) {
        setBackendEnabled(false);
        setOpen(false);
        return;
      }
    } finally {
      setBootstrapping(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    setMessages((m) => {
      if (!m.length) return [{ id: "welcome", role: "assistant", content: welcome }];
      if (m.length === 1 && m[0].id === "welcome" && m[0].content !== welcome) {
        return [{ ...m[0], content: welcome }];
      }
      return m;
    });
  }, [open, welcome]);

  useEffect(() => {
    if (!isViteCopilotEnabled) return;
    if (skipMountGate.current) {
      skipMountGate.current = false;
      return;
    }
    void (async () => {
      const res = isAuthenticated
        ? await apiClient.researchCopilotBootstrap()
        : await apiClient.researchCopilotPublicBootstrap();
      if (res.data) setBackendEnabled(res.data.enabled !== false);
      else setBackendEnabled(false);
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (open) void bootstrap();
  }, [open, bootstrap]);

  const loadConversation = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiClient.researchCopilotGetConversation(id);
      if (res.data) {
        setConversationId(id);
        setMessages(
          (res.data.messages || []).map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: String(m.content ?? ""),
            confidence: m.confidence as number | null | undefined,
            escalate_hint: Boolean(m.escalate_hint),
            citations: m.citations as CopilotMessage["citations"],
            suggested_actions: m.suggested_actions as CopilotAction[] | undefined,
            cards: ((m.metadata as { cards?: CopilotCard[] } | undefined)?.cards ?? []) as CopilotCard[],
            metadata: (m.metadata as Record<string, unknown> | undefined) ?? undefined,
          })),
        );
        setHistoryOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const archiveConversation = async (id: string, archived: boolean) => {
    const res = await apiClient.researchCopilotArchiveConversation(id, archived);
    if (res.error) return;
    if (archived && id === conversationId) {
      setConversationId(null);
      setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
    }
    await refreshList();
  };

  const startNew = async () => {
    setConversationId(null);
    setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
    if (!isAuthenticated) return;
    const res = await apiClient.researchCopilotCreateConversation();
    if (res.data?.conversation?.id) {
      setConversationId(res.data.conversation.id);
      if (res.data.suggested_prompts) setSuggested(res.data.suggested_prompts);
      await refreshList();
    }
  };

  const send = async (textOverride?: string, choice?: { kind: string; value: string }, action?: StructuredAction) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setQuickOpen(false);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setLoading(true);
    try {
      if (!isAuthenticated) {
        const res = await apiClient.researchCopilotPublicAsk(text);
        if (res.error || !res.data?.message) {
          setMessages((m) => [
            ...m,
            {
              id: `e-${Date.now()}`,
              role: "assistant",
              content: copilotErrorMessage(res),
              escalate_hint: true,
            },
          ]);
          return;
        }
        const msg = res.data.message;
        const publicCards =
          ((res.data as { cards?: CopilotCard[] }).cards as CopilotCard[] | undefined) ||
          ((msg.metadata as { cards?: CopilotCard[] } | undefined)?.cards ?? []);
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: String(msg.content || ""),
            escalate_hint: Boolean(msg.escalate_hint),
            citations: (msg.citations || []) as CopilotMessage["citations"],
            suggested_actions: (msg.suggested_actions || []) as CopilotMessage["suggested_actions"],
            cards: publicCards,
            response_kind: (res.data as { response_kind?: string }).response_kind,
          },
        ]);
        return;
      }

      const id = await ensureConversation();
      const res = await apiClient.researchCopilotSendMessage(id, text, choice, action);
      if (res.error || !res.data?.message) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: copilotErrorMessage(res),
            escalate_hint: true,
          },
        ]);
        return;
      }
      const msg = res.data.message;
      const authCards =
        ((res.data as { cards?: CopilotCard[] }).cards as CopilotCard[] | undefined) ||
        ((msg.metadata as { cards?: CopilotCard[] } | undefined)?.cards ?? []);
      setMessages((m) => [
        ...m,
        {
          id: String(msg.id || `a-${Date.now()}`),
          role: "assistant",
          content: String(msg.content || ""),
          confidence: msg.confidence as number | null | undefined,
          escalate_hint: Boolean(msg.escalate_hint),
          citations: msg.citations as CopilotMessage["citations"],
          suggested_actions: msg.suggested_actions as CopilotMessage["suggested_actions"],
          cards: authCards,
          response_kind: (res.data as { response_kind?: string }).response_kind,
          metadata: (msg.metadata as Record<string, unknown> | undefined) ?? undefined,
        },
      ]);
      if (res.data.suggested_prompts) setSuggested(res.data.suggested_prompts);
      await refreshList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            msg ||
            "Booking Assistant is temporarily unavailable. You can continue using the normal booking portal.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyLastAssistant = async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content);
    } catch {
      /* ignore */
    }
  };

  const feedback = async (rating: "up" | "down", messageId?: string, comment?: string, reason?: string) => {
    if (!conversationId) return false;
    const res = await apiClient.researchCopilotFeedback(conversationId, {
      rating,
      message_id: messageId && isServerMessageId(messageId) ? messageId : undefined,
      comment,
      reason,
    });
    if (res.error) {
      setMessages((m) => [
        ...m,
        { id: `e-${Date.now()}`, role: "assistant", content: "Your feedback could not be saved. Please try again." },
      ]);
    }
    return !res.error;
  };

  const escalate = async (messageId: string | null, reason: string, note?: string) => {
    if (!conversationId || escalating) return;
    setEscalating(true);
    try {
      const res = await apiClient.researchCopilotEscalate(conversationId, {
        message_id: messageId && isServerMessageId(messageId) ? messageId : undefined,
        reason,
        note,
      });
      const data = res.data;
      setMessages((m) => [
        ...m,
        res.error || !data
          ? {
              id: `e-${Date.now()}`,
              role: "assistant",
              content: res.error || "The support ticket could not be created. Please try again or use Support Tickets.",
            }
          : {
              id: `t-${Date.now()}`,
              role: "assistant",
              content: data.message,
              suggested_actions: data.href ? [{ id: "view_ticket", label: "View Ticket", href: data.href }] : [],
            },
      ]);
    } finally {
      setEscalating(false);
    }
  };

  /** The single click handler for every Copilot button: buttons continue the conversation unless they are links. */
  const handleCopilotAction = (a: CopilotAction, msg: CopilotMessage) => {
    if (a.escalate) {
      void escalate(msg.id, a.escalate.reason || "no_verified_answer");
      return;
    }
    if (a.action_type) {
      void send(a.utterance || a.prompt || a.label, undefined, { type: a.action_type, payload: { ...(a.payload || {}) } });
      return;
    }
    if (a.choice) {
      void send(a.label, a.choice);
      return;
    }
    if (a.type === "copilot_prepare_booking" && a.payload?.equipment_id && a.payload.slot_ids?.length) {
      void prepareBooking(a.payload.equipment_id, a.payload.slot_ids, a.payload.number_of_samples);
      return;
    }
    if (a.proposal_id && a.confirmation_token) {
      setPendingConfirm({
        proposal_id: a.proposal_id,
        confirmation_token: a.confirmation_token,
        mutation_action: a.mutation_action,
        label: a.label,
        card: msg.cards?.find((c) => c.proposal_id === a.proposal_id),
        idempotency_key: newIdempotencyKey(),
      });
      return;
    }
    if (a.prompt) {
      void send(a.prompt);
      return;
    }
    if (a.href) {
      setOpen(false);
      navigate(a.href);
    }
  };

  const openFeedbackDialog = (messageId: string | null) => {
    setFeedbackReason("");
    setFeedbackComment("");
    setFeedbackFor({ messageId, step: "reason" });
  };

  const submitFeedbackReason = async () => {
    if (!feedbackFor || !feedbackReason) return;
    const ok = await feedback(
      "down",
      feedbackFor.messageId ?? undefined,
      feedbackComment.trim() || undefined,
      feedbackReason,
    );
    if (ok) setFeedbackFor({ ...feedbackFor, step: "done" });
  };

  const closeFeedback = () => {
    setFeedbackFor(null);
    setFeedbackReason("");
    setFeedbackComment("");
  };

  const lastServerAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && isServerMessageId(m.id))?.id ?? null;

  if (!isCopilotEnabled) return null;
  if (hideOnAnalysisDesktop || isEmbed) return null;

  return (
    <>
      <Button
        type="button"
        aria-label={open ? "Close Booking Assistant" : "Open Booking Assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] h-12 gap-2 rounded-full px-4 shadow-lg bg-slate-900 text-amber-100 hover:bg-slate-800 dark:bg-amber-100 dark:text-slate-900"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        <span className="hidden sm:inline text-sm font-semibold">Booking Assistant</span>
      </Button>

      {open && (
        <div
          className="fixed bottom-20 right-3 z-[9998] flex w-[min(720px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-card shadow-2xl sm:right-6"
          style={{ height: "min(640px, calc(100vh - 7rem))" }}
        >
          {/* History (signed-in only) */}
          {isAuthenticated ? (
          <aside
            className={`${
              historyOpen ? "absolute inset-y-0 left-0 z-20 flex w-64 shadow-xl" : "hidden"
            } shrink-0 flex-col border-r bg-card sm:static sm:z-auto sm:flex sm:w-52 sm:bg-muted/30 sm:shadow-none`}
            aria-label="Conversation history"
          >
            <div className="flex items-center justify-between gap-1 border-b px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {showArchived ? "Archived" : "History"}
              </span>
              <div className="flex items-center">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setShowArchived((v) => !v)}
                  aria-label={showArchived ? "Show active conversations" : "Show archived conversations"}
                  title={showArchived ? "Show active conversations" : "Show archived conversations"}
                >
                  {showArchived ? <History className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setHistoryOpen(false);
                    void startNew();
                  }}
                  aria-label="New chat"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 sm:hidden"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-start gap-1 rounded-md hover:bg-muted ${
                      conversationId === c.id ? "bg-muted" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void loadConversation(c.id)}
                      className="min-w-0 flex-1 px-2 py-2 text-left text-xs"
                    >
                      <div className={`line-clamp-2 ${conversationId === c.id ? "font-medium" : ""}`}>
                        {c.title || "Conversation"}
                      </div>
                      {c.last_query ? (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.last_query}</div>
                      ) : null}
                      {formatWhen(c.updated_at) ? (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{formatWhen(c.updated_at)}</div>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mt-1 h-6 w-6 shrink-0 opacity-70 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      onClick={() => void archiveConversation(c.id, !showArchived)}
                      aria-label={showArchived ? "Restore conversation" : "Archive conversation"}
                      title={showArchived ? "Restore" : "Archive"}
                    >
                      {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
                {!conversations.length && (
                  <p className="px-2 py-4 text-xs text-muted-foreground">
                    {showArchived ? "No archived conversations." : "No conversations yet."}
                  </p>
                )}
              </div>
            </ScrollArea>
          </aside>
          ) : null}

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Bot className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{assistantName}</div>
                <div className="text-xs text-muted-foreground">IIC · IIT Roorkee · Laboratory intelligence</div>
              </div>
              {isAuthenticated ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="sm:hidden"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-label="Conversation history"
                  aria-expanded={historyOpen}
                >
                  <History className="h-4 w-4" />
                </Button>
              ) : null}
              <Button type="button" size="icon" variant="ghost" onClick={() => void copyLastAssistant()} aria-label="Copy reply">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void feedback("up", lastServerAssistantId ?? undefined)}
                aria-label="Helpful"
                disabled={!conversationId}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => openFeedbackDialog(lastServerAssistantId)}
                aria-label="Not helpful"
                disabled={!conversationId}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>

            {!isAuthenticated ? (
              <div className="border-b bg-amber-50/80 px-4 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                Guest mode: general FAQ, free slots, and rough estimates.{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => {
                    setOpen(false);
                    navigate("/auth");
                  }}
                >
                  Sign in
                </button>{" "}
                for booking, wallet, and your bookings.
              </div>
            ) : null}
            <>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {bootstrapping && (
                      <div className="text-xs text-muted-foreground">Preparing workspace…</div>
                    )}
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                            msg.role === "user"
                              ? "bg-slate-900 text-amber-50 dark:bg-amber-100 dark:text-slate-900"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {msg.role === "assistant" && typeof msg.metadata?.source_label === "string" && msg.metadata.source_label ? (
                            <div className="mb-1.5">
                              <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {msg.metadata.source_label}
                              </span>
                            </div>
                          ) : null}
                          {msg.role === "assistant" ? (
                            <SimpleMarkdown text={msg.content} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          )}
                          {msg.role === "assistant" && (
                            <CopilotCards
                              cards={msg.cards}
                              onNavigate={(href) => {
                                setOpen(false);
                                navigate(href);
                              }}
                              onPrompt={(prompt) => void send(prompt)}
                              onBookSlot={
                                isAuthenticated ? (eqId, slotId) => void prepareBooking(eqId, [slotId]) : undefined
                              }
                              busy={loading}
                              intelligence={Boolean(msg.metadata?.intelligence)}
                              interactive={msg.id === lastAssistantId}
                              onChoice={(kind, value, label) => void send(label, { kind, value })}
                              onAssistantAction={
                                isAuthenticated ? (label, type, payload) => void send(label, undefined, { type, payload }) : undefined
                              }
                            />
                          )}
                          {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 border-t border-border/60 pt-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {msg.citations.some((c) => c.source_type === "manual")
                                  ? "Sources · Equipment manual"
                                  : "Sources · Knowledge document"}
                              </div>
                              <ul className="mt-1 space-y-1">
                                {msg.citations.map((c, idx) => (
                                  <li key={`${c.source_id || c.title}-${idx}`} className="text-xs">
                                    <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                      {c.source_type === "manual"
                                        ? `[${c.n ?? idx + 1}] manual`
                                        : (c.source_type || c.category || "document").toString()}
                                    </span>
                                    {c.source_type === "manual" ? (
                                      <span>
                                        {c.title}
                                        {c.page_label ? <span className="text-muted-foreground">, {c.page_label}</span> : null}
                                        {c.has_file && c.document_id ? (
                                          <button
                                            type="button"
                                            className="ml-2 inline-flex items-center gap-1 text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
                                            onClick={() => void openManual(c.document_id!, c.page)}
                                          >
                                            <FileText className="h-3 w-3" />
                                            Open manual{c.page ? ` at p. ${c.page}` : ""}
                                          </button>
                                        ) : null}
                                      </span>
                                    ) : c.url ? (
                                      <button
                                        type="button"
                                        className="text-left text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
                                        onClick={() => {
                                          if (c.url?.startsWith("/")) {
                                            setOpen(false);
                                            navigate(c.url);
                                          } else if (c.url) {
                                            window.open(c.url, "_blank", "noopener,noreferrer");
                                          }
                                        }}
                                      >
                                        {c.title}
                                      </button>
                                    ) : (
                                      <span>{c.title}</span>
                                    )}
                                    {c.snippet ? (
                                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{c.snippet}</div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {msg.role === "assistant" && isServerMessageId(msg.id) && conversationId && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={() => void feedback("up", msg.id)}
                              >
                                <ThumbsUp className="h-3 w-3" /> Helpful
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={() => openFeedbackDialog(msg.id)}
                              >
                                <ThumbsDown className="h-3 w-3" /> Not helpful
                              </Button>
                            </div>
                          )}
                          {msg.role === "assistant" && msg.suggested_actions && msg.suggested_actions.length > 0 && (() => {
                            const cardChoiceKeys = msg.metadata?.intelligence
                              ? renderedChoiceKeys(msg.cards as unknown as Record<string, unknown>[])
                              : new Set<string>();
                            const actions = msg.suggested_actions.filter(
                              (a) => !a.choice || !cardChoiceKeys.has(`${a.choice.kind}:${a.choice.value}`),
                            );
                            if (!actions.length) return null;
                            const isLatest = msg.id === lastAssistantId;
                            return (
                            <div className="mt-3 space-y-2">
                              {actions.some((a) => a.proposal_id) ? (
                                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                  Nothing changes until you press confirm and approve the summary.
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-1.5">
                                {actions.map((a) => {
                                  const primary = a.primary || a.style === "primary" || Boolean(a.proposal_id);
                                  return (
                                    <Button
                                      key={a.id}
                                      type="button"
                                      size="sm"
                                      variant={primary ? "default" : "outline"}
                                      disabled={
                                        a.enabled === false ||
                                        (loading && Boolean(a.proposal_id || a.type || a.choice || a.action_type)) ||
                                        Boolean(a.proposal_id && usedProposals.has(a.proposal_id)) ||
                                        Boolean(a.choice && !isLatest) ||
                                        Boolean(a.escalate && escalating) ||
                                        (!a.href && !a.prompt && !a.proposal_id && !a.choice && !a.escalate &&
                                          !a.action_type && a.type !== "copilot_prepare_booking")
                                      }
                                      title={a.hint}
                                      className="h-8 rounded-full px-3 text-xs"
                                      onClick={() => handleCopilotAction(a, msg)}
                                    >
                                      {a.label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                            );
                          })()}
                          {msg.escalate_hint && !msg.suggested_actions?.some((a) => a.escalate) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              If this doesn&apos;t answer your question, open Support Tickets or try a more specific prompt.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl bg-muted px-4 py-3">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {hasUserMessages && (commands.length > 0 || suggested.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setQuickOpen((v) => !v)}
                    aria-expanded={quickOpen}
                    className="border-t px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                  >
                    {quickOpen ? "Hide quick actions" : "Show quick actions"}
                  </button>
                )}

                {showQuick && commandGroups.length > 0 && (
                  <div className="max-h-44 space-y-1.5 overflow-y-auto border-t px-3 py-2">
                    {commandGroups.map((g) => (
                      <div key={g.id}>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.label}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.actions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                if (c.choice) {
                                  void send(c.label, c.choice);
                                  return;
                                }
                                if (c.prompt) {
                                  void send(c.prompt);
                                  return;
                                }
                                if (c.href) {
                                  setOpen(false);
                                  navigate(c.href);
                                }
                              }}
                              className="rounded-full border bg-background px-3 py-1 text-left text-xs font-medium text-foreground hover:bg-muted"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showQuick && !commandGroups.length && commands.length > 0 && (
                  <div className="border-t px-3 py-2">
                    {!hasUserMessages && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Quick actions
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {commands.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            // Prefer prompt so quick actions run Copilot (slots/wallet/etc.)
                            // instead of navigating away when both href and prompt exist.
                            if (c.prompt) {
                              void send(c.prompt);
                              return;
                            }
                            if (c.href) {
                              setOpen(false);
                              navigate(c.href);
                            }
                          }}
                          className="rounded-full border bg-background px-3 py-1 text-left text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showQuick && suggested.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t px-3 py-2">
                    {suggested.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={loading}
                        onClick={() => void send(s)}
                        className="rounded-full border bg-background px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {feedbackFor && (
                  <div className="border-t bg-muted/40 p-3" role="region" aria-label="Feedback">
                    {feedbackFor.step === "reason" ? (
                      <>
                        <div className="mb-2 text-xs font-semibold">What was missing?</div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {FEEDBACK_REASONS.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setFeedbackReason(r.value)}
                              aria-pressed={feedbackReason === r.value}
                              className={`rounded-full border px-3 py-1 text-xs ${
                                feedbackReason === r.value
                                  ? "border-slate-900 bg-slate-900 text-amber-50 dark:border-amber-100 dark:bg-amber-100 dark:text-slate-900"
                                  : "bg-background hover:bg-muted"
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <Input
                          placeholder="Optional comment"
                          value={feedbackComment}
                          maxLength={1000}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          className="mb-2"
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => void submitFeedbackReason()} disabled={!feedbackReason}>
                            Submit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={closeFeedback}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 text-xs">
                          Thanks, your feedback was recorded.
                          {canEscalate ? " Do you want the IIC team to look into this?" : ""}
                        </div>
                        <div className="flex gap-2">
                          {canEscalate ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={escalating}
                            onClick={() => {
                              const note = feedbackComment.trim() || undefined;
                              const messageId = feedbackFor.messageId;
                              closeFeedback();
                              void escalate(messageId, "negative_feedback", note);
                            }}
                          >
                            Raise Support Ticket
                          </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" onClick={closeFeedback}>
                            {canEscalate ? "No, thanks" : "Close"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2 border-t p-3">
                  <Input
                    placeholder={isAuthenticated ? "e.g. I need FESEM tomorrow — what are my options?" : "Ask about booking, equipment, wallet, Remote Analysis…"}
                    aria-label="Message Booking Assistant"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button type="button" size="icon" onClick={() => void send()} disabled={loading || !input.trim()} aria-label="Send">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
          </div>

          {pendingConfirm && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="copilot-confirm-title"
            >
              <div className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-xl">
                <div id="copilot-confirm-title" className="text-sm font-semibold">
                  {pendingConfirm.card?.title || pendingConfirm.label}
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {pendingConfirm.card?.equipment_name ? <li>Equipment: {pendingConfirm.card.equipment_name}</li> : null}
                  {pendingConfirm.card?.booking_id ? <li>Booking: {String(pendingConfirm.card.booking_id)}</li> : null}
                  {pendingConfirm.card?.when_label ? (
                    <li>When: {pendingConfirm.card.when_label}</li>
                  ) : pendingConfirm.card?.date ? (
                    <li>Date: {pendingConfirm.card.date}</li>
                  ) : null}
                  {pendingConfirm.card?.start_time && !pendingConfirm.card.when_label ? (
                    <li>
                      Time: {String(pendingConfirm.card.start_time).slice(11, 16)}
                      {pendingConfirm.card.end_time ? `–${String(pendingConfirm.card.end_time).slice(11, 16)}` : ""}
                    </li>
                  ) : null}
                  {pendingConfirm.card?.sample_count ? <li>Samples: {pendingConfirm.card.sample_count}</li> : null}
                  {pendingConfirm.card?.total_amount != null ? (
                    <li>
                      Estimated total: ₹{String(pendingConfirm.card.total_amount)}
                      {pendingConfirm.card.gst_amount ? " (incl. GST)" : ""}
                    </li>
                  ) : pendingConfirm.card?.estimated_amount != null ? (
                    <li>Estimated charge: ₹{String(pendingConfirm.card.estimated_amount)}</li>
                  ) : null}
                  {pendingConfirm.card?.wallet_label ? <li>Charged to: {pendingConfirm.card.wallet_label}</li> : null}
                  {pendingConfirm.card?.requested_amount != null ? (
                    <li>Requested credit: ₹{String(pendingConfirm.card.requested_amount)}</li>
                  ) : null}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  {CONFIRM_WARNINGS[pendingConfirm.mutation_action || ""] || "Booking Assistant will carry out this action for you."}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPendingConfirm(null)}>
                    Go back
                  </Button>
                  <Button type="button" size="sm" onClick={() => void runConfirm(pendingConfirm)} disabled={loading}>
                    {pendingConfirm.label}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export { isViteCopilotEnabled as isCopilotEnabled };
