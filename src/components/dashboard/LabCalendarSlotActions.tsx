import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LabCalendarSlot } from "@/lib/labOperatorCalendarTypes";
import { isSlotInPast } from "@/lib/slotCalendarDisplay";

/** Same operations and wording as Change slot status. */
export const LAB_CALENDAR_SLOT_OPERATIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BLOCKED", label: "Other Reasons" },
  { value: "UNDER_MAINTENANCE", label: "Under Maintenance" },
  { value: "OPERATOR_ABSENT", label: "Operator Absent" },
] as const;

export type LabCalendarSlotOperation = (typeof LAB_CALENDAR_SLOT_OPERATIONS)[number]["value"];

/**
 * Slots an OIC can pick on the dashboard calendar: upcoming slots without a booking.
 * Changing a booked or past slot stays on Change slot status (a booked slot's booking is cancelled and refunded).
 */
export function isDashboardSelectableSlot(
  slot: Pick<LabCalendarSlot, "status" | "booking_id" | "real_booking_id" | "start_datetime">,
  now: Date = new Date(),
): boolean {
  const status = String(slot.status || "").toUpperCase();
  if (status === "BOOKED" || status === "BOOKING_NOT_UTILIZED") return false;
  if (isSlotInPast(slot, now)) return false;
  return slot.booking_id == null && slot.real_booking_id == null;
}

interface Props {
  selectedCount: number;
  busy?: boolean;
  onApply: (status: LabCalendarSlotOperation, blockedLabel: string | null) => void;
  onClear: () => void;
}

/** Apply bar under the OIC dashboard calendar: block selected slots or make them available. */
export function LabCalendarSlotActions({ selectedCount, busy = false, onApply, onClear }: Props) {
  const [operation, setOperation] = useState<LabCalendarSlotOperation>("BLOCKED");
  const [blockedLabel, setBlockedLabel] = useState("");

  if (selectedCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Click upcoming free slots to select them, then block them or make them available here. Booked slots open the
        booking.
      </p>
    );
  }

  return (
    <div
      role="region"
      aria-label="Change selected slots"
      className="sticky bottom-2 z-20 flex flex-col gap-2 rounded-xl border border-primary/25 bg-card/95 p-3 shadow-lg backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center"
    >
      <span className="text-sm font-semibold text-foreground">
        {selectedCount} slot{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="lab-calendar-slot-operation" className="text-sm">
          Mark as
        </Label>
        <Select value={operation} onValueChange={(v) => setOperation(v as LabCalendarSlotOperation)}>
          <SelectTrigger id="lab-calendar-slot-operation" className="h-9 w-[12rem] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAB_CALENDAR_SLOT_OPERATIONS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {operation === "BLOCKED" && (
          <Input
            aria-label="Reason shown on the slot (optional)"
            placeholder="Reason shown on the slot (optional)"
            value={blockedLabel}
            onChange={(e) => setBlockedLabel(e.target.value)}
            className="h-9 w-[16rem] max-w-full text-sm"
          />
        )}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Button variant="outline" size="sm" className="h-9" onClick={onClear} disabled={busy}>
          Clear
        </Button>
        <Button
          size="sm"
          className="h-9 bg-brand text-white hover:bg-brand/90"
          disabled={busy}
          onClick={() => onApply(operation, operation === "BLOCKED" ? blockedLabel.trim() || null : null)}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Applying…" : `Apply to ${selectedCount} slot${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
