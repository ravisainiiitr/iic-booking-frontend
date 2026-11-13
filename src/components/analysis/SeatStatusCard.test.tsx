// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { SeatStatusCard } from "./SeatStatusCard";

const post = vi.fn();
vi.mock("@/lib/api", () => ({
  apiClient: { postRemoteAnalysisSessionActivity: (...args: unknown[]) => post(...args) },
}));

import { ACTIVE_WINDOW_MS, KEEPALIVE_EVERY_MS, useSessionKeepalive } from "@/hooks/use-session-keepalive";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SeatStatusCard", () => {
  it("shows place in line, wait, reason and that the user may leave — never a bare spinner", () => {
    render(
      <SeatStatusCard
        mode="queued"
        updatedAt={Date.now()}
        queue={{
          is_queued: true,
          position: 3,
          queue_size: 4,
          people_ahead: 2,
          estimated_wait_minutes: 45,
          expected_start_at: "2026-11-13T15:30:00Z",
          reason: "Every Analysis PC with this software is in use right now.",
        }}
      />,
    );
    const card = screen.getByTestId("seat-queued");
    expect(card.getAttribute("aria-live")).toBe("polite");
    expect(card.textContent).toContain("You are number 3 in line");
    expect(card.textContent).toContain("People ahead of you2");
    expect(card.textContent).toContain("About 45 min");
    expect(card.textContent).toContain("in use right now");
    expect(card.textContent).toContain("You can leave this page");
    expect(card.textContent).toContain("Updated just now");
  });

  it("says 'next in line' and admits when the wait is unknown", () => {
    render(<SeatStatusCard mode="queued" queue={{ is_queued: true, position: 1, people_ahead: 0, estimated_wait_minutes: null }} />);
    const card = screen.getByTestId("seat-queued");
    expect(card.textContent).toContain("You are next in line");
    expect(card.textContent).toContain("Not known yet");
  });

  it("offers Join and Release with the hold countdown", () => {
    const onJoin = vi.fn();
    const onRelease = vi.fn();
    render(<SeatStatusCard mode="held" queue={{}} holdSeconds={600} onJoin={onJoin} onRelease={onRelease} />);
    const card = screen.getByTestId("seat-held");
    expect(card.textContent).toContain("Join within 10:00");
    fireEvent.click(screen.getByRole("button", { name: "Join session" }));
    fireEvent.click(screen.getByRole("button", { name: "Give it to the next person" }));
    expect(onJoin).toHaveBeenCalledOnce();
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it("disables Join with a reason on an unsupported device", () => {
    render(<SeatStatusCard mode="held" queue={{}} holdSeconds={300} onJoin={vi.fn()} joinDisabledReason="This device cannot run the session." />);
    expect((screen.getByRole("button", { name: "Join session" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("seat-held").textContent).toContain("This device cannot run the session.");
  });
});

describe("useSessionKeepalive", () => {
  beforeEach(() => {
    post.mockReset();
    vi.useFakeTimers();
  });

  it("pings while the user works and stops once they have been away", () => {
    renderHook(() => useSessionKeepalive("s-1", true));
    expect(post).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
      vi.advanceTimersByTime(KEEPALIVE_EVERY_MS);
    });
    expect(post).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(ACTIVE_WINDOW_MS + KEEPALIVE_EVERY_MS * 2);
    });
    const afterAway = post.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(KEEPALIVE_EVERY_MS * 3);
    });
    expect(post.mock.calls.length).toBe(afterAway);
  });

  it("does nothing until the desktop is up", () => {
    renderHook(() => useSessionKeepalive("s-1", false));
    act(() => {
      vi.advanceTimersByTime(KEEPALIVE_EVERY_MS * 2);
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("'I am still working' pings at once", () => {
    const { result } = renderHook(() => useSessionKeepalive("s-2", false));
    act(() => result.current());
    expect(post).toHaveBeenCalledWith("s-2");
  });
});
