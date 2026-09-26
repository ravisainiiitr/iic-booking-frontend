import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

type NoticeExpiryDialogProps = {
  open: boolean;
  noticeId: number | null;
  equipmentName?: string;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

/**
 * OIC sets expiry (or Unlimited) for an equipment-unavailable notice draft,
 * then submits it for Main Admin approval.
 * Defaults to Unlimited — notice is closed automatically when equipment returns to Operational.
 */
export function NoticeExpiryDialog({
  open,
  noticeId,
  equipmentName,
  onOpenChange,
  onCompleted,
}: NoticeExpiryDialogProps) {
  const [expiryLocal, setExpiryLocal] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<{ title: string; description: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setUnlimited(true);
      setExpiryLocal("");
    }
  }, [open, noticeId]);

  useEffect(() => {
    if (!open || noticeId == null) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setDraftLoading(true);
    apiClient
      .getNotice(noticeId)
      .then((res) => {
        if (cancelled) return;
        setDraft(res.data?.title ? { title: res.data.title, description: res.data.description || "" } : null);
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, noticeId]);

  const reset = () => {
    setExpiryLocal("");
    setUnlimited(true);
  };

  const noticeTitle =
    draft?.title ||
    (equipmentName ? `${equipmentName} — Under Maintenance` : "Equipment Under Maintenance");
  const noticeBody =
    draft?.description ||
    (equipmentName
      ? `${equipmentName} is under maintenance and is not available for booking until further notice.\nThis notice will be removed automatically once the equipment is back in operation.`
      : "This equipment is under maintenance and is not available for booking until further notice.\nThis notice will be removed automatically once the equipment is back in operation.");

  const handleSubmit = async () => {
    if (noticeId == null) return;
    if (!unlimited && !expiryLocal.trim()) {
      toast.error("Choose an expiry date/time or select Unlimited.");
      return;
    }
    setSubmitting(true);
    try {
      const expiryIso = unlimited ? null : new Date(expiryLocal).toISOString();
      const res = await apiClient.completeNoticeRequestExpiry(noticeId, {
        expiry_unlimited: unlimited,
        expiry_date: expiryIso,
      });
      if (res.error) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to submit notice");
        return;
      }
      toast.success(
        unlimited
          ? "Notice submitted. It will close automatically when the equipment is Operational again."
          : "Notice submitted for Main Admin approval."
      );
      reset();
      onOpenChange(false);
      onCompleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit notice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish on notice board?</DialogTitle>
          <DialogDescription>
            Equipment was set to Under Maintenance. Review the notice details below and submit
            for the notice board. With Unlimited expiry, the notice closes automatically when you
            set the equipment back to Operational.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notice preview
              {draftLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            </p>
            <p className="text-sm font-semibold text-foreground">{noticeTitle}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{noticeBody}</p>
            <p className="text-xs text-muted-foreground pt-1">
              Type: Warning · Linked equipment: {equipmentName || "—"}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="notice-expiry-unlimited"
              checked={unlimited}
              onCheckedChange={(v) => setUnlimited(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="notice-expiry-unlimited" className="font-normal cursor-pointer leading-snug">
              Unlimited end date (recommended) — notice ends when equipment returns to Operational
            </Label>
          </div>
          {!unlimited ? (
            <div className="space-y-2">
              <Label htmlFor="notice-expiry-dt">Expiry date &amp; time</Label>
              <Input
                id="notice-expiry-dt"
                type="datetime-local"
                value={expiryLocal}
                onChange={(e) => setExpiryLocal(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Skip for now
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || noticeId == null}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Push to notice board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
