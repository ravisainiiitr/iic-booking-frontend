import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Copy,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number | null;
  escalate_hint?: boolean;
  citations?: Array<{
    source_id?: string;
    title: string;
    snippet?: string;
    score?: number;
    url?: string;
    category?: string;
    source_type?: string;
  }>;
  suggested_actions?: Array<{
    id: string;
    label: string;
    href?: string;
    enabled?: boolean;
    hint?: string;
    requires_confirmation?: boolean;
  }>;
};

type ConversationSummary = {
  id: string;
  title: string;
  updated_at?: string | null;
};

type CommandAction = {
  id: string;
  label: string;
  href?: string;
  prompt?: string;
};

/**
 * Soft gate: backend `enabled` is authoritative.
 * Build/runtime may explicitly set false to hide the FAB without calling the API.
 * Default (unset) → allow bootstrap so production Copilot is not blocked by a missing Vite flag.
 */
function readCopilotSoftGate(): boolean {
  const runtime =
    typeof window !== "undefined"
      ? (window as unknown as { __RUNTIME_CONFIG__?: { VITE_RESEARCH_COPILOT_ENABLED?: string | boolean } })
          .__RUNTIME_CONFIG__?.VITE_RESEARCH_COPILOT_ENABLED
      : undefined;
  const raw =
    runtime !== undefined && runtime !== null && String(runtime) !== ""
      ? String(runtime)
      : String(import.meta.env.VITE_RESEARCH_COPILOT_ENABLED || "");
  if (!raw) return true;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

const isViteCopilotEnabled = readCopilotSoftGate();

const DEFAULT_COMMANDS: CommandAction[] = [
  { id: "next_booking", label: "My next booking", prompt: "What is my next booking?" },
  { id: "my_bookings", label: "My bookings", href: "/my-bookings", prompt: "List my recent bookings." },
  { id: "booking_status", label: "Check booking status", prompt: "What is the status of my latest booking?" },
  { id: "sample_status", label: "Check sample status", prompt: "What is the sample status of my latest booking?" },
  { id: "results", label: "Check results", prompt: "Are results available for my latest completed booking?" },
  { id: "find_equipment", label: "Find equipment", href: "/equipments", prompt: "Help me find suitable equipment for my sample." },
  { id: "search_slots", label: "Search available slots", prompt: "Search available slots for FESEM this week." },
  { id: "estimate_cost", label: "Estimate booking cost", prompt: "Estimate the cost of booking FESEM for 2 hours." },
  { id: "wallet", label: "Wallet / recharge", href: "/wallet", prompt: "What is my wallet balance?" },
  { id: "software", label: "Find Analysis Software", href: "/remote-analysis/software-catalog" },
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
    return "Research Copilot rate limit reached. Please wait a bit, or continue using the normal booking portal.";
  }
  if (status === 503 || raw.includes("disabled") || raw.includes("not enabled")) {
    return "Research Copilot is not enabled on this environment right now.";
  }
  if (status === 0 || raw.includes("network") || raw.includes("failed to fetch")) {
    return "Unable to reach Research Copilot. Check your network connection, then try again.";
  }
  if (raw.includes("busy") || status === 409) {
    return "Research Copilot is busy. Please try again in a moment.";
  }
  return res.error || "Research Copilot could not complete that request. You can continue using the booking portal.";
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

export default function ResearchCopilot() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [backendEnabled, setBackendEnabled] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [commands, setCommands] = useState<CommandAction[]>(
    isAuthenticated ? DEFAULT_COMMANDS : PUBLIC_DEFAULT_COMMANDS,
  );
  const [assistantName, setAssistantName] = useState("IIC Research Copilot");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isCopilotEnabled = isViteCopilotEnabled && backendEnabled !== false;

  const welcome = useMemo(
    () =>
      isAuthenticated
        ? `I am **${assistantName}** — your laboratory officer, booking assistant, and research guide for IIC IIT Roorkee.\n\nAsk about equipment selection, bookings, wallet, sample status, Remote Analysis, or DSA (admins). I will not invent live data or claim actions I cannot perform.`
        : `I am **${assistantName}** (guest mode).\n\nAsk about equipment, free slots, rough charge estimates, HOLD meaning, sample acceptance, manuals, or Remote Analysis troubleshooting. Sign in to book, check wallet, or view your bookings.`,
    [assistantName, isAuthenticated],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const refreshList = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    const res = await apiClient.researchCopilotListConversations();
    if (res.data?.results) setConversations(res.data.results);
  }, [isAuthenticated]);

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
        setAssistantName(res.data.assistant_name || "IIC Research Copilot");
        setSuggested(res.data.suggested_prompts || []);
        const ca = (res.data as { command_actions?: CommandAction[] }).command_actions;
        if (ca?.length) setCommands(ca);
        else setCommands(isAuthenticated ? DEFAULT_COMMANDS : PUBLIC_DEFAULT_COMMANDS);
      } else if (res.error) {
        setBackendEnabled(false);
        setOpen(false);
        return;
      }
      if (isAuthenticated) await refreshList();
      if (!messages.length) {
        setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
      }
    } finally {
      setBootstrapping(false);
    }
  }, [isAuthenticated, messages.length, refreshList, welcome]);

  useEffect(() => {
    if (!isViteCopilotEnabled) return;
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
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            confidence: m.confidence,
            escalate_hint: m.escalate_hint,
            citations: m.citations,
            suggested_actions: m.suggested_actions,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
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

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
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
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: String(msg.content || ""),
            escalate_hint: Boolean(msg.escalate_hint),
            citations: (msg.citations || []) as CopilotMessage["citations"],
            suggested_actions: (msg.suggested_actions || []) as CopilotMessage["suggested_actions"],
          },
        ]);
        return;
      }

      const id = await ensureConversation();
      const res = await apiClient.researchCopilotSendMessage(id, text);
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
            "Research Copilot is temporarily unavailable. You can continue using the normal booking portal.",
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

  const feedback = async (rating: "up" | "down", messageId?: string, comment?: string) => {
    if (!conversationId) return;
    await apiClient.researchCopilotFeedback(conversationId, {
      rating,
      message_id: messageId,
      comment,
    });
  };

  const submitReport = async () => {
    if (!conversationId || !reportText.trim()) return;
    await feedback("down", reportMessageId || undefined, `INCORRECT: ${reportText.trim()}`);
    setReportOpen(false);
    setReportText("");
    setReportMessageId(null);
  };

  if (!isCopilotEnabled) return null;

  return (
    <>
      <Button
        type="button"
        aria-label={open ? "Close Research Copilot" : "Open Research Copilot"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] h-14 gap-2 rounded-full px-5 shadow-lg bg-slate-900 text-amber-100 hover:bg-slate-800 dark:bg-amber-100 dark:text-slate-900"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        <span className="hidden sm:inline text-sm font-semibold">Research Copilot</span>
      </Button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-[9998] flex w-[min(720px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-card shadow-2xl"
          style={{ height: "min(640px, 78vh)" }}
        >
          {/* History (signed-in only) */}
          {isAuthenticated ? (
          <aside className="hidden w-52 shrink-0 flex-col border-r bg-muted/30 sm:flex">
            <div className="flex items-center justify-between border-b px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => void startNew()} aria-label="New chat">
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void loadConversation(c.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-xs hover:bg-muted ${
                      conversationId === c.id ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <div className="line-clamp-2">{c.title || "Conversation"}</div>
                  </button>
                ))}
                {!conversations.length && (
                  <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
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
              <Button type="button" size="icon" variant="ghost" onClick={() => void copyLastAssistant()} aria-label="Copy reply">
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => void feedback("up")} aria-label="Helpful">
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => void feedback("down")} aria-label="Not helpful">
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
                          {msg.role === "assistant" ? (
                            <SimpleMarkdown text={msg.content} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          )}
                          {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 border-t border-border/60 pt-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Sources · Knowledge document
                              </div>
                              <ul className="mt-1 space-y-1">
                                {msg.citations.map((c, idx) => (
                                  <li key={`${c.source_id || c.title}-${idx}`} className="text-xs">
                                    <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                      {(c.source_type || c.category || "document").toString()}
                                    </span>
                                    {c.url ? (
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
                          {msg.role === "assistant" && msg.id !== "welcome" && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => void feedback("up", msg.id)}
                              >
                                Helpful
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => {
                                  setReportMessageId(msg.id);
                                  setReportOpen(true);
                                }}
                              >
                                Report incorrect
                              </Button>
                            </div>
                          )}
                          {msg.role === "assistant" && msg.suggested_actions && msg.suggested_actions.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.suggested_actions.some((a) => a.requires_confirmation) && (
                                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                  Suggested action — opens the portal so you can review and confirm. Copilot does not
                                  change bookings, wallet, or reservations by itself.
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {msg.suggested_actions.map((a) => (
                                  <Button
                                    key={a.id}
                                    type="button"
                                    size="sm"
                                    variant={
                                      a.requires_confirmation
                                        ? "default"
                                        : a.enabled === false
                                          ? "outline"
                                          : "secondary"
                                    }
                                    disabled={a.enabled === false || !a.href}
                                    title={
                                      a.requires_confirmation
                                        ? `${a.hint || a.label} — you must confirm in the portal before anything changes.`
                                        : a.hint
                                    }
                                    className="h-8 text-xs"
                                    onClick={() => {
                                      if (a.href) {
                                        setOpen(false);
                                        navigate(a.href);
                                      }
                                    }}
                                  >
                                    {a.requires_confirmation ? `Review & confirm: ${a.label}` : a.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.escalate_hint && (
                            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                              Low confidence or human help requested — use Support Tickets for escalation.
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

                {commands.length > 0 && (
                  <div className="border-t px-3 py-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Quick actions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {commands.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            if (c.href) {
                              setOpen(false);
                              navigate(c.href);
                            } else if (c.prompt) {
                              void send(c.prompt);
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

                {suggested.length > 0 && (
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

                {reportOpen && (
                  <div className="border-t bg-muted/40 p-3">
                    <div className="mb-1 text-xs font-semibold">Report incorrect answer</div>
                    <Input
                      placeholder="What was wrong? (helps admins improve knowledge)"
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void submitReport()} disabled={!reportText.trim()}>
                        Submit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReportOpen(false);
                          setReportText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 border-t p-3">
                  <Input
                    placeholder="Ask about booking, equipment, wallet, Remote Analysis…"
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
        </div>
      )}
    </>
  );
}

export { isViteCopilotEnabled as isCopilotEnabled };
