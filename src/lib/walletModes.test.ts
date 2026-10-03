import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ apiClient: {} }));

import { walletModeFlagsForDepartment, walletModeFlagsFromSettings } from "./walletModes";

describe("wallet mode flags per department", () => {
  const flags = walletModeFlagsFromSettings({
    project_grant_recharge_enabled: true,
    direct_cash_recharge_enabled: true,
    online_gateway_recharge_enabled: false,
    peer_transfer_enabled: true,
    credit_facility_enabled: false,
    department_modes: { "7": { direct_cash_recharge_enabled: false, peer_transfer_enabled: false } },
  });

  it("keeps the master switches for departments without settings", () => {
    const d = walletModeFlagsForDepartment(flags, 3);
    expect(d.directCash).toBe(true);
    expect(d.peerTransfer).toBe(true);
    expect(walletModeFlagsForDepartment(flags, null).directCash).toBe(true);
  });

  it("turns off options a department disabled", () => {
    const d = walletModeFlagsForDepartment(flags, 7);
    expect(d.directCash).toBe(false);
    expect(d.peerTransfer).toBe(false);
    expect(d.projectGrant).toBe(true);
  });

  it("never turns on an option whose master is off", () => {
    expect(walletModeFlagsForDepartment(flags, "7").onlineGateway).toBe(false);
  });

  it("ignores malformed department data", () => {
    expect(walletModeFlagsFromSettings({ department_modes: "x" }).departmentOverrides).toBeUndefined();
  });
});
