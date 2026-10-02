// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { axeViolations } from "@/test/axe";
import { DashboardMenuTree, SECTIONS_OPEN_KEY, type DashboardMenuEntry, type MenuSection } from "./DashboardMenuTree";
import type { DashboardMenuLayout } from "@/lib/api";

const SECTIONS: MenuSection[] = [
  { id: "sec_overview", name: "Overview", items: ["reports"] },
  { id: "sec_bookings", name: "Bookings", items: ["bookings", "waitlist"] },
  { id: "sec_finance", name: "Finance", items: ["wallet"] },
  { id: "sec_more", name: "More", items: [], fallback: true },
];

function entry(id: string, label: string, path: string, onOpen: (path: string) => void, visible = true): DashboardMenuEntry {
  return {
    id,
    label,
    path,
    visible,
    render: () => (
      <Card className="cursor-pointer" onClick={() => onOpen(path)}>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
        </CardHeader>
      </Card>
    ),
  };
}

function renderMenu({
  activePath = null,
  layout = null,
  hideWallet = false,
}: { activePath?: string | null; layout?: DashboardMenuLayout | null; hideWallet?: boolean } = {}) {
  const onOpen = vi.fn();
  const entries = [
    entry("reports", "Reports", "/reports", onOpen),
    entry("bookings", "View Booking", "/booking-management", onOpen),
    entry("waitlist", "Equipment waitlist", "/equipment-waitlist", onOpen),
    entry("wallet", "Wallet recharge requests", "/admin-settings/wallet-recharge-requests", onOpen, !hideWallet),
    entry("bookings_again", "Booking management (duplicate)", "/booking-management", onOpen),
    entry("brand_new", "Brand new tool", "/brand-new", onOpen),
  ];
  const view = render(
    <nav aria-label="Dashboard menu" className="dashboard-menu-nav">
      <DashboardMenuTree
        entries={entries}
        defaultOrder={["reports", "bookings", "waitlist", "wallet"]}
        layout={layout}
        canCustomize={false}
        activePath={activePath}
        onSaveLayout={async () => null}
        sections={SECTIONS}
      />
    </nav>,
  );
  return { onOpen, ...view };
}

const sectionButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("DashboardMenuTree sections", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows section headings with Overview and Bookings open by default", () => {
    renderMenu();
    expect(sectionButton("Overview").getAttribute("aria-expanded")).toBe("true");
    expect(sectionButton("Bookings").getAttribute("aria-expanded")).toBe("true");
    expect(sectionButton("Finance").getAttribute("aria-expanded")).toBe("false");
    expect(sectionButton("Finance").textContent).toContain("1 items");
    expect(screen.getByRole("button", { name: "Reports" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Wallet recharge requests" })).toBeNull();
  });

  it("lists a page only once and puts unlisted entries under More", async () => {
    renderMenu();
    expect(screen.queryByText("Booking management (duplicate)")).toBeNull();
    await userEvent.setup().click(sectionButton("More"));
    expect(screen.getByRole("button", { name: "Brand new tool" })).toBeTruthy();
  });

  it("hides sections whose items the role cannot see", () => {
    renderMenu({ hideWallet: true });
    expect(screen.queryByRole("button", { name: /^Finance/ })).toBeNull();
  });

  it("opens the section that holds the current page", () => {
    renderMenu({ activePath: "/admin-settings/wallet-recharge-requests" });
    expect(sectionButton("Finance").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Wallet recharge requests" }).getAttribute("aria-current")).toBe("page");
  });

  it("remembers opened and closed sections", async () => {
    renderMenu();
    const user = userEvent.setup();
    await user.click(sectionButton("Bookings"));
    await user.click(sectionButton("Finance"));
    expect(JSON.parse(localStorage.getItem(SECTIONS_OPEN_KEY) ?? "[]").sort()).toEqual(["sec_finance", "sec_overview"]);
    cleanup();
    renderMenu();
    expect(sectionButton("Bookings").getAttribute("aria-expanded")).toBe("false");
    expect(sectionButton("Finance").getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the user's own menus ahead of the built-in sections", () => {
    renderMenu({ layout: { groups: [{ id: "g1", name: "Daily", items: ["wallet"] }] } });
    expect(screen.getByRole("button", { name: /^Daily/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Wallet recharge requests" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Finance/ })).toBeNull();
  });

  it("filters the menu by item or section name and opens the first match with Enter", async () => {
    const { onOpen } = renderMenu();
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox", { name: "Search menu" });

    await user.type(search, "finance");
    expect(screen.getByRole("button", { name: "Wallet recharge requests" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reports" })).toBeNull();

    await user.clear(search);
    await user.type(search, "wait{Enter}");
    expect(onOpen).toHaveBeenLastCalledWith("/equipment-waitlist");

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText(/No menu items match/)).toBeTruthy();
    await user.keyboard("{Escape}");
    expect((search as HTMLInputElement).value).toBe("");
    expect(sectionButton("Overview")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderMenu({ activePath: "/reports" });
    expect(await axeViolations(container)).toEqual([]);
  });
});
