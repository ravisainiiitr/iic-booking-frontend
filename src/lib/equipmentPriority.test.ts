import { describe, expect, it } from "vitest";
import { moveItem, orderByPriority } from "./equipmentPriority";

const eq = (ids: number[]) => ids.map((id) => ({ equipment_id: id }));
const ids = (rows: { equipment_id: number }[]) => rows.map((r) => r.equipment_id);

describe("orderByPriority", () => {
  it("keeps the current order when nothing is saved", () => {
    expect(ids(orderByPriority(eq([3, 1, 2]), (e) => e.equipment_id, []))).toEqual([3, 1, 2]);
  });

  it("puts saved equipment first in saved order", () => {
    expect(ids(orderByPriority(eq([1, 2, 3, 4]), (e) => e.equipment_id, [3, 1, 4, 2]))).toEqual([3, 1, 4, 2]);
  });

  it("adds equipment assigned later at the end and drops ids no longer assigned", () => {
    expect(ids(orderByPriority(eq([1, 2, 5, 6]), (e) => e.equipment_id, [9, 2, 1]))).toEqual([2, 1, 5, 6]);
  });

  it("does not change the input list", () => {
    const list = eq([1, 2]);
    orderByPriority(list, (e) => e.equipment_id, [2, 1]);
    expect(ids(list)).toEqual([1, 2]);
  });
});

describe("moveItem", () => {
  it("moves an item up or down and clamps the target", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
