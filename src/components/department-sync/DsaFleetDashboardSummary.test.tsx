// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({ getDepartmentSyncFleet: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import { DsaFleetDashboardSummary } from "./DsaFleetDashboardSummary";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DsaFleetDashboardSummary", () => {
  it("shows counts and the first agent needing attention", async () => {
    api.getDepartmentSyncFleet.mockResolvedValue({
      data: {
        count: 2,
        counts: { offline: 1, critical: 0, warning: 0, healthy: 1, unknown: 0 },
        heartbeat_timeout_seconds: 180,
        server_time: "",
        results: [
          { department: "Physics", agent_name: "PHY", health: "offline", why: [{ message: "No heartbeat for 25 min." }] },
          { department: "IIC", agent_name: "RAVI", health: "healthy", why: [] },
        ],
      },
    });
    render(<DsaFleetDashboardSummary />);
    expect(await screen.findByText("1 Offline")).toBeTruthy();
    expect(screen.getByText("1 Healthy")).toBeTruthy();
    expect(screen.getByText(/Physics: No heartbeat for 25 min\./)).toBeTruthy();
  });

  it("says all healthy, and degrades quietly on error", async () => {
    api.getDepartmentSyncFleet.mockResolvedValueOnce({
      data: { count: 1, counts: { healthy: 1 }, results: [{ department: "IIC", health: "healthy", why: [] }] },
    });
    render(<DsaFleetDashboardSummary />);
    expect(await screen.findByText("All agents healthy.")).toBeTruthy();
    cleanup();

    api.getDepartmentSyncFleet.mockResolvedValueOnce({ error: "HTTP 403" });
    render(<DsaFleetDashboardSummary />);
    expect(await screen.findByText("Fleet health unavailable.")).toBeTruthy();
  });
});
