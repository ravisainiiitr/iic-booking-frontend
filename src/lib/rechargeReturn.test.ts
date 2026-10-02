import { describe, expect, it } from "vitest";

import { RETURN_TO_BOOKING_KEY, clearReturnToBooking, readReturnToBooking, saveReturnToBooking } from "./rechargeReturn";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("return to booking after recharge", () => {
  it("round-trips the booking path and equipment name", () => {
    const s = memoryStorage();
    saveReturnToBooking({ path: "/book-equipment?equipment_id=5", equipmentName: "XPS", reason: "recharge" }, 100, s);
    expect(readReturnToBooking(200, s)).toEqual({
      path: "/book-equipment?equipment_id=5",
      equipmentName: "XPS",
      reason: "recharge",
      savedAt: 100,
    });
    clearReturnToBooking(s);
    expect(readReturnToBooking(200, s)).toBeNull();
  });

  it("reads the plain path written by older builds", () => {
    const s = memoryStorage();
    s.setItem(RETURN_TO_BOOKING_KEY, "/book-equipment?equipment_id=9");
    expect(readReturnToBooking(0, s)?.path).toBe("/book-equipment?equipment_id=9");
  });

  it("refuses anything that is not a booking page", () => {
    const s = memoryStorage();
    saveReturnToBooking({ path: "https://evil.example/book-equipment" }, 0, s);
    expect(readReturnToBooking(0, s)).toBeNull();
    s.setItem(RETURN_TO_BOOKING_KEY, "//evil.example");
    expect(readReturnToBooking(0, s)).toBeNull();
    s.setItem(RETURN_TO_BOOKING_KEY, JSON.stringify({ path: "/admin", savedAt: 0 }));
    expect(readReturnToBooking(0, s)).toBeNull();
  });

  it("expires after a day", () => {
    const s = memoryStorage();
    saveReturnToBooking({ path: "/book-equipment?equipment_id=5" }, 0, s);
    expect(readReturnToBooking(25 * 60 * 60 * 1000, s)).toBeNull();
  });
});
