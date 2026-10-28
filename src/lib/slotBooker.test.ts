import { describe, expect, it } from "vitest";
import { bookerHoverLines, slotHoldsBooking } from "./slotBooker";

const booked = {
  status: "BOOKED",
  booking_user_name: "Asha Verma",
  booking_user_department_name: "Chemistry",
  booking_user_department_code: "CY",
  booking_user_email: "asha@iitr.ac.in",
  booking_user_phone: "9876500000",
  booking_id: "IICXRD0005",
};

describe("slot booker", () => {
  it("lists who booked the slot, department, contact and booking", () => {
    expect(bookerHoverLines(booked, "Click for details")).toEqual([
      "Booked by Asha Verma",
      "Department: Chemistry / CY",
      "Email: asha@iitr.ac.in",
      "Mobile: 9876500000",
      "Booking: IICXRD0005",
      "Click for details",
    ]);
  });

  it("needs a booker the server chose to send", () => {
    expect(slotHoldsBooking(booked)).toBe(true);
    expect(slotHoldsBooking({ ...booked, booking_user_name: null })).toBe(false);
    expect(slotHoldsBooking({ ...booked, status: "AVAILABLE" })).toBe(false);
    expect(slotHoldsBooking({ ...booked, status: "OPERATOR_ABSENT" })).toBe(true);
  });
});
