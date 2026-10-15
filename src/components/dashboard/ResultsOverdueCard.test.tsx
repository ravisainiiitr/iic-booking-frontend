// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { rememberedOpenKey } from "@/lib/rememberedOpen";

const api = vi.hoisted(() => ({ getResultsOverdueBookings: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 42, user_type: "manager" } }) }));

import ResultsOverdueCard, { RESULTS_OVERDUE_PANEL } from "./ResultsOverdueCard";

function booking(id: number) {
  return {
    booking_id: id,
    booking_ref: `IICXPS20260000${id}`,
    equipment_id: 5,
    equipment_name: "X-Ray Photoelectron Spectroscopy (XPS)",
    equipment_code: "XPS",
    user_name: "Test User",
    due_display: "Fri 09 Oct 2026, 08:05 PM",
    overdue_by: "5 days 15 h",
    link: `/booking-management?expand=${id}`,
  };
}

const renderCard = () =>
  render(
    <MemoryRouter>
      <ResultsOverdueCard />
    </MemoryRouter>,
  );

beforeEach(() => {
  api.getResultsOverdueBookings.mockResolvedValue({ data: { bookings: [booking(1), booking(2), booking(3)] } });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ResultsOverdueCard", () => {
  it("is collapsed by default to a one-line header with the count", async () => {
    renderCard();
    const toggle = await screen.findByTestId("results-overdue-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Results overdue");
    expect(toggle.textContent).toContain("3");
    expect(screen.queryByText("IICXPS202600001")).toBeNull();
    expect(screen.queryByRole("button", { name: /View all in View Booking/ })).toBeNull();
  });

  it("expands on click and remembers the choice for the user", async () => {
    const first = renderCard();
    await userEvent.click(await screen.findByTestId("results-overdue-toggle"));
    expect(screen.getByText("IICXPS202600001")).toBeTruthy();
    expect(localStorage.getItem(rememberedOpenKey(RESULTS_OVERDUE_PANEL, 42))).toBe("1");
    first.unmount();

    renderCard();
    expect((await screen.findByTestId("results-overdue-toggle")).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("IICXPS202600001")).toBeTruthy();

    await userEvent.click(screen.getByTestId("results-overdue-toggle"));
    expect(screen.queryByText("IICXPS202600001")).toBeNull();
    expect(localStorage.getItem(rememberedOpenKey(RESULTS_OVERDUE_PANEL, 42))).toBe("0");
  });

  it("shows nothing when no results are overdue", async () => {
    api.getResultsOverdueBookings.mockResolvedValue({ data: { bookings: [] } });
    const { container } = renderCard();
    await Promise.resolve();
    expect(container.textContent).toBe("");
  });
});
