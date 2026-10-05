import { useState } from "react";
import { AlertCircle, Loader2, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient, type FabricationWorkflow } from "@/lib/api";

export const FABRICATION_COMPLETE_FILES_WARNING =
  "Uploaded files will be deleted after completion. Download them first.";

function hoursLabel(hours: number): string {
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function FabricationRejectDialog({
  bookingId,
  minLength,
  windowHours,
  onRejected,
}: {
  bookingId: number;
  minLength: number;
  windowHours: number;
  onRejected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = reason.trim();
  const tooShort = trimmed.length < minLength;

  const submit = async () => {
    if (tooShort || saving) return;
    setSaving(true);
    try {
      const res = await apiClient.rejectFabricationBooking(bookingId, trimmed);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Booking rejected. The user was asked to upload new files.");
      setOpen(false);
      setReason("");
      onRejected();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ThumbsDown className="h-4 w-4 mr-2" />
        Reject (not feasible)
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject (not feasible)</DialogTitle>
            <DialogDescription>
              Tell the user what is wrong with the files. They will get an email and have{" "}
              {hoursLabel(windowHours)} to upload new files. If they do not, the booking is cancelled and fully
              refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="fabrication-reject-reason">Reason</Label>
            <Textarea
              id="fabrication-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wall thickness is below 1 mm; the part cannot be printed"
              rows={4}
            />
            <p className={`text-xs ${tooShort && trimmed.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              At least {minLength} characters.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submit()} disabled={tooShort || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting…
                </>
              ) : (
                "Reject booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FabricationRejectedNotice({
  workflow,
  staffView,
}: {
  workflow: FabricationWorkflow;
  staffView: boolean;
}) {
  const deadline = workflow.replace_deadline_display;
  return (
    <div
      role="status"
      data-testid="fabrication-rejected-notice"
      className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/40"
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-900 dark:text-rose-200">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        Rejected by the lab – waiting for new files
      </p>
      {workflow.reason && (
        <p className="mt-1 whitespace-pre-line text-sm text-rose-900 dark:text-rose-100">
          <span className="font-medium">Reason:</span> {workflow.reason}
        </p>
      )}
      {workflow.rejected_by_name && (
        <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">Rejected by {workflow.rejected_by_name}</p>
      )}
      <p className="mt-2 text-sm text-rose-900 dark:text-rose-100">
        {workflow.replace_deadline_passed
          ? "The time to replace the files has ended. The booking will be cancelled and fully refunded shortly."
          : staffView
            ? `Waiting for the user to upload new files${deadline ? ` by ${deadline}` : ""}. If they do not, the booking is cancelled and fully refunded.`
            : `Upload new files${deadline ? ` by ${deadline}` : ""} using "Replace files" below. If you do not, the booking is cancelled and fully refunded. You can also cancel now for a full refund.`}
      </p>
    </div>
  );
}
