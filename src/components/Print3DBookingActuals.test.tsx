// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrintAnalysisResult } from "@/lib/api";

const api = vi.hoisted(() => ({
  updateBookingPrintActuals: vi.fn(),
  getPrintAnalysisStlPresign: vi.fn(),
  getToken: vi.fn(() => "tok"),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));

import { Print3DBookingActuals } from "@/components/Print3DBookingActuals";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const file = (id: string, over: Partial<PrintAnalysisResult> = {}): PrintAnalysisResult => ({
  id,
  status: "COMPLETED",
  weight_grams: 290,
  estimated_time_minutes: 535,
  stl_filename: `${id}.stl`,
  ...over,
});

describe("Print3DBookingActuals", () => {
  it("saves actuals and reports the extra amount from the recalculation", async () => {
    api.updateBookingPrintActuals.mockResolvedValue({
      data: {
        message: "ok",
        booking: { booking_id: 692 },
        charge_recalculation_summary: { previous_charge: "521", new_charge: "750", refund_amount: null, extra_amount: "229" },
      },
    });
    const onUpdated = vi.fn();
    render(<Print3DBookingActuals printAnalysis={file("a")} bookingId={692} canEdit onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: /Set actual weight & time/ }));
    expect(screen.getByText(/Saving recalculates the booking amount/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Actual weight/), { target: { value: "420" } });
    fireEvent.change(screen.getByLabelText(/Actual print time/), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: /Save & update charges/ }));

    await waitFor(() =>
      expect(api.updateBookingPrintActuals).toHaveBeenCalledWith(692, { actual_weight_grams: 420, actual_time_minutes: 600 }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(toast.success.mock.calls[0][0]).toContain("229");
  });

  it("targets the chosen file of a multi-file booking", async () => {
    api.updateBookingPrintActuals.mockResolvedValue({ data: { message: "ok", booking: {}, charge_recalculation_summary: null } });
    render(
      <Print3DBookingActuals printAnalysis={file("a")} printAnalyses={[file("a"), file("b")]} bookingId={7} canEdit />,
    );
    expect(screen.getByText(/2 files in this booking/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Set actual weight & time/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save & update charges/ }));
    await waitFor(() =>
      expect(api.updateBookingPrintActuals).toHaveBeenCalledWith(7, {
        analysis_id: "a",
        actual_weight_grams: 290,
        actual_time_minutes: 535,
      }),
    );
  });

  it("shows the booking amount and a pending adjustment once actuals are set", () => {
    const { unmount } = render(
      <Print3DBookingActuals
        printAnalysis={file("a", { actual_weight_grams: 420, actual_time_minutes: 600 })}
        bookingId={7}
        totalCharge="750.00"
        pendingAmount="229.00"
      />,
    );
    const box = screen.getByTestId("print-actuals-amount");
    expect(box.textContent).toContain("₹750");
    expect(box.textContent).toContain("charged on the actual weight and time");
    expect(box.textContent).toContain("₹229");
    expect(box.textContent).toContain("more is to be paid");
    unmount();

    render(
      <Print3DBookingActuals
        printAnalysis={file("a", { actual_weight_grams: 100 })}
        bookingId={7}
        totalCharge="200.00"
        pendingAmount="-321.00"
      />,
    );
    expect(screen.getByTestId("print-actuals-amount").textContent).toContain("waiting for the Officer In Charge");
    expect(screen.queryByRole("button", { name: /Edit actuals/ })).toBeNull();
  });
});
