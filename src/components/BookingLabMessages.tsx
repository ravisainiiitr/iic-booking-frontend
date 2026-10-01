import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { apiClient, type BookingLabMessage, type BookingLabMessageThread } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RECENT_COUNT = 4;

interface BookingLabMessagesProps {
  bookingId: number;
}

function formatSentAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "d MMM yyyy, h:mm a");
}

function MessageItem({ message }: { message: BookingLabMessage }) {
  const isReply = message.kind === "staff_reply";
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isReply ? "border-primary/25 bg-primary/5" : "bg-background",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-foreground">{message.is_mine ? "You" : message.sender_name}</span>
        <Badge variant={isReply ? "default" : "secondary"} className="text-[11px] font-medium">
          {message.sender_role}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatSentAt(message.created_at)}</span>
      </div>
      {message.reason ? (
        <Badge variant="outline" className="mt-1.5 text-[11px] font-normal">
          {message.reason}
        </Badge>
      ) : null}
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{message.message}</p>
    </li>
  );
}

const BookingLabMessages = ({ bookingId }: BookingLabMessagesProps) => {
  const [thread, setThread] = useState<BookingLabMessageThread | null>(null);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const res = await apiClient.getBookingLabMessages(bookingId);
    setThread(res.data ?? null);
  }, [bookingId]);

  useEffect(() => {
    setThread(null);
    setReason("");
    setText("");
    setShowAll(false);
    void load();
  }, [load]);

  if (!thread) return null;

  const { messages, can_post: canPost } = thread;
  const isStaffView = thread.viewer === "staff" || thread.viewer === "other";
  // Staff only see the card once the booking user has written; booking users see it while messaging is open.
  if (messages.length === 0 && !canPost) return null;
  const canReply = isStaffView && thread.can_reply;
  const canWrite = canPost || canReply;

  const maxLength = thread.max_length || 1000;
  const trimmed = text.trim();
  const limitReached = canPost && thread.remaining_today <= 0;
  const hiddenCount = showAll ? 0 : Math.max(0, messages.length - RECENT_COUNT);
  const visible = hiddenCount ? messages.slice(-RECENT_COUNT) : messages;

  const handleSend = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = canPost
        ? await apiClient.sendBookingLabMessage(bookingId, trimmed, reason || undefined)
        : await apiClient.replyToBookingLabMessage(bookingId, trimmed);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not send your message. Please try again.");
        return;
      }
      const sent = res.data.message;
      const remaining: number =
        "remaining_today" in res.data && typeof res.data.remaining_today === "number"
          ? res.data.remaining_today
          : thread.remaining_today;
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, sent], remaining_today: remaining } : prev,
      );
      setText("");
      setReason("");
      toast.success(
        canPost
          ? "Message sent to the Lab Operator and Officer In-Charge."
          : "Reply sent to the booking user.",
      );
      (res.data.warnings || []).forEach((w) => toast.warning(w));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t no-print">
      <section
        aria-labelledby={`lab-messages-title-${bookingId}`}
        className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id={`lab-messages-title-${bookingId}`} className="text-base font-semibold leading-tight">
              {isStaffView ? "Messages from the booking user" : "Message the lab"}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isStaffView
                ? "Messages the booking user sent to the Lab Operator and Officer In-Charge of this equipment."
                : "Let the Lab Operator and Officer In-Charge know about anything affecting this booking — for example, a delay in sample submission."}
            </p>
          </div>
        </div>

        {messages.length > 0 ? (
          <div className="space-y-2">
            {hiddenCount > 0 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() => setShowAll(true)}
              >
                Show {hiddenCount} earlier {hiddenCount === 1 ? "message" : "messages"}
              </Button>
            ) : null}
            <ul className="space-y-2" aria-label="Messages">
              {visible.map((m) => (
                <MessageItem key={m.id} message={m} />
              ))}
            </ul>
          </div>
        ) : null}

        {canWrite ? (
          <div className="space-y-2.5">
            {canPost ? (
              <div className="space-y-1.5">
                <Label className="text-sm" id={`lab-message-reason-${bookingId}`}>
                  What is this about? <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div
                  role="radiogroup"
                  aria-labelledby={`lab-message-reason-${bookingId}`}
                  className="flex flex-wrap gap-2"
                >
                  {thread.reasons.map((r) => {
                    const selected = reason === r.code;
                    return (
                      <button
                        key={r.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setReason(selected ? "" : r.code)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`lab-message-text-${bookingId}`} className="text-sm">
                {canPost ? "Your message" : "Reply to the booking user"}
              </Label>
              <Textarea
                id={`lab-message-text-${bookingId}`}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
                rows={3}
                placeholder={
                  canPost
                    ? "e.g. My sample will reach the lab by 11:00 AM tomorrow instead of today."
                    : "Write a reply…"
                }
                disabled={sending || limitReached}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {canPost
                    ? "Emailed to the Lab Operator and Officer In-Charge of this equipment and saved on this booking."
                    : "Emailed to the booking user; the other lab staff of this equipment get a copy."}
                </span>
                <span aria-live="polite" className={cn(text.length >= maxLength && "text-destructive")}>
                  {text.length}/{maxLength}
                </span>
              </div>
            </div>
            {limitReached ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                You have sent {thread.daily_limit} messages for this booking in the last 24 hours. Please try again later
                or contact the lab directly.
              </p>
            ) : canPost && thread.remaining_today <= 3 ? (
              <p className="text-xs text-muted-foreground">
                You can send {thread.remaining_today} more {thread.remaining_today === 1 ? "message" : "messages"} for
                this booking today.
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => void handleSend()} disabled={!trimmed || sending || limitReached}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {canPost ? "Send message" : "Send reply"}
              </Button>
            </div>
          </div>
        ) : thread.closed_reason && !isStaffView ? (
          <p className="text-sm text-muted-foreground">{thread.closed_reason}</p>
        ) : null}
      </section>
    </div>
  );
};

export default BookingLabMessages;
