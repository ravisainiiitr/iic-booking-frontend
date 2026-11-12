// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { PaymentIssueRow } from "@/lib/api";

const state = vi.hoisted(() => ({
  api: { getPaymentIssues: vi.fn(), resolvePaymentIssue: vi.fn() },
  user: { id: 1, user_type: "finance" },
}));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/contexts/AuthContext", () => {
  const auth = () => ({ user: state.user, loading: false, isAuthenticated: true });
  return { useAuth: auth, useOptionalAuth: auth };
});
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PaymentIssues from "./PaymentIssues";

function issue(over: Partial<PaymentIssueRow> = {}): PaymentIssueRow {
  return {
    id: 7, kind: "DUPLICATE_CAPTURE", kind_label: "Second payment captured on an already paid order", status: "OPEN",
    razorpay_order_id: "order_X1", razorpay_payment_id: "pay_X2", amount: "944.00", mode: "test",
    detail: "Order already paid by pay_X1; this second payment needs a refund.", raised_at: "2026-11-08T08:38:00Z",
    resolved_at: null, resolution_note: "", booking_id: 79, booking_reference: "IICPXRD [B]202600026",
    purpose: "BOOKING_SHORTFALL", test_account: true, resolved_by: "", ...over,
  };
}

const page = () => render(<MemoryRouter><PaymentIssues /></MemoryRouter>);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Payment issues", () => {
  it("lists open issues with the booking, Razorpay ids, amount and what to do next", async () => {
    state.api.getPaymentIssues.mockResolvedValue({ data: { results: [issue()] } });
    page();
    expect(await screen.findByText("Second payment captured on an already paid order")).toBeTruthy();
    expect(screen.getByText("IICPXRD [B]202600026")).toBeTruthy();
    expect(screen.getByText("pay_X2")).toBeTruthy();
    expect(screen.getByTestId("open-total").textContent).toMatch(/1 open · ₹944/);
    expect(screen.getByText(/Refund the second payment on Razorpay/)).toBeTruthy();
    expect(state.api.getPaymentIssues).toHaveBeenCalledWith("OPEN");
  });

  it("closes an issue only with a note, then reloads", async () => {
    state.api.getPaymentIssues.mockResolvedValue({ data: { results: [issue()] } });
    state.api.resolvePaymentIssue.mockResolvedValue({ data: issue({ status: "RESOLVED" }) });
    page();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Close issue" }));
    const confirm = screen.getAllByRole("button", { name: "Close issue" }).at(-1)!;
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("What was done"), "Refunded, rfnd_123");
    await user.click(confirm);
    expect(state.api.resolvePaymentIssue).toHaveBeenCalledWith(7, "Refunded, rfnd_123");
    await waitFor(() => expect(state.api.getPaymentIssues).toHaveBeenCalledTimes(2));
  });

  it("shows who closed an issue, or that it closed itself", async () => {
    state.api.getPaymentIssues.mockResolvedValue({
      data: { results: [issue({ status: "RESOLVED", resolved_at: "2026-11-09T15:00:00Z", resolved_by: "", resolution_note: "Closed automatically." })] },
    });
    page();
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Closed" }));
    expect(await screen.findByText(/automatically: Closed automatically\./)).toBeTruthy();
    expect(state.api.getPaymentIssues).toHaveBeenLastCalledWith("RESOLVED");
  });

  it("explains when the user may not see payment issues", async () => {
    state.api.getPaymentIssues.mockResolvedValue({ error: "Forbidden." });
    page();
    expect(await screen.findByText(/Only the Accounts In Charge and the Main Administrator/)).toBeTruthy();
  });
});
