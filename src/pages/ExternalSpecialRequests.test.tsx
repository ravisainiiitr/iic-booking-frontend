// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: () => null,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ExternalWindowNotice } from "@/components/external/ExternalWindowNotice";
import type { SpecialPolicy, SpecialRequest } from "@/lib/externalBookingApi";
import { NewSpecialRequestForm, localToIso, timelineSteps } from "./ExternalSpecialRequests";
import { extractCode } from "./StaffSampleReceipt";

afterEach(() => cleanup());

// Radix checkboxes measure themselves; jsdom has no ResizeObserver (same polyfill as the other component tests).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const policy: SpecialPolicy = {
  enabled: true,
  available_to_you: true,
  short_notice_days: 12,
  payment_window_hours: 24,
  max_open_special_requests: 3,
  short_notice_policy: { key: "short_notice", version: 1, text: "Short-notice booking conditions: bring the sample in time.", approved: false, approval_note: "", sha256: "x" },
  notice: "This is a special booking request, not a confirmed booking.",
};

const draft = { equipmentId: 5, equipmentName: "XRD", inputValues: { A: 2 } };

function istLocal(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return `${parts}T10:00`;
}

describe("special request form", () => {
  it("shows the request notice and requires the short-notice acknowledgement before submitting", () => {
    render(
      <MemoryRouter>
        <NewSpecialRequestForm draft={draft} policy={policy} onCreated={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/not a confirmed booking/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: istLocal(3) } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: istLocal(3).replace("10:00", "12:00") } });
    fireEvent.change(screen.getByLabelText("Sample details"), { target: { value: "Thin films" } });
    expect(screen.getByRole("region", { name: "Short-notice booking conditions" })).toBeTruthy();
    expect(screen.getByText(/awaiting approval/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: /Submit special request/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/I have read and understand/));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not ask for the acknowledgement when the time is far enough away", () => {
    render(
      <MemoryRouter>
        <NewSpecialRequestForm draft={draft} policy={policy} onCreated={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: istLocal(20) } });
    expect(screen.queryByRole("region", { name: "Short-notice booking conditions" })).toBeNull();
  });

  it("sends IST wall-clock times with the +05:30 offset", () => {
    expect(localToIso("2026-11-20T10:00")).toBe("2026-11-20T10:00:00+05:30");
  });
});

describe("timeline", () => {
  const base: SpecialRequest = {
    id: 1,
    status: "PENDING",
    status_label: "Pending",
    equipment: { id: 5, name: "XRD", code: "XRD1" },
    requested_at: "2026-11-01T10:00:00+05:30",
    number_of_samples: 1,
    required_minutes: 60,
    required_slots: 1,
    estimated_total: "118.00",
    estimated_breakdown: [],
    input_values: {},
    decided_at: null,
    decision_note: "",
  };

  it("shows review as the current step while pending", () => {
    const steps = timelineSteps(base);
    expect(steps.map((s) => s.key)).toEqual(["submitted", "review", "allocated", "paid"]);
    expect(steps[1].state).toBe("current");
  });

  it("shows the payment deadline once a slot is allocated", () => {
    const steps = timelineSteps({
      ...base,
      status: "APPROVED",
      decided_at: "2026-11-02T10:00:00+05:30",
      allocation: {
        booking_id: 9, booking_reference: "IIC9", booking_status: "PENDING_PAYMENT", state: "awaiting_payment", state_label: "Awaiting payment",
        approved_at: "2026-11-02T10:00:00+05:30", slot_start: "2026-11-03T08:00:00+05:30", slots: [], payment_deadline_at: "2026-11-03T08:00:00+05:30",
        amount: "118.00", amount_due: "118.00", short_notice: true, short_notice_acknowledged_at: null, paid_at: null, expired_at: null,
        expiry_reason: "", late_payment_at: null,
      },
    });
    expect(steps.find((s) => s.key === "deadline")?.state).toBe("current");
    expect(steps.find((s) => s.key === "deadline")?.label).toMatch(/Pay by .*3 Nov.*2026/);
  });

  it("stops at rejection with the reason", () => {
    const steps = timelineSteps({ ...base, status: "REJECTED", decision_note: "Calibration week" });
    expect(steps[steps.length - 1]).toMatchObject({ state: "stopped", detail: "Calibration week" });
  });
});

describe("external window notice", () => {
  it("renders nothing for users the window does not apply to", () => {
    const { container } = render(
      <MemoryRouter>
        <ExternalWindowNotice window={{ enabled: true, is_open: true, first_date: "2026-11-09", last_date: "2026-12-06", opens_at: null, next_expansion_at: null, next_week_start: null, next_week_end: null, timezone: "Asia/Kolkata", applies_to_you: false }} special={policy} />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("offers a special request only once booking details exist", () => {
    const win = { enabled: true, is_open: true, first_date: "2026-11-09", last_date: "2026-12-06", opens_at: null, next_expansion_at: null, next_week_start: null, next_week_end: null, timezone: "Asia/Kolkata", applies_to_you: true };
    const { rerender } = render(
      <MemoryRouter>
        <ExternalWindowNotice window={win} special={policy} draft={null} />
      </MemoryRouter>,
    );
    expect((screen.getByRole("button", { name: /Request a Special Booking/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <MemoryRouter>
        <ExternalWindowNotice window={win} special={policy} draft={draft} />
      </MemoryRouter>,
    );
    expect((screen.getByRole("button", { name: /Request a Special Booking/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("sample receipt code", () => {
  it("reads the code from a scanned label link or a typed code", () => {
    expect(extractCode("https://equip.iitr.ac.in/staff/sample-receipt?code=abc123XYZ")).toBe("abc123XYZ");
    expect(extractCode("  abc123XYZ ")).toBe("abc123XYZ");
    expect(extractCode("")).toBe("");
  });
});
