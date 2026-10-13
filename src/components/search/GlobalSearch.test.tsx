// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { GlobalSearchHost, openGlobalSearch } from "./GlobalSearch";
import { bookingHref, matchPages, pagesFor, rememberSearch, loadRecentSearches } from "./searchCatalog";

const auth = vi.hoisted(() => ({ value: { user: null as unknown, isAuthenticated: false } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));

const openUserCard = vi.hoisted(() => vi.fn());
vi.mock("@/components/users/UserIdCardLink", () => ({ useUserCard: () => ({ openUserCard, drawer: null }) }));

const api = vi.hoisted(() => ({ globalSearch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{`${loc.pathname}${loc.search}`}</output>;
}

function renderHost() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <GlobalSearchHost />
      <Where />
    </MemoryRouter>,
  );
}

// The palette is lazy; load it up front so the first open is not racing the module import.
beforeAll(async () => {
  await import("./GlobalSearchDialog");
});

beforeEach(() => {
  localStorage.clear();
  api.globalSearch.mockReset();
});

afterEach(() => cleanup());

describe("search catalogue helpers", () => {
  it("offers staff pages to staff only", () => {
    const student = pagesFor("student", true).map((p) => p.path);
    const oic = pagesFor("manager", true).map((p) => p.path);
    expect(student).toContain("/my-bookings");
    expect(student).not.toContain("/booking-management");
    expect(oic).toContain("/booking-management");
    expect(pagesFor(null, false).every((p) => p.audience === "public")).toBe(true);
  });

  it("matches every word against titles and keywords", () => {
    const pages = pagesFor("student", true);
    expect(matchPages(pages, "wallet").map((p) => p.path)).toEqual(["/wallet"]);
    expect(matchPages(pages, "email alerts").map((p) => p.path)).toEqual(["/notifications?tab=settings"]);
  });

  it("keeps recent searches unique and newest first", () => {
    rememberSearch("xrd");
    rememberSearch("SEM");
    rememberSearch("XRD");
    expect(loadRecentSearches()).toEqual(["XRD", "SEM"]);
  });

  it("opens staff hits in booking management and own bookings in My bookings", () => {
    expect(bookingHref({ id: 7, virtual_booking_id: "IICX1", own: false }, true)).toBe("/booking-management?expand=7");
    expect(bookingHref({ id: 7, virtual_booking_id: "IICX1", own: true }, true)).toBe("/my-bookings?booking=IICX1");
  });
});

describe("GlobalSearchHost", () => {
  it("opens with Ctrl+K and shows grouped results that navigate", async () => {
    auth.value = { user: { id: 1, user_type: "manager" }, isAuthenticated: true };
    api.globalSearch.mockResolvedValue({
      data: {
        query: "IIC",
        equipment: [{ id: 3, name: "X-ray Diffractometer", code: "XRD", category: "", department: "", status: "" }],
        bookings: [
          {
            id: 42,
            virtual_booking_id: "IICXRD202600042",
            status: "BOOKED",
            status_label: "Booked",
            equipment: "X-ray Diffractometer",
            equipment_code: "XRD",
            user_name: "Alice",
            slot_start: null,
            created_at: null,
            own: false,
          },
        ],
        people: [{ id: 9, name: "Alice", email: "a@x.in", user_type: "Student", department: "Chemistry" }],
        people_enabled: true,
        staff_view: true,
      },
    });
    renderHost();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByPlaceholderText(/Search booking ID, equipment, user name/);
    fireEvent.change(input, { target: { value: "IIC" } });

    expect(await screen.findByText("IICXRD202600042")).toBeTruthy();
    expect(screen.getByText("Booked")).toBeTruthy();
    expect(api.globalSearch).toHaveBeenCalledWith("IIC", expect.anything());

    fireEvent.click(screen.getByText("IICXRD202600042"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/booking-management?expand=42"));
    expect(loadRecentSearches()).toEqual(["IIC"]);
  });

  it("opens a person's ID card", async () => {
    auth.value = { user: { id: 1, user_type: "admin" }, isAuthenticated: true };
    api.globalSearch.mockResolvedValue({
      data: {
        query: "ali",
        equipment: [],
        bookings: [],
        people: [{ id: 9, name: "Alice", email: "a@x.in", user_type: "Student", department: "" }],
        people_enabled: true,
        staff_view: true,
      },
    });
    renderHost();
    act(() => openGlobalSearch("ali"));
    fireEvent.click(await screen.findByText("Alice"));
    expect(openUserCard).toHaveBeenCalledWith(9);
  });

  it("explains when nothing matches", async () => {
    auth.value = { user: null, isAuthenticated: false };
    api.globalSearch.mockResolvedValue({
      data: { query: "zzz", equipment: [], bookings: [], people: [], people_enabled: false },
    });
    renderHost();
    act(() => openGlobalSearch("zzz"));
    expect(await screen.findByText(/No matches for/)).toBeTruthy();
  });
});
