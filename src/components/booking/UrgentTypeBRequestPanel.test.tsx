// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { BookingWalletStatus } from "@/lib/bookingWalletStatus";
import {
  UrgentTypeBRequestPanel,
  formatRequiredTime,
  urgentTypeBSubmitBlocker,
} from "./UrgentTypeBRequestPanel";

afterEach(() => cleanup());

function Harness({
  walletStatus = { kind: "ok" },
  blocker = null,
  onSubmit = () => {},
}: {
  walletStatus?: BookingWalletStatus;
  blocker?: string | null;
  onSubmit?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [preferred, setPreferred] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <UrgentTypeBRequestPanel
      requiredMinutes={90}
      totalCharge="1350.00"
      chargeBreakdown={[
        { description: "Base charge", amount: 900 },
        { description: "Urgent surcharge (50%)", amount: 450 },
      ]}
      walletStatus={walletStatus}
      blocker={blocker}
      preferredSchedule={preferred}
      onPreferredScheduleChange={setPreferred}
      reason={reason}
      onReasonChange={setReason}
      evidenceFile={file}
      onEvidenceFileChange={setFile}
      disclaimerAccepted={ok}
      onDisclaimerChange={setOk}
      submitting={false}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  );
}

describe("Type B urgent request panel (no slot selection)", () => {
  it("shows the required time and the amount with the surcharge before submitting", () => {
    render(<Harness />);
    expect(screen.getByTestId("urgent-type-b-required-time").textContent).toBe("1 h 30 min");
    expect(screen.getByTestId("urgent-type-b-amount").textContent).toContain("1,350");
    expect(screen.getByText("Urgent surcharge (50%)")).toBeTruthy();
    expect(screen.queryByText(/Select Time Slots/i)).toBeNull();
  });

  it("enables submit only after a reason and the surcharge confirmation", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: "Submit Type B request" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Reviewer deadline next week" } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps submit blocked while Step 1 is incomplete", () => {
    render(<Harness blocker="Fill in Samples in Step 1." />);
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Reviewer deadline next week" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Submit Type B request" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Fill in Samples in Step 1.")).toBeTruthy();
  });

  it("warns (without blocking) when the wallet cannot cover the amount", () => {
    render(<Harness walletStatus={{ kind: "insufficient", spendable: 1000, charge: 1350, shortfall: 350 }} />);
    expect(screen.getByRole("status").textContent).toMatch(/350 short/);
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Reviewer deadline next week" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Submit Type B request" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("formats times and blockers", () => {
    expect(formatRequiredTime(45)).toBe("45 min");
    expect(formatRequiredTime(120)).toBe("2 h");
    expect(urgentTypeBSubmitBlocker({ reason: "short", disclaimerAccepted: true, requiredMinutes: 60 })).toMatch(/reason/);
    expect(urgentTypeBSubmitBlocker({ reason: "long enough reason", disclaimerAccepted: true, requiredMinutes: 0 })).toMatch(/Step 1/);
    expect(urgentTypeBSubmitBlocker({ reason: "long enough reason", disclaimerAccepted: true, requiredMinutes: 60 })).toBeNull();
  });
});

describe("Booking page in Type B mode", () => {
  const source = readFileSync(resolve(process.cwd(), "src/pages/BookEquipment.tsx"), "utf8");

  it("hides the slot calendar step and shows the requirement panel instead", () => {
    expect(source).toMatch(/\{showSlots && chargeCalculated[^\n]*!isUrgentTypeBHoldMode && \(/);
    expect(source).toMatch(/isUrgentTypeBHoldMode && chargeCalculated && calculatedCharge[\s\S]{0,200}<UrgentTypeBRequestPanel/);
  });

  it("submits Type B without slots or a hold booking", () => {
    const handler = source.slice(
      source.indexOf("const handleUrgentTypeBSubmit"),
      source.indexOf("const handleBooking = async"),
    );
    expect(handler).toContain("input_values: inputValues");
    expect(handler).not.toContain("create_as_hold");
    expect(handler).not.toContain("hold_booking_id");
    expect(handler).not.toContain("slot_ids");
  });
});
