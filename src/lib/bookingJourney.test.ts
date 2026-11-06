import { describe, expect, it } from "vitest";
import { bookingTab, bookingTimeline, bookingTone, slotWhen, timeUntil } from "./bookingJourney";

const now = new Date("2026-11-06T06:00:00Z"); // 11:30 in India

describe("bookingTab", () => {
  it("puts a booking under the tab a user would look in", () => {
    expect(bookingTab({ status: "BOOKED", end_time: "2026-11-07T06:00:00Z" }, now)).toBe("upcoming");
    expect(bookingTab({ status: "BOOKED", end_time: "2026-11-05T06:00:00Z" }, now)).toBe("past");
    expect(bookingTab({ status: "PENDING_PAYMENT", end_time: "2026-11-05T06:00:00Z" }, now)).toBe("pending");
    expect(bookingTab({ status: "DISRUPTION_PENDING" }, now)).toBe("pending");
    expect(bookingTab({ status: "PROCESSING" }, now)).toBe("pending");
    expect(bookingTab({ status: "COMPLETED" }, now)).toBe("past");
    expect(bookingTab({ status: "CANCELLED" }, now)).toBe("cancelled");
    expect(bookingTab({ status: "refunded" }, now)).toBe("cancelled");
  });
});

describe("bookingTone", () => {
  it("gives every status a distinct meaning and never fails on an unknown one", () => {
    expect(bookingTone("completed")).toBe("success");
    expect(bookingTone("PENDING_PAYMENT")).toBe("warning");
    expect(bookingTone("DISRUPTION_PENDING")).toBe("danger");
    expect(bookingTone("SOMETHING_NEW")).toBe("neutral");
    expect(bookingTone(null)).toBe("neutral");
  });
});

describe("bookingTimeline", () => {
  const current = (status: string, start?: string) =>
    bookingTimeline({ status, start_time: start }, now)?.find((s) => s.state === "current")?.key;

  it("shows where a booking stands", () => {
    expect(current("PENDING_PAYMENT")).toBe("requested");
    expect(current("BOOKED", "2026-11-07T06:00:00Z")).toBe("confirmed");
    expect(current("BOOKED", "2026-11-06T05:00:00Z")).toBe("analysis");
    expect(current("PROCESSING")).toBe("analysis");
  });

  it("marks everything done when completed", () => {
    expect(bookingTimeline({ status: "COMPLETED" }, now)?.every((s) => s.state === "done")).toBe(true);
  });

  it("has no timeline for a booking that left the path", () => {
    expect(bookingTimeline({ status: "CANCELLED" }, now)).toBeNull();
    expect(bookingTimeline({ status: "BOOKING_NOT_UTILIZED" }, now)).toBeNull();
  });
});

describe("slot wording", () => {
  it("uses India time whatever the phone's zone", () => {
    expect(slotWhen("2026-11-06T04:30:00Z", "2026-11-06T05:30:00Z").toLowerCase()).toMatch(/fri.*6 nov.*10:00 am.*11:00 am/);
  });

  it("says how long until a booking", () => {
    expect(timeUntil("2026-11-06T06:20:00Z", now)).toBe("In 20 min");
    expect(timeUntil("2026-11-06T08:00:00Z", now)).toBe("In 2 hours");
    expect(timeUntil("2026-11-07T06:00:00Z", now)).toBe("Tomorrow");
    expect(timeUntil("2026-11-10T06:00:00Z", now)).toBe("In 4 days");
    expect(timeUntil("2026-11-06T05:00:00Z", now)).toBe("");
    expect(timeUntil(null, now)).toBe("");
  });

  it("does not fail on a bad date", () => {
    expect(slotWhen("nonsense")).toBe("");
    expect(timeUntil("nonsense", now)).toBe("");
  });
});
