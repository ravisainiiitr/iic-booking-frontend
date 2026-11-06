import { format, parseISO } from "date-fns";
import type { PublicDisruptionInfo } from "@/lib/disruptions";
import { slotSpanLabel } from "@/lib/slotTimeRange";

/** The slot fields behind a staff hover card; extra fields come from the server for staff of the equipment only. */
export interface SlotStatusHoverSource {
  status?: string | null;
  status_display?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  blocked_label?: string | null;
  disruption_reason?: string | null;
  disruption_reason_category?: string | null;
  disruption_public?: PublicDisruptionInfo | null;
  external_reference?: string | null;
  mode_overlay?: string | null;
  booking_id?: number | string | null;
  booking_status_display?: string | null;
  booking_user_name?: string | null;
  booking_user_department_code?: string | null;
  booking_user_department_name?: string | null;
  booking_user_email?: string | null;
  booking_user_phone?: string | null;
  booking_auto_reschedule_note?: string | null;
}

export function describeGroupSlotWindow(start: string, end: string): string {
  try {
    return `${format(parseISO(start), "EEE d MMM yyyy")}, ${slotSpanLabel(parseISO(start), parseISO(end))}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function bookedSlotUserDetailLines(slot: SlotStatusHoverSource): string[] {
  if (String(slot.status || "").toUpperCase() !== "BOOKED" && !slot.booking_id) return [];
  const lines: string[] = [];
  const name = String(slot.booking_user_name || "").trim();
  if (name) lines.push(`Name: ${name}`);
  const deptName = String(slot.booking_user_department_name || "").trim();
  const deptCode = String(slot.booking_user_department_code || "").trim();
  if (deptName && deptCode) lines.push(`Department: ${deptName} (${deptCode})`);
  else if (deptName) lines.push(`Department: ${deptName}`);
  else if (deptCode) lines.push(`Department: ${deptCode}`);
  const email = String(slot.booking_user_email || "").trim();
  if (email) lines.push(`Email: ${email}`);
  const phone = String(slot.booking_user_phone || "").trim();
  if (phone) lines.push(`Mobile: ${phone}`);
  if (slot.booking_id != null && String(slot.booking_id).trim() !== "") {
    lines.push(`Booking ID: ${slot.booking_id}`);
  }
  const autoRescheduleNote = String(slot.booking_auto_reschedule_note || "").trim();
  if (autoRescheduleNote) lines.push(autoRescheduleNote);
  return lines;
}

const SLOT_STATUS_HOVER_LABELS: Record<string, string> = {
  NOT_AVAILABLE: "Not Available",
  BOOKED: "Booked",
  BLOCKED: "Blocked (other reasons)",
  UNDER_MAINTENANCE: "Under Maintenance",
  SCHEDULED_MAINT: "Scheduled Maintenance",
  RESERVED_EXTERNAL: "Reserved (External)",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  HOLD: "On hold",
  COMPLETED: "Completed",
};

/**
 * Staff hover lines for any slot whose status is not plain Available: status, time range,
 * reason (blocked label / holiday / weekend / mode) and, for booked slots, who booked it.
 * Returns [] for Available slots.
 */
export function slotStatusHoverLines(
  slot: SlotStatusHoverSource | null | undefined,
  opts: { holidayName?: string; isWeekend?: boolean } = {},
): string[] {
  if (!slot) return [];
  const status = String(slot.status || "").toUpperCase();
  const statusDisplay = String(slot.status_display || "").trim();
  const reservedDisplay = status === "AVAILABLE" && statusDisplay !== "" && !statusDisplay.startsWith("Available");
  const hasBooking = slot.booking_id != null && String(slot.booking_id).trim() !== "";
  if (status === "AVAILABLE" && !reservedDisplay && !slot.mode_overlay && !hasBooking) return [];

  const lines: string[] = [];
  const label =
    (hasBooking && String(slot.booking_status_display || "").trim()) ||
    statusDisplay ||
    SLOT_STATUS_HOVER_LABELS[status] ||
    status.replace(/_/g, " ");
  lines.push(`Status: ${label}`);
  if (slot.start_datetime && slot.end_datetime) {
    lines.push(`Time: ${describeGroupSlotWindow(slot.start_datetime, slot.end_datetime)}`);
  }
  const blockedLabel = String(slot.blocked_label || "").trim();
  if (blockedLabel) lines.push(`Reason: ${blockedLabel}`);
  const disruptionCategory = String(slot.disruption_reason_category || "").trim();
  const disruptionReason = String(slot.disruption_reason || "").trim();
  if (disruptionCategory) lines.push(`Category: ${disruptionCategory}`);
  if (disruptionReason && disruptionReason !== blockedLabel) lines.push(`Disruption reason: ${disruptionReason}`);
  const recoveryText = String(slot.disruption_public?.recovery_text || "").trim();
  if (recoveryText) lines.push(recoveryText);
  const externalReference = String(slot.external_reference || "").trim();
  if (externalReference) lines.push(`I-STEM FBR: ${externalReference}`);
  if (opts.holidayName) {
    lines.push(`Holiday: ${opts.holidayName}`);
  } else if (!blockedLabel && status === "NOT_AVAILABLE" && opts.isWeekend) {
    lines.push("Reason: Weekend");
  }
  if (slot.mode_overlay) lines.push(`Mode: ${slot.mode_overlay}`);
  if (hasBooking || status === "BOOKED") lines.push(...bookedSlotUserDetailLines(slot));
  return lines;
}
