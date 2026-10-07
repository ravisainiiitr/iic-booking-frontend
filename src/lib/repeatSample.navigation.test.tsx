// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { openRepeatSampleBooking } from "./repeatSample";

const visited: string[] = [];

function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;
  visited.push(here);
  return (
    <div>
      <span data-testid="at">{here}</span>
      <button type="button" onClick={() => openRepeatSampleBooking(navigate, location.pathname, 3, 501)}>
        Mark as repeat &amp; book (free)
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}

const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={["/dashboard", path]} initialIndex={1}>
      <Routes>
        <Route path="*" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  visited.length = 0;
});

describe("Mark as repeat & book navigation", () => {
  it("lands directly on booking slots for the user in repeat mode, and Back reopens the booking", () => {
    mount("/booking-management");
    fireEvent.click(screen.getByRole("button", { name: "Mark as repeat & book (free)" }));
    expect(screen.getByTestId("at").textContent).toBe("/book-equipment?equipment_id=3&mode=book&repeatOf=501");
    expect(visited.filter((p) => p.startsWith("/book-equipment"))).toEqual([
      "/book-equipment?equipment_id=3&mode=book&repeatOf=501",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("at").textContent).toBe("/booking-management?expand=501");
  });

  it("leaves other pages in history as they were", () => {
    mount("/equipment-bookings");
    fireEvent.click(screen.getByRole("button", { name: "Mark as repeat & book (free)" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("at").textContent).toBe("/equipment-bookings");
  });
});
