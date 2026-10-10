import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trainingApi } from "@/lib/trainingApi";
import { formatWindow } from "../trainingHelpers";
import { runTrainingAction } from "../trainingUi";

export interface ShiftRef {
  id: number;
  start: string;
  end: string;
  plannedMinutes: number;
  operatedMinutes: number | null;
  operatorName: string;
}

/** OIC records or corrects operated minutes for a shift, or marks it missed. */
export function ShiftHoursDialog({
  shift,
  onOpenChange,
  onSaved,
}: {
  shift: ShiftRef | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [hours, setHours] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"verify" | "missed" | null>(null);

  useEffect(() => {
    if (!shift) return;
    const minutes = shift.operatedMinutes ?? shift.plannedMinutes;
    setHours(String(Math.round((minutes / 60) * 100) / 100));
    setRemarks("");
  }, [shift]);

  const minutes = Math.round(Number(hours) * 60);
  const valid = hours.trim() !== "" && Number.isFinite(minutes) && minutes >= 0;

  const run = async (kind: "verify" | "missed") => {
    if (!shift) return;
    setBusy(kind);
    const res = await runTrainingAction(
      trainingApi.shiftAction(shift.id, kind, kind === "verify" ? { operated_minutes: minutes, remarks } : { remarks }),
      kind === "verify" ? "Hours recorded" : "Shift marked as missed",
    );
    setBusy(null);
    if (!res.error) {
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={Boolean(shift)} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record duty hours</DialogTitle>
          <DialogDescription>
            {shift ? `${shift.operatorName} · ${formatWindow(shift.start, shift.end)}` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="operated-hours">Hours operated</Label>
            <Input id="operated-hours" type="number" step="0.25" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
            <p className="text-xs text-muted-foreground">Planned {Math.round(((shift?.plannedMinutes ?? 0) / 60) * 100) / 100} h. Your entry replaces check-in/out or booking-derived hours.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hours-remarks">Remarks</Label>
            <Textarea id="hours-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Required when marking missed" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => void run("missed")} disabled={Boolean(busy) || !remarks.trim()}>
            {busy === "missed" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Mark missed
          </Button>
          <Button type="button" onClick={() => void run("verify")} disabled={Boolean(busy) || !valid}>
            {busy === "verify" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
