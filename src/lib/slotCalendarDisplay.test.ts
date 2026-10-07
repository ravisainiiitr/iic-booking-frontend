import { describe, expect, it } from "vitest";
import {
  NO_BOOKING_COLOR,
  NO_BOOKING_LABEL,
  contrastTextColor,
  isPastUnbookedSlot,
  resolveSlotCell,
  slotCalendarLegend,
  slotCalendarPalette,
} from "./slotCalendarDisplay";

const NOW = new Date("2026-10-07T13:00:00+05:30");
const WEDNESDAY = new Date(2026, 9, 7);
const SATURDAY = new Date(2026, 9, 10);
const SUNDAY = new Date(2026, 9, 11);
const PAST = "2026-10-07T09:30:00+05:30";
const FUTURE = "2026-10-08T09:30:00+05:30";
const palette = slotCalendarPalette();

function show(slot: Parameters<typeof resolveSlotCell>[0]["slot"], extra: Partial<Parameters<typeof resolveSlotCell>[0]> = {}) {
  return resolveSlotCell({ slot, day: WEDNESDAY, palette, now: NOW, ...extra });
}

describe("resolveSlotCell: past slots", () => {
  it("shows a past Available slot nobody booked as No booking, not Past", () => {
    const cell = show({ status: "AVAILABLE", start_datetime: PAST });
    expect(cell.kind).toBe("no-booking");
    expect(cell.label).toBe(NO_BOOKING_LABEL);
    expect(cell.label).toBe("No booking");
    expect(cell.background).toBe(NO_BOOKING_COLOR);
  });

  it("treats past department-reserved Available slots as No booking too", () => {
    expect(show({ status: "AVAILABLE", status_display: "Home department only", start_datetime: PAST }).label).toBe("No booking");
  });

  it("keeps Booked and Completed on past booked slots", () => {
    expect(show({ status: "BOOKED", booking_status: "CONFIRMED", start_datetime: PAST }).label).toBe("Booked");
    expect(show({ status: "BOOKED", booking_status: "COMPLETED", start_datetime: PAST }).label).toBe("Completed");
    expect(show({ status: "BOOKED", display_status: "COMPLETED", start_datetime: PAST }).kind).toBe("completed");
  });

  it("keeps blocked and maintenance statuses on past slots", () => {
    expect(show({ status: "BLOCKED", blocked_label: "Training", start_datetime: PAST }).label).toBe("Training");
    expect(show({ status: "BLOCKED", start_datetime: PAST }).label).toBe("Other Reasons");
    const maintenance = show({ status: "UNDER_MAINTENANCE", start_datetime: PAST });
    expect(maintenance.label).toBe("Under Maintenance");
    expect(maintenance.background).toBe(palette.slotColors.UNDER_MAINTENANCE);
  });

  it("isPastUnbookedSlot only matches past Available slots", () => {
    expect(isPastUnbookedSlot({ status: "AVAILABLE", start_datetime: PAST }, NOW)).toBe(true);
    expect(isPastUnbookedSlot({ status: "AVAILABLE", start_datetime: FUTURE }, NOW)).toBe(false);
    expect(isPastUnbookedSlot({ status: "BOOKED", start_datetime: PAST }, NOW)).toBe(false);
    expect(isPastUnbookedSlot({ status: "AVAILABLE" }, NOW)).toBe(false);
  });
});

describe("resolveSlotCell: future and closed days", () => {
  it("shows future free slots as Available in the configured colour", () => {
    const cell = show({ status: "AVAILABLE", start_datetime: FUTURE }, { palette: slotCalendarPalette({ slot_colors: { AVAILABLE: "#00ff00" } }) });
    expect(cell).toMatchObject({ kind: "available", label: "Available", background: "#00ff00" });
  });

  it("names Saturday and Sunday on closed weekend slots with the weekend colours", () => {
    const sat = show({ status: "NOT_AVAILABLE", start_datetime: FUTURE }, { day: SATURDAY, holiday: "Saturday" });
    expect(sat).toMatchObject({ kind: "closed-day", label: "Saturday", background: palette.saturday });
    const sun = show(null, { day: SUNDAY });
    expect(sun).toMatchObject({ kind: "closed-day", label: "Sunday", background: palette.sunday });
  });

  it("shows a named holiday as Holiday with the name on hover", () => {
    const cell = show({ status: "NOT_AVAILABLE", start_datetime: FUTURE }, { holiday: { label: "Dussehra", color: "#123456" } });
    expect(cell).toMatchObject({ kind: "closed-day", label: "Holiday", background: "#123456", hover: "Holiday: Dussehra" });
  });

  it("shows a weekend or holiday slot that staff opened as Available", () => {
    expect(show({ status: "AVAILABLE", start_datetime: FUTURE }, { day: SUNDAY, holiday: "Sunday" }).label).toBe("Available");
    expect(show({ status: "AVAILABLE", start_datetime: FUTURE }, { holiday: "Diwali" }).label).toBe("Available");
  });

  it("shows a dash for a weekday with no slot", () => {
    expect(show(null)).toMatchObject({ kind: "empty", label: "—" });
  });

  it("names Booking Not Utilized for staff but just Booked for users", () => {
    expect(show({ status: "BOOKING_NOT_UTILIZED", start_datetime: PAST }, { staffView: true }).label).toBe("Booking Not Utilized");
    expect(show({ status: "BOOKING_NOT_UTILIZED", start_datetime: PAST }).label).toBe("Booked");
  });

  it("shows department reservations", () => {
    expect(show({ status: "AVAILABLE", status_display: "Reserved for other departments", start_datetime: FUTURE }).kind).toBe("reserved");
  });
});

describe("slot calendar legend and colours", () => {
  it("lists No booking and no longer lists Past", () => {
    const labels = slotCalendarLegend(palette).map((i) => i.label);
    expect(labels).toContain("No booking");
    expect(labels).not.toContain("Past");
  });

  it("picks readable text colours", () => {
    expect(contrastTextColor("#ffffff")).toBe("#1f2937");
    expect(contrastTextColor("#000")).toBe("#ffffff");
    expect(contrastTextColor("not-a-colour")).toBe("#1f2937");
  });
});
