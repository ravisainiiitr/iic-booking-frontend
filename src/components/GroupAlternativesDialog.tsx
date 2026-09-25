import { format, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, Loader2, Microscope } from "lucide-react";
import type { GroupAlternative, GroupAlternativesPayload } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GroupAlternativesDialogProps {
  open: boolean;
  payload: GroupAlternativesPayload | null;
  /** equipment_id of the alternative currently being booked (disables all actions). */
  busyEquipmentId: number | null;
  waitlistBusy: boolean;
  /** False when the original request did not allow waitlisting (e.g. external users). */
  waitlistAvailable: boolean;
  onBook: (alternative: GroupAlternative) => void;
  onOpenForm: (alternative: GroupAlternative) => void;
  onContinueToWaitlist: () => void;
  onCancel: () => void;
}

function formatWindow(start: string, end: string): string {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, "EEE d MMM yyyy, HH:mm")} – ${format(e, "HH:mm")}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function needsInputReview(alt: GroupAlternative): boolean {
  return alt.missing_required_fields.length > 0 || !!alt.input_error;
}

export function GroupAlternativesDialog({
  open,
  payload,
  busyEquipmentId,
  waitlistBusy,
  waitlistAvailable,
  onBook,
  onOpenForm,
  onContinueToWaitlist,
  onCancel,
}: GroupAlternativesDialogProps) {
  const busy = busyEquipmentId != null || waitlistBusy;
  const original = payload?.original_equipment;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alternative equipment available</DialogTitle>
          <DialogDescription>
            {original ? (
              <>
                <span className="font-medium text-foreground">{original.name}</span> is not available for your
                requested slot. The following equipment from the same group can take your booking. Charges are
                recalculated for the equipment you choose.
              </>
            ) : (
              "The requested equipment is not available. The following alternatives are available."
            )}
          </DialogDescription>
        </DialogHeader>

        {payload?.original_error ? (
          <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2">{payload.original_error}</p>
        ) : null}

        <div className="space-y-3">
          {(payload?.alternatives ?? []).map((alt) => {
            const review = needsInputReview(alt);
            const isBusy = busyEquipmentId === alt.equipment_id;
            return (
              <div key={alt.equipment_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <Microscope className="h-4 w-4 shrink-0 text-primary" />
                      <span className="break-words">{alt.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">({alt.code})</span>
                    </div>
                    {(alt.make || alt.model_information) && (
                      <p className="text-xs text-muted-foreground">
                        {[alt.make, alt.model_information].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {alt.internal_department_name && (
                      <p className="text-xs text-muted-foreground">{alt.internal_department_name}</p>
                    )}
                  </div>
                  <Badge variant={alt.exact_match ? "default" : "secondary"}>
                    {alt.exact_match ? "Same slot" : "Earliest available"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    {formatWindow(alt.start, alt.end)}
                  </span>
                  {alt.estimated_charge != null && (
                    <span>
                      Estimated charge: <span className="font-medium">₹{Number(alt.estimated_charge).toFixed(2)}</span>
                    </span>
                  )}
                </div>

                {alt.dropped_fields.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Not carried over: {alt.dropped_fields.map((f) => f.label).join(", ")}
                  </p>
                )}
                {review && (
                  <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {alt.input_error
                      ? alt.input_error
                      : `Please provide: ${alt.missing_required_fields.map((f) => f.label).join(", ")}`}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpenForm(alt)}>
                    {review ? "Complete details" : "Review in booking form"}
                  </Button>
                  {!review && (
                    <Button size="sm" disabled={busy} onClick={() => onBook(alt)}>
                      {isBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                      Book this equipment
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          {waitlistAvailable && (
            <Button variant="secondary" disabled={busy} onClick={onContinueToWaitlist}>
              {waitlistBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Continue to waitlist for {original?.name ?? "original equipment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
