// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DisruptionPromptDialog } from "./DisruptionPromptDialog";
import {
  disruptionRequestFields,
  disruptionTypeForSlotStatus,
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

  it("hides the upload for roles that cannot attach reports", () => {
    render(
      <DisruptionPromptDialog open mode="resume" title="Record action taken" onCancel={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /Attach service report/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeTruthy();
  });
});
