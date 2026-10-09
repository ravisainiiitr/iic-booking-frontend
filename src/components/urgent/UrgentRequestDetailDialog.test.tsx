// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { UrgentRequestDetailDialog, urgentDecisionFacts, type UrgentRequestDetailData } from "./UrgentRequestDetailDialog";

afterEach(cleanup);

const base: UrgentRequestDetailData = {
  id: 42,
  request_type: "REVIEWER_URGENT",
  user_id: 3,
  user_name: "Demo Student",
  user_email: "student@example.test",
  equipment_id: 9,
  equipment_code: "EQ-1",
  equipment_name: "Demo Microscope",
  requested_at: "2026-10-05T10:00:00",
  number_of_samples: 1,
  slots_requested: 4,
  duration_minutes: 2880,
  evidence_file_url: "/evidence/42",
  evidence_original_name: "reviewer-email.pdf",
  reviewer_comment: "Reviewer asked for extra imaging before the deadline.",
  wallet_approved_at: "2026-10-06T09:30:00",
  wallet_approved_by_name: "Demo Supervisor",
  wallet_notes: "Approved, deadline is genuine.",
  pending_wallet_approval: false,
  supervisor_approval_required: true,
  supervisor_decision: "APPROVED",
  supervisor_name: "Demo Supervisor",
  supervisor_decided_at: "2026-10-06T09:30:00",
  requester_category: "IIT Student",
  wallet_check: { has_wallet: true, available: "9000.00", sufficient: true, shortfall: "0.00", message: "" },
  status: "PENDING",
  admin_notes: "",
  decided_at: null,
  decided_by_name: null,
  requester_approved_urgent_last_6_months: [],
  hold_booking_id: null,
  hold_booking_summary: null,
  requires_slot_allocation: true,
  requirement: {
    input_values_by_key: { a_samples: 6, b_mode: "Fast" },
    input_fields: [
      { field_key: "a_samples", field_label: "No. of samples", field_type: "NUMERIC" },
      { field_key: "b_mode", field_label: "Mode", field_type: "TEXT" },
    ] as never,
    input_summary: [
      { key: "a_samples", label: "No. of samples", value: "6" },
      { key: "b_mode", label: "Mode", value: "Fast" },
    ],
    required_minutes: 180,
    required_slots: 3,
    estimated_charge: "4500.00",
    estimated_charge_breakdown: [],
    preferred_schedule: "Any weekday morning",
  },
};

const renderDialog = (detail: UrgentRequestDetailData, viewer: "supervisor" | "oic", actions?: React.ReactNode) =>
  render(
    <UrgentRequestDetailDialog
      detail={detail}
      viewer={viewer}
      onClose={vi.fn()}
      onOpenEvidence={vi.fn()}
      notes={{ id: "n", label: viewer === "oic" ? "Decision notes" : "Your comment", value: "", onChange: vi.fn(), show: true }}
      actions={actions}
    />,
  );

describe("Urgent request detail dialog", () => {
  it("OIC view: summary strip uses the entered inputs, reason and supervisor comment side by side", () => {
    renderDialog(base, "oic", <Button>Approve &amp; allocate</Button>);
    const dialog = screen.getByTestId("urgent-detail-oic");
    expect(within(dialog).getByText("Urgent request #42")).toBeTruthy();
    expect(within(dialog).getByText("Type B · 50% surcharge")).toBeTruthy();
    expect(screen.getByTestId("urgent-fact-samples").textContent).toContain("6 samples");
    expect(screen.getByTestId("urgent-fact-slots").textContent).toContain("3");
    expect(screen.getByTestId("urgent-fact-time").textContent).toContain("3 h");
    expect(screen.getByTestId("urgent-fact-amount").textContent).toContain("4,500");
    expect(screen.getByTestId("urgent-fact-wallet").textContent).toContain("Sufficient");
    expect(screen.getByTestId("urgent-reason-block").textContent).toContain("Reviewer asked for extra imaging");
    const sup = screen.getByTestId("urgent-supervisor-block");
    expect(sup.textContent).toContain("Approved");
    expect(screen.getByTestId("urgent-supervisor-comment").textContent).toContain("deadline is genuine");
    expect(sup.textContent).toContain("Demo Supervisor");
    expect(screen.getByText("Any weekday morning")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve & allocate/ })).toBeTruthy();
    expect(screen.getByLabelText("Decision notes")).toBeTruthy();
  });

  it("supervisor view: awaiting state and the supervisor's own comment box", () => {
    renderDialog(
      { ...base, pending_wallet_approval: true, supervisor_decision: "", wallet_approved_at: null, wallet_notes: "", supervisor_decided_at: null },
      "supervisor",
      <Button>Approve</Button>,
    );
    expect(screen.getByTestId("urgent-detail-supervisor")).toBeTruthy();
    const sup = screen.getByTestId("urgent-supervisor-block");
    expect(sup.textContent).toContain("Awaiting supervisor");
    expect(screen.getByLabelText("Your comment")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("shows Not required when the user pays from their own wallet, and the wallet shortfall", () => {
    renderDialog(
      {
        ...base,
        supervisor_approval_required: false,
        supervisor_decision: "",
        wallet_approved_at: null,
        wallet_check: { has_wallet: true, available: "100.00", sufficient: false, shortfall: "4400.00", message: "Insufficient wallet balance." },
      },
      "oic",
    );
    expect(screen.getByTestId("urgent-supervisor-block").textContent).toContain("Not required");
    expect(screen.getByTestId("urgent-fact-wallet").textContent).toContain("Short by");
  });

  it("falls back to the held booking for requests with slots", () => {
    const facts = urgentDecisionFacts({
      ...base,
      requirement: null,
      requires_slot_allocation: false,
      hold_booking_id: 5,
      hold_booking_summary: {
        booking_id: "B-5",
        total_charge: "900.00",
        total_time_minutes: 120,
        slot_times: [
          { start: "2026-10-07T09:00:00", end: "2026-10-07T10:00:00" },
          { start: "2026-10-07T10:00:00", end: "2026-10-07T11:00:00" },
        ],
        input_values: {},
      },
    });
    expect(facts).toEqual({ samples: "1 sample", slots: 2, requiredMinutes: 120, amount: "900.00" });
  });
});
