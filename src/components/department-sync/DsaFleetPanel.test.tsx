// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getDepartmentSyncFleet: vi.fn(),
  getDepartmentSyncFleetAgent: vi.fn(),
  runDepartmentSyncFleetAction: vi.fn(),
  acknowledgeDepartmentSyncIncident: vi.fn(),
  getDepartmentSyncBundleBlob: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast }));

import { DsaFleetPanel, relativeTime, formatBytes } from "./DsaFleetPanel";

const now = new Date().toISOString();

const agent = {
  id: "a1",
  agent_name: "RAVI",
  machine_name: "RAVI-PC",
  department: "IIC",
  department_code: "IIC",
  status: "ENROLLED",
  health: "critical",
  why: [{ code: "UPLOADS_STUCK", severity: "critical", message: "3 upload(s) waiting; oldest for 95 min." }],
  version: "1.0.7",
  last_heartbeat_at: now,
  uploads_pending: 3,
  uploads_failed: 1,
  disk_free_percent: 55,
  equipment_pcs: { total: 1, online: 1 },
  open_incidents: 1,
  clock_skew_seconds: 2,
  diagnostics_supported: true,
};

const detail = {
  agent,
  reasons: [
    {
      code: "UPLOADS_STUCK",
      severity: "critical",
      message: "3 upload(s) waiting; oldest for 95 min.",
      action: "Run 'Retry failed uploads'.",
    },
  ],
  diagnostics: {
    service: { version: "1.0.7", uptime_seconds: 7200, running_as_service: true },
    equipment_network: { enabled: true, adapter_ip: "10.250.0.1", adapter_up: true },
    uploads: { pending: 3, failed: 1, oldest_pending_age_minutes: 95 },
    problems: { recent: [{ at: now, level: "Error", message: "Upload failed: HTTP 503" }] },
  },
  equipment_pcs: [{ id: "p1", hostname: "LAB-LAPTOP", last_seen: now, agent_version: "1.0.6", share_ok: true }],
  received_at: now,
  agent_sent_at: now,
  evaluated_at: now,
  heartbeat: null,
  incidents: [
    {
      id: "i1",
      code: "UPLOADS_STUCK",
      title: "Uploads Stuck",
      message: "3 upload(s) waiting",
      severity: "CRITICAL",
      status: "NEW",
      subject: "",
      opened_at: now,
      resolved_at: null,
      notify_count: 0,
    },
  ],
  commands: [],
  bundles: [],
  actions: [
    { key: "restart_service", label: "Restart service", command_type: "RESTART_AGENT", supported: true },
    { key: "retry_failed_uploads", label: "Retry failed uploads", command_type: "RETRY_FAILED_UPLOADS", supported: true },
    { key: "support_bundle", label: "Collect support bundle", command_type: "COLLECT_SUPPORT_BUNDLE", supported: false },
  ],
};

beforeEach(() => {
  api.getDepartmentSyncFleet.mockResolvedValue({
    data: {
      count: 1,
      counts: { healthy: 0, warning: 0, critical: 1, offline: 0, unknown: 0 },
      heartbeat_timeout_seconds: 180,
      server_time: now,
      results: [agent],
    },
  });
  api.getDepartmentSyncFleetAgent.mockResolvedValue({ data: detail });
  api.runDepartmentSyncFleetAction.mockResolvedValue({ data: { id: "c1" } });
  api.acknowledgeDepartmentSyncIncident.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DsaFleetPanel", () => {
  it("lists every agent with health and the reason", async () => {
    render(<DsaFleetPanel />);
    expect(await screen.findByText("IIC")).toBeTruthy();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getByText("3 upload(s) waiting; oldest for 95 min.")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy();
  });

  it("drills down and sends an audited action with the reason", async () => {
    render(<DsaFleetPanel />);
    fireEvent.click(await screen.findByTestId("fleet-row-a1"));
    expect(await screen.findByText("LAB-LAPTOP")).toBeTruthy();
    expect(screen.getByText("Run 'Retry failed uploads'.")).toBeTruthy();
    expect(screen.getByText(/Upload failed: HTTP 503/)).toBeTruthy();

    const bundle = screen.getByRole("button", { name: "Collect support bundle" }) as HTMLButtonElement;
    expect(bundle.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Reason/), { target: { value: "stuck since 9" } });
    fireEvent.click(screen.getByRole("button", { name: "Retry failed uploads" }));
    await waitFor(() =>
      expect(api.runDepartmentSyncFleetAction).toHaveBeenCalledWith("a1", "retry_failed_uploads", "stuck since 9", false),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("asks before restarting the service", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DsaFleetPanel initialAgentId="a1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Restart service" }));
    expect(confirm).toHaveBeenCalled();
    expect(api.runDepartmentSyncFleetAction).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("acknowledges an open incident", async () => {
    render(<DsaFleetPanel initialAgentId="a1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    await waitFor(() => expect(api.acknowledgeDepartmentSyncIncident).toHaveBeenCalledWith("a1", "i1"));
  });
});

describe("helpers", () => {
  it("formats relative times and sizes", () => {
    const base = Date.parse("2026-11-13T10:00:00Z");
    expect(relativeTime("2026-11-13T09:58:00Z", base)).toBe("2 min ago");
    expect(relativeTime(null, base)).toBe("never");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
    expect(formatBytes(undefined)).toBe("—");
  });
});
