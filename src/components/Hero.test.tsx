// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, user: { id: 1, user_type: "student" } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/api", () => ({
  apiClient: {
    getCmsHome: vi.fn(async () => ({ data: { content: { cta_browse_text: "Browse Catalog" } } })),
    getCmsSiteStats: vi.fn(async () => ({ data: null })),
    getEquipments: vi.fn(async () => ({ data: { equipments: [{ name: "Powder X-Ray Diffractometer (PXRD) [B]" }, { name: "Field Emission SEM" }] } })),
    getOmniportAuthUrl: vi.fn(),
  },
}));
vi.mock("@/components/search/GlobalSearch", () => ({ HeroSearchBar: () => null }));
vi.mock("@/components/home/ResearcherSpotlight", () => ({ default: () => null }));
const connect = vi.hoisted(() => ({ available: false }));
vi.mock("@/components/connect/useConnect", () => ({
  useConnectAvailability: (enabled: boolean) => ({ available: enabled && connect.available, bootstrap: null, loading: false }),
}));

import Hero from "./Hero";

afterEach(() => {
  cleanup();
  connect.available = false;
  auth.value = { isAuthenticated: true, user: { id: 1, user_type: "student" } };
});

describe("Hero quick actions", () => {
  it("shows the four actions in one style, without Browse Catalog", async () => {
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: "Quick actions" });
    const labels = within(nav).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Book Equipment", "Analysis Charges", "Booking Calendar", "Contact Us"]);
    expect(within(nav).queryByText("Browse Catalog")).toBeNull();
    const classes = within(nav).getAllByRole("button").map((b) => b.className);
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain("bg-white/10");
    expect(classes[0]).not.toContain("bg-brand");
  });

  it("shows Login with Channel i first for visitors, styled like the other actions", async () => {
    auth.value = { isAuthenticated: false, user: null as never };
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: "Quick actions" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons[0].textContent).toMatch(/Login with/);
    expect(new Set(buttons.map((b) => b.className)).size).toBe(1);
    expect(buttons[0].className).toContain("bg-white/10");
  });
});

describe("Hero instrument showcase", () => {
  it("names instruments from the catalogue, without the [B]-style suffix", async () => {
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const ticker = await screen.findByTestId("instrument-ticker");
    expect(ticker.textContent).toMatch(/Now bookable:/);
    expect(ticker.textContent).not.toContain("[B]");
    expect(ticker.textContent).toMatch(/Powder X-Ray Diffractometer \(PXRD\)|Field Emission SEM/);
  });
});

describe("Hero IITR Connect action", () => {
  it("is hidden when IITR Connect is not available to the user", async () => {
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: "Quick actions" });
    expect(within(nav).queryByRole("button", { name: /IITR Connect/ })).toBeNull();
  });

  it("sits just before Contact Us with a New badge when available", async () => {
    connect.available = true;
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: "Quick actions" });
    const buttons = within(nav).getAllByRole("button");
    const i = buttons.findIndex((b) => b.getAttribute("aria-label") === "IITR Connect (new)");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(buttons[i + 1].textContent?.trim()).toBe("Contact Us");
    expect(within(buttons[i]).getByTestId("connect-new-badge").textContent).toBe("New");
    expect(buttons[i].className).toBe(buttons[i + 1].className);
  });

  it("is never shown to signed-out visitors", async () => {
    connect.available = true;
    auth.value = { isAuthenticated: false, user: null as never };
    render(<MemoryRouter><Hero /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: "Quick actions" });
    expect(within(nav).queryByRole("button", { name: /IITR Connect/ })).toBeNull();
  });
});
