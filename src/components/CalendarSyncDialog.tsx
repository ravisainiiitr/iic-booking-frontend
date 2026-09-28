import { useEffect, useState } from "react";
import { CalendarPlus, Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type CalendarSyncSettings } from "@/lib/api";
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

interface CalendarSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSyncDialog({ open, onOpenChange }: CalendarSyncDialogProps) {
  const [settings, setSettings] = useState<CalendarSyncSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmReset(false);
      setCopied(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient.getCalendarSyncSettings().then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.data?.eligible) setSettings(res.data);
      else setError(res.error || "Calendar sync is not available for your account.");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const copyLink = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.feed_url);
      setCopied(true);
      toast.success("Calendar link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };

  const resetLink = async () => {
    setResetting(true);
    const res = await apiClient.regenerateCalendarSyncLink();
    setResetting(false);
    setConfirmReset(false);
    if (res.data?.eligible) {
      setSettings(res.data);
      toast.success("New calendar link created. Re-subscribe in your calendar app with the new link.");
    } else {
      toast.error(res.error || "Could not reset the calendar link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Sync bookings to your calendar
          </DialogTitle>
          <DialogDescription>
            Subscribe once and your IIC bookings appear in Google Calendar, Outlook or Apple Calendar. New,
            rescheduled and cancelled bookings update automatically, with a reminder before each slot and sample
            submission deadline.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing your calendar link…
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : settings ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <Button asChild variant="outline" size="sm">
                <a href={settings.google_url} target="_blank" rel="noopener noreferrer">
                  Google Calendar
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={settings.outlook_url} target="_blank" rel="noopener noreferrer">
                  Outlook
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={settings.webcal_url}>Apple Calendar</a>
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calendar-sync-url">Or copy your private calendar link</Label>
              <div className="flex gap-2">
                <Input
                  id="calendar-sync-url"
                  readOnly
                  value={settings.feed_url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button type="button" variant="secondary" size="icon" onClick={copyLink} title="Copy link">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste it into your calendar app's "Subscribe from URL" / "Add calendar from internet" option. Keep
                this link private: anyone with it can see your booking schedule.
              </p>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Calendar apps refresh subscribed calendars on their own schedule. Outlook and Apple usually update
                within a few hours; Google Calendar can take up to a day.
              </p>
              <p>
                For an instant copy of a single booking, use <span className="font-medium">Add to calendar</span> on
                that booking.
              </p>
              {settings.last_accessed_at && (
                <p>Last fetched by a calendar app: {new Date(settings.last_accessed_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {settings && !loading && !error ? (
            confirmReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Old link stops working.</span>
                <Button variant="destructive" size="sm" onClick={resetLink} disabled={resetting}>
                  {resetting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)} disabled={resetting}>
                  Keep link
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Reset link
              </Button>
            )
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CalendarSyncDialog;
