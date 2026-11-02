// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getUpsList: vi.fn(),
  getUpsHealth: vi.fn(),
  runUpsHealth: vi.fn(),
}));

vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import UpsHealth from "./UpsHealth";

const unit = (id: number, name: string, extra = {}) => ({
  id,
  name,
  manufacturer: "Vertiv",
  model: "GXT5",
  department: "Physics",
  equipment: [{ id: 3, name: "FE-SEM", code: "F1" }],
  map_verified: true,
  enabled: true,
  latest: {
    read_at: "2026-11-02T08:00:00Z", stale: false, reachable: true, input_voltage: 231, output_voltage: 230,
    load_percent: 42, battery_percent: 100, runtime_minutes: 18, temperature_c: 31, on_battery: false, alerts: [],
  },
  health: { level: "attention", risk_score: 20, summary: "Warm.", created_at: "2026-11-02T08:07:00Z" },
  ...extra,
});

const health = {
  device: 1,
  latest: {
    id: 9, created_at: "2026-11-02T08:07:00Z", level: "attention", risk_score: 20, metrics: {},
    summary: "The UPS for FE-SEM needs attention soon: its room is warm.", summary_source: "ai",
    notified_at: "2026-11-02T08:07:00Z", notified_codes: ["warm"],
    findings: [{ code: "warm", level: "attention", title: "UPS room warm", detail: "About 31 °C.", action: "Improve cooling.", evidence: {} }],
  },
  notices: [{ at: "2026-11-02T08:07:00Z", level: "attention", codes: ["warm"], summary: "x", recipients: 1 }],
  officers: ["Prof. A"],
  notify_officers: true,
  power_events: [{ kind: "on_battery", started_at: "2026-11-01T10:00:00Z", ended_at: "2026-11-01T10:06:00Z", minutes: 6,
    start_battery_percent: 100, end_battery_percent: 70 }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><UpsHealth /></MemoryRouter>);

describe("UpsHealth", () => {
  it("shows the AI summary, findings, power cuts and who is told for the UPS in the link", async () => {
    api.getUpsList.mockResolvedValue({ data: { results: [unit(1, "UPS Lab 1"), unit(2, "UPS Lab 2")] } });
    api.getUpsHealth.mockResolvedValue({ data: health });
    renderAt("/ups-health?ups=2");

    expect(await screen.findByText(/its room is warm/)).toBeTruthy();
    expect(api.getUpsHealth).toHaveBeenCalledWith(2);
    expect(screen.getByText(/Written by the portal's AI assistant/)).toBeTruthy();
    expect(screen.getByText("UPS room warm")).toBeTruthy();
    expect(screen.getByText("Improve cooling.")).toBeTruthy();
    expect(screen.getByText(/To Prof\. A\./)).toBeTruthy();
    expect(screen.getByText(/6 min · 100→70%/)).toBeTruthy();
  });

  it("runs the check on request and says when readings are unverified", async () => {
    api.getUpsList.mockResolvedValue({ data: { results: [unit(1, "UPS Lab 1", { map_verified: false })] } });
    api.getUpsHealth.mockResolvedValue({ data: { ...health, latest: null, notices: [], notify_officers: false } });
    api.runUpsHealth.mockResolvedValue({ data: health.latest });
    renderAt("/ups-health");

    expect(await screen.findByText(/not verified yet/)).toBeTruthy();
    expect(await screen.findByText(/No health check yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Check now/ }));
    await waitFor(() => expect(api.runUpsHealth).toHaveBeenCalledWith(1));
    await waitFor(() => expect(api.getUpsHealth).toHaveBeenCalledTimes(2));
  });

  it("explains when no UPS is linked", async () => {
    api.getUpsList.mockResolvedValue({ data: { results: [] } });
    renderAt("/ups-health");
    expect(await screen.findByText(/No UPS is linked/)).toBeTruthy();
  });
});
