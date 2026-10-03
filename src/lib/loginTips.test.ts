import { describe, expect, it } from "vitest";
import { isIitrStudentUser, pickLoginTip, pickNextSampleReminder, type SampleReminderBooking } from "./loginTips";

describe("isIitrStudentUser", () => {
  it.each([
    [{ user_type: "student", department_type: "internal" }],
    [{ user_type: "student" }],
    [{ user_type: "individual_student", department_type: "internal" }],
    [{ user_type: "student", user_type_alias: "Research Associate" }],
    [{ user_type: 1 }],
  ])("includes IITR students and project staff %o", (user) => {
    expect(isIitrStudentUser(user)).toBe(true);
  });

  it.each([
    [{ user_type: "faculty", department_type: "internal" }],
    [{ user_type: "student", is_faculty: true }],
    [{ user_type: "external" }],
    [{ user_type: "industry" }],
    [{ user_type: "rnd" }],
    [{ user_type: "startup_incubated_iitr" }],
    [{ user_type: "individual_student", user_type_alias: "IITR Startups" }],
    [{ user_type: "student", department_type: "external" }],
    [{ user_type: "operator" }],
    [{ user_type: "manager" }],
    [{ user_type: "admin" }],
    [{ user_type: "dept_admin" }],
    [{ user_type: "finance" }],
    [{ user_type: "external_relations" }],
    [{ user_type: null }],
  ])("excludes %o", (user) => {
    expect(isIitrStudentUser(user)).toBe(false);
  });

  it("picks the sample tip only for students", () => {
    expect(pickLoginTip({ user_type: "student" })?.id).toBe("sample-on-time");
    expect(pickLoginTip({ user_type: "faculty" })).toBeNull();
    expect(pickLoginTip(null)).toBeNull();
  });
});

describe("pickNextSampleReminder", () => {
  const now = new Date("2026-10-05T08:00:00Z");
  const booking = (over: Partial<SampleReminderBooking>): SampleReminderBooking => ({
    booking_id: "B-1",
    real_booking_id: 11,
    equipment_name: "XRD",
    status: "BOOKED",
    start_time: "2026-10-06T04:30:00Z",
    ...over,
  });

  it("returns the earliest future booking that still needs a sample", () => {
    const r = pickNextSampleReminder(
      [
        booking({ booking_id: "B-3", real_booking_id: 13, equipment_name: "FE-SEM", start_time: "2026-10-08T04:30:00Z" }),
        booking({ booking_id: "B-2", real_booking_id: 12, status: "PROCESSING", start_time: "2026-10-05T10:00:00Z" }),
        booking({ booking_id: "B-0", real_booking_id: 10, start_time: "2026-10-04T10:00:00Z" }),
        booking({}),
      ],
      [],
      now
    );
    expect(r).toEqual({ equipmentName: "XRD", startTime: "2026-10-06T04:30:00Z", deadlineAt: null, leadHours: null });
  });

  it("adds the sample deadline when the portal already reported it", () => {
    const r = pickNextSampleReminder(
      [booking({})],
      [{ booking_id: 11, virtual_booking_id: "B-1", deadline_at: "2026-10-05T04:30:00Z", lead_hours: 24 }],
      new Date("2026-10-04T08:00:00Z")
    );
    expect(r?.deadlineAt).toBe("2026-10-05T04:30:00Z");
    expect(r?.leadHours).toBe(24);
  });

  it("ignores a deadline that has already passed and returns null without a pending booking", () => {
    const r = pickNextSampleReminder([booking({})], [{ booking_id: 11, deadline_at: "2026-10-05T04:30:00Z", lead_hours: 24 }], now);
    expect(r?.deadlineAt).toBeNull();
    expect(pickNextSampleReminder([booking({ status: "CANCELLED" })], [], now)).toBeNull();
  });
});
