// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  scanSample: vi.fn(),
  confirmSample: vi.fn(),
  labelCourierStatus: vi.fn(),
  submitLabelCourier: vi.fn(),
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
  return { ...actual, externalBookingApi: {
      scanSample: m.scanSample,
      confirmSample: m.confirmSample,
      labelCourierStatus: m.labelCourierStatus,
      submitLabelCourier: m.submitLabelCourier,
    },
  };
});

import type { LabelCourierView, ScanResult } from "@/lib/externalBookingApi";
import StaffSampleReceipt from "./StaffSampleReceipt";

function result(over: Partial<ScanResult> = {}): ScanResult {
  return {
    label_reference: "SCAN2345",
    booking_id: 9,
    booking_reference: "ACCMLACCXRD202600009",
    booking_status: "BOOKED",
    equipment: "Synthetic XRD",
    user_name: "Dr Asha Verma",
    sample_count: 2,
    description: "Thin films",
    latest_sample_status: null,
    already_received: false,
    slots: [],
    outcome: "received_at_office",
    role: "office",
    message: "Received at office. Hand the sample over to the lab.",
    lab: "Synthetic Materials Lab",
    equipment_code: "ACCXRD",
    location: "Room 101",
    officers_in_charge: ["Prof. OIC"],
    lab_incharge: ["Lab Operator"],
    slot_ranges: [{ start: "2026-11-11T09:00:00+05:30", end: "2026-11-11T10:00:00+05:30" }],
    amount_due: "0.00",
    payment_settled: true,
    notes: "",
    inputs: { sets: 1, fields: [{ key: "A", label: "Scan range", values: [{ kind: "text", text: "10–80°" }] }], comments: "" },
    timeline: [{ status: "FORWARDED_TO_LAB", label: "Forwarded to Lab", at: "2026-10-28T21:10:00+05:30", by: "Accounts", reason: "" }],
    received_at_office: true,
    received_at_lab: false,
    ...over,
  };
}

function courierView(over: Partial<LabelCourierView> = {}): LabelCourierView {
  return {
    label_reference: "SCAN2345",
    booking_reference: "ACCMLACCXRD202600009",
    equipment: "Synthetic XRD",
    lab: "Synthetic Materials Lab",
    sample_count: 2,
    can_submit: true,
    reason: "",
    recorded: null,
    courier_list: true,
    couriers: [{ slug: "bluedart", name: "Blue Dart" }],
    ...over,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/staff/sample-receipt" element={<StaffSampleReceipt />} />
        <Route path="/auth" element={<p>sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.isAuthenticated = true;
  m.auth.loading = false;
});
afterEach(() => cleanup());

describe("sample receipt by scanning", () => {
  it("opening the QR link records the step without typing anything, once", async () => {
    m.scanSample.mockResolvedValue(result());
    renderAt("/staff/sample-receipt?code=tok123");
    expect((await screen.findByTestId("scan-outcome")).textContent).toContain("Received at Office");
    expect(screen.getByTestId("scan-outcome").textContent).toContain("Synthetic Materials Lab");
    expect(screen.getByTestId("scan-outcome").textContent).toContain("Prof. OIC");
    expect(m.scanSample).toHaveBeenCalledTimes(1);
    expect(m.scanSample).toHaveBeenCalledWith("tok123");
    expect(m.confirmSample).not.toHaveBeenCalled();
  });

  it("lab receipt and later scans show the booking details for the experiment", async () => {
    m.scanSample.mockResolvedValue(result({ outcome: "details", role: "lab", message: "" }));
    renderAt("/staff/sample-receipt?code=tok123");
    const details = await screen.findByTestId("scan-details");
    expect(screen.getByTestId("scan-outcome").textContent).toContain("Booking details");
    expect(details.textContent).toContain("Scan range");
    expect(details.textContent).toContain("10–80°");
    expect(details.textContent).toContain("ACCMLACCXRD202600009");
    expect(screen.getByTestId("scan-timeline").textContent).toContain("Received at Office");
  });

  it("signed-out phone scan asks for the courier once, and offers staff sign-in back to the same label", async () => {
    m.auth.isAuthenticated = false;
    m.labelCourierStatus.mockResolvedValue(courierView());
    m.submitLabelCourier.mockResolvedValue(
      courierView({ can_submit: false, reason: "The courier details were already given by scanning this label.", recorded: { courier_name: "Blue Dart", tracking_tail: "…5678" } }),
    );
    renderAt("/staff/sample-receipt?code=tok123");
    expect((await screen.findByTestId("courier-step")).textContent).toContain("ACCMLACCXRD202600009");
    expect(m.scanSample).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Courier"), { target: { value: "bluedart" } });
    fireEvent.change(screen.getByLabelText("Tracking (AWB) number"), { target: { value: "AB12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/already given by scanning/)).toBeTruthy();
    expect(m.submitLabelCourier).toHaveBeenCalledWith("tok123", { courier_slug: "bluedart", tracking_number: "AB12345678" });
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Staff sign in/ }));
    expect(await screen.findByText("sign-in page")).toBeTruthy();
    expect(m.redirect).toHaveBeenCalledWith("/staff/sample-receipt?code=tok123");
  });

  it("courier typed by name when the lab has no courier list", async () => {
    m.auth.isAuthenticated = false;
    m.labelCourierStatus.mockResolvedValue(courierView({ courier_list: false, couriers: [] }));
    m.submitLabelCourier.mockResolvedValue(courierView({ can_submit: false, recorded: { courier_name: "DTDC", tracking_tail: "…4567" } }));
    renderAt("/staff/sample-receipt?code=tok123");
    fireEvent.change(await screen.findByLabelText("Courier"), { target: { value: "DTDC" } });
    fireEvent.change(screen.getByLabelText("Tracking (AWB) number"), { target: { value: "D1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("DTDC")).toBeTruthy();
    expect(m.submitLabelCourier).toHaveBeenCalledWith("tok123", { courier_name: "DTDC", tracking_number: "D1234567" });
  });

  it("pending payment: nothing forwarded, office can hold it with a reason", async () => {
    m.scanSample.mockResolvedValue(
      result({ outcome: "payment_pending", payment_settled: false, amount_due: "590.00", message: "Payment of ₹590.00 is pending.", timeline: [] }),
    );
    renderAt("/staff/sample-receipt?code=tok123");
    expect((await screen.findByTestId("scan-outcome")).textContent).toContain("Payment pending");
    expect(screen.getByRole("button", { name: "Mark held at office" })).toBeTruthy();
    expect(screen.getByTestId("scan-details").textContent).toContain("Pending ₹590.00");
  });

  it("signed in but not receiving staff (the sender on their phone): the courier step, no staff sign-in", async () => {
    const { ExternalBookingApiError } = await import("@/lib/externalBookingApi");
    m.scanSample.mockRejectedValue(new ExternalBookingApiError(404, { error: "This label was not found, or it is not for you to receive." }));
    m.labelCourierStatus.mockResolvedValue(courierView({ can_submit: false, reason: "IIC has already received this sample." }));
    renderAt("/staff/sample-receipt?code=tok123");
    expect((await screen.findByTestId("courier-step")).textContent).toContain("already received");
    expect(screen.queryByTestId("scan-outcome")).toBeNull();
    expect(screen.queryByTestId("staff-sign-in")).toBeNull();
  });

  it("an unknown label shows the server's message", async () => {
    const { ExternalBookingApiError } = await import("@/lib/externalBookingApi");
    m.scanSample.mockRejectedValue(new ExternalBookingApiError(404, { error: "x" }));
    m.labelCourierStatus.mockRejectedValue(new ExternalBookingApiError(404, { error: "This label was not found." }));
    renderAt("/staff/sample-receipt?code=tok123");
    expect((await screen.findByRole("alert")).textContent).toContain("This label was not found.");
    expect(screen.queryByTestId("courier-step")).toBeNull();
  });
});
