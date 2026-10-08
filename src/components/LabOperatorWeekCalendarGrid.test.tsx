// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LabOperatorWeekCalendarGrid } from "./LabOperatorWeekCalendarGrid";
import type { LabWeekCalendarSlotsPayload } from "@/lib/labOperatorCalendarTypes";

afterEach(cleanup);

const payload = {
  slots: [{ date: "2026-10-05", slot_open_time: "09:30", status: "AVAILABLE" }],
  slot_duration_minutes: 30,
} as unknown as LabWeekCalendarSlotsPayload;

function renderGrid(props: Partial<Parameters<typeof LabOperatorWeekCalendarGrid>[0]> = {}) {
  return render(
    <LabOperatorWeekCalendarGrid
      weekStartIso="2026-10-05"
      equipmentTitle="Powder X-Ray Diffractometer (PXRD) [A]"
      slotsPayload={payload}
      onBookedSlotClick={vi.fn()}
      headerActions={<button type="button">Next week</button>}
      {...props}
    />,
  );
}

describe("LabOperatorWeekCalendarGrid heading", () => {
  it("shows the controls on the same row as the equipment name", () => {
    renderGrid();
    const heading = screen.getByRole("heading", { name: "Powder X-Ray Diffractometer (PXRD) [A]" });
    expect(within(heading.parentElement as HTMLElement).getByRole("button", { name: "Next week" })).toBeTruthy();
  });

  it("keeps the controls when Booked only leaves nothing to show", () => {
    renderGrid({ bookedSlotsOnly: true });
    expect(screen.getByText("No booked slots this week for this equipment.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
  });

  it("keeps the controls while slots are not loaded", () => {
    renderGrid({ slotsPayload: null });
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
  });

  it("shows only the name when no controls are given", () => {
    renderGrid({ headerActions: undefined });
    expect(screen.queryByRole("button", { name: "Next week" })).toBeNull();
  });
});

const weekPayload = {
  slots: [
    { id: 1, date: "2020-01-06", slot_open_time: "09:30", start_datetime: "2020-01-06T09:30:00", status: "AVAILABLE" },
    { id: 2, date: "2099-01-05", slot_open_time: "09:30", start_datetime: "2099-01-05T09:30:00", status: "AVAILABLE" },
    {
      id: 3,
      date: "2099-01-06",
      slot_open_time: "09:30",
      start_datetime: "2099-01-06T09:30:00",
      status: "BOOKED",
      booking_id: "B-77",
      real_booking_id: 77,
      booking_user_name: "Test User",
    },
  ],
  slot_duration_minutes: 30,
} as unknown as LabWeekCalendarSlotsPayload;

describe("LabOperatorWeekCalendarGrid cells", () => {
  it("shows a past free slot as No booking, never Past", () => {
    renderGrid({ weekStartIso: "2020-01-06", slotsPayload: weekPayload });
    expect(screen.getByText("No booking")).toBeTruthy();
    expect(screen.queryByText("Past")).toBeNull();
  });

  it("opens the booking when a booked slot is clicked", () => {
    const onBookedSlotClick = vi.fn();
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: weekPayload, onBookedSlotClick });
    fireEvent.click(screen.getByRole("button", { name: /Booking ID: B-77/ }));
    expect(onBookedSlotClick).toHaveBeenCalledWith(77);
  });

  it("shows the booking hover card outside the grid so edge cells aren't cut off", () => {
    const { container } = renderGrid({ weekStartIso: "2099-01-05", slotsPayload: weekPayload });
    fireEvent.focus(screen.getByRole("button", { name: /Booking ID: B-77/ }));
    const card = document.body.querySelector("[data-slot-hover-card]");
    expect(card).not.toBeNull();
    expect(container.contains(card)).toBe(false);
    expect(card?.textContent).toContain("Booking ID: B-77");
    expect(card?.textContent).toContain("User: Test User");
    expect(card?.textContent).toContain("Equipment: Powder X-Ray Diffractometer (PXRD) [A]");
  });

  it("lets an OIC pick free slots when selection is enabled", () => {
    const onToggle = vi.fn();
    renderGrid({
      weekStartIso: "2099-01-05",
      slotsPayload: weekPayload,
      selection: { selectedIds: new Set<number>(), canSelect: () => true, onToggle },
    });
    fireEvent.click(screen.getByRole("button", { name: /Available$/ }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("marks selected slots and leaves free slots plain without selection", () => {
    const { unmount } = renderGrid({
      weekStartIso: "2099-01-05",
      slotsPayload: weekPayload,
      selection: { selectedIds: new Set([2]), canSelect: () => true, onToggle: vi.fn() },
    });
    expect(screen.getByRole("button", { name: /selected$/ }).getAttribute("aria-pressed")).toBe("true");
    unmount();
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: weekPayload, headerActions: undefined });
    expect(screen.queryByRole("button", { name: /Available/ })).toBeNull();
    expect(screen.getByText("Available")).toBeTruthy();
  });
});

const notUtilizedPayload = {
  slots: [
    { id: 4, date: "2099-01-05", slot_open_time: "09:30", start_datetime: "2099-01-05T09:30:00", status: "AVAILABLE" },
    {
      id: 5,
      date: "2099-01-06",
      slot_open_time: "09:30",
      start_datetime: "2099-01-06T09:30:00",
      end_datetime: "2099-01-06T10:00:00",
      status: "BOOKING_NOT_UTILIZED",
      booking_id: "NU-88",
      real_booking_id: 88,
      booking_status: "BOOKING_NOT_UTILIZED",
      booking_user_name: "Idle User",
      booking_user_department_name: "Physics",
    },
  ],
  slot_duration_minutes: 30,
} as unknown as LabWeekCalendarSlotsPayload;

describe("LabOperatorWeekCalendarGrid Booking Not Utilized cells", () => {
  it("shows the booking ID and user in the cell and opens the booking on click", () => {
    const onBookedSlotClick = vi.fn();
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: notUtilizedPayload, onBookedSlotClick });
    const cell = screen.getByRole("button", { name: /Booking ID: NU-88/ });
    expect(cell.textContent).toContain("NU-88");
    expect(cell.textContent).toContain("Idle User");
    expect(cell.textContent).toContain("Not utilized");
    fireEvent.click(cell);
    expect(onBookedSlotClick).toHaveBeenCalledWith(88);
  });

  it("shows the booking hover card with status Booking Not Utilized", () => {
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: notUtilizedPayload });
    fireEvent.focus(screen.getByRole("button", { name: /Booking ID: NU-88/ }));
    const card = document.body.querySelector("[data-slot-hover-card]");
    expect(card?.textContent).toContain("Booking ID: NU-88");
    expect(card?.textContent).toContain("User: Idle User");
    expect(card?.textContent).toContain("Department: Physics");
    expect(card?.textContent).toContain("Status: Booking Not Utilized");
    expect(card?.textContent).toContain("Slot: 09:30 – 10:00");
    expect(card?.textContent).toContain("Equipment: Powder X-Ray Diffractometer (PXRD) [A]");
  });

  it("opens the booking instead of toggling selection when OIC selection is on", () => {
    const onBookedSlotClick = vi.fn();
    const onToggle = vi.fn();
    renderGrid({
      weekStartIso: "2099-01-05",
      slotsPayload: notUtilizedPayload,
      onBookedSlotClick,
      selection: { selectedIds: new Set<number>(), canSelect: (s) => s.status === "AVAILABLE", onToggle },
    });
    fireEvent.click(screen.getByRole("button", { name: /Booking ID: NU-88/ }));
    expect(onBookedSlotClick).toHaveBeenCalledWith(88);
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Available$/ }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  it("stays visible under Booked only", () => {
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: notUtilizedPayload, bookedSlotsOnly: true });
    expect(screen.getByRole("button", { name: /Booking ID: NU-88/ })).toBeTruthy();
  });

  it("stays a plain cell when the slot has no booking reference", () => {
    const payloadNoRef = {
      ...notUtilizedPayload,
      slots: [{ ...notUtilizedPayload.slots[1], booking_id: null, real_booking_id: null, booking_user_name: null }],
    } as unknown as LabWeekCalendarSlotsPayload;
    renderGrid({ weekStartIso: "2099-01-05", slotsPayload: payloadNoRef, headerActions: undefined });
    expect(screen.getByText("Booking Not Utilized")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
