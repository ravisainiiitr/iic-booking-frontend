import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS_LEGEND,
  bookingBadgeStatus,
  bookingStatusBadgeClass,
  placeWaitlistEntries,
} from "./bookingStatusLegend";

describe("placeWaitlistEntries", () => {
  const row = (id: string, group: number) => ({ id, list_status_group: group });
  const wl = { id: "WL1", list_status_group: null };

  it("puts waitlist entries after the Booked group", () => {
    const rows = [row("overdue", 1), row("pending", 2), row("booked", 3), row("choice", 4), row("completed", 8)];
    expect(placeWaitlistEntries(rows, [wl]).map((r) => r.id)).toEqual([
      "overdue", "pending", "booked", "WL1", "choice", "completed",
    ]);
  });

  it("appends them when the page has only the first three groups, and leads when it has none", () => {
    expect(placeWaitlistEntries([row("booked", 3)], [wl]).map((r) => r.id)).toEqual(["booked", "WL1"]);
    expect(placeWaitlistEntries([row("completed", 8)], [wl]).map((r) => r.id)).toEqual(["WL1", "completed"]);
  });
});

const LOW_CONTRAST_WITH_WHITE = /\bbg-(yellow|amber|lime|orange)-(50|100|200|300|400|500)\b/;

describe("bookingStatusBadgeClass", () => {
  it("no longer renders Pending as white text on yellow", () => {
    const cls = bookingStatusBadgeClass("PENDING");
    expect(cls).not.toMatch(/\btext-white\b/);
    expect(cls).not.toMatch(/\bbg-yellow-(400|500)\b/);
    expect(cls).toMatch(/\btext-amber-900\b/);
    expect(cls).toMatch(/\bdark:text-amber-100\b/);
  });

  it("is case-insensitive and falls back to a neutral badge", () => {
    expect(bookingStatusBadgeClass("booked")).toBe(bookingStatusBadgeClass("BOOKED"));
    expect(bookingStatusBadgeClass("SOMETHING_NEW")).toMatch(/\bbg-gray-600\b.*\btext-white\b/);
    expect(bookingStatusBadgeClass(undefined)).toMatch(/\btext-white\b/);
  });

  it("pairs every background with an explicit text colour and never white on light yellow/amber", () => {
    const statuses = [
      ...BOOKING_STATUS_LEGEND.map((e) => e.status),
      "OTHER_DISRUPTION",
      "PROCESSING",
      "CONFIRMED",
      "APPROVED",
      "IN_PROGRESS",
      "REJECTED",
      "UNKNOWN",
    ];
    for (const status of statuses) {
      const cls = bookingStatusBadgeClass(status);
      expect(cls, status).toMatch(/(^|\s)bg-\S+/);
      expect(cls, status).toMatch(/(^|\s)text-\S+/);
      if (/\btext-white\b/.test(cls)) {
        expect(cls, status).not.toMatch(LOW_CONTRAST_WITH_WHITE);
      }
    }
  });

  it("keeps Waitlisted neutral rather than alarming", () => {
    const cls = bookingStatusBadgeClass("WAITLISTED");
    expect(cls).not.toMatch(/\bbg-(red|amber|orange|yellow)-/);
  });
});

describe("bookingBadgeStatus", () => {
  it("shows a booked fabrication job rejected by the lab with its own badge", () => {
    expect(bookingBadgeStatus({ status: "BOOKED", fabrication_rejected_at: "2026-10-05T04:30:00Z" })).toBe("FABRICATION_REJECTED");
    expect(bookingBadgeStatus({ status: "BOOKED", fabrication_workflow: { rejected: true } })).toBe("FABRICATION_REJECTED");
    expect(bookingStatusBadgeClass("FABRICATION_REJECTED")).not.toBe(bookingStatusBadgeClass("BOOKED"));
  });

  it("uses the derived Pending / Result Overdue list status: amber and red", () => {
    expect(bookingBadgeStatus({ status: "BOOKED", list_status: "RESULTS_PENDING" })).toBe("RESULTS_PENDING");
    expect(bookingBadgeStatus({ status: "PROCESSING", list_status: "RESULT_OVERDUE" })).toBe("RESULT_OVERDUE");
    expect(bookingBadgeStatus({ status: "COMPLETED", list_status: "COMPLETED" })).toBe("COMPLETED");
    expect(bookingStatusBadgeClass("RESULTS_PENDING")).toMatch(/\bbg-amber-100\b.*\btext-amber-900\b/);
    expect(bookingStatusBadgeClass("RESULT_OVERDUE")).toMatch(/\bbg-red-700\b/);
  });

  it("keeps the normal status otherwise, including after an expired rejection was cancelled", () => {
    expect(bookingBadgeStatus({ status: "booked" })).toBe("BOOKED");
    expect(bookingBadgeStatus({ status: "REFUNDED", fabrication_rejected_at: "2026-10-05T04:30:00Z" })).toBe("REFUNDED");
  });
});

describe("BOOKING_STATUS_LEGEND", () => {
  it("covers the statuses users see in My Bookings", () => {
    const statuses = BOOKING_STATUS_LEGEND.map((e) => e.status);
    for (const s of [
      "RESULTS_PENDING",
      "RESULT_OVERDUE",
      "PENDING_PAYMENT",
      "BOOKED",
      "WAITLISTED",
      "HOLD",
      "DISRUPTION_PENDING",
      "UNDER_MAINTENANCE",
      "COMPLETED",
      "CANCELLED",
      "ABSENT",
      "REFUNDED",
      "BOOKING_NOT_UTILIZED",
    ]) {
      expect(statuses).toContain(s);
    }
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it("gives every status a label, a meaning and the shared badge class", () => {
    for (const entry of BOOKING_STATUS_LEGEND) {
      expect(entry.label.trim(), entry.status).not.toBe("");
      expect(entry.meaning.trim().length, entry.status).toBeGreaterThan(10);
      expect(entry.badgeClass).toBe(bookingStatusBadgeClass(entry.status));
    }
  });
});
