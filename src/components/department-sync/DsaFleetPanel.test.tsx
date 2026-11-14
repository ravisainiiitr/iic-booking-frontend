// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

function renderPanel(url = "/department-sync?tab=fleet") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <DsaFleetPanel />
    </MemoryRouter>,
  );
}

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
  retired: false,
  latest_version: "1.0.10",
  version_status: "outdated",
  share: { ok: 1, failing: 0, unknown: 1 },
  network: { reported: true, enabled: true, adapter_up: true, adapter_ip: "10.250.0.1", ip_matches_config: true },
  errors_24h: 4,
  last_command: null,
  equipment_pc_hosts: ["LAB-LAPTOP", "DSATEST-LAPTOP", "10.250.0.2"],
};

const retiredAgent = {
  ...agent,
  id: "r1",
  agent_name: "MYSERVER",
  department: "Old Lab",
  health: "offline",
  why: [],
  retired: true,
  status: "RETIRED",
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
    power: { supported: true, standby_ac_minutes: 0, hibernate_ac_minutes: 0, lid_action_ac: 0, last_sleep_at: null },
  },
  equipment_pcs: [
    {
      id: "p1",
      hostname: "LAB-LAPTOP",
      equipment_id: 77,
      online: true,
      last_heartbeat_at: now,
      agent_version: "1.0.6",
      share_ok: true,
      share_name: "Results",
      observed_ip: "10.250.0.2",
      last_probe: { success: false, connectivity: "Reachable", smb_status: "Timeout", error_category: "Firewall", probed_at: now },
    },
    { id: "p2", hostname: "DSATEST-LAPTOP", online: false, registration_status: "Online", last_status_at: now },
  ],
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
  commands: [
    {
      id: "c9",
      command_type: "RETRY_FAILED_UPLOADS",
      status: "COMPLETED",
      created_at: now,
      completed_at: now,
      created_by: "",
      reason: "",
      result: { decision: "retry_scheduled", upload_queue_requeued: 2, detected_files_requeued: 0 },
      last_error: "",
    },
  ],
  bundles: [],
  sync_events: [
    {
      id: 5,
      at: now,
      code: "RESULT-2007",
      severity: "ERROR",
      category: "UPLOAD",
      message: "Result upload retried",
      equipment: { id: 77, name: "MPAES", code: "MPAES" },
      booking: { id: 4321, label: "IIC-4321" },
      correlation_id: "",
    },
  ],
  uploads: [
    {
      id: "u1",
      file_name: "scan.csv",
      status: "FAILED",
      bytes_received: 0,
      expected_size: 10,
      created_at: now,
      completed_at: null,
      last_error: "checksum mismatch",
      booking: { id: 4321, label: "IIC-4321" },
      equipment: { id: 77, name: "MPAES", code: "MPAES" },
      processing: null,
    },
  ],
  workspaces: [],
  actions: [
    { key: "restart_service", label: "Restart service", command_type: "RESTART_AGENT", supported: true },
    { key: "retry_failed_uploads", label: "Retry failed uploads", command_type: "RETRY_FAILED_UPLOADS", supported: true },
    { key: "support_bundle", label: "Collect support bundle", command_type: "COLLECT_SUPPORT_BUNDLE", supported: false },
  ],
};

function fleetResponse(results: unknown[]) {
  return {
    data: {
      count: results.length,
      counts: { healthy: 0, warning: 0, critical: 1, offline: 0, unknown: 0 },
      heartbeat_timeout_seconds: 180,
      server_time: now,
      results,
      retired_count: 1,
      latest_version: "1.0.10",
    },
  };
}

beforeEach(() => {
  api.getDepartmentSyncFleet.mockResolvedValue(fleetResponse([agent]));
  api.getDepartmentSyncFleetAgent.mockResolvedValue({ data: detail });
  api.runDepartmentSyncFleetAction.mockResolvedValue({ data: { id: "c1" } });
  api.acknowledgeDepartmentSyncIncident.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function openTab(name: RegExp) {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe("DsaFleetPanel", () => {
  it("lists every agent with health, the reason with its code, version against latest and network", async () => {
    renderPanel();
    const row = await screen.findByTestId("fleet-row-a1");
    expect(row.textContent).toContain("IIC");
    expect(row.textContent).toContain("Critical");
    expect(row.textContent).toContain("UPLOADS_STUCK");
    expect(row.textContent).toContain("3 upload(s) waiting; oldest for 95 min.");
    expect(row.textContent).toContain("1/1 online");
    expect(row.textContent).toContain("1.0.10");
    expect(row.textContent).toContain("10.250.0.1");
    expect(screen.getByText(/1 retired agent\(s\) hidden/)).toBeTruthy();
    expect(api.getDepartmentSyncFleet).toHaveBeenCalledWith({ includeRetired: false });
  });

  it("hides retired agents unless asked, and searches by Equipment PC", async () => {
    api.getDepartmentSyncFleet.mockImplementation(async (opts?: { includeRetired?: boolean }) =>
      fleetResponse(opts?.includeRetired ? [agent, retiredAgent] : [agent]),
    );
    renderPanel();
    await screen.findByTestId("fleet-row-a1");
    expect(screen.queryByTestId("fleet-row-r1")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Show retired agents" }));
    expect(await screen.findByTestId("fleet-row-r1")).toBeTruthy();
    expect(api.getDepartmentSyncFleet).toHaveBeenLastCalledWith({ includeRetired: true });

    fireEvent.change(screen.getByLabelText("Search the fleet"), { target: { value: "10.250.0.2" } });
    expect(screen.getByTestId("fleet-row-a1")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search the fleet"), { target: { value: "nothing-matches" } });
    expect(screen.getByText("No agents match these filters.")).toBeTruthy();
  });

  it("filters by health from the summary tiles", async () => {
    renderPanel();
    await screen.findByTestId("fleet-row-a1");
    fireEvent.click(screen.getByTestId("stat-healthy"));
    expect(screen.queryByTestId("fleet-row-a1")).toBeNull();
    fireEvent.click(screen.getByTestId("stat-attention"));
    expect(screen.getByTestId("fleet-row-a1")).toBeTruthy();
  });

  it("drills down to the requirement checklist, codes, booking links and action results", async () => {
    renderPanel();
    fireEvent.click(await screen.findByTestId("fleet-row-a1"));
    await screen.findByTestId("fleet-detail");
    expect(screen.getByTestId("check-version").getAttribute("data-state")).toBe("warn");
    expect(screen.getByTestId("check-firewall").getAttribute("data-state")).toBe("fail");
    expect(screen.getByTestId("check-uploads-queue").getAttribute("data-state")).toBe("fail");
    expect(screen.getByTestId("check-heartbeat").getAttribute("data-state")).toBe("pass");
    expect(screen.getByTestId("action-result-retry_failed_uploads").textContent).toContain("Re-queued 2 upload(s)");

    openTab(/Errors & codes/);
    const errors = await screen.findByRole("list", { name: "Recent errors" });
    expect(within(errors).getAllByText("RESULT-2007").length).toBeGreaterThan(0);
    expect(within(errors).getByText(/Upload failed: HTTP 503/)).toBeTruthy();
    const link = within(errors).getByRole("link", { name: "IIC-4321" });
    expect(link.getAttribute("href")).toBe("/booking-management?expand=4321");
  });

  it("drills down to an Equipment PC with share, firewall, version and its bookings", async () => {
    renderPanel("/department-sync?tab=fleet&agent=a1&pc=p1");
    const pc = await screen.findByTestId("pc-detail");
    expect(within(pc).getByRole("heading", { name: "LAB-LAPTOP" })).toBeTruthy();
    expect(screen.getByTestId("check-pc-firewall").getAttribute("data-state")).toBe("fail");
    expect(screen.getByTestId("check-pc-share").getAttribute("data-state")).toBe("pass");
    expect(screen.getByTestId("check-pc-version").getAttribute("data-state")).toBe("warn");
    expect(within(pc).getByText("scan.csv")).toBeTruthy();
    expect(within(pc).getAllByRole("link", { name: "IIC-4321" }).length).toBeGreaterThan(0);
  });

  it("shows an unreachable PC as Offline even when its stored status says Online", async () => {
    renderPanel("/department-sync?tab=fleet&agent=a1");
    await screen.findByTestId("fleet-detail");
    openTab(/Equipment PCs/);
    const offlineRow = (await screen.findByText("DSATEST-LAPTOP")).closest("tr") as HTMLElement;
    expect(offlineRow.textContent).toContain("Offline");
  });

  it("sends an audited action with the reason and disables unsupported ones", async () => {
    renderPanel("/department-sync?tab=fleet&agent=a1");
    await screen.findByTestId("fleet-detail");
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
    renderPanel("/department-sync?tab=fleet&agent=a1");
    fireEvent.click(await screen.findByRole("button", { name: "Restart service" }));
    expect(confirm).toHaveBeenCalled();
    expect(api.runDepartmentSyncFleetAction).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("acknowledges an open incident", async () => {
    renderPanel("/department-sync?tab=fleet&agent=a1");
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    await waitFor(() => expect(api.acknowledgeDepartmentSyncIncident).toHaveBeenCalledWith("a1", "i1"));
  });

  it("keeps actions off for a retired agent", async () => {
    api.getDepartmentSyncFleetAgent.mockResolvedValue({ data: { ...detail, agent: { ...retiredAgent } } });
    renderPanel("/department-sync?tab=fleet&agent=r1");
    await screen.findByTestId("fleet-detail");
    expect(screen.getByText(/This agent is retired/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Retry failed uploads" }) as HTMLButtonElement).disabled).toBe(true);
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
