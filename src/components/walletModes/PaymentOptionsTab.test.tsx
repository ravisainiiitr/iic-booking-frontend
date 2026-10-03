// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { AdminWalletModeSettings, WalletModeDepartmentRow, WalletPaymentModesOverview } from "@/lib/api";

import PaymentOptionsTab from "./PaymentOptionsTab";

vi.mock("@/lib/api", () => ({ apiClient: {} }));

const states = (over: Partial<WalletModeDepartmentRow["states"]> = {}): WalletModeDepartmentRow["states"] => ({
  project_grant: "inherit",
  direct_cash: "inherit",
  online_gateway: "inherit",
  peer_transfer: "inherit",
  credit: "disabled",
  direct_recharge: "inherit",
  ...over,
});

const dept = (id: number, name: string, extra: Partial<WalletModeDepartmentRow> = {}): WalletModeDepartmentRow => ({
  id,
  name,
  code: "",
  listed: true,
  states: states(),
  effective: {} as WalletModeDepartmentRow["effective"],
  ...extra,
});

const overview = {
  schema_ready: true,
  masters: {},
  options: [],
  departments: [
    dept(1, "Chemistry"),
    dept(2, "Physics", { states: states({ direct_cash: "disabled" }) }),
    dept(3, "Old Workshop", { listed: false, states: states({ peer_transfer: "disabled" }) }),
  ],
  roles: [],
  builtin_recipients: {},
  recipient_notes: {},
  to_required_options: [],
  recipients: [],
  disabled_message: "",
} as unknown as WalletPaymentModesOverview;

const settings = (over: Partial<AdminWalletModeSettings> = {}) =>
  ({
    project_grant_recharge_enabled: true,
    direct_cash_recharge_enabled: true,
    online_gateway_recharge_enabled: false,
    peer_transfer_enabled: true,
    credit_facility_enabled: false,
    credit_facility_available_in_environment: true,
    direct_recharge_enabled: false,
    ...over,
  }) as unknown as AdminWalletModeSettings;

const renderTab = (s = settings()) =>
  render(
    <TooltipProvider>
      <PaymentOptionsTab
        overview={overview}
        settings={s}
        onSettingsSaved={() => undefined}
        onReload={async () => undefined}
        onDirtyChange={() => undefined}
      />
    </TooltipProvider>
  );

const cell = (option: string, deptName: string) => screen.getByRole("switch", { name: new RegExp(`^${option} for ${deptName}:`) });

afterEach(() => cleanup());

describe("Wallet payment modes – department settings", () => {
  it("lists catalog departments and keeps saved-only ones in a collapsed group", () => {
    renderTab();
    expect(screen.getByRole("rowheader", { name: /Chemistry/ })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: /Physics/ })).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: /Old Workshop/ })).toBeNull();

    const group = screen.getByRole("button", { name: /Other departments with saved settings \(1\)/ });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    expect(screen.getByRole("rowheader", { name: /Old Workshop/ })).toBeTruthy();
  });

  it("locks columns whose master is off and shows each saved choice when it is on", () => {
    renderTab();
    const gatewayOff = cell("Online gateway", "Chemistry");
    expect(gatewayOff.getAttribute("aria-checked")).toBe("false");
    expect(gatewayOff.hasAttribute("disabled")).toBe(true);
    expect(gatewayOff.getAttribute("aria-label")).toMatch(/Off \(master\)$/);

    const cashChem = cell("Direct Cash", "Chemistry");
    const cashPhys = cell("Direct Cash", "Physics");
    expect(cashChem.getAttribute("aria-checked")).toBe("true");
    expect(cashChem.hasAttribute("disabled")).toBe(false);
    expect(cashPhys.getAttribute("aria-checked")).toBe("false");
    expect(cashPhys.getAttribute("aria-label")).toMatch(/Disabled$/);
  });

  it("keeps the saved department value while its master is off", () => {
    renderTab(settings({ direct_cash_recharge_enabled: false } as Partial<AdminWalletModeSettings>));
    expect(cell("Direct Cash", "Physics").getAttribute("aria-checked")).toBe("false");
    expect(cell("Direct Cash", "Chemistry").getAttribute("aria-checked")).toBe("false");
    cleanup();
    renderTab();
    expect(cell("Direct Cash", "Chemistry").getAttribute("aria-checked")).toBe("true");
    expect(cell("Direct Cash", "Physics").getAttribute("aria-checked")).toBe("false");
  });
});
