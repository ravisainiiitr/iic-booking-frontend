// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DisruptionPromptDialog } from "./DisruptionPromptDialog";
import { EquipmentDisruptionNotice } from "./EquipmentDisruptionNotice";
import {
  RECOVERY_DELAYED_TEXT,
  RECOVERY_UNKNOWN_TEXT,
  disruptionRequestFields,
  disruptionTypeForSlotStatus,
  personWithRole,
  procurementRequestBody,
  publicDisruptionLines,
  recoveryWording,
  resumedEventIds,
  serviceReportFileError,
} from "@/lib/disruptions";

afterEach(cleanup);

describe("disruption helpers", () => {
  it("maps slot statuses to disruption types", () => {
    expect(disruptionTypeForSlotStatus("UNDER_MAINTENANCE")).toBe("UNDER_MAINTENANCE");
    expect(disruptionTypeForSlotStatus("SCHEDULED_MAINT")).toBe("SCHEDULED_MAINTENANCE");
    expect(disruptionTypeForSlotStatus("operator_absent")).toBe("OPERATOR_ABSENT");
    expect(disruptionTypeForSlotStatus("BLOCKED")).toBe("OTHER");
    expect(disruptionTypeForSlotStatus("NOT_AVAILABLE")).toBeNull();
    expect(disruptionTypeForSlotStatus("RESERVED_EXTERNAL")).toBeNull();
  });

  it("only sends the fields that were filled in", () => {
    expect(disruptionRequestFields({ reason: "  ", reasonCategory: "", actionTaken: "", serviceReport: null })).toEqual({});
    expect(
      disruptionRequestFields({ reason: " Pump failed ", reasonCategory: "BREAKDOWN", actionTaken: "", serviceReport: null })
    ).toEqual({ disruption_reason: "Pump failed", disruption_reason_category: "BREAKDOWN" });
  });

  it("collects resumed event ids once", () => {
    expect(resumedEventIds({ closed: [1, 2], resumed: [2, 3] })).toEqual([1, 2, 3]);
    expect(resumedEventIds(undefined)).toEqual([]);
  });

  it("validates service report files", () => {
    expect(serviceReportFileError(new File(["x"], "report.pdf"))).toBeNull();
    expect(serviceReportFileError(new File(["x"], "script.exe"))).toMatch(/PDF/);
    expect(serviceReportFileError(new File([], "empty.pdf"))).toMatch(/empty/);
  });

  it("words the expected recovery: unknown, expected, or delayed once passed", () => {
    const now = new Date(2025, 9, 11, 12, 0);
    expect(recoveryWording(null, now)).toBe(RECOVERY_UNKNOWN_TEXT);
    expect(recoveryWording(new Date(2025, 9, 13, 10, 0).toISOString(), now)).toBe("Expected back: Mon 13 Oct, 10:00");
    expect(recoveryWording(new Date(2025, 9, 10, 8, 0).toISOString(), now)).toBe(RECOVERY_DELAYED_TEXT);
    expect(RECOVERY_DELAYED_TEXT).toBe("Recovery delayed — update awaited");
  });

  it("builds public hover lines and person labels", () => {
    expect(
      publicDisruptionLines({
        type: "OPERATOR_ABSENT",
        label: "Operator absent",
        reason: "The operator is not available at this time.",
        expected_recovery_at: null,
        recovery_status: "UNKNOWN",
        recovery_text: RECOVERY_UNKNOWN_TEXT,
      })
    ).toEqual(["Operator absent", "The operator is not available at this time.", RECOVERY_UNKNOWN_TEXT]);
    expect(publicDisruptionLines(null)).toEqual([]);
    expect(personWithRole("A. Person", "Temp OIC")).toBe("A. Person (Temp OIC)");
    expect(personWithRole("", "")).toBe("");
  });

  it("drops procurement drafts without a type or named items", () => {
    const item = { name: "", quantity: "1", estimated_cost: "", recommended_by_service_person: true, notes: "" };
    expect(procurementRequestBody({ category: "", items: [{ ...item, name: "Oil" }], notes: "" })).toBeNull();
    expect(procurementRequestBody({ category: "CONSUMABLE", items: [item], notes: "" })).toBeNull();
  });
});

describe("EquipmentDisruptionNotice", () => {
  const notice = {
    type: "UNDER_MAINTENANCE" as const,
    label: "Under maintenance",
    reason: "Detector failure",
    expected_recovery_at: "2099-10-13T04:30:00Z",
    recovery_status: "EXPECTED" as const,
    recovery_text: "Expected back: Tue 13 Oct, 10:00",
    since: null,
    message: "Under maintenance · Expected back: Tue 13 Oct, 10:00",
  };

  it("shows the banner with the reason and the compact card line", () => {
    const { rerender } = render(<EquipmentDisruptionNotice notice={notice} />);
    expect(screen.getByRole("status").textContent).toContain("Under maintenance · Expected back: Tue 13 Oct, 10:00");
    expect(screen.getByText("Detector failure")).toBeTruthy();
    rerender(<EquipmentDisruptionNotice notice={{ ...notice, recovery_text: "" }} compact />);
    expect(screen.getByTestId("equipment-disruption-notice").textContent).toBe(`Under maintenance · ${RECOVERY_UNKNOWN_TEXT}`);
    rerender(<EquipmentDisruptionNotice notice={null} />);
    expect(screen.queryByTestId("equipment-disruption-notice")).toBeNull();
  });
});

describe("DisruptionPromptDialog", () => {
  it("saves a category and reason when marking a disruption", () => {
    const onSubmit = vi.fn();
    render(
      <DisruptionPromptDialog
        open
        mode="disrupt"
        disruptionType="UNDER_MAINTENANCE"
        title="Reason for Under Maintenance"
        summary={[{ label: "Slots", value: "3" }]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText("Slots")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Breakdown" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), { target: { value: " Detector fault " } });
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledWith(
      { reason: "Detector fault", reasonCategory: "BREAKDOWN", actionTaken: "", serviceReport: null },
      false
    );
  });

  it("lets the user skip the reason", () => {
    const onSubmit = vi.fn();
    render(
      <DisruptionPromptDialog
        open
        mode="disrupt"
        disruptionType="OPERATOR_ABSENT"
        title="Reason for Operator Absent"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip reason" }));
    expect(onSubmit).toHaveBeenCalledWith(
      { reason: "", reasonCategory: "", actionTaken: "", serviceReport: null },
      true
    );
  });

  it("asks for the action taken and an optional service report on resume", () => {
    const onSubmit = vi.fn();
    render(
      <DisruptionPromptDialog
        open
        mode="resume"
        title="Record action taken"
        canAttachReport
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Action taken/ }), { target: { value: "Replaced lamp" } });
    expect(screen.getByRole("button", { name: /Attach service report/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith(
      { reason: "", reasonCategory: "", actionTaken: "Replaced lamp", serviceReport: null },
      false
    );
  });

  it("asks for an optional expected recovery when marking a disruption", () => {
    const onSubmit = vi.fn();
    render(
      <DisruptionPromptDialog
        open
        mode="disrupt"
        disruptionType="UNDER_MAINTENANCE"
        title="Reason for Under Maintenance"
        askRecovery
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText(/Recovery date not yet announced/)).toBeTruthy();
    const input = screen.getByLabelText(/Expected recovery/) as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
    fireEvent.change(input, { target: { value: "2099-10-13T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const values = onSubmit.mock.calls[0][0];
    expect(values.expectedRecovery).toBe("2099-10-13T10:00");
    expect(disruptionRequestFields(values).expected_recovery_at).toBe(new Date("2099-10-13T10:00").toISOString());
  });

  it("offers a procurement request on resume only when the module is available", () => {
    const { rerender } = render(
      <DisruptionPromptDialog open mode="resume" title="Record action taken" canAttachReport onCancel={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(screen.queryByText("Service person recommended items?")).toBeNull();

    const onSubmit = vi.fn();
    rerender(
      <DisruptionPromptDialog
        open
        mode="resume"
        title="Record action taken"
        canAttachReport
        procurement={{
          available: true,
          categories: [
            { value: "CONSUMABLE", label: "Consumables" },
            { value: "MAJOR_ASSET", label: "Major assets" },
          ],
        }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Service person recommended items/ }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Consumables" }));
    fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: " Pump oil " } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Est. cost/), { target: { value: "1500" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    const values = onSubmit.mock.calls[0][0];
    expect(procurementRequestBody(values.procurement)).toEqual({
      category: "CONSUMABLE",
      notes: "",
      items: [{ name: "Pump oil", quantity: 2, estimated_cost: 1500, recommended_by_service_person: true, notes: "" }],
    });
  });

  it("hides the upload for roles that cannot attach reports", () => {
    render(
      <DisruptionPromptDialog open mode="resume" title="Record action taken" onCancel={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /Attach service report/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeTruthy();
  });
});
