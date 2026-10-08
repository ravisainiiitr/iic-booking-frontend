// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const adminList = vi.fn();
const downloadReportExport = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    adminList: (...args: unknown[]) => adminList(...args),
    downloadReportExport: (...args: unknown[]) => downloadReportExport(...args),
  },
  extractAdminListItems: (data: unknown) => (Array.isArray(data) ? data : []),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { user_type: "admin" }, loading: false, isAuthenticated: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));

import AdminWalletWithdrawalRequests from "./AdminWalletWithdrawalRequests";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminWalletWithdrawalRequests export", () => {
  it("exports every withdrawal request from the Export menu", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    adminList.mockResolvedValue({
      data: [{ id: 3, user: 9, wallet: 2, amount: "100.00", status: "PENDING", user_name: "Test User" }],
    });
    downloadReportExport.mockResolvedValue({ rowCount: 1 });
    render(
      <MemoryRouter>
        <AdminWalletWithdrawalRequests />
      </MemoryRouter>,
    );
    await screen.findByText("Test User");
    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excel/ }));
    await waitFor(() =>
      expect(downloadReportExport).toHaveBeenCalledWith("wallet-withdrawal-requests", "xlsx", {}),
    );
  });
});
