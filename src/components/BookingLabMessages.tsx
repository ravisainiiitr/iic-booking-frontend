import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BellRing, CheckCircle2, CornerDownRight, HelpCircle, Loader2, MessageSquare, Send, X } from "lucide-react";
import { apiClient, type BookingLabMessage, type BookingLabMessageThread } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RECENT_COUNT = 4;

interface BookingLabMessagesProps {
  bookingId: number;
  /** Called whenever the thread is (re)loaded or changes, so the parent can show send actions and banners. */
  onThreadChange?: (thread: BookingLabMessageThread | null) => void;
  /** Change to reload the thread (e.g. after a reminder was sent from the actions area). */
  refreshKey?: number;
}

function formatSentAt(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "d MMM yyyy, h:mm a");
}

function formatReplyBy(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : format(date, "d MMM yyyy");
}

function isOverdue(value: string | null | undefined): boolean {
  return Boolean(value) && String(value) < format(new Date(), "yyyy-MM-dd");
}

function QuestionStatus({ message }: { message: BookingLabMessage }) {
  if (message.kind !== "staff_question") return null;
  if (message.question_open) {
    return (
      <Badge className="border-amber-300 bg-amber-100 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
        Awaiting reply
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
      {message.resolved_at && !message.answered_at ? "Resolved" : "Answered"}
    </Badge>
  );
}

function MessageItem({
  message,
  quoted,
  canResolve,
  resolving,
  onResolve,
}: {
  message: BookingLabMessage;
  quoted?: BookingLabMessage;
  canResolve: boolean;
  resolving: boolean;
  onResolve: (id: number) => void;
}) {
  const isStaff = message.kind === "staff_reply" || message.kind === "staff_reminder" || message.kind === "staff_question";
  const isReminder = message.kind === "staff_reminder";
  const isQuestion = message.kind === "staff_question";
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isQuestion
          ? message.question_open
            ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30"
            : "border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20"
          : isReminder
            ? "border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20"
            : isStaff
              ? "border-primary/25 bg-primary/5"
              : "bg-background",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {isReminder ? <BellRing className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden /> : null}
        {isQuestion ? <HelpCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden /> : null}
        <span className="font-medium text-foreground">{message.is_mine ? "You" : message.sender_name}</span>
        <Badge variant={isStaff ? "default" : "secondary"} className="text-[11px] font-medium">
          {message.sender_role}
        </Badge>
        {isReminder ? (
          <Badge variant="outline" className="text-[11px] font-medium">
            Reminder
          </Badge>
        ) : null}
        <QuestionStatus message={message} />
        <span className="text-xs text-muted-foreground">{formatSentAt(message.created_at)}</span>
      </div>
      {quoted ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">Reply to: {quoted.message}</span>
        </p>
      ) : message.reason && !isStaff ? (
        <Badge variant="outline" className="mt-1.5 text-[11px] font-normal">
          {message.reason}
        </Badge>
      ) : null}
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{message.message}</p>
      {isQuestion && message.reply_by ? (
        <p
          className={cn(
            "mt-1 text-xs",
            message.question_open && isOverdue(message.reply_by)
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
        >
          Reply needed by {formatReplyBy(message.reply_by)}
          {message.question_open && isOverdue(message.reply_by) ? " (overdue)" : ""}
        </p>
      ) : null}
      {canResolve && isQuestion && message.question_open ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={resolving}
            onClick={() => onResolve(message.id)}
          >
            {resolving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            Mark resolved
          </Button>
        </div>
      ) : null}
    </li>
  );
}

const BookingLabMessages = ({ bookingId, onThreadChange, refreshKey = 0 }: BookingLabMessagesProps) => {
  const [thread, setThread] = useState<BookingLabMessageThread | null>(null);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const onThreadChangeRef = useRef(onThreadChange);
  onThreadChangeRef.current = onThreadChange;

  const load = useCallback(async () => {
    const res = await apiClient.getBookingLabMessages(bookingId);
    setThread(res.data ?? null);
  }, [bookingId]);

  useEffect(() => {
    setThread(null);
    setReason("");
    setText("");
    setShowAll(false);
    setReplyTo(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey, load]);

  useEffect(() => {
    onThreadChangeRef.current?.(thread);
  }, [thread]);

  if (!thread) return null;

  const { messages, can_post: canPost } = thread;
  const canAnswer = Boolean(thread.can_answer);
  const isStaffView = thread.viewer === "staff" || thread.viewer === "other";
  // Staff only see the card once there is a message; booking users see it while messaging is open.
  if (messages.length === 0 && !canPost) return null;
  const canReply = isStaffView && thread.can_reply;
  const openQuestions = messages.filter((m) => m.kind === "staff_question" && m.question_open);
  const replyTarget = replyTo != null ? messages.find((m) => m.id === replyTo) : undefined;
  const userCanWrite = canPost || (canAnswer && replyTarget != null);
  const canWrite = userCanWrite || canReply;
  const byId = new Map(messages.map((m) => [m.id, m]));

  const maxLength = thread.max_length || 1000;
  const trimmed = text.trim();
  const limitReached = !isStaffView && thread.remaining_today <= 0;
  const hiddenCount = showAll ? 0 : Math.max(0, messages.length - RECENT_COUNT);
  const visible = hiddenCount ? messages.slice(-RECENT_COUNT) : messages;

  const startReply = (questionId: number) => {
    setReplyTo(questionId);
    setReason("");
    window.setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const handleResolve = async (questionId: number) => {
    setResolvingId(questionId);
    try {
      const res = await apiClient.resolveBookingLabQuestion(bookingId, questionId);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not update the question.");
        return;
      }
      const updated = res.data.message;
      setThread((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.id === updated.id ? updated : m)),
              open_question_count: Math.max(0, (prev.open_question_count ?? 1) - 1),
            }
          : prev,
      );
      toast.success("Question marked as resolved.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleSend = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = userCanWrite
        ? await apiClient.sendBookingLabMessage(bookingId, trimmed, reason || undefined, replyTarget?.id)
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
      const answeredId = replyTarget?.id;
      setThread((prev) => {
        if (!prev) return prev;
        const updated = prev.messages.map((m) =>
          answeredId != null && m.id === answeredId && m.question_open
            ? { ...m, question_open: false, answered_at: sent.created_at }
            : m,
        );
        const stillOpen = updated.filter((m) => m.kind === "staff_question" && m.question_open).length;
        return {
          ...prev,
          messages: [...updated, sent],
          remaining_today: remaining,
          open_question_count: stillOpen,
          can_answer: prev.can_answer && stillOpen > 0,
        };
      });
      setText("");
      setReason("");
      setReplyTo(null);
      toast.success(
        answeredId != null
          ? "Reply sent to the lab."
          : userCanWrite
            ? "Message sent to the Lab Operator and Officer In-Charge."
            : "Reply sent to the booking user.",
      );
      (res.data.warnings || []).forEach((w) => toast.warning(w));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t no-print" id={`lab-messages-${bookingId}`}>
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
              {isStaffView ? "Messages with the booking user" : "Message the lab"}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isStaffView
                ? "Messages between the booking user and the Lab Operator / Officer In-Charge of this equipment, including reminders and questions sent from Actions."
                : "Let the Lab Operator and Officer In-Charge know about anything affecting this booking — for example, a delay in sample submission."}
            </p>
          </div>
        </div>

        {!isStaffView && openQuestions.length > 0 ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-700 dark:bg-amber-950/40"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <HelpCircle className="h-4 w-4" aria-hidden />
              Question from the lab — reply needed
            </p>
            <ul className="mt-2 space-y-2">
              {openQuestions.map((q) => (
                <li key={q.id} className="text-sm">
                  <p className="whitespace-pre-wrap break-words text-foreground">{q.message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      {q.sender_name}, {q.sender_role}
                      {q.reply_by ? ` · reply by ${formatReplyBy(q.reply_by)}` : ""}
                    </span>
                    {canAnswer ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={replyTo === q.id ? "default" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => startReply(q.id)}
                      >
                        Reply
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
                <MessageItem
                  key={m.id}
                  message={m}
                  quoted={m.in_reply_to != null ? byId.get(m.in_reply_to) : undefined}
                  canResolve={canReply}
                  resolving={resolvingId === m.id}
                  onResolve={(id) => void handleResolve(id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {canWrite ? (
          <div className="space-y-2.5">
            {replyTarget ? (
              <div className="flex items-start justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Replying to:</span>{" "}
                  <span className="line-clamp-2 text-muted-foreground">{replyTarget.message}</span>
                </span>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                  onClick={() => setReplyTo(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {canPost && !replyTarget ? (
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
                {replyTarget ? "Your reply" : userCanWrite ? "Your message" : "Reply to the booking user"}
              </Label>
              <Textarea
                id={`lab-message-text-${bookingId}`}
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
                rows={3}
                placeholder={
                  replyTarget
                    ? "Write your answer to the lab's question…"
                    : userCanWrite
                      ? "e.g. My sample will reach the lab by 11:00 AM tomorrow instead of today."
                      : "Write a reply…"
                }
                disabled={sending || limitReached}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {replyTarget
                    ? "Emailed to the person who asked and to the Lab Operator and Officer In-Charge of this equipment."
                    : userCanWrite
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
            ) : userCanWrite && thread.remaining_today <= 3 ? (
              <p className="text-xs text-muted-foreground">
                You can send {thread.remaining_today} more {thread.remaining_today === 1 ? "message" : "messages"} for
                this booking today.
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => void handleSend()} disabled={!trimmed || sending || limitReached}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {replyTarget ? "Send reply" : userCanWrite ? "Send message" : "Send reply"}
              </Button>
            </div>
          </div>
        ) : !isStaffView && canAnswer ? (
          <p className="text-sm text-muted-foreground">Use Reply on the question above to answer the lab.</p>
        ) : thread.closed_reason && !isStaffView ? (
          <p className="text-sm text-muted-foreground">{thread.closed_reason}</p>
        ) : null}
      </section>
    </div>
  );
};

export default BookingLabMessages;
