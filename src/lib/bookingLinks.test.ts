import { describe, expect, it } from "vitest";
import { bookingDetailPath, opensBookingManagement } from "./bookingLinks";

describe("bookingDetailPath", () => {
  it("opens View Booking for staff, by pk or display ID", () => {
    expect(bookingDetailPath({ pk: 42, displayId: "IIC-XRD-42", staff: true })).toBe("/booking-management?expand=42");
    expect(bookingDetailPath({ displayId: "IIC-XRD-42", staff: true })).toBe("/booking-management?expand=IIC-XRD-42");
  });

  it("opens My Bookings for everyone else, by display ID", () => {
    expect(bookingDetailPath({ pk: 42, displayId: "IIC XRD/42", staff: false })).toBe(
      "/my-bookings?booking=IIC%20XRD%2F42",
    );
    expect(bookingDetailPath({ pk: 42, staff: false })).toBe("/my-bookings?booking=42");
  });

  it("has no link without an ID", () => {
    expect(bookingDetailPath({ pk: null, displayId: "", staff: true })).toBe("");
  });

  it("treats Lab Operators, Officers In Charge, admins and department admins as staff", () => {
    for (const type of ["operator", "manager", "admin", "DEPT_ADMIN"]) expect(opensBookingManagement(type)).toBe(true);
    for (const type of ["student", "faculty", "external", undefined]) expect(opensBookingManagement(type)).toBe(false);
  });
});
