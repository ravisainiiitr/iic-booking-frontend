// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import EquipmentCatalogCard, { type EquipmentCatalogCardItem } from "./EquipmentCatalogCard";

const state = vi.hoisted(() => ({
  auth: { user: { id: 1, user_type: "student" } as Record<string, unknown> | null, isAuthenticated: true },
  peak: { loaded: true, active: false, externalPaused: false, externalNotice: false, window: null, message: "" },
  prefetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-peak-window", () => ({ usePeakWindow: () => state.peak }));
vi.mock("@/components/EquipmentImage", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "/api",
  apiClient: new Proxy({}, { get: () => vi.fn(async () => ({ data: null })) }),
}));
vi.mock("@/lib/peakWindow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/peakWindow")>()),
  prefetchBookingPage: state.prefetch,
}));

const accent = { gradient: "", bar: "", button: "", border: "" };
const item: EquipmentCatalogCardItem = {
  id: 42,
  name: "XPS",
  image: "/x.png",
  status: "ACTIVE",
  fromPrice: "1500.00",
  fromPriceUnit: "sample",
};

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

const renderCard = (props: Partial<Parameters<typeof EquipmentCatalogCard>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={["/equipment"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <EquipmentCatalogCard item={item} accent={accent} canChangeSlotStatus={false} {...props} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent;

afterEach(() => {
  cleanup();
  state.auth = { user: { id: 1, user_type: "student" }, isAuthenticated: true };
  state.peak = { ...state.peak, active: false };
  state.prefetch.mockClear();
});

describe("EquipmentCatalogCard routing", () => {
  it("opens the detail page off-peak and offers a separate Book button", () => {
    renderCard();
    fireEvent.click(screen.getByText("XPS"));
    expect(where()).toBe("/equipment/42");
    fireEvent.click(screen.getByRole("button", { name: "Book XPS" }));
    expect(where()).toBe("/book-equipment?equipment_id=42");
  });

  it("takes internal users straight to booking during the peak window", () => {
    state.peak = { ...state.peak, active: true };
    renderCard();
    fireEvent.click(screen.getByText("XPS"));
    expect(where()).toBe("/book-equipment?equipment_id=42");
    expect(screen.getByRole("button", { name: "Book now" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(where()).toBe("/equipment/42");
  });

  it("uses book-for-user mode for admin, OIC and department admin", () => {
    state.peak = { ...state.peak, active: true };
    state.auth = { user: { id: 2, user_type: "manager" }, isAuthenticated: true };
    renderCard({ canBookForOtherUsers: true });
    fireEvent.click(screen.getByText("XPS"));
    expect(where()).toBe("/book-equipment?equipment_id=42&mode=book");
  });

  it("keeps detail-page behaviour for non-operational equipment during peak", () => {
    state.peak = { ...state.peak, active: true };
    render(
      <MemoryRouter initialEntries={["/equipment"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <EquipmentCatalogCard item={{ ...item, status: "REPAIR" }} accent={accent} canChangeSlotStatus={false} />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("XPS"));
    expect(where()).toBe("/equipment/42");
    expect(screen.queryByRole("button", { name: /^Book/ })).toBeNull();
  });

  it("lets the family-parent handler take over", () => {
    state.peak = { ...state.peak, active: true };
    const onOpen = vi.fn(() => true);
    renderCard({ onOpenEquipment: onOpen });
    fireEvent.click(screen.getByText("XPS"));
    expect(onOpen).toHaveBeenCalledWith(42);
    expect(where()).toBe("/equipment");
  });

  it("never routes external users to booking and hides Book for them", () => {
    state.peak = { ...state.peak, active: true };
    state.auth = { user: { id: 3, user_type: "industry" }, isAuthenticated: true };
    renderCard();
    expect(screen.queryByRole("button", { name: /^Book/ })).toBeNull();
    fireEvent.click(screen.getByText("XPS"));
    expect(where()).toBe("/equipment/42");
  });

  it("hides Book for signed-out visitors and lab/accounts in-charge", () => {
    state.auth = { user: null, isAuthenticated: false };
    renderCard();
    expect(screen.queryByRole("button", { name: "Book XPS" })).toBeNull();
    cleanup();
    state.auth = { user: { id: 4, user_type: "operator" }, isAuthenticated: true };
    renderCard();
    expect(screen.queryByRole("button", { name: "Book XPS" })).toBeNull();
  });

  it("warms the booking chunk on hover for users who can book", () => {
    renderCard();
    fireEvent.mouseEnter(screen.getByText("XPS").closest("div.group") as HTMLElement);
    expect(state.prefetch).toHaveBeenCalled();
  });
});

describe("EquipmentCatalogCard price", () => {
  it("shows the from-price with its unit", () => {
    renderCard();
    expect(screen.getByText("from ₹1,500/sample")).toBeTruthy();
  });

  it("hides the price when unknown", () => {
    render(
      <MemoryRouter>
        <EquipmentCatalogCard item={{ ...item, fromPrice: null }} accent={accent} canChangeSlotStatus={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/from ₹/)).toBeNull();
  });
});

describe("EquipmentCatalogCard multi-mode availability", () => {
  it("lays one line over the photo, leading with this mode, and opens the availability calendar", () => {
    renderCard({
      item: {
        ...item,
        modeAvailability: {
          parent_equipment_id: 41,
          modes: [
            {
              equipment_id: 41, code: "XPS", name: "XPS base", role: "base", operational: true,
              weekdays: [0, 1, 2, 3, 4], hours: [], state: "available", next_available: { date: "2030-01-09", free_slots: 2 }, next_opening: null,
            },
            {
              equipment_id: 42, code: "XPS-D", name: "XPS Depth", role: "mode", operational: true,
              weekdays: [1, 3], hours: [], state: "full", next_available: null, next_opening: null,
            },
          ],
        },
      },
    });
    const strip = screen.getByTestId("card-mode-availability");
    expect(strip.textContent).toBe("XPS-D Tue/Thu · full|XPS Mon–Fri · next Wed 9 Jan");
    expect(strip.getAttribute("title")).toBe("XPS-D Tue/Thu · full | XPS Mon–Fri · next Wed 9 Jan");
    expect(screen.queryByText(/modes share this instrument/)).toBeNull();
    fireEvent.click(strip);
    expect(where()).toBe("/equipment/42?panel=availability");
    cleanup();
    renderCard();
    expect(screen.queryByTestId("card-mode-availability")).toBeNull();
  });
});
