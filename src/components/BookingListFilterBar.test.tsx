/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BookingListFilterBar } from "./BookingListFilterBar";
import { UrgentBadge } from "./booking/UrgentBadge";
import { statusFilterParams, URGENT_FILTER_OPTION } from "@/lib/bookingStatusLegend";

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

describe("Urgent status choice", () => {
  it("asks the list for urgent bookings, not for a list status", () => {
    expect(statusFilterParams(URGENT_FILTER_OPTION.value)).toEqual({ urgent: true });
  });

  it("leaves other choices as they were", () => {
    expect(statusFilterParams("all")).toEqual({});
    expect(statusFilterParams("BOOKED")).toEqual({ list_status: "BOOKED" });
  });

  it("shows as the selected status, with no separate button", () => {
    render(bar({ status: URGENT_FILTER_OPTION.value, statusOptions: [URGENT_FILTER_OPTION] }));
    expect(screen.getAllByRole("combobox")[0].textContent).toContain("Urgent");
    expect(screen.queryByRole("button", { name: "Urgent only" })).toBeNull();
  });

  it("badge reads URGENT", () => {
    render(<UrgentBadge />);
    expect(screen.getByTestId("urgent-badge").textContent).toBe("URGENT");
  });
});
