// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { BookingResultsDeadline, BookingResultsOverdue } from "@/lib/api";
import { formatOverdueBy, ResultsOverdueNotice, resultsOverdueState } from "./ResultsOverdueNotice";

afterEach(cleanup);

const results = (over: Partial<BookingResultsOverdue> = {}): BookingResultsOverdue => ({
  hours: 24,
  label: "24 hours after the booking end, or after the sample receipt plus the booked time if that is later",
  due_at: "2026-10-07T13:01:00Z",
  due_display: "Wed 07 Oct 2026, 06:31 PM",
  overdue: false,
  overdue_by: null,
  waiting_for_user: false,
  extended: false,
  anchor_at: "2026-10-06T13:01:00Z",
  slot_end_at: "2026-10-06T09:00:00Z",
  sample_received_at: "2026-10-06T10:31:00Z",
  booked_minutes: 150,
  counted_from_receipt: true,
  visible_to_user: false,
  ...over,
});

const before = new Date("2026-10-07T10:00:00Z");
const after = new Date("2026-10-08T02:01:00Z"); // 13 h after the due time

describe("formatOverdueBy", () => {
  it("matches the server wording", () => {
    expect(formatOverdueBy(20 * 60_000)).toBe("less than 1 h");
    expect(formatOverdueBy(5 * 3_600_000)).toBe("5 h");
    expect(formatOverdueBy(48 * 3_600_000)).toBe("2 days");
    expect(formatOverdueBy(51 * 3_600_000)).toBe("2 days 3 h");
  });
});

describe("resultsOverdueState", () => {
  it("counts only from the due time, and never while the sample waits for the user", () => {
    expect(resultsOverdueState(results(), before)).toEqual({ overdue: false, overdueBy: null });
    expect(resultsOverdueState(results(), after)).toEqual({ overdue: true, overdueBy: "13 h" });
    expect(resultsOverdueState(results({ waiting_for_user: true }), after)).toEqual({ overdue: false, overdueBy: null });
  });
});

describe("ResultsOverdueNotice", () => {
  it("shows staff the due time before it, then the overdue hours", () => {
    render(<ResultsOverdueNotice results={results()} status="BOOKED" staffView now={before} />);
    const due = screen.getByTestId("results-overdue-staff").textContent ?? "";
    expect(due).toContain("Results due by Wed 07 Oct 2026, 06:31 PM");
    expect(due).not.toContain("overdue by");
    expect(due).toContain("Not shown to the user.");
    cleanup();

    render(<ResultsOverdueNotice results={results()} status="BOOKED" staffView now={after} />);
    const late = screen.getByTestId("results-overdue-staff").textContent ?? "";
    expect(late).toContain("Results overdue by 13 h");
    expect(late).toContain("Results were due by Wed 07 Oct 2026, 06:31 PM");
  });

  it("shows the user nothing unless the OIC shows the countdown", () => {
    const { container } = render(<ResultsOverdueNotice results={results()} status="BOOKED" staffView={false} now={after} />);
    expect(container.textContent).toBe("");
  });

  it("shows the user the expected time, then the overdue hours, with the results deadline when shown", () => {
    const deadline = { due_display: "Tue 13 Oct", visible_to_user: true } as BookingResultsDeadline;
    render(
      <ResultsOverdueNotice
        results={results({ visible_to_user: true })}
        status="BOOKED"
        staffView={false}
        userDeadline={deadline}
        now={before}
      />,
    );
    const box = screen.getByTestId("results-overdue-user").textContent ?? "";
    expect(box).toContain("Results expected by Wed 07 Oct 2026, 06:31 PM");
    expect(box).toContain("Results deadline for this equipment: Tue 13 Oct");
    cleanup();

    render(<ResultsOverdueNotice results={results({ visible_to_user: true })} status="BOOKED" staffView={false} now={after} />);
    expect(screen.getByTestId("results-overdue-user").textContent).toContain("Results overdue by 13 h");
  });

  it("is hidden once results are shared or before the lab has the sample", () => {
    const shared = render(<ResultsOverdueNotice results={results()} status="COMPLETED" staffView now={after} />);
    expect(shared.container.textContent).toBe("");
    cleanup();
    const none = render(<ResultsOverdueNotice results={null} status="BOOKED" staffView now={after} />);
    expect(none.container.textContent).toBe("");
  });
});
