// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import PeakWindowGate from "./PeakWindowGate";
import { notifyPeakExternalPaused } from "@/lib/peakWindowEvents";

const WINDOW = {
  opening_at: "2026-10-07T21:00:00+05:30",
  starts_at: "2026-10-07T20:55:00+05:30",
  ends_at: "2026-10-07T21:15:00+05:30",
};
const MESSAGE =
  "To give IIT Roorkee users a fair chance when new slots open, external access is paused from 8:55 pm to 9:15 pm on Wednesdays. Please come back after 9:15 pm.";

const state = vi.hoisted(() => ({
  auth: {
    user: { id: 1, user_type: "external" } as Record<string, unknown> | null,
    isAuthenticated: true,
    logout: vi.fn(async () => {}),
  },
  peak: {
    loaded: true,
    active: false,
    externalPaused: false,
    externalNotice: false,
    window: null as null | { opening_at: string; starts_at: string; ends_at: string },
    message: "",
  },
  prefetch: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-peak-window", () => ({ usePeakWindow: () => state.peak }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api" }));
vi.mock("@/lib/peakWindow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/peakWindow")>()),
  prefetchBookingPage: state.prefetch,
  refreshPeakStatus: state.refresh,
  peakNow: () => Date.parse("2026-10-07T21:00:00+05:30"),
}));

const renderGate = () =>
  render(
    <PeakWindowGate>
      <p>App content</p>
    </PeakWindowGate>,
  );

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  state.auth.user = { id: 1, user_type: "external" };
  state.auth.isAuthenticated = true;
  state.peak = { loaded: true, active: false, externalPaused: false, externalNotice: false, window: null, message: "" };
  state.prefetch.mockClear();
});

describe("PeakWindowGate", () => {
  it("shows signed-in external users the paused page during the window", () => {
    state.peak = { ...state.peak, active: true, externalPaused: true, window: WINDOW, message: MESSAGE };
    renderGate();
    expect(screen.getByRole("heading", { name: /External access is paused/ })).toBeTruthy();
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText("9:15 pm")).toBeTruthy();
    expect(screen.queryByText("App content")).toBeNull();
  });

  it("lets internal users through and warms the booking page", () => {
    state.auth.user = { id: 2, user_type: "student" };
    state.peak = { ...state.peak, active: true, externalPaused: true, window: WINDOW, message: MESSAGE };
    renderGate();
    expect(screen.getByText("App content")).toBeTruthy();
    expect(state.prefetch).toHaveBeenCalled();
  });

  it("never blocks staff or signed-out visitors", () => {
    state.peak = { ...state.peak, active: true, externalPaused: true, window: WINDOW, message: MESSAGE };
    state.auth.user = { id: 3, user_type: "admin" };
    renderGate();
    expect(screen.getByText("App content")).toBeTruthy();
    cleanup();
    state.auth.user = null;
    state.auth.isAuthenticated = false;
    renderGate();
    expect(screen.getByText("App content")).toBeTruthy();
  });

  it("shows the advance notice banner to external users before the window", () => {
    state.peak = { ...state.peak, externalNotice: true, window: WINDOW };
    renderGate();
    expect(screen.getByRole("status").textContent).toMatch(/paused from 8:55 pm to 9:15 pm/);
    expect(screen.getByText("App content")).toBeTruthy();
  });

  it("does not show the notice to internal users", () => {
    state.auth.user = { id: 2, user_type: "faculty" };
    state.peak = { ...state.peak, externalNotice: true, window: WINDOW };
    renderGate();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("switches to the paused page when the API answers peak_window_external_paused", () => {
    renderGate();
    expect(screen.getByText("App content")).toBeTruthy();
    act(() => notifyPeakExternalPaused({ message: MESSAGE, peak_window: WINDOW }));
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(state.refresh).toHaveBeenCalled();
  });
});
