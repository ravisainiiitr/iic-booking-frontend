// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getDashboardShortcuts: vi.fn(),
  saveDashboardShortcuts: vi.fn(),
  resetDashboardShortcuts: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DashboardShortcuts from "./DashboardShortcuts";

const ENTRIES = [
  { id: "browse_equipment", label: "Browse and Book Equipment", path: "/equipments" },
  { id: "view_bookings", label: "My Bookings", path: "/bookings" },
  { id: "wallet_management", label: "Wallet", path: "/wallet" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const group = (id: string, items: string[], extra: Record<string, unknown> = {}) => ({
  id, name: `Group ${id}`, icon: "calendar", items, collapsed: false, ...extra,
});

describe("DashboardShortcuts", () => {
  it("offers to create a group when there is none", async () => {
    api.getDashboardShortcuts.mockResolvedValue({ data: { groups: [] } });
    render(<DashboardShortcuts entries={ENTRIES} onOpen={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /Create a group/ })).toBeTruthy();
    expect(screen.queryByTestId("shortcut-group")).toBeNull();
  });

  it("shows the user's groups; a button opens its page; buttons the user lacks never appear", async () => {
    api.getDashboardShortcuts.mockResolvedValue({ data: { groups: [group("a", ["view_bookings", "admin_only_tool"])] } });
    const onOpen = vi.fn();
    render(<DashboardShortcuts entries={ENTRIES} onOpen={onOpen} />);
    const g = await screen.findByTestId("shortcut-group");
    expect(within(g).queryByText(/admin_only_tool/)).toBeNull();
    expect(within(g).getByText("1")).toBeTruthy(); // count of buttons the user has
    fireEvent.click(within(g).getByRole("button", { name: "My Bookings" }));
    expect(onOpen).toHaveBeenCalledWith("/bookings", "My Bookings");
  });

  it("collapses and expands a group and remembers it", async () => {
    api.getDashboardShortcuts.mockResolvedValue({ data: { groups: [group("a", ["view_bookings"])] } });
    api.saveDashboardShortcuts.mockResolvedValue({ data: { groups: [] } });
    render(<DashboardShortcuts entries={ENTRIES} onOpen={vi.fn()} />);
    const toggle = await screen.findByRole("button", { name: /Group a/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(api.saveDashboardShortcuts).toHaveBeenCalledWith([expect.objectContaining({ id: "a", collapsed: true })]);
  });

  it("creates, names, fills, reorders and saves groups; a button is offered once", async () => {
    api.getDashboardShortcuts.mockResolvedValue({ data: { groups: [group("a", ["view_bookings"])] } });
    api.saveDashboardShortcuts.mockImplementation(async (groups) => ({ data: { groups } }));
    render(<DashboardShortcuts entries={ENTRIES} onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Customize/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Add a group/ }));
    const groups = within(dialog).getAllByTestId("shortcut-editor-group");
    expect(groups).toHaveLength(2);
    fireEvent.change(within(groups[1]).getByLabelText("Group name"), { target: { value: "Money" } });
    fireEvent.change(within(groups[1]).getByLabelText("Icon"), { target: { value: "wallet" } });
    const add = within(groups[1]).getByLabelText("Add a button") as HTMLSelectElement;
    expect([...add.options].map((o) => o.value)).not.toContain("view_bookings"); // already in group a
    fireEvent.change(add, { target: { value: "wallet_management" } });
    fireEvent.click(within(groups[1]).getByRole("button", { name: "Move Money up" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveDashboardShortcuts).toHaveBeenCalled());
    const saved = api.saveDashboardShortcuts.mock.calls[0][0];
    expect(saved.map((g: { name: string }) => g.name)).toEqual(["Money", "Group a"]);
    expect(saved[0]).toMatchObject({ icon: "wallet", items: ["wallet_management"] });
  });

  it("restore default removes every group", async () => {
    api.getDashboardShortcuts.mockResolvedValue({ data: { groups: [group("a", ["view_bookings"])] } });
    api.resetDashboardShortcuts.mockResolvedValue({ data: { groups: [] } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DashboardShortcuts entries={ENTRIES} onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Customize/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Restore default" }));
    await waitFor(() => expect(screen.queryByTestId("shortcut-group")).toBeNull());
    expect(api.resetDashboardShortcuts).toHaveBeenCalled();
  });
});
