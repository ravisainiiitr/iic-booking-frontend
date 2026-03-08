import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ticketId?: number;
};

const WELCOME = "Hi! Ask me anything about booking equipment, slots, wallet, or urgent requests. For complex issues I'll create a support ticket for you.";

export default function ChatWidget() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "welcome", role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await apiClient.chatAgent({
        message: text,
        ...(!isAuthenticated && user?.name && { public_name: user.name }),
        ...(!isAuthenticated && user?.email && { public_email: user.email }),
      });
      if (res.error) {
        setMessages((m) => [
          ...m,
          { id: `e-${Date.now()}`, role: "assistant", content: res.error || "Something went wrong. Please try again or create a support ticket from the menu." },
        ]);
        return;
      }
      const reply = res.data?.reply ?? "Thanks for your message.";
      const ticketId = res.data?.ticket_id ?? undefined;
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: reply, ticketId },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `e-${Date.now()}`, role: "assistant", content: "Unable to send. Please try again or use Create Support Ticket from the menu." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <Button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[9998] flex w-[min(400px,calc(100vw-3rem))] flex-col rounded-xl border bg-card shadow-xl"
          style={{ height: "min(420px, 60vh)" }}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="font-medium">Help</span>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.ticketId != null && (
                      <Button
                        variant="link"
                        className="mt-2 h-auto p-0 text-xs text-inherit underline"
                        onClick={() => {
                          setOpen(false);
                          navigate("/tickets");
                        }}
                      >
                        View ticket #{msg.ticketId}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div className="flex gap-2 border-t p-3">
            <Input
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
