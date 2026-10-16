import { describe, expect, it } from "vitest";
import { nextAutoWeekStep } from "./slotWeekAutoAdvance";

describe("nextAutoWeekStep", () => {
  it("stays on the current week when it still has a bookable slot", () => {
    expect(nextAutoWeekStep({ index: 0, startIndex: 0, weekCount: 2, hasBookableSlot: true })).toEqual({
      done: true,
      showIndex: 0,
      advanced: false,
    });
  });

  it("moves to next week when nothing is left this week and next week is open", () => {
    expect(nextAutoWeekStep({ index: 0, startIndex: 0, weekCount: 2, hasBookableSlot: false })).toEqual({
      done: false,
      showIndex: 1,
    });
    expect(nextAutoWeekStep({ index: 1, startIndex: 0, weekCount: 2, hasBookableSlot: true })).toEqual({
      done: true,
      showIndex: 1,
      advanced: true,
    });
  });

  it("stays on the current week when next week is not open yet", () => {
    expect(nextAutoWeekStep({ index: 0, startIndex: 0, weekCount: 1, hasBookableSlot: false })).toEqual({
      done: true,
      showIndex: 0,
      advanced: false,
    });
  });

  it("goes back to the current week when no open week has a free slot", () => {
    expect(nextAutoWeekStep({ index: 2, startIndex: 0, weekCount: 3, hasBookableSlot: false })).toEqual({
      done: true,
      showIndex: 0,
      advanced: false,
    });
  });

  it("checks every open week in order (external windows can be longer)", () => {
    expect(nextAutoWeekStep({ index: 1, startIndex: 0, weekCount: 3, hasBookableSlot: false })).toEqual({
      done: false,
      showIndex: 2,
    });
    expect(nextAutoWeekStep({ index: 2, startIndex: 0, weekCount: 3, hasBookableSlot: true })).toEqual({
      done: true,
      showIndex: 2,
      advanced: true,
    });
  });
});
