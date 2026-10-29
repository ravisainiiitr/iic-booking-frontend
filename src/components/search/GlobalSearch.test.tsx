// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { resetAutomationFeaturesCache } from "@/components/automation/useAutomationFeatures";
import { GlobalSearchHost, openGlobalSearch } from "./GlobalSearch";
import { bookingHref, editDistance, matchPages, pagesFor, rememberSearch, loadRecentSearches } from "./searchCatalog";

const auth = vi.hoisted(() => ({ value: { user: null as unknown, isAuthenticated: false } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));

const openUserCard = vi.hoisted(() => vi.fn());
vi.mock("@/components/users/UserIdCardLink", () => ({ useUserCard: () => ({ openUserCard, drawer: null }) }));

const api = vi.hoisted(() => ({ globalSearch: vi.fn(), automationFeatures: vi.fn() }));
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
  api.automationFeatures.mockReset();
  api.automationFeatures.mockResolvedValue({ data: { instrument_finder: false, smart_slots: false } });
  resetAutomationFeaturesCache();
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

  it("forgives a small spelling mistake only for words found on no page", () => {
    const pages = pagesFor("student", true);
    expect(matchPages(pages, "notifcations").map((p) => p.path)).toContain("/notifications");
    expect(matchPages(pages, "walet").map((p) => p.path)).toEqual(["/wallet"]);
    expect(matchPages(pages, "wallet").map((p) => p.path)).toEqual(["/wallet"]);
    expect(matchPages(pages, "zzzzzz")).toEqual([]);
  });

  it("measures edit distance with swapped letters", () => {
    expect(editDistance("fesm", "fesem", 1)).toBe(1);
    expect(editDistance("xdr", "xrd", 1)).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
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

  it("lets users find the Officer in Charge and Lab In-charge and opens their instrument", async () => {
    auth.value = { user: { id: 2, user_type: "student" }, isAuthenticated: true };
    api.globalSearch.mockResolvedValue({
      data: {
        query: "mee",
        equipment: [],
        bookings: [],
        people: [],
        people_enabled: false,
        lab_staff: [
          { id: 5, name: "Dr. Meera Sharma", role: "Officer in Charge", email: "meera@iitr.ac.in",
            equipment: [{ id: 10, name: "FESEM-APREO", code: "APREO" }] },
        ],
      },
    });
    renderHost();
    act(() => openGlobalSearch("mee"));
    expect(await screen.findByText("Officer in Charge and Lab In-charge")).toBeTruthy();
    expect(screen.getByText("Officer in Charge · meera@iitr.ac.in")).toBeTruthy();
    fireEvent.click(screen.getByText("Dr. Meera Sharma"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/equipment/10"));
  });

  it("shows technique hints and a did-you-mean suggestion that refines the query", async () => {
    auth.value = { user: null, isAuthenticated: false };
    api.globalSearch.mockImplementation(async (q: string) => ({
      data:
        q === "cristal structure"
          ? {
              query: q,
              equipment: [
                {
                  id: 1,
                  name: "Powder X-Ray Diffractometer (PXRD) [A]",
                  code: "PXRD [A]",
                  category: "X-Ray Diffraction",
                  department: "",
                  status: "ACTIVE",
                  match: "fuzzy",
                  hint: "Matched technique: X-ray diffraction",
                },
                {
                  id: 2,
                  name: "Grazing Incidence X-Ray Diffractometer (GI-XRD)",
                  code: "GI-XRD",
                  category: "X-Ray Diffraction",
                  department: "",
                  status: "REPAIR",
                  match: "fuzzy",
                  hint: "Matched technique: X-ray diffraction",
                },
              ],
              suggestion: "crystal structure",
              bookings: [],
              people: [],
              people_enabled: false,
            }
          : { query: q, equipment: [], suggestion: "", bookings: [], people: [], people_enabled: false },
    }));
    renderHost();
    act(() => openGlobalSearch("cristal structure"));

    expect(await screen.findByText("Powder X-Ray Diffractometer (PXRD) [A]")).toBeTruthy();
    expect(screen.getAllByText("Matched technique: X-ray diffraction")).toHaveLength(2);
    expect(screen.getByText("Under maintenance")).toBeTruthy();

    fireEvent.click(screen.getByText("crystal structure"));
    await waitFor(() => expect(api.globalSearch).toHaveBeenLastCalledWith("crystal structure", expect.anything()));
  });

  it("shows no hint for exact matches", async () => {
    auth.value = { user: null, isAuthenticated: false };
    api.globalSearch.mockResolvedValue({
      data: {
        query: "TEM",
        equipment: [
          { id: 3, name: "Transmission Electron Microscope (TEM)", code: "TEM", category: "", department: "", status: "ACTIVE", match: "exact", hint: "" },
        ],
        suggestion: "",
        bookings: [],
        people: [],
        people_enabled: false,
      },
    });
    renderHost();
    act(() => openGlobalSearch("TEM"));
    expect(await screen.findByText("Transmission Electron Microscope (TEM)")).toBeTruthy();
    expect(screen.queryByText(/Matched technique|Did you mean/)).toBeNull();
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

  it("offers the Instrument finder every time it opens, and passes the query on", async () => {
    auth.value = { user: { id: 1, user_type: "student" }, isAuthenticated: true };
    api.automationFeatures.mockResolvedValue({ data: { instrument_finder: true, smart_slots: false } });
    api.globalSearch.mockResolvedValue({
      data: { query: "band gap", equipment: [], bookings: [], people: [], people_enabled: false },
    });
    renderHost();

    for (let i = 0; i < 2; i += 1) {
      act(() => openGlobalSearch(""));
      fireEvent.click(await screen.findByText("Instrument finder"));
      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/find-instrument"));
    }

    act(() => openGlobalSearch("band gap"));
    expect(await screen.findByText(/No matches for/)).toBeTruthy();
    fireEvent.click(await screen.findByText(/Ask the Instrument finder about/));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/find-instrument?q=band%20gap"));
  });

  it("leaves the Instrument finder out when it is switched off or signed out", async () => {
    auth.value = { user: { id: 1, user_type: "student" }, isAuthenticated: true };
    renderHost();
    act(() => openGlobalSearch(""));
    await screen.findByText("Go to");
    await waitFor(() => expect(api.automationFeatures).toHaveBeenCalled());
    expect(screen.queryByText("Instrument finder")).toBeNull();
    cleanup();

    resetAutomationFeaturesCache();
    api.automationFeatures.mockClear();
    auth.value = { user: null, isAuthenticated: false };
    renderHost();
    act(() => openGlobalSearch(""));
    await screen.findByText("Go to");
    expect(screen.queryByText("Instrument finder")).toBeNull();
    expect(api.automationFeatures).not.toHaveBeenCalled();
  });
});
