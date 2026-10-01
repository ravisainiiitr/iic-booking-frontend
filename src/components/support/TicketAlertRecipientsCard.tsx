import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SupportNotificationSettings } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function splitEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Main Administrator: addresses that receive a copy of every new support ticket. */
export default function TicketAlertRecipientsCard() {
  const [saved, setSaved] = useState<SupportNotificationSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = (data: SupportNotificationSettings) => {
    setSaved(data);
    setEnabled(data.ticket_alert_enabled);
    setEmails(data.ticket_alert_emails);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getSupportNotificationSettings();
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load notification settings");
      return;
    }
    apply(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxRecipients = saved?.max_recipients ?? 20;

  const addFromDraft = (raw: string): boolean => {
    const parts = splitEmails(raw);
    if (parts.length === 0) return true;
    const invalid = parts.filter((p) => !EMAIL_RE.test(p));
    if (invalid.length) {
      setInputError(`Not a valid email: ${invalid.join(", ")}`);
      return false;
    }
    const next = [...emails];
    for (const p of parts) {
      if (!next.some((e) => e.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length > maxRecipients) {
      setInputError(`At most ${maxRecipients} recipients are allowed.`);
      return false;
    }
    setEmails(next);
    setDraft("");
    setInputError(null);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      addFromDraft(draft);
    } else if (e.key === "Backspace" && !draft && emails.length) {
      setEmails(emails.slice(0, -1));
    }
  };

  const dirty = useMemo(() => {
    if (!saved) return false;
    return (
      saved.ticket_alert_enabled !== enabled ||
      saved.ticket_alert_emails.join(",").toLowerCase() !== emails.join(",").toLowerCase() ||
      draft.trim() !== ""
    );
  }, [saved, enabled, emails, draft]);

  const save = async () => {
    let list = emails;
    if (draft.trim()) {
      if (!addFromDraft(draft)) return;
      list = [...emails];
      for (const p of splitEmails(draft)) {
        if (!list.some((e) => e.toLowerCase() === p.toLowerCase())) list.push(p);
      }
    }
    if (enabled && list.length === 0) {
      setInputError("Add at least one recipient, or switch new ticket emails off.");
      return;
    }
    setSaving(true);
    const res = await apiClient.updateSupportNotificationSettings({
      ticket_alert_enabled: enabled,
      ticket_alert_emails: list,
    });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save");
      return;
    }
    apply(res.data);
    setDraft("");
    setInputError(null);
    toast.success("New ticket email recipients saved");
  };

  const defaults = saved?.default_ticket_alert_emails ?? [];

  return (
    <Card className="rounded-2xl border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">New ticket email alerts</CardTitle>
              <CardDescription className="mt-0.5">
                Every newly raised ticket is emailed to these addresses, in addition to the OIC / assignee
                notification.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ticket-alert-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={loading || saving}
            />
            <Label htmlFor="ticket-alert-enabled" className="text-sm">
              {enabled ? "On" : "Off"}
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5",
                !enabled && "opacity-60",
                inputError && "border-destructive"
              )}
            >
              {emails.map((email) => (
                <Badge key={email.toLowerCase()} variant="secondary" className="gap-1 py-1 pl-2 pr-1 font-normal">
                  {email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => setEmails(emails.filter((e) => e !== email))}
                    disabled={saving}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => draft.trim() && addFromDraft(draft)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (/[\s,;]/.test(text.trim())) {
                    e.preventDefault();
                    addFromDraft(text);
                  }
                }}
                placeholder={emails.length ? "Add another email" : "name@example.com"}
                className="h-7 min-w-[200px] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                disabled={saving}
                aria-label="Add recipient email"
              />
            </div>
            {inputError ? (
              <p className="text-xs text-destructive">{inputError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Press Enter or comma to add an address; paste a comma-separated list to add several. Up to{" "}
                {maxRecipients} recipients.
                {saved?.updated_by_name && saved.updated_at
                  ? ` Last changed by ${saved.updated_by_name} on ${new Date(saved.updated_at).toLocaleString()}.`
                  : ""}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {defaults.length > 0 && defaults.join(",") !== emails.join(",") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEmails(defaults);
                    setInputError(null);
                  }}
                  disabled={saving}
                >
                  Reset to default ({defaults.join(", ")})
                </Button>
              )}
              {dirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (saved) apply(saved);
                    setDraft("");
                    setInputError(null);
                  }}
                  disabled={saving}
                >
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
