// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyWalletSyncDeadline } from "@/lib/api";

const getDeadline = vi.fn();
const setDeadline = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getFacultyWalletSyncDeadline: (...args: unknown[]) => getDeadline(...args),
    setFacultyWalletSyncDeadline: (...args: unknown[]) => setDeadline(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import FacultyWalletSyncDeadlineCard from "./FacultyWalletSyncDeadlineCard";

const base: FacultyWalletSyncDeadline = {
  cutoff: "2026-10-04T00:00:00+05:30",
  cutoff_ist: "04 Oct 2026, 00:00:00 IST",
  source: "default",
  stored_cutoff: null,
  default_cutoff: "2026-10-04T00:00:00+05:30",
  window_open: false,
  server_time: "2026-10-05T10:00:00+05:30",
  max_cutoff: "2027-10-05T10:00:00+05:30",
  last_change: null,
  recent_changes: [],
};

const extended: FacultyWalletSyncDeadline = {
  ...base,
  cutoff: "2026-10-31T23:59:59+05:30",
  cutoff_ist: "31 Oct 2026, 23:59:59 IST",
  source: "setting",
  stored_cutoff: "2026-10-31T23:59:59+05:30",
  window_open: true,
  last_change: {
    id: 1,
    changed_at: "2026-10-05T10:05:00+05:30",
    changed_by_name: "Main Admin",
    changed_by_email: "admin@iitr.ac.in",
    old_cutoff: null,
    new_cutoff: "2026-10-31T23:59:59+05:30",
    reason: "Extend to month end",
  },
};

describe("FacultyWalletSyncDeadlineCard", () => {
  beforeEach(() => {
    getDeadline.mockReset();
    setDeadline.mockReset();
  });
  afterEach(cleanup);

  it("shows the built-in deadline as closed", async () => {
    getDeadline.mockResolvedValue({ data: base });
    render(<FacultyWalletSyncDeadlineCard />);
    await screen.findByText("Closed");
    expect(screen.getByText(/Built-in default/)).toBeTruthy();
    expect(screen.getByText("Never changed")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Close sync now/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires a reason and sends the IST deadline", async () => {
    getDeadline.mockResolvedValue({ data: base });
    setDeadline.mockResolvedValue({ data: extended });
    render(<FacultyWalletSyncDeadlineCard />);
    const input = (await screen.findByLabelText("New deadline (IST)")) as HTMLInputElement;
    // Browsers normalise a zero-seconds datetime-local value to HH:mm.
    expect(input.value).toMatch(/^2026-10-04T00:00(:00)?$/);

    fireEvent.change(input, { target: { value: "2026-10-31T23:59:59" } });
    fireEvent.click(screen.getByRole("button", { name: /Save deadline/ }));

    const confirm = (await screen.findByRole("button", { name: /^Save$/ })) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Extend to month end" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(setDeadline).toHaveBeenCalledWith({ cutoff: "2026-10-31T23:59:59+05:30", reason: "Extend to month end" }),
    );
    await screen.findByText("Open");
    expect(screen.getByText(/Main Admin/)).toBeTruthy();
  });

  it("closes the sync now with an empty cutoff", async () => {
    getDeadline.mockResolvedValue({ data: extended });
    setDeadline.mockResolvedValue({ data: { ...extended, window_open: false } });
    render(<FacultyWalletSyncDeadlineCard />);
    fireEvent.click(await screen.findByRole("button", { name: /Close sync now/ }));
    fireEvent.change(await screen.findByLabelText("Reason (required)"), { target: { value: "Stop syncing" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(setDeadline).toHaveBeenCalledWith({ cutoff: "", reason: "Stop syncing" }));
  });
});
