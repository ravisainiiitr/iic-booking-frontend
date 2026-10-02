// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { axeViolations } from "@/test/axe";
import { DashboardMenuTree, type DashboardMenuEntry } from "./DashboardMenuTree";

function entry(id: string, label: string, path: string, onOpen: (path: string) => void): DashboardMenuEntry {
  return {
    id,
    label,
    path,
    visible: true,
    render: () => (
      <Card className="cursor-pointer" onClick={() => onOpen(path)}>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
        </CardHeader>
      </Card>
    ),
  };
}

function renderMenu(activePath: string | null = null) {
  const onOpen = vi.fn();
  const entries = [
    entry("catalog", "Browse equipment", "/equipments", onOpen),
    entry("wallet", "Wallet", "/wallet", onOpen),
    entry("reports", "Reports", "/reports", onOpen),
  ];
  const view = render(
    <nav aria-label="Dashboard menu">
      <DashboardMenuTree
        entries={entries}
        defaultOrder={["catalog", "wallet", "reports"]}
        layout={{ groups: [{ id: "money", name: "Money", items: ["wallet", "reports"] }] }}
        canCustomize={false}
        activePath={activePath}
        onSaveLayout={async () => null}
      />
    </nav>,
  );
  return { onOpen, ...view };
}

describe("DashboardMenuTree keyboard access", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("exposes every entry as a focusable button in a logical tab order", async () => {
    renderMenu();
    const user = userEvent.setup();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Browse equipment" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Money/ }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Wallet" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reports" }));
  });

  it("activates entries with Enter and Space", async () => {
    const { onOpen } = renderMenu();
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Wallet" }).focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenLastCalledWith("/wallet");

    screen.getByRole("button", { name: "Reports" }).focus();
    await user.keyboard(" ");
    expect(onOpen).toHaveBeenLastCalledWith("/reports");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("marks the open page with aria-current", () => {
    renderMenu("/wallet/transactions");
    expect(screen.getByRole("button", { name: "Wallet" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Reports" }).getAttribute("aria-current")).toBeNull();
  });

  it("toggles groups with aria-expanded and aria-controls", async () => {
    renderMenu();
    const user = userEvent.setup();
    const group = screen.getByRole("button", { name: /Money/ });

    expect(group.getAttribute("aria-expanded")).toBe("true");
    const listId = group.getAttribute("aria-controls");
    expect(listId && document.getElementById(listId)).toBeTruthy();

    group.focus();
    await user.keyboard("{Enter}");
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Wallet" })).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = renderMenu("/reports");
    expect(await axeViolations(container)).toEqual([]);
  });
});
