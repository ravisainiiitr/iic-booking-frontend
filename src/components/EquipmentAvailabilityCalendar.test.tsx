// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { addDays, format, startOfWeek } from "date-fns";

const getEquipmentSlots = vi.fn();
vi.mock("@/lib/api", () => ({ apiClient: { getEquipmentSlots: (...args: unknown[]) => getEquipmentSlots(...args) } }));

import EquipmentAvailabilityCalendar from "./EquipmentAvailabilityCalendar";

afterEach(() => {
  cleanup();
  getEquipmentSlots.mockReset();
});

function slot(id: number, day: Date, fields: Record<string, unknown>) {
  const date = format(day, "yyyy-MM-dd");
  return {
    id,
    date,
    slot_open_time: "09:00:00",
    start_datetime: `${date}T09:00:00+05:30`,
    end_datetime: `${date}T10:00:00+05:30`,
    ...fields,
  };
}

describe("EquipmentAvailabilityCalendar", () => {
  it("shows a slot of a completed booking as Completed, not Booked", async () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    getEquipmentSlots.mockResolvedValue({
      data: {
        slots: [
          slot(1, monday, { status: "BOOKED", display_status: "COMPLETED", booking_status: "COMPLETED" }),
          slot(2, addDays(monday, 1), { status: "BOOKED", booking_status: "COMPLETED" }),
          slot(3, addDays(monday, 2), { status: "BOOKED", display_status: "BOOKED", booking_status: "BOOKED" }),
          // Free future slot this week, so the calendar stays on this week.
          slot(4, addDays(monday, 6), { status: "AVAILABLE", start_datetime: "2099-01-01T09:00:00+05:30" }),
        ],
        slot_master_times: ["09:00:00"],
        slot_duration_minutes: 60,
        calendar_colors: { slot_colors: { COMPLETED: "#9f32d2", BOOKED: "#3819d2" } },
      },
    });

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    // Two cells plus the legend entry.
    await waitFor(() => expect(screen.getAllByText("Completed")).toHaveLength(3));
    const completed = screen.getAllByText("Completed");
    expect((completed[0] as HTMLElement).style.backgroundColor).toBe("rgb(159, 50, 210)");
    // One open booking plus the legend entry.
    expect(screen.getAllByText("Booked")).toHaveLength(2);
  });

  it("shows a past free slot as No booking instead of Past", async () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    getEquipmentSlots.mockResolvedValue({
      data: {
        slots: [
          slot(1, monday, { status: "AVAILABLE", start_datetime: "2000-01-03T09:00:00+05:30" }),
          slot(2, addDays(monday, 6), { status: "AVAILABLE", start_datetime: "2099-01-01T09:00:00+05:30" }),
        ],
        slot_master_times: ["09:00:00"],
        slot_duration_minutes: 60,
      },
    });

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    // The cell plus the legend entry.
    await waitFor(() => expect(screen.getAllByText("No booking")).toHaveLength(2));
    expect(screen.queryByText("Past")).toBeNull();
  });

  it("shows another user's Booking Not Utilized slot as plain Booked, with no booking details or link", async () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    getEquipmentSlots.mockResolvedValue({
      data: {
        slots: [
          slot(1, monday, {
            status: "BOOKING_NOT_UTILIZED",
            booking_id: "NU-41",
            real_booking_id: 41,
            booking_user_name: "Other Person",
          }),
          slot(2, addDays(monday, 6), { status: "AVAILABLE", start_datetime: "2099-01-01T09:00:00+05:30" }),
        ],
        slot_master_times: ["09:00:00"],
        slot_duration_minutes: 60,
      },
    });

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    // The cell plus the legend entry.
    await waitFor(() => expect(screen.getAllByText("Booked")).toHaveLength(2));
    expect(screen.queryByText(/NU-41/)).toBeNull();
    expect(screen.queryByText(/Other Person/)).toBeNull();
    expect(screen.queryByText(/Not Utilized/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /NU-41|Booking ID/ })).toBeNull();
  });

  it("explains a disrupted slot on hover with the public reason and expected recovery only", async () => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    getEquipmentSlots.mockResolvedValue({
      data: {
        slots: [
          slot(1, monday, {
            status: "UNDER_MAINTENANCE",
            disruption_public: {
              type: "UNDER_MAINTENANCE",
              label: "Under maintenance",
              reason: "Vacuum pump replacement",
              expected_recovery_at: null,
              recovery_status: "UNKNOWN",
              recovery_text: "Recovery date not yet announced",
            },
          }),
          slot(2, addDays(monday, 6), { status: "AVAILABLE", start_datetime: "2099-01-01T09:00:00+05:30" }),
        ],
        slot_master_times: ["09:00:00"],
        slot_duration_minutes: 60,
      },
    });

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    const cell = await screen.findByLabelText(/Vacuum pump replacement/);
    expect(cell.getAttribute("aria-label")).toContain("Recovery date not yet announced");
    fireEvent.focus(cell);
    const card = document.body.querySelector("[data-slot-hover-card]");
    expect(card?.textContent).toContain("Under maintenance");
    expect(card?.textContent).toContain("Vacuum pump replacement");
    expect(card?.textContent).toContain("Recovery date not yet announced");
  });
});
