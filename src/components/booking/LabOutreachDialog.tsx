import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { BellRing, HelpCircle, Loader2, Mail, Send } from "lucide-react";
import {
  apiClient,
  type BookingLabMessage,
  type LabOutreachKind,
  type LabOutreachOptions,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface LabOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  kind: LabOutreachKind;
  options: LabOutreachOptions;
  onSent: (message: BookingLabMessage, kind: LabOutreachKind, remainingToday: number) => void;
}

function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const COPY: Record<LabOutreachKind, { title: string; description: string; label: string; placeholder: string; send: string; sent: string }> = {
  reminder: {
    title: "Send reminder",
    description: "Pick a reminder or write your own. The user gets an email and a notification, and it is saved on this booking.",
    label: "Reminder",
    placeholder: "e.g. Please bring your sample to the lab by 10:00 AM tomorrow.",
    send: "Send reminder",
    sent: "Reminder sent",
  },
  question: {
    title: "Ask the user",
    description: "Ask anything about this booking. The user is asked to reply from the booking page; you are notified when they do.",
    label: "Question",
    placeholder: "e.g. Please confirm that your sample is non-magnetic.",
    send: "Send question",
    sent: "Question sent",
  },
};

const LabOutreachDialog = ({ open, onOpenChange, bookingId, kind, options, onSent }: LabOutreachDialogProps) => {
  const kindOptions = options[kind];
  const copy = COPY[kind];
  const [preset, setPreset] = useState("");
  const [text, setText] = useState("");
  const [replyBy, setReplyBy] = useState("");
  const [sending, setSending] = useState(false);
  const requestIdRef = useRef("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    requestIdRef.current = newRequestId();
    const first = kind === "reminder" ? kindOptions.presets.find((p) => p.code !== "custom" && p.text) : undefined;
    setPreset(first?.code ?? "");
    setText(first?.text ?? "");
    setReplyBy("");
    setSending(false);
    // Options are refreshed after each send; only reset when the dialog opens or the kind changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const maxLength = options.max_length || 1000;
  const trimmed = text.trim();
  const limitReached = kindOptions.remaining_today <= 0;
  const blocked = !options.can_send || limitReached;
  const today = useMemo(() => new Date(), []);
  const minDate = format(today, "yyyy-MM-dd");
  const maxDate = format(addDays(today, options.max_reply_by_days || 60), "yyyy-MM-dd");

  const choosePreset = (code: string) => {
    const p = kindOptions.presets.find((x) => x.code === code);
    setPreset(code);
    if (p && p.text) setText(p.text.slice(0, maxLength));
    if (code === "custom") {
      setText("");
      window.setTimeout(() => textRef.current?.focus(), 0);
    }
  };

  const handleSend = async () => {
    if (!trimmed || sending || blocked) return;
    setSending(true);
    try {
      const res = await apiClient.sendBookingLabOutreach(bookingId, kind, {
        message: trimmed,
        preset: preset || undefined,
        reply_by: kind === "question" && replyBy ? replyBy : undefined,
        client_request_id: requestIdRef.current,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not send. Please try again.");
        return;
      }
      if (res.data.duplicate) {
        toast.info((res.data.warnings || [])[0] || "This was already sent.");
      } else {
        toast.success(`${copy.sent} to ${options.recipient_name}.`);
        (res.data.warnings || []).forEach((w) => toast.warning(w));
      }
      onSent(res.data.message, kind, res.data.remaining_today);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const Icon = kind === "reminder" ? BellRing : HelpCircle;

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!options.can_send && options.closed_reason ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {options.closed_reason}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label id={`outreach-preset-${bookingId}`} className="text-sm">
              {kind === "reminder" ? "Choose a reminder" : "Common questions"}{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div role="radiogroup" aria-labelledby={`outreach-preset-${bookingId}`} className="flex flex-wrap gap-2">
              {kindOptions.presets.map((p) => {
                const selected = preset === p.code;
                return (
                  <button
                    key={p.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={blocked || sending}
                    onClick={() => choosePreset(p.code)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`outreach-text-${bookingId}`} className="text-sm">
              {copy.label}
            </Label>
            <Textarea
              id={`outreach-text-${bookingId}`}
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxLength))}
              maxLength={maxLength}
              rows={4}
              placeholder={copy.placeholder}
              disabled={blocked || sending}
            />
            <div className="flex justify-end text-xs text-muted-foreground">
              <span aria-live="polite" className={cn(text.length >= maxLength && "text-destructive")}>
                {text.length}/{maxLength}
              </span>
            </div>
          </div>

          {kind === "question" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`outreach-reply-by-${bookingId}`} className="text-sm">
                Reply needed by <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`outreach-reply-by-${bookingId}`}
                type="date"
                value={replyBy}
                min={minDate}
                max={maxDate}
                onChange={(e) => setReplyBy(e.target.value)}
                disabled={blocked || sending}
                className="w-full sm:w-48"
              />
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <p className="flex items-start gap-1.5">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-medium text-foreground">To:</span> {options.recipient_name}
                {options.recipient_has_email ? "" : " (no email address — shown in the portal only)"}
              </span>
            </p>
            {options.recipient_has_email && kindOptions.email_subject ? (
              <p className="break-words pl-5">
                <span className="font-medium text-foreground">Email subject:</span> {kindOptions.email_subject}
              </p>
            ) : null}
            <p className="pl-5">
              {limitReached
                ? `The limit of ${kindOptions.daily_limit} per booking in 24 hours has been reached.`
                : `${kindOptions.remaining_today} of ${kindOptions.daily_limit} left for this booking in the next 24 hours.`}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSend()} disabled={!trimmed || sending || blocked}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {copy.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabOutreachDialog;
