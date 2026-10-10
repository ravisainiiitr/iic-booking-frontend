// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import BookingAttemptLogs from "./BookingAttemptLogs";

const api = vi.hoisted(() => ({ list: vi.fn(), exportReport: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@iitr.ac.in", name: "Admin", user_type: "admin" },
    isAuthenticated: true,
    loading: false,
  }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "listBookingAttemptLogs") return api.list;
        if (prop === "downloadReportExport") return api.exportReport;
        if (prop === "isAdminPanelUser") return () => true;
        if (prop === "getEquipments") {
          return vi.fn(async () => ({ data: { equipments: [{ equipment_id: 3, name: "XPS", code: "XPS" }] } }));
        }
        return vi.fn(async () => ({ data: [] }));
      },
    },
  ),
}));

type Params = Record<string, unknown>;

function logRow(id: number, reason = "Quota check failed") {
  return {
    id,
    user_id: 9,
    user_name: `User ${id}`,
    user_email: "",
    equipment_id: 3,
    equipment_code: "XPS",
    equipment_name: "XPS",
    requested_at: "2026-09-30T16:32:01Z",
    outcome: "FAILED",
    failure_reason: reason,
    failure_summary: `${reason} #${id}`,
    number_of_samples: 1,
    slots_requested: 1,
    duration_minutes: 30,
    booking_id: null,
  };
}

const calls = () => api.list.mock.calls.map(([p]) => p as Params);
const lastCall = () => calls()[calls().length - 1];
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

let location = "";
function LocationProbe() {
  const loc = useLocation();
  location = loc.search;
  return null;
}

function renderPage(url = "/booking-attempt-logs") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <BookingAttemptLogs />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  api.list.mockImplementation(async (params: Params) => ({
    data: { results: [logRow(Number(params.offset ?? 0) + 1)], total_count: 120 },
  }));
  api.exportReport.mockResolvedValue({ data: {} });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Booking Attempt Log live filters", { timeout: 20_000 }, () => {
  it("has no Apply filters button and applies the outcome at once, back on page 1", async () => {
    renderPage();
    await screen.findByText("Quota check failed #1");
    expect(screen.queryByRole("button", { name: /Apply filters/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastCall().offset).toBe(50));

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "FAILED" } });
    await waitFor(() => expect(lastCall()).toMatchObject({ outcome: "FAILED", offset: 0 }));
    await waitFor(() => expect(location).toContain("outcome=FAILED"));
  });

  it("searches the failure reason after a pause from 2 characters, and at once on Enter", async () => {
    renderPage();
    await screen.findByText("Quota check failed #1");
    const initial = calls().length;
    const box = screen.getByLabelText("Failure reason contains");

    fireEvent.change(box, { target: { value: "q" } });
    await sleep(600);
    expect(calls().length).toBe(initial);

    fireEvent.change(box, { target: { value: "quo" } });
    fireEvent.change(box, { target: { value: "quota" } });
    await waitFor(() => expect(lastCall().failure_reason_contains).toBe("quota"));
    expect(calls().length).toBe(initial + 1);

    fireEvent.change(box, { target: { value: "slot" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(lastCall().failure_reason_contains).toBe("slot");
  });

  it("does not fetch while the date range is out of order and explains why", async () => {
    renderPage();
    await screen.findByText("Quota check failed #1");
    fireEvent.change(screen.getByLabelText("Date to"), { target: { value: "01-10-2026" } });
    await waitFor(() => expect(lastCall().date_to).toBe("2026-10-01"));
    const before = calls().length;

    fireEvent.change(screen.getByLabelText("Date from"), { target: { value: "05-10-2026" } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/end date must be on or after/);
    fireEvent.change(screen.getByLabelText("Date from"), { target: { value: "05-10-20" } });
    await sleep(500);
    expect(calls().length).toBe(before);

    fireEvent.change(screen.getByLabelText("Date from"), { target: { value: "01-09-2026" } });
    await waitFor(() => expect(lastCall()).toMatchObject({ date_from: "2026-09-01", date_to: "2026-10-01" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps rows on screen while refetching and never shows an older response over a newer one", async () => {
    renderPage();
    await screen.findByText("Quota check failed #1");
    let releaseSlow: () => void = () => {};
    api.list.mockImplementation((params: Params) => {
      if (params.outcome === "SUCCESS") {
        return new Promise((resolve) => {
          releaseSlow = () => resolve({ data: { results: [logRow(901, "Old")], total_count: 1 } });
        });
      }
      return Promise.resolve({ data: { results: [logRow(902, "New")], total_count: 1 } });
    });

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "SUCCESS" } });
    await waitFor(() => expect(lastCall().outcome).toBe("SUCCESS"));
    expect(screen.getByText("Quota check failed #1")).toBeTruthy();
    expect(screen.getByText("Updating…")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "FAILED" } });
    await screen.findByText("New #902");
    await act(async () => releaseSlow());
    expect(screen.queryByText("Old #901")).toBeNull();
  });

  it("restores filters from the URL and Clear resets them and refetches", async () => {
    renderPage("/booking-attempt-logs?outcome=FAILED&failure_reason_contains=quota");
    await screen.findByText("Quota check failed #1");
    expect(calls()[0]).toMatchObject({ outcome: "FAILED", failure_reason_contains: "quota" });
    expect((screen.getByLabelText("Failure reason contains") as HTMLInputElement).value).toBe("quota");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(lastCall().outcome).toBeUndefined());
    expect(lastCall().failure_reason_contains).toBeUndefined();
    await waitFor(() => expect(location).toBe(""));
  });

  it("exports with the filters the list is showing", async () => {
    renderPage("/booking-attempt-logs?outcome=FAILED");
    await screen.findByText("Quota check failed #1");
    fireEvent.change(screen.getByLabelText("Failure reason contains"), { target: { value: "quota" } });
    await waitFor(() => expect(lastCall().failure_reason_contains).toBe("quota"));

    fireEvent.keyDown(screen.getByRole("button", { name: /Export/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /CSV/ }));
    await waitFor(() => expect(api.exportReport).toHaveBeenCalledTimes(1));
    expect(api.exportReport.mock.calls[0][0]).toBe("booking-attempt-logs");
    expect(api.exportReport.mock.calls[0][2]).toMatchObject({ outcome: "FAILED", failure_reason_contains: "quota" });
  });
});
