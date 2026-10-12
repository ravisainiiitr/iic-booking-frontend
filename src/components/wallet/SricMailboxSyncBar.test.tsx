// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSricMailboxStatus: vi.fn(),
  refreshSricMailbox: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import SricMailboxSyncBar, { formatCountdown, resultLine } from "./SricMailboxSyncBar";

const status = (over: Record<string, unknown> = {}) => ({
  poll_seconds: 300,
  cooldown_seconds: 45,
  cooldown_remaining: 0,
  running: false,
  last_checked_at: "2026-10-12T08:03:12Z",
  next_check_at: "2026-10-12T08:08:12Z",
  next_check_in_seconds: 125,
  readers: [],
  last_refresh: null,
  ...over,
});

const result = {
  totals: { new_emails: 2, rows_parsed: 2, matched: 1, unmatched: 1 },
  readers: {},
  message: "Mailbox checked: 2 new email(s), 2 row(s) read, 1 matched, 1 not matched (see the review list).",
};

describe("SricMailboxSyncBar", () => {
  beforeEach(() => {
    api.getSricMailboxStatus.mockResolvedValue({ data: status() });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("formats the countdown and the result", () => {
    expect(formatCountdown(125)).toBe("2 min 05 s");
    expect(formatCountdown(9)).toBe("9 s");
    expect(formatCountdown(0)).toBe("due now");
    expect(resultLine(result)).toBe("2 new email(s) · 2 row(s) read · 1 matched · 1 not matched");
  });

  it("shows last check and next automatic check", async () => {
    render(<SricMailboxSyncBar />);
    await waitFor(() => expect(screen.getByTestId("sric-mailbox-last-checked").textContent).toContain("next automatic check in 2 min"));
    expect(screen.getByText(/every 5 min/)).toBeTruthy();
  });

  it("refreshes, reports the result, reloads the page and starts the cooldown", async () => {
    const onRefreshed = vi.fn();
    api.refreshSricMailbox.mockResolvedValue({ data: { result, status: status({ cooldown_remaining: 45 }) } });
    render(<SricMailboxSyncBar onRefreshed={onRefreshed} />);
    await waitFor(() => expect(api.getSricMailboxStatus).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByTestId("sric-mailbox-refresh"));
    });
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Last Refresh: 2 new email\(s\)/)).toBeTruthy();
    const button = screen.getByTestId("sric-mailbox-refresh") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("45s");
  });

  it("does not reload the page on cooldown", async () => {
    const onRefreshed = vi.fn();
    api.refreshSricMailbox.mockResolvedValue({ error: "Checked moments ago. Please wait 30 seconds.", status: 429 });
    render(<SricMailboxSyncBar onRefreshed={onRefreshed} />);
    await waitFor(() => expect(api.getSricMailboxStatus).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByTestId("sric-mailbox-refresh"));
    });
    expect(onRefreshed).not.toHaveBeenCalled();
  });
});
