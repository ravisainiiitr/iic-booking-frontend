import { describe, expect, it } from "vitest";

import {
  awaitingIsOverdue,
  awaitingOverdueText,
  BOOKINGS_AWAITING_COMPLETION_KEY,
  showsBookingsAwaitingCompletion,
  withoutAwaitingCompletionUnlessOperator,
} from "./awaitingCompletion";

const items = [
  { key: BOOKINGS_AWAITING_COMPLETION_KEY, count: 2 },
  { key: "registration_approvals", count: 1 },
];

describe("Bookings awaiting completion", () => {
  it("is listed for Lab Operators only", () => {
    expect(showsBookingsAwaitingCompletion("operator")).toBe(true);
    expect(showsBookingsAwaitingCompletion("OPERATOR")).toBe(true);
    for (const userType of ["manager", "admin", "dept_admin", "faculty", "student", "finance", "", null, undefined]) {
      expect(showsBookingsAwaitingCompletion(userType), String(userType)).toBe(false);
    }
  });

  it("drops the pending item for OICs and keeps it for Lab Operators", () => {
    expect(withoutAwaitingCompletionUnlessOperator(items, "manager").map((i) => i.key)).toEqual(["registration_approvals"]);
    expect(withoutAwaitingCompletionUnlessOperator(items, "operator")).toEqual(items);
  });
});

describe("Results column", () => {
  const row = {
    overdue: "",
    is_overdue: false,
    waiting_for_user: false,
    results_due_at: "2026-10-07T13:01:00Z",
    results_due_at_display: "Wed 07 Oct 2026, 06:31 PM",
  };
  const before = new Date("2026-10-07T10:00:00Z");
  const after = new Date("2026-10-08T02:00:00Z");

  it("shows when results are due, with no overdue counter, until the results overdue time", () => {
    expect(awaitingIsOverdue(row)).toBe(false);
    expect(awaitingOverdueText(row, before)).toBe("Due by Wed 07 Oct 2026, 06:31 PM");
  });

  it("shows Overdue by, counted by the server from the due time, after it", () => {
    const late = { ...row, is_overdue: true, overdue: "13 h" };
    expect(awaitingIsOverdue(late)).toBe(true);
    expect(awaitingOverdueText(late, after)).toBe("Overdue by 13 h");
  });

  it("never counts a sample waiting for the user as overdue", () => {
    expect(awaitingOverdueText({ ...row, waiting_for_user: true }, after)).toBe("Waiting for the user");
  });

  it("treats an older payload with only the overdue text as overdue", () => {
    expect(awaitingIsOverdue({ overdue: "21 h" })).toBe(true);
    expect(awaitingOverdueText({ overdue: "21 h" })).toBe("Overdue by 21 h");
  });
});
