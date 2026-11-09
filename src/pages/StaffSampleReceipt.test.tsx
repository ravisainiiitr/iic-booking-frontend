// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  scanSample: vi.fn(),
  labelStatus: vi.fn(),
  auth: { isAuthenticated: true, loading: false },
  redirect: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/components/PageShell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => m.auth }));
vi.mock("@/lib/authRedirect", () => ({ setPostLoginRedirect: m.redirect }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return { ...actual, externalBookingApi: { scanSample: m.scanSample, labelStatus: m.labelStatus } };
});

import type { ScanResult } from "@/lib/externalBookingApi";
import StaffSampleReceipt, { extractCode } from "./StaffSampleReceipt";

function result(over: Partial<ScanResult> = {}): ScanResult {
  return {
    outcome: "received_at_office",
    role: "office",
    message: "Received at office. Hand the sample over to the lab.",
    label_reference: "SCAN2345",
    booking_id: 9,
    booking_reference: "ACCMLACCXRD202600009",
    booking_status: "BOOKED",
    equipment: "Synthetic XRD",
    equipment_code: "ACCXRD",
    lab: "Synthetic Materials Lab",
    user_name: "Test User",
    sample_count: 2,
    description: "Thin films",
    slot_ranges: [{ start: "2026-11-11T09:00:00+05:30", end: "2026-11-11T10:00:00+05:30" }],
    amount_due: "0.00",
    payment_settled: true,
    timeline: [{ status: "FORWARDED_TO_LAB", label: "Forwarded to Lab", at: "2026-11-10T11:00:00+05:30", by: "Accounts", reason: "" }],
    received_at_office: true,
    ...over,
  };
}

function open(path = "/staff/sample-receipt?code=tok123") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/staff/sample-receipt" element={<StaffSampleReceipt />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Sample label scan (one scan at the receiving office)", () => {
  beforeEach(() => {
    m.scanSample.mockReset();
    m.redirect.mockReset();
    m.auth = { isAuthenticated: true, loading: false };
  });
  afterEach(cleanup);

  it("records the office receipt from the QR link, once", async () => {
    m.scanSample.mockResolvedValue(result());
    open();
    expect(await screen.findByText("Received at Office", { selector: "h1" })).toBeTruthy();
    expect(screen.getByText("Synthetic Materials Lab")).toBeTruthy();
    expect(m.scanSample).toHaveBeenCalledTimes(1);
    expect(m.scanSample).toHaveBeenCalledWith("tok123");
  });

  it("a later scan only shows that the receipt was already recorded", async () => {
    m.scanSample.mockResolvedValue(result({ outcome: "already_received", role: "viewer", message: "The receipt was already recorded." }));
    open();
    expect(await screen.findByText("Already received at the office")).toBeTruthy();
    expect(screen.getByText("The receipt was already recorded.")).toBeTruthy();
  });

  it("says when the payment is pending", async () => {
    m.scanSample.mockResolvedValue(result({ outcome: "payment_pending", payment_settled: false, amount_due: "590.00", timeline: [], message: "Payment of ₹590.00 is pending." }));
    open();
    expect(await screen.findByText("Payment pending — not recorded")).toBeTruthy();
    expect(screen.getByText("Pending ₹590.00")).toBeTruthy();
    expect(screen.getByText("Not received yet")).toBeTruthy();
  });

  it("asks staff to sign in, and comes back to the label", () => {
    m.auth = { isAuthenticated: false, loading: false };
    open();
    expect(m.scanSample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Staff sign in/ }));
    expect(m.redirect).toHaveBeenCalledWith("/staff/sample-receipt?code=tok123");
  });

  it("shows the server's refusal when the label is not found at all", async () => {
    m.scanSample.mockRejectedValue(new Error("This label was not found, or it is not for you to receive."));
    m.labelStatus.mockRejectedValue(new Error("This label was not found. It may have been replaced by a newer label."));
    open();
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("reads the code from a label link or a typed code", () => {
    expect(extractCode("https://equip.iitr.ac.in/staff/sample-receipt?code=abc")).toBe("abc");
    expect(extractCode(" scan2345 ")).toBe("scan2345");
  });
});


describe("anyone scanning the parcel", () => {
  it("shows the booking, payment and latest status without signing in", async () => {
    m.auth.isAuthenticated = false;
    m.labelStatus.mockResolvedValue({
      label_reference: "SCAN2345", booking_reference: "IICXRF202600014", equipment: "X-Ray Fluorescence (XRF)",
      department: "Institute Instrumentation Centre", user_name: "Iic Demo Test", sample_count: 1, booking_status: "Completed",
      payment: "Paid", current_status: "Result ready", updated_at: "2026-11-12T10:00:00+05:30",
      timeline: [{ status: "FORWARDED_TO_LAB", label: "Received at Office", at: "2026-11-10T11:00:00+05:30" },
                 { status: "RESULT_READY", label: "Result ready", at: "2026-11-12T10:00:00+05:30" }],
      slot_ranges: [],
    });
    render(
      <MemoryRouter initialEntries={["/staff/sample-receipt?code=tok123"]}>
        <Routes><Route path="/staff/sample-receipt" element={<StaffSampleReceipt />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("label-public")).toBeTruthy();
    expect(m.labelStatus).toHaveBeenCalledWith("tok123");
    expect(m.scanSample).not.toHaveBeenCalled();
    expect(screen.getAllByText("Result ready").length).toBeGreaterThan(0);
    expect(screen.getByText("IICXRF202600014")).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    m.auth.isAuthenticated = true;
  });
});
