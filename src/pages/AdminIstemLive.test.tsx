// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { IstemLiveFeed } from "@/lib/api";

const api = vi.hoisted(() => ({ getIstemLiveFeed: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/components/PageShell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import AdminIstemLive, { formatSeconds } from "./AdminIstemLive";

function feed(over: Partial<IstemLiveFeed> = {}): IstemLiveFeed {
  return {
    server_time: "2026-11-14T10:30:00Z",
    since: "2026-11-13T10:30:00Z",
    realtime: true,
    mode: "live",
    peak: { active: false, ends_at: null },
    events: [
      {
        id: "a2", kind: "booking_allocated", label: "Slot allocated (booking confirmed)", operation: "CONFIRM_BOOKING", trigger: "automatic",
        status: "done", error: "", detail: "", portal_at: "2026-11-14T10:29:50Z", sent_at: "2026-11-14T10:29:52Z", answered_at: "2026-11-14T10:29:56Z",
        wait_seconds: 2, call_seconds: 4, total_seconds: 6.2, booking_ref: "IICXRF202600021", equipment: "XRF", user: "Test User",
        fbr_no: "1976095620", request_id: "95620", confirmation_id: "72030",
      },
      {
        id: "a1", kind: "booking_cancelled", label: "Booking cancelled on I-STEM", operation: "CANCEL_BOOKING", trigger: "portal cancellation",
        status: "refused", error: "VALIDATION", detail: "Booking not found.", portal_at: null, sent_at: "2026-11-14T10:20:00Z", answered_at: "2026-11-14T10:20:03Z",
        wait_seconds: 0, call_seconds: 3, total_seconds: 3, booking_ref: "IICXRF202600019",
      },
    ],
    waiting: [
      { id: "j9", kind: "fbr_executed", label: "FBR executed (booking completed)", state: "PENDING", trigger: "automatic",
        queued_at: "2026-11-14T10:29:58Z", next_attempt_at: null, age_seconds: 2, error: "", detail: "", booking_ref: "IICXRF202600018" },
    ],
    stats: [{ kind: "booking_allocated", label: "Slot allocated (booking confirmed)", calls: 4, failed: 0, median_total_seconds: 7.5, slowest_total_seconds: 12, median_call_seconds: 4 }],
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminIstemLive", () => {
  it("lists each I-STEM call with its identifiers and the time from the portal event", async () => {
    api.getIstemLiveFeed.mockResolvedValue({ data: feed() });
    render(<AdminIstemLive />);
    const rows = await screen.findAllByTestId("istem-live-event");
    expect(rows.map((r) => r.getAttribute("data-kind"))).toEqual(["booking_allocated", "booking_cancelled"]);
    expect(screen.getByText("FBR 1976095620")).toBeTruthy();
    expect(screen.getAllByTestId("istem-live-total")[0].textContent).toBe("6.2 s");
    expect(screen.getByText("Booking not found.")).toBeTruthy();
    expect(screen.getAllByTestId("istem-live-waiting")).toHaveLength(1);
    expect(screen.getAllByTestId("istem-live-stat")).toHaveLength(1);
  });

  it("says when the peak booking window holds I-STEM calls", async () => {
    api.getIstemLiveFeed.mockResolvedValue({ data: feed({ peak: { active: true, ends_at: "2026-11-14T15:35:00Z" } }) });
    render(<AdminIstemLive />);
    expect((await screen.findByTestId("istem-live-peak")).textContent).toMatch(/held so bookings stay fast/);
  });

  it("formats durations for the screen", () => {
    expect(formatSeconds(4.25)).toBe("4.3 s");
    expect(formatSeconds(42)).toBe("42 s");
    expect(formatSeconds(125)).toBe("2 min 5 s");
    expect(formatSeconds(null)).toBe("-");
  });
});
