// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getCallHistory: vi.fn(),
  callBack: vi.fn(),
  calls: { enabled: true, state: { phase: "idle" }, engine: null as unknown },
}));
vi.mock("@/lib/api", () => ({ apiClient: { getCallHistory: mocks.getCallHistory } }));
vi.mock("@/components/calls/CallProvider", () => ({ useCalls: () => mocks.calls }));
vi.mock("@/components/calls/CallScreen", () => ({
  CallAvatar: ({ name }: { name: string }) => <span>{name[0]}</span>,
  formatDuration: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
}));

import AppCalls, { callDayLabel, isMissedCall, matchesCallFilter } from "./AppCalls";

const row = (over: Record<string, unknown>) => ({
  id: "c1", status: "ended", status_display: "Ended", direction: "outgoing", role: "operator", role_label: "Lab Operator",
  other: { id: 9, name: "Sample Operator" }, context_type: "booking", context_id: 5, context_label: "Booking X", reason: "",
  created_at: new Date().toISOString(), answered_at: null, ended_at: null, duration_seconds: 0, failure_code: "", ring_seconds: 45, ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(rows: unknown[]) {
  mocks.calls.engine = { callBack: mocks.callBack };
  mocks.calls.state = { phase: "idle" };
  mocks.getCallHistory.mockResolvedValue({ data: { results: rows } });
  return render(<MemoryRouter><AppCalls /></MemoryRouter>);
}

describe("call filters", () => {
  it("counts only an unanswered incoming call as missed", () => {
    expect(isMissedCall({ direction: "incoming", status: "missed" })).toBe(true);
    expect(isMissedCall({ direction: "incoming", status: "cancelled" })).toBe(true); // they gave up while it rang
    expect(isMissedCall({ direction: "incoming", status: "declined" })).toBe(false);
    expect(isMissedCall({ direction: "outgoing", status: "missed" })).toBe(false);
    expect(matchesCallFilter({ direction: "incoming", status: "ended" }, "incoming")).toBe(true);
    expect(matchesCallFilter({ direction: "incoming", status: "ended" }, "outgoing")).toBe(false);
    expect(matchesCallFilter({ direction: "outgoing", status: "ended" }, "all")).toBe(true);
  });

  it("names the day in India time", () => {
    const now = new Date("2026-11-06T06:00:00Z");
    expect(callDayLabel("2026-11-06T01:00:00Z", now)).toBe("Today");
    expect(callDayLabel("2026-11-05T19:00:00Z", now)).toBe("Today"); // 00:30 on the 6th in India
    expect(callDayLabel("2026-11-05T06:00:00Z", now)).toBe("Yesterday");
  });
});

describe("AppCalls", () => {
  it("shows direction, duration and a one-tap call on each row", async () => {
    show([row({ duration_seconds: 75 }), row({ id: "c2", direction: "incoming", status: "missed", status_display: "Missed" })]);
    expect(await screen.findByText(/1:15/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Outgoing call" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Missed call" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Call Sample Operator" })[1]);
    expect(mocks.callBack).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  it("calls a connected call that dropped Disconnected, not Failed", async () => {
    show([row({ status: "failed", status_display: "Failed", answered_at: new Date().toISOString() })]);
    expect(await screen.findByText(/Disconnected/)).toBeTruthy();
  });

  it("filters to missed calls and says when there are none", async () => {
    show([row({})]);
    await screen.findByText("Sample Operator");
    fireEvent.click(screen.getByRole("radio", { name: "Missed" }));
    expect(screen.getByText("No missed calls")).toBeTruthy();
    expect(screen.queryByText("Sample Operator")).toBeNull();
  });

  it("does not offer calling while another call is on", async () => {
    show([row({})]);
    mocks.calls.state = { phase: "in_call" };
    const { container } = render(<MemoryRouter><AppCalls /></MemoryRouter>);
    await screen.findAllByText("Sample Operator");
    expect((container.querySelector('button[aria-label="Call Sample Operator"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
