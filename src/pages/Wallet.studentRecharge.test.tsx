// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Wallet from "./Wallet";

type Scenario = {
  user: Record<string, unknown>;
  joinRequests: Array<Record<string, unknown>>;
  wallet: Record<string, unknown>;
};

const state = vi.hoisted(() => ({ scenario: null as Scenario | null }));

const TINKERING = { id: 47, name: "Tinkering Lab", code: "TL" };

vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/UserProfile", () => ({ default: () => null }));
vi.mock("@/components/wallet/ReturnToBookingBanner", () => ({ default: () => null }));
vi.mock("@/components/walletModes/DirectRechargeEntry", () => ({ default: () => null }));
vi.mock("@/components/wallet/SupervisorInvite", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        const s = state.scenario!;
        if (prop === "getToken") return () => "token";
        if (prop === "getCurrentUser") return async () => ({ data: s.user });
        if (prop === "getWalletJoinRequests") return async () => ({ data: { requests: s.joinRequests } });
        if (prop === "getWallet") return async () => ({ data: s.wallet });
        if (prop === "getWalletStudentRechargeSettings") {
          return async () => ({
            data: {
              // Legacy student switch off everywhere: it must not hide the button any more.
              enabled: false,
              enable_iitr_student_wallet_recharge: false,
              applies_to_current_user: true,
              project_grant_recharge_enabled: true,
              direct_cash_recharge_enabled: true,
              online_gateway_recharge_enabled: false,
              peer_transfer_enabled: true,
              credit_facility_enabled: false,
              department_modes: {
                "47": { direct_cash_recharge_enabled: false, project_grant_recharge_enabled: false },
              },
            },
          });
        }
        if (prop === "getDepartmentsForRecharge") return async () => ({ data: { departments: [TINKERING] } });
        if (prop === "getWalletRechargeRequests") return async () => ({ data: { requests: [] } });
        if (prop === "getWalletTransactions") return async () => ({ data: { transactions: [], total_count: 0 } });
        if (prop === "getProfilePictureUrl") return () => "";
        return vi.fn(async () => ({ data: {} }));
      },
    },
  ),
}));

const supervisorWallet = {
  balance: "1200.00",
  is_shared: true,
  wallet_owner: { id: 2, name: "Prof Supervisor", email: "prof@example.test" },
  sub_wallets: [{ id: 9, department_id: 47, department_name: "Tinkering Lab", department_code: "TL", balance: "1200.00" }],
};

const approvedRequest = {
  id: 1,
  status: "APPROVED",
  faculty: 2,
  faculty_name: "Prof Supervisor",
  faculty_email: "prof@example.test",
};

function renderWallet(scenario: Scenario) {
  state.scenario = scenario;
  render(
    <MemoryRouter initialEntries={["/wallet"]}>
      <Wallet />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.scenario = null;
});

describe("Wallet: Recharge Wallet for IITR Students", { timeout: 20_000 }, () => {
  it("shows Recharge Wallet to a student on a supervisor's wallet even with the legacy student switch off", async () => {
    renderWallet({
      user: { id: 7, user_type: "student", can_have_wallet: false },
      joinRequests: [approvedRequest],
      wallet: supervisorWallet,
    });
    expect(await screen.findByTestId("wallet-recharge-button")).toBeTruthy();
  });

  it("shows a method switched off for the department as Awaiting Competent Authority Approval", async () => {
    renderWallet({
      user: { id: 7, user_type: "student", can_have_wallet: false },
      joinRequests: [approvedRequest],
      wallet: supervisorWallet,
    });
    fireEvent.click(await screen.findByTestId("wallet-recharge-button"));
    await screen.findByText("Tinkering Lab (TL)");
    const methods = screen.getByRole("radiogroup", { name: "Recharge method" });
    expect(within(methods).queryByText("Project Grant")).toBeNull();
    const cash = within(methods).getByText("Direct Cash Deposit / Bank Transfer").closest("button")!;
    expect(cash.disabled).toBe(true);
    expect(within(cash).getByText("Awaiting Competent Authority Approval")).toBeTruthy();
  });

  it("keeps the link-your-supervisor form for a student without a supervisor's wallet", async () => {
    renderWallet({
      user: { id: 8, user_type: "student", can_have_wallet: false },
      joinRequests: [],
      wallet: supervisorWallet,
    });
    expect(await screen.findAllByText(/Request to Join/i)).not.toHaveLength(0);
    expect(screen.queryByTestId("wallet-recharge-button")).toBeNull();
  });

  it("does not offer recharge to a non-student member of a shared wallet", async () => {
    renderWallet({
      user: { id: 9, user_type: "other", can_have_wallet: false },
      joinRequests: [approvedRequest],
      wallet: supervisorWallet,
    });
    await screen.findByTestId("wallet-balance");
    expect(screen.queryByTestId("wallet-recharge-button")).toBeNull();
  });
});
