import { describe, expect, it } from "vitest";
import { BOOKING_STATUS_LEGEND, bookingStatusBadgeClass } from "./bookingStatusLegend";

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

describe("BOOKING_STATUS_LEGEND", () => {
  it("covers the statuses users see in My Bookings", () => {
    const statuses = BOOKING_STATUS_LEGEND.map((e) => e.status);
    for (const s of [
      "PENDING",
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
