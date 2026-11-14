import { describe, expect, it } from "vitest";

import { commandOutcome, compareVersion, extractCodes, matchesFleet, pcFirewall } from "./dsaTrace";

describe("dsaTrace", () => {
  it("compares the running build with the published version", () => {
    expect(compareVersion("1.0.10", "1.0.10")).toBe("current");
    expect(compareVersion("1.0.9+sha", "1.0.10")).toBe("outdated");
    expect(compareVersion("1.0.10.0", "v1.0.10")).toBe("current");
    expect(compareVersion("1.0.11", "1.0.10")).toBe("ahead");
    expect(compareVersion("", "1.0.10")).toBe("unknown");
  });

  it("extracts error codes from messages", () => {
    expect(extractCodes("RESULT-2007 retried after ENT-1001; RESULT-2007 again")).toEqual(["RESULT-2007", "ENT-1001"]);
    expect(extractCodes("no codes here")).toEqual([]);
    expect(extractCodes(null)).toEqual([]);
  });

  it("judges firewall only from the last probe", () => {
    expect(pcFirewall({}).state).toBe("unknown");
    expect(pcFirewall({ last_probe: { success: true, write_test: true } }).state).toBe("pass");
    expect(pcFirewall({ last_probe: { success: false, error_category: "Firewall" } }).fact).toMatch(/^Blocked/);
  });

  it("describes remote action results", () => {
    expect(
      commandOutcome({ command_type: "REFRESH_EQUIPMENT_PCS", status: "COMPLETED", result: { equipment_pcs: 2, reachable: 1 }, last_error: "" }),
    ).toEqual({ state: "warn", text: "1 of 2 Equipment PC(s) reachable" });
    expect(commandOutcome({ command_type: "RESTART_AGENT", status: "PENDING", result: {}, last_error: "" }).state).toBe("unknown");
    expect(
      commandOutcome({ command_type: "RESTART_AGENT", status: "COMPLETED", result: { decision: "refused", message: "cooldown" }, last_error: "" }).text,
    ).toBe("Refused: cooldown");
  });

  it("matches the fleet search on PCs, codes and every term", () => {
    const a = {
      id: "a",
      agent_name: "WIN-F0VB5CHK0VA",
      machine_name: "",
      department: "IIC",
      department_code: "IIC",
      status: "ACTIVE",
      health: "warning" as const,
      why: [{ code: "EQPC_SHARE", severity: "warning" as const, message: "share" }],
      version: "1.0.10",
      last_heartbeat_at: null,
      equipment_pcs: { total: 1, online: 1 },
      open_incidents: 0,
      diagnostics_supported: true,
      equipment_pc_hosts: ["MPAES-PC", "10.250.0.2"],
    };
    expect(matchesFleet(a, "mpaes", "all")).toBe(true);
    expect(matchesFleet(a, "eqpc_share iic", "all")).toBe(true);
    expect(matchesFleet(a, "iic other", "all")).toBe(false);
    expect(matchesFleet(a, "", "attention")).toBe(true);
    expect(matchesFleet(a, "", "healthy")).toBe(false);
  });
});
