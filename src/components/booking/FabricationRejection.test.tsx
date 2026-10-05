// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FabricationWorkflow } from "@/lib/api";

const api = vi.hoisted(() => ({ rejectFabricationBooking: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));

import { FabricationRejectDialog, FabricationRejectedNotice } from "@/components/booking/FabricationRejection";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const workflow: FabricationWorkflow = {
  rejected: true,
  rejected_at: "2026-10-05T04:30:00Z",
  rejected_by_name: "Lab Operator",
  reason: "Walls are thinner than 1 mm",
  replace_deadline: "2026-10-06T04:30:00Z",
  replace_deadline_display: "06 Oct 2026, 10:00 AM IST",
  replace_deadline_passed: false,
  replace_window_hours: 24,
  can_reject: false,
  reason_min_length: 10,
};

describe("FabricationRejectDialog", () => {
  it("needs a reason of the minimum length and posts it for the numeric booking id", async () => {
    api.rejectFabricationBooking.mockResolvedValue({ data: { message: "Booking rejected.", booking: {} } });
    const onRejected = vi.fn();
    render(<FabricationRejectDialog bookingId={673} minLength={10} windowHours={24} onRejected={onRejected} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject (not feasible)" }));
    expect(screen.getByText(/24 hours to upload new files/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Reject booking" }) as HTMLButtonElement;
    const reason = screen.getByLabelText("Reason");

    fireEvent.change(reason, { target: { value: "too thin" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(reason, { target: { value: "  Walls are thinner than 1 mm  " } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(api.rejectFabricationBooking).toHaveBeenCalledWith(673, "Walls are thinner than 1 mm"));
    await waitFor(() => expect(onRejected).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Booking rejected.");
  });

  it("shows the server error and keeps the dialog open", async () => {
    api.rejectFabricationBooking.mockResolvedValue({ error: "Only bookings in Booked state can be rejected." });
    const onRejected = vi.fn();
    render(<FabricationRejectDialog bookingId={5} minLength={10} windowHours={1} onRejected={onRejected} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject (not feasible)" }));
    expect(screen.getByText(/1 hour to upload new files/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "File is not a closed mesh" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject booking" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only bookings in Booked state can be rejected."));
    expect(onRejected).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reject booking" })).toBeTruthy();
  });
});

describe("FabricationRejectedNotice", () => {
  it("tells the user the reason, the deadline and how to replace or cancel", () => {
    render(<FabricationRejectedNotice workflow={workflow} staffView={false} />);
    const notice = screen.getByTestId("fabrication-rejected-notice");
    expect(notice.textContent).toContain("Walls are thinner than 1 mm");
    expect(notice.textContent).toContain("Rejected by Lab Operator");
    expect(notice.textContent).toContain("by 06 Oct 2026, 10:00 AM IST");
    expect(notice.textContent).toContain('"Replace files"');
    expect(notice.textContent).toContain("cancel now for a full refund");
  });

  it("tells lab staff they are waiting for the user", () => {
    render(<FabricationRejectedNotice workflow={workflow} staffView />);
    expect(screen.getByTestId("fabrication-rejected-notice").textContent).toContain("Waiting for the user to upload new files");
  });

  it("says when the time to replace has ended", () => {
    render(<FabricationRejectedNotice workflow={{ ...workflow, replace_deadline_passed: true }} staffView={false} />);
    expect(screen.getByTestId("fabrication-rejected-notice").textContent).toContain("The time to replace the files has ended");
  });
});
