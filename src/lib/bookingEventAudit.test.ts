import { describe, expect, it } from "vitest";
import type { BookingEvent } from "@/lib/api";
import { bookingEventActor, bookingEventReason, bookingEventSource, bookingEventTitle, isSystemEvent } from "./bookingEventAudit";

const event = (overrides: Partial<BookingEvent> = {}): BookingEvent => ({
  event_id: 1,
  booking: 1,
  event_type: "STATUS_CHANGED",
  event_type_display: "Status Changed",
  previous_status: "BOOKED",
  previous_status_display: "Booked",
  new_status: "DISRUPTION_PENDING",
  new_status_display: "Disruption pending",
  comment: null,
  created_by: 7,
  created_by_name: "A. Kumar",
  metadata: {},
  notification_sent: false,
  created_at: "2026-10-12T10:00:00Z",
  ...overrides,
});

describe("booking event audit", () => {
  it("names the OIC who marked Operator Absent and the reason", () => {
    const e = event({
      audit: {
        actor_kind: "staff",
        actor_role: "OIC",
        actor_role_label: "Officer In Charge",
        actor_name: "Dr. A. Kumar",
        source_label: "Web portal",
        reason_code: "OPERATOR_ABSENT",
        reason_label: "Operator Absent",
        reason: "Operator on medical leave",
      },
    });

    expect(bookingEventTitle(e)).toBe("Operator Absent");
    expect(bookingEventActor(e)).toBe("Dr. A. Kumar (Officer In Charge)");
    expect(bookingEventReason(e)).toBe("Operator on medical leave");
    expect(bookingEventSource(e)).toBe("Web portal");
  });

  it("shows System for scheduled jobs", () => {
    const e = event({
      created_by: null,
      created_by_name: null,
      event_type: "REFUNDED",
      event_type_display: "Refunded",
      audit: {
        actor_kind: "system",
        actor_role: "SYSTEM",
        actor_role_label: "System (automatic)",
        source_label: "Scheduled job: 5-day disruption decision deadline",
        reason_code: "DISRUPTION_DEADLINE",
        reason_label: "No choice within 5 days — refunded automatically",
        reason: "No refund/reschedule choice within 5 days of Operator Absent",
      },
    });

    expect(isSystemEvent(e)).toBe(true);
    expect(bookingEventActor(e)).toBe("System (automatic)");
    expect(bookingEventTitle(e)).toBe("No choice within 5 days — refunded automatically");
  });

  it("falls back to the stored creator for events without an audit block", () => {
    const e = event({ event_type_display: "Cancelled" });

    expect(bookingEventTitle(e)).toBe("Cancelled");
    expect(bookingEventActor(e)).toBe("A. Kumar");
    expect(bookingEventReason(e)).toBe("");
    expect(isSystemEvent(event({ created_by: null }))).toBe(true);
  });

  it("uses a cancellation reason label when there is no typed reason", () => {
    const e = event({
      event_type_display: "Cancelled",
      audit: { actor_kind: "user", actor_role: "USER", actor_role_label: "Booking user", reason_code: "USER_REQUEST", reason_label: "Cancelled by the user" },
    });

    expect(bookingEventTitle(e)).toBe("Cancelled");
    expect(bookingEventReason(e)).toBe("Cancelled by the user");
  });
});
