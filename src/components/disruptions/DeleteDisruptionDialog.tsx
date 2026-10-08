import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import type { DisruptionRecord } from "@/lib/disruptions";

interface Props {
  /** Entry to delete; null keeps the dialog closed. */
  event: Pick<DisruptionRecord, "id" | "equipment_name" | "disruption_type_display" | "start_at" | "status"> | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
}

export function DeleteDisruptionDialog({ event, onClose, onDeleted }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (event) setReason("");
  }, [event]);

  const confirm = async () => {
    if (!event) return;
    setBusy(true);
    const res = await apiClient.deleteDisruption(event.id, reason.trim());
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not delete the disruption.");
      return;
    }
    toast.success("Disruption entry deleted.");
    onDeleted(event.id);
  };

  return (
    <AlertDialog open={event != null} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete disruption entry</AlertDialogTitle>
          <AlertDialogDescription>
            Delete this disruption entry? It will be removed from disruption history and reports. Slot statuses and
            bookings are not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {event ? (
          <p className="text-sm">
            <span className="font-medium">{event.disruption_type_display}</span> on {event.equipment_name}
            {event.start_at ? `, from ${formatDMYTime(event.start_at)}` : ""}
          </p>
        ) : null}
        {event?.status === "OPEN" ? (
          <p
            role="note"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This disruption is still ongoing. Its slots (or the equipment) stay in their current status; make them
            available again from Change slot status or equipment status when ready.
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="disruption-delete-reason">Reason (optional)</Label>
          <Textarea
            id="disruption-delete-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: recorded by mistake, duplicate entry"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Delete entry
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
