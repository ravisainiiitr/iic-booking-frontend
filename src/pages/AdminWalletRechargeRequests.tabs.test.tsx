// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  SRIC_WALLET_RECHARGES_PATH,
  WALLET_RECHARGE_REQUESTS_PATH,
  rechargeTabHref,
} from "@/lib/walletRecharge";
import { findActiveMenuId } from "@/components/dashboard/menuItemA11y";
import { ADMIN_MENU_SECTIONS } from "@/components/dashboard/adminMenuSections";

const auth = vi.hoisted(() => ({ userType: "admin" }));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getCatalogDepartments: async () => ({ data: { departments: [] } }),
    adminSingletonGet: async () => ({ data: {} }),
    adminList: async () => ({ data: { results: [] } }),
    getSricMailboxStatus: async () => ({ error: "skip" }),
  },
  extractAdminListItems: (d: { results?: unknown[] }) => d?.results ?? [],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { user_type: auth.userType }, loading: false, isAuthenticated: true }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({ ExportMenu: () => null }));
vi.mock("@/components/wallet/AdminSricRecharges", () => ({ default: () => <div data-testid="sric-panel" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import AdminWalletRechargeRequests from "./AdminWalletRechargeRequests";

function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{`${location.pathname}${location.search}`}</output>;
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={WALLET_RECHARGE_REQUESTS_PATH} element={<AdminWalletRechargeRequests />} />
        <Route path={SRIC_WALLET_RECHARGES_PATH} element={<AdminWalletRechargeRequests />} />
      </Routes>
      <CurrentUrl />
    </MemoryRouter>,
  );

const url = () => screen.getByTestId("url").textContent;

afterEach(() => {
  cleanup();
  auth.userType = "admin";
});

describe("rechargeTabHref", () => {
  it("maps each tab to its path, keeping other params and dropping the legacy tab param", () => {
    expect(rechargeTabHref("sric", "")).toBe(SRIC_WALLET_RECHARGES_PATH);
    expect(rechargeTabHref("sric", "?tab=sric&overdue=1")).toBe(`${SRIC_WALLET_RECHARGES_PATH}?overdue=1`);
    expect(rechargeTabHref("requests", "?overdue=1")).toBe(`${WALLET_RECHARGE_REQUESTS_PATH}?overdue=1`);
  });
});

describe("Wallet recharge requests: SRIC recharges tab", () => {
  it("opens the SRIC recharges tab on its own path", async () => {
    renderAt(SRIC_WALLET_RECHARGES_PATH);
    expect(await screen.findByTestId("sric-panel")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "SRIC recharges" }).getAttribute("aria-selected")).toBe("true");
  });

  it("switching tabs updates the path", async () => {
    renderAt(WALLET_RECHARGE_REQUESTS_PATH);
    expect(screen.queryByTestId("sric-panel")).toBeNull();
    const sricTab = screen.getByRole("tab", { name: "SRIC recharges" });
    fireEvent.mouseDown(sricTab);
    fireEvent.click(sricTab);
    await waitFor(() => expect(url()).toBe(SRIC_WALLET_RECHARGES_PATH));
    expect(screen.getByTestId("sric-panel")).toBeTruthy();

    const requestsTab = screen.getByRole("tab", { name: "Recharge requests" });
    fireEvent.mouseDown(requestsTab);
    fireEvent.click(requestsTab);
    await waitFor(() => expect(url()).toBe(WALLET_RECHARGE_REQUESTS_PATH));
    expect(screen.queryByTestId("sric-panel")).toBeNull();
  });

  it("moves the old ?tab=sric link to the SRIC path", async () => {
    renderAt(`${WALLET_RECHARGE_REQUESTS_PATH}?tab=sric`);
    await waitFor(() => expect(url()).toBe(SRIC_WALLET_RECHARGES_PATH));
    expect(screen.getByTestId("sric-panel")).toBeTruthy();
  });

  it("sends roles without SRIC access back to the request list", async () => {
    auth.userType = "dept_admin";
    renderAt(SRIC_WALLET_RECHARGES_PATH);
    await waitFor(() => expect(url()).toBe(WALLET_RECHARGE_REQUESTS_PATH));
    expect(screen.queryByTestId("sric-panel")).toBeNull();
    expect(screen.queryByRole("tab", { name: "SRIC recharges" })).toBeNull();
  });
});

describe("Finance menu", () => {
  const entries = [
    { id: "wallet_recharge_requests", path: WALLET_RECHARGE_REQUESTS_PATH },
    { id: "sric_wallet_recharges", path: SRIC_WALLET_RECHARGES_PATH },
  ];

  it("lists SRIC wallet recharges right after Wallet recharge requests", () => {
    const finance = ADMIN_MENU_SECTIONS.find((s) => s.id === "sec_finance")?.items ?? [];
    expect(finance.indexOf("sric_wallet_recharges")).toBe(finance.indexOf("wallet_recharge_requests") + 1);
  });

  it("highlights the entry for the open tab", () => {
    expect(findActiveMenuId(entries, SRIC_WALLET_RECHARGES_PATH)).toBe("sric_wallet_recharges");
    expect(findActiveMenuId(entries, WALLET_RECHARGE_REQUESTS_PATH)).toBe("wallet_recharge_requests");
  });
});
