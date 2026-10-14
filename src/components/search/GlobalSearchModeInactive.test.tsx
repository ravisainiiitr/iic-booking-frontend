// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { GlobalSearchHost, openGlobalSearch } from "./GlobalSearch";

const auth = vi.hoisted(() => ({ value: { user: { id: 1, user_type: "student" } as unknown, isAuthenticated: true } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/components/users/UserIdCardLink", () => ({ useUserCard: () => ({ openUserCard: vi.fn(), drawer: null }) }));

const api = vi.hoisted(() => ({ globalSearch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

beforeAll(async () => {
  await import("./GlobalSearchDialog");
});

beforeEach(() => {
  localStorage.clear();
  api.globalSearch.mockReset();
});

afterEach(() => cleanup());

const row = (id: number, code: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, code, category: "NMR", department: "", status: "ACTIVE", ...extra,
});

describe("search palette: mode not active", () => {
  it("lists the instrument with a Mode not active pill and the running mode, without a Book button", async () => {
    api.globalSearch.mockResolvedValue({
      data: {
        query: "nmr",
        equipment: [
          row(338, "NMR TXI", "NMR TXI probe"),
          row(7, "NMR", "NMR Spectrometer", {
            mode_inactive: {
              label: "Mode not active",
              message: "Currently running as NMR TXI probe; booking opens when this mode is active.",
              active_mode: { equipment_id: 338, code: "NMR TXI", name: "NMR TXI probe" },
              next_active_dates: ["2026-10-26"],
            },
          }),
        ],
        bookings: [],
        people: [],
        people_enabled: false,
      },
    });
    render(
      <MemoryRouter>
        <GlobalSearchHost />
      </MemoryRouter>,
    );
    act(() => openGlobalSearch("nmr"));
    expect(await screen.findByText("NMR Spectrometer")).toBeTruthy();
    expect(screen.getByText("Mode not active")).toBeTruthy();
    expect(screen.getByText("Currently running as NMR TXI probe; booking opens when this mode is active.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Book" })).toHaveLength(1);
  });
});
