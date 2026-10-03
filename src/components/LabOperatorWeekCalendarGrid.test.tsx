// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
