// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { BookingResultsDeadline } from "@/lib/api";
import { ResultsDeadlineNotice, resultsDeadlineApplies, sampleAcceptedForResults } from "./ResultsDeadlineNotice";

afterEach(cleanup);

const deadline = (over: Partial<BookingResultsDeadline> = {}): BookingResultsDeadline => ({
  value: 2,
  unit: "WORKING_DAYS",
  label: "within 2 working days after the slot",
  due_at: "2026-10-13T18:29:59Z",
  due_display: "Tue 13 Oct",
  extended: false,
  overdue: false,
  visible_to_user: false,
  ...over,
});

const before = new Date("2026-10-12T06:00:00Z");
const after = new Date("2026-10-14T06:00:00Z");

describe("ResultsDeadlineNotice", () => {
  it("applies only while results are still awaited", () => {
    expect(resultsDeadlineApplies("BOOKED")).toBe(true);
    expect(resultsDeadlineApplies("processing")).toBe(true);
    expect(resultsDeadlineApplies("ANALYSED")).toBe(false);
    expect(resultsDeadlineApplies("CANCELLED")).toBe(false);
  });

  it("treats the sample as accepted after Sample Accepted or once the booking is processing", () => {
    expect(sampleAcceptedForResults("BOOKED", [])).toBe(false);
    expect(sampleAcceptedForResults("BOOKED", [{ status: "SAMPLE_SUBMITTED" }])).toBe(false);
    expect(sampleAcceptedForResults("BOOKED", [{ status: "SAMPLE_SUBMITTED" }, { status: "sample_accepted" }])).toBe(true);
    expect(sampleAcceptedForResults("PROCESSING", null)).toBe(true);
  });

  it("shows nothing to the user while the OIC keeps the deadline hidden (the default)", () => {
    const { container } = render(<ResultsDeadlineNotice deadline={deadline()} status="BOOKED" staffView={false} now={before} />);
    expect(container.textContent).toBe("");
  });

  it("shows the expected date to the user when the OIC shows it", () => {
    render(<ResultsDeadlineNotice deadline={deadline({ visible_to_user: true })} status="BOOKED" staffView={false} now={before} />);
    const box = screen.getByTestId("results-deadline-user");
    expect(box.textContent).toContain("Results expected by Tue 13 Oct");
    expect(box.textContent).toContain("within 2 working days after the slot");
  });

  it("tells the user the lab is working on it once the date has passed", () => {
    render(<ResultsDeadlineNotice deadline={deadline({ visible_to_user: true })} status="PROCESSING" staffView={false} now={after} />);
    expect(screen.getByTestId("results-deadline-user").textContent).toContain("Results were expected by Tue 13 Oct");
  });

  it("always shows staff the due date, and flags overdue bookings", () => {
    render(<ResultsDeadlineNotice deadline={deadline({ extended: true })} status="BOOKED" staffView now={before} />);
    const due = screen.getByTestId("results-deadline-staff").textContent ?? "";
    expect(due).toContain("Results due: Tue 13 Oct");
    expect(due).toContain("(extended for this booking)");
    expect(due).toContain("Not shown to the user.");
    cleanup();

    render(<ResultsDeadlineNotice deadline={deadline({ overdue: true, visible_to_user: true })} status="BOOKED" staffView now={after} />);
    const overdue = screen.getByTestId("results-deadline-staff").textContent ?? "";
    expect(overdue).toContain("Results overdue: Tue 13 Oct");
    expect(overdue).toContain("The user can see this date.");
  });

  it("is hidden once results are shared", () => {
    const { container } = render(<ResultsDeadlineNotice deadline={deadline({ overdue: true })} status="ANALYSED" staffView now={after} />);
    expect(container.textContent).toBe("");
  });
});
