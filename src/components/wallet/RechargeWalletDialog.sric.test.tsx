// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import RechargeWalletDialog from "./RechargeWalletDialog";
import { DEFAULT_WALLET_MODE_FLAGS, walletModeFlagsFromSettings } from "@/lib/walletModes";

vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getProjects") return async () => ({ data: { projects: [] } });
        if (prop === "getDepartmentsForRecharge") {
          return async () => ({ data: { departments: [{ id: 3, name: "Example Centre", code: "EC" }] } });
        }
        if (prop === "getMySricRecharges") {
          return async () => ({
            data: {
              portal_url: "https://rnd.iitr.ac.in",
              scan_enabled: true,
              auto_credit_enabled: false,
              last_scan_at: null,
              receivers: [],
              results: [],
            },
          });
        }
        return vi.fn(async () => ({ data: {} }));
      },
    },
  ),
}));

afterEach(cleanup);

function renderDialog(flags = DEFAULT_WALLET_MODE_FLAGS) {
  render(
    <RechargeWalletDialog
      onClose={vi.fn()}
      onSubmitted={vi.fn()}
      isFaculty
      userType="faculty"
      isStudentRecharge={false}
      subWallets={[]}
      modeFlags={flags}
    />,
  );
}

describe("RechargeWalletDialog: Project Grant retired", () => {
  it("reads the retirement flag from the wallet settings", () => {
    expect(walletModeFlagsFromSettings({ project_grant_retired: true }).projectGrantRetired).toBe(true);
    expect(walletModeFlagsFromSettings({}).projectGrantRetired).toBe(false);
  });

  it("offers the SRIC portal procedure instead of the Project Grant form, keeping the other modes", async () => {
    renderDialog({ ...DEFAULT_WALLET_MODE_FLAGS, projectGrantRetired: true });
    const methods = screen.getByRole("radiogroup", { name: "Recharge method" });
    expect(within(methods).queryByText("Project Grant")).toBeNull();
    const sric = within(methods).getByText("From a project (SRIC portal)").closest("button")!;
    expect(sric.getAttribute("aria-checked")).toBe("true");
    expect(within(methods).getByText("Direct Cash Deposit / Bank Transfer")).toBeTruthy();
    expect(within(methods).getByText("Pay online")).toBeTruthy();
    expect(await screen.findByTestId("sric-recharge-panel")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send OTP" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" }).some((b) => b.textContent === "Close")).toBe(true);

    fireEvent.click(within(methods).getByText("Direct Cash Deposit / Bank Transfer"));
    expect(screen.queryByTestId("sric-recharge-panel")).toBeNull();
    expect(screen.getByRole("button", { name: "Send OTP" })).toBeTruthy();
  });

  it("keeps the Project Grant option while the mode is not retired", () => {
    renderDialog({ ...DEFAULT_WALLET_MODE_FLAGS, projectGrant: true });
    const methods = screen.getByRole("radiogroup", { name: "Recharge method" });
    expect(within(methods).getByText("Project Grant")).toBeTruthy();
    expect(within(methods).queryByText("From a project (SRIC portal)")).toBeNull();
  });
});
