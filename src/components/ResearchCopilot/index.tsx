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
  }>;
};

type ConversationSummary = {
  id: string;
  title: string;
  updated_at?: string | null;
};

const isCopilotEnabled =
  String(import.meta.env.VITE_RESEARCH_COPILOT_ENABLED || "").toLowerCase() === "true";

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
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [assistantName, setAssistantName] = useState("IIC Research Copilot");
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcome = useMemo(
    () =>
      `I am **${assistantName}** — your laboratory officer, booking assistant, and research guide for IIC IIT Roorkee.\n\nAsk about equipment selection, bookings, wallet, sample status, Remote Analysis, or DSA (admins). I will not invent live data or claim actions I cannot perform.`,
    [assistantName],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const refreshList = useCallback(async () => {
    const res = await apiClient.researchCopilotListConversations();
    if (res.data?.results) setConversations(res.data.results);
  }, []);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const res = await apiClient.researchCopilotCreateConversation();
    const id = res.data?.conversation?.id;
    if (!id) throw new Error(res.error || "Could not start conversation");
    setConversationId(id);
    if (res.data?.suggested_prompts) setSuggested(res.data.suggested_prompts);
    await refreshList();
    return id;
  }, [conversationId, refreshList]);

  const bootstrap = useCallback(async () => {
    if (!isAuthenticated) return;
    setBootstrapping(true);
    try {
      const res = await apiClient.researchCopilotBootstrap();
      if (res.data) {
        setAssistantName(res.data.assistant_name || "IIC Research Copilot");
        setSuggested(res.data.suggested_prompts || []);
      }
      await refreshList();
      if (!messages.length) {
        setMessages([{ id: "welcome", role: "assistant", content: welcome }]);
      }
    } finally {
      setBootstrapping(false);
    }
  }, [isAuthenticated, messages.length, refreshList, welcome]);

  useEffect(() => {
    if (open && isAuthenticated) void bootstrap();
  }, [open, isAuthenticated, bootstrap]);

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
    const res = await apiClient.researchCopilotCreateConversation();
    if (res.data?.conversation?.id) {
      setConversationId(res.data.conversation.id);
      if (res.data.suggested_prompts) setSuggested(res.data.suggested_prompts);
      await refreshList();
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading || !isAuthenticated) return;
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setLoading(true);
    try {
      const id = await ensureConversation();
      const res = await apiClient.researchCopilotSendMessage(id, text);
      if (res.error || !res.data?.message) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: res.error || "Something went wrong. Please try again or open Support Tickets.",
            escalate_hint: true,
          },
        ]);
        return;
      }
      const msg = res.data.message;
      setMessages((m) => [
        ...m,
        {
          id: msg.id,
          role: "assistant",
          content: msg.content,
          confidence: msg.confidence,
          escalate_hint: msg.escalate_hint,
          citations: msg.citations,
          suggested_actions: msg.suggested_actions,
        },
      ]);
      if (res.data.suggested_prompts) setSuggested(res.data.suggested_prompts);
      await refreshList();
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Unable to reach Research Copilot. Check your session and try again.",
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

  const feedback = async (rating: "up" | "down") => {
    if (!conversationId) return;
    await apiClient.researchCopilotFeedback(conversationId, { rating });
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
          {/* History */}
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
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Sign in to use IIC Research Copilot.
              </div>
            ) : (
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
                                Sources
                              </div>
                              <ul className="mt-1 space-y-1">
                                {msg.citations.map((c, idx) => (
                                  <li key={`${c.source_id || c.title}-${idx}`} className="text-xs">
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
                                        {c.category ? ` · ${c.category}` : ""}
                                      </button>
                                    ) : (
                                      <span>
                                        {c.title}
                                        {c.category ? ` · ${c.category}` : ""}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {msg.role === "assistant" && msg.suggested_actions && msg.suggested_actions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.suggested_actions.map((a) => (
                                <Button
                                  key={a.id}
                                  type="button"
                                  size="sm"
                                  variant={a.enabled === false ? "outline" : "secondary"}
                                  disabled={a.enabled === false}
                                  title={a.hint}
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    if (a.href) {
                                      setOpen(false);
                                      navigate(a.href);
                                    }
                                  }}
                                >
                                  {a.label}
                                </Button>
                              ))}
                            </div>
                          )}
                          {msg.escalate_hint && (
                            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                              Low confidence or human help requested — use Support Tickets for escalation (AI.5 will auto-create).
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
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { isCopilotEnabled };
