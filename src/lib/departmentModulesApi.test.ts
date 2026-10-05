import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import {
  departmentModulesApi,
  describeChange,
  moduleAvailable,
  stateLabel,
  type DepartmentModulesAvailability,
  type ModuleMeta,
} from "./departmentModulesApi";

const ra: ModuleMeta = {
  key: "remote_analysis",
  label: "Remote Analysis",
  test_users_only_help: "Only test accounts can start new remote analysis on this department's equipment.",
  off_help: "No new remote analysis on this department's equipment; bookings made earlier can finish.",
  usage_label: "RA-enabled equipment",
};

function availability(available: boolean): DepartmentModulesAvailability {
  const entry = { available, department_enabled: available, test_users_only: false, configured: true };
  return {
    department_id: 33,
    is_test_account: false,
    can_configure: false,
    modules: { dsa: entry, remote_analysis: entry, training: entry, procurement: entry },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("moduleAvailable", () => {
  it("keeps today's entry points when availability is unknown", () => {
    expect(moduleAvailable(undefined, "remote_analysis")).toBe(true);
    expect(moduleAvailable(null, "dsa")).toBe(true);
  });

  it("follows the server answer when present", () => {
    expect(moduleAvailable(availability(false), "remote_analysis")).toBe(false);
    expect(moduleAvailable(availability(true), "remote_analysis")).toBe(true);
  });
});

describe("labels", () => {
  it("names the restricted state per module", () => {
    expect(stateLabel("dsa", { enabled: false, test_users_only: true })).toBe("Off");
    expect(stateLabel("training", { enabled: true, test_users_only: true })).toBe("Test users only");
    expect(stateLabel("procurement", { enabled: true, test_users_only: true })).toBe("Pilot users only");
    expect(stateLabel("dsa", { enabled: true, test_users_only: false })).toBe("On");
  });

  it("explains the impact of switching off in the reason dialog", () => {
    const department = { id: 47, name: "Tinkering Lab", code: "TL" };
    expect(describeChange({ department, module: ra, change: { enabled: false } })).toEqual({
      title: "Switch Remote Analysis off for Tinkering Lab (TL)",
      detail: ra.off_help,
    });
    expect(describeChange({ department, module: ra, change: { test_users_only: true } }).title).toBe(
      "Limit Remote Analysis to test users in Tinkering Lab (TL)",
    );
    expect(describeChange({ department, module: ra, change: { test_users_only: false } }).title).toBe(
      "Open Remote Analysis to everyone in Tinkering Lab (TL)",
    );
  });
});

describe("departmentModulesApi", () => {
  it("posts one cell change with the reason and token", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ department_id: 47, module_key: "dsa", cell: { enabled: false } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await departmentModulesApi.update(47, "dsa", { enabled: false, reason: "Agent PC retired" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/department-modules/47/dsa/");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ enabled: false, reason: "Agent PC retired" });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Token tok");
  });

  it("surfaces the server message and code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Give a reason.", code: "reason_required", field: "reason" }), { status: 400 })),
    );
    await expect(departmentModulesApi.update(47, "dsa", { enabled: false, reason: "" })).rejects.toMatchObject({
      message: "Give a reason.",
      code: "reason_required",
      field: "reason",
      status: 400,
    });
  });

  it("builds history filters", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await departmentModulesApi.history({ department: 33, module: "training", limit: 50 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admin/department-modules/history/?department=33&module=training&limit=50");
  });
});
