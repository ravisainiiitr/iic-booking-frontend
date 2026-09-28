import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
});

import { currentBookingDetailLines, type RescheduleBooking, type RescheduleSlot } from "./RescheduleSlotPicker";

const booking: RescheduleBooking = {
  booking_id: 42,
  equipment: 7,
  start_time: "2026-10-05T10:00:00+05:30",
  end_time: "2026-10-05T11:00:00+05:30",
  daily_slots: [{ id: 11, start_datetime: "2026-10-05T10:00:00+05:30", end_datetime: "2026-10-05T11:00:00+05:30", date: "2026-10-05" }],
};

const slot = (overrides: Partial<RescheduleSlot>): RescheduleSlot => ({
  id: 11,
  date: "2026-10-05",
  start_datetime: "2026-10-05T10:00:00+05:30",
  end_datetime: "2026-10-05T11:00:00+05:30",
  status: "BOOKED",
  ...overrides,
});

describe("currentBookingDetailLines", () => {
  it("prefers holder details from the booking", () => {
    const lines = currentBookingDetailLines(
      {
        ...booking,
        holder: {
          display_booking_id: "IICNMR0042",
          user_name: "Asha Verma",
          user_email: "asha@iitr.ac.in",
          user_phone: "9999999999",
          user_department: "Chemistry",
          supervisor_name: "Prof Rao",
        },
      },
      [slot({ booking_user_name: "Someone Else" })],
    );
    expect(lines).toContain("Booking ID: IICNMR0042");
    expect(lines).toContain("Name: Asha Verma");
    expect(lines).toContain("Email: asha@iitr.ac.in");
    expect(lines).toContain("Mobile: 9999999999");
    expect(lines).toContain("Department: Chemistry");
    expect(lines).toContain("Supervisor: Prof Rao");
    expect(lines).toContain("Slots: 1");
  });

  it("falls back to the booked slot's user fields", () => {
    const lines = currentBookingDetailLines(booking, [
      slot({ booking_user_name: "Ravi", booking_user_email: "ravi@iitr.ac.in", booking_user_department_code: "CY" }),
    ]);
    expect(lines).toContain("Booking ID: 42");
    expect(lines).toContain("Name: Ravi");
    expect(lines).toContain("Email: ravi@iitr.ac.in");
    expect(lines).toContain("Department: CY");
  });
});
