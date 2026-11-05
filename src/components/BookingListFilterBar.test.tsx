/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingListFilterBar } from "./BookingListFilterBar";
import { UrgentBadge } from "./booking/UrgentBadge";

const bar = (props: Partial<Parameters<typeof BookingListFilterBar>[0]> = {}) => (
  <BookingListFilterBar
    search=""
    onSearchChange={() => {}}
    status="all"
    onStatusChange={() => {}}
    statusOptions={[{ value: "all", label: "All status" }]}
    startDate=""
    onStartDateChange={() => {}}
    endDate=""
    onEndDateChange={() => {}}
    equipment="all"
    onEquipmentChange={() => {}}
    equipmentOptions={[]}
    {...props}
  />
);

afterEach(() => cleanup());

describe("Urgent only filter", () => {
  it("toggles and reports its state", () => {
    const onChange = vi.fn();
    const { rerender } = render(bar({ urgentOnly: false, onUrgentOnlyChange: onChange }));
    const button = screen.getByRole("button", { name: "Urgent only" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(bar({ urgentOnly: true, onUrgentOnlyChange: onChange }));
    const pressed = screen.getByRole("button", { name: "Urgent only" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("is absent where a page does not offer it", () => {
    render(bar());
    expect(screen.queryByRole("button", { name: "Urgent only" })).toBeNull();
  });

  it("badge reads URGENT", () => {
    render(<UrgentBadge />);
    expect(screen.getByTestId("urgent-badge").textContent).toBe("URGENT");
  });
});
