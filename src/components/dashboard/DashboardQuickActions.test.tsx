// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardQuickActions from "./DashboardQuickActions";

const ENTRIES = [
  { id: "wallet_management", label: "Wallet", path: "/wallet" },
  { id: "view_bookings", label: "My Bookings", path: "/my-bookings" },
  { id: "browse_equipment", label: "Browse and Book Equipment", path: "/equipments" },
  { id: "support_tickets", label: "Support", path: "/tickets" },
];

afterEach(cleanup);

describe("DashboardQuickActions", () => {
  it("greets the user and puts booking first, then everyday actions the user has", () => {
    const onOpen = vi.fn();
    render(<DashboardQuickActions firstName="Asha" entries={ENTRIES} onOpen={onOpen} />);
    expect(screen.getByRole("heading", { name: "Welcome back, Asha" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Quick actions" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Browse and Book Equipment", "My Bookings", "Wallet",
    ]);
    fireEvent.click(within(nav).getByRole("button", { name: /Browse and Book Equipment/ }));
    expect(onOpen).toHaveBeenCalledWith("/equipments", "Browse and Book Equipment");
  });

  it("never offers a button the user does not have", () => {
    render(<DashboardQuickActions entries={[{ id: "view_bookings", label: "My Bookings", path: "/my-bookings" }]} onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Quick actions" });
    expect(within(nav).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText(/Wallet|Browse/)).toBeNull();
  });
});
