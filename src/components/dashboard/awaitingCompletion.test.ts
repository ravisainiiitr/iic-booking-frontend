import { describe, expect, it } from "vitest";

import {
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
