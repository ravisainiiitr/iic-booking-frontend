/** Labels for the slot status operations offered in Change Slot Status and the dashboard calendar. */
export const SLOT_OPERATION_LABELS: Record<string, string> = {
  BLOCKED: "Other Reasons",
  UNDER_MAINTENANCE: "Under Maintenance",
  SCHEDULED_MAINT: "Scheduled Maintenance",
  OPERATOR_ABSENT: "Operator Absent",
  BOOKING_NOT_UTILIZED: "Booking Not Utilized",
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not Available",
  RESERVED_EXTERNAL: "Reserved for External",
};

export function slotOperationLabel(status: string): string {
  return SLOT_OPERATION_LABELS[String(status || "").toUpperCase()] ?? status;
}

/** I-STEM FBR reference stored on Reserved (External) slots. */
export const EXTERNAL_REFERENCE_MAX_LENGTH = 100;
