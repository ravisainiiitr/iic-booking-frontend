// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LabCalendarSlotActions, isDashboardSelectableSlot } from "./LabCalendarSlotActions";

afterEach(cleanup);

const now = new Date("2026-10-07T12:00:00");
const future = "2026-10-08T09:30:00";

describe("isDashboardSelectableSlot", () => {
  it("allows upcoming slots without a booking", () => {
    expect(isDashboardSelectableSlot({ status: "AVAILABLE", start_datetime: future }, now)).toBe(true);
    expect(isDashboardSelectableSlot({ status: "BLOCKED", start_datetime: future }, now)).toBe(true);
    expect(isDashboardSelectableSlot({ status: "UNDER_MAINTENANCE", start_datetime: future }, now)).toBe(true);
  });

  it("keeps booked slots off the quick action", () => {
    expect(isDashboardSelectableSlot({ status: "BOOKED", start_datetime: future }, now)).toBe(false);
    expect(isDashboardSelectableSlot({ status: "BOOKING_NOT_UTILIZED", start_datetime: future }, now)).toBe(false);
    expect(isDashboardSelectableSlot({ status: "BLOCKED", start_datetime: future, real_booking_id: 5 }, now)).toBe(false);
  });

  it("keeps past slots off the quick action", () => {
    expect(isDashboardSelectableSlot({ status: "AVAILABLE", start_datetime: "2026-10-07T09:30:00" }, now)).toBe(false);
  });
});

describe("LabCalendarSlotActions", () => {
  it("explains how to select when nothing is selected", () => {
    render(<LabCalendarSlotActions selectedCount={0} onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(/Click upcoming free slots to select them/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
  });

  it("blocks the selected slots with the typed reason", () => {
    const onApply = vi.fn();
    render(<LabCalendarSlotActions selectedCount={2} onApply={onApply} onClear={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Reason shown on the slot (optional)"), { target: { value: " Training " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply to 2 slots" }));
    expect(onApply).toHaveBeenCalledWith("BLOCKED", "Training");
  });

  it("clears the selection", () => {
    const onClear = vi.fn();
    render(<LabCalendarSlotActions selectedCount={1} onApply={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("disables the buttons while applying", () => {
    render(<LabCalendarSlotActions selectedCount={1} busy onApply={vi.fn()} onClear={vi.fn()} />);
    expect((screen.getByRole("button", { name: /Applying/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
