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
    getOmniportAuthUrl: vi.fn(),
  },
}));
vi.mock("@/components/search/GlobalSearch", () => ({ HeroSearchBar: () => null }));
vi.mock("@/components/home/ResearcherSpotlight", () => ({ default: () => null }));

import Hero from "./Hero";

afterEach(cleanup);

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
