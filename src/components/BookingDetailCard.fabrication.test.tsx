import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { BookingDetailCard, type BookingDetailCardBooking } from "./BookingDetailCard";

vi.mock("@/lib/api", () => {
  const empty = vi.fn(async () => ({ data: null }));
  const apiClient = new Proxy({} as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : empty),
  });
  apiClient.getProfilePictureUrl = () => "";
  return { API_BASE_URL: "/api", apiClient, default: apiClient };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 50, user_type: "manager" }, isAuthenticated: true }),
}));

const base = {
  id: 701,
  booking_id: 701,
  virtual_booking_id: "XRD-#701",
  user: 7,
  user_email: "asha@example.org",
  user_name: "Asha Verma",
  user_department: "Chemistry",
  equipment: 3,
  equipment_code: "XRD",
  equipment_name: "X-Ray Diffractometer",
  charge_profile: 1,
  user_type_snapshot: "student",
  user_type_snapshot_display: "Student",
  total_time_minutes: 60,
  total_hours: 1,
  total_charge: "500.00",
  input_values: {},
  input_fields: [],
  selected_parameters: null,
  charge_breakdown: [{ amount: 500, description: "Charge" }],
  status: "BOOKED",
  status_display: "Booked",
  notes: "",
  start_time: "2020-10-06T10:00:00+05:30",
  end_time: "2020-10-06T11:00:00+05:30",
  daily_slots: [],
  sample_trace: [],
  atmosphere_sensitive_sample: true,
  lifecycle_countdown: {
    enabled: true,
    phase: "submit_sample",
    started_at: "2026-10-01T10:00:00Z",
    deadline_at: "2099-10-06T04:30:00Z",
  },
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};

const workflow = {
  rejected: false,
  rejected_at: null,
  rejected_by_name: "",
  reason: "",
  replace_deadline: null,
  replace_deadline_display: "",
  replace_deadline_passed: false,
  replace_window_hours: 24,
  can_reject: true,
  reason_min_length: 10,
};

const printBooking = (over: Record<string, unknown> = {}) =>
  ({
    ...base,
    virtual_booking_id: "3DP-#701",
    equipment_code: "3DP",
    equipment_name: "3D Printer",
    equipment_profile_type: "PRINT_3D",
    fabrication_parts: [{ kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 2 }],
    fabrication_file_changes: [],
    fabrication_files_replaceable: { allowed: false, reason: null },
    fabrication_workflow: workflow,
    ...over,
  }) as unknown as BookingDetailCardBooking;

const oic = { isOperator: false, isManagerOrAdmin: true, currentUserType: "manager", currentUserId: 50 };
const owner = { isOperator: false, currentUserType: "student", currentUserId: 7 };

function renderCard(
  booking: BookingDetailCardBooking,
  props: { isOperator: boolean; isManagerOrAdmin?: boolean; currentUserType: string; currentUserId: number },
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard booking={booking} onClose={() => {}} onUpdated={() => {}} {...props} />
    </MemoryRouter>,
  );
}

const SAMPLE_ITEMS = [
  "Sample Accepted",
  "Sample Rejected",
  "Booking Not Utilized",
  "Operator Unavailable",
  "Analysis Not Possible",
  "Extend results deadline",
  "Time remaining",
  "Atmosphere-sensitive sample",
  "Sample Lifecycle",
];

describe("BookingDetailCard for fabrication bookings", () => {
  it("gives lab staff only Mark complete and Reject, without the sample lifecycle", () => {
    const html = renderCard(printBooking(), oic);
    expect(html).toContain("Mark complete");
    expect(html).toContain("Reject (not feasible)");
    expect(html).toContain("Print files");
    expect(html).toContain("Download gear.stl");
    for (const hidden of SAMPLE_ITEMS) {
      expect(html, hidden).not.toContain(hidden);
    }
  });

  it("shows the rejection to the user and hides Mark complete for staff while rejected", () => {
    const rejected = printBooking({
      status_display: "Rejected – waiting for new files",
      fabrication_rejected_at: "2026-10-05T04:30:00Z",
      fabrication_workflow: {
        ...workflow,
        rejected: true,
        can_reject: false,
        reason: "Walls are thinner than 1 mm",
        rejected_by_name: "Lab Operator",
        replace_deadline_display: "06 Oct 2026, 10:00 AM IST",
      },
      fabrication_files_replaceable: { allowed: true, reason: null },
    });
    const userHtml = renderCard(rejected, owner);
    expect(userHtml).toContain("Rejected – waiting for new files");
    expect(userHtml).toContain("Walls are thinner than 1 mm");
    expect(userHtml).toContain("06 Oct 2026, 10:00 AM IST");
    expect(userHtml).toContain("Replace files");
    expect(userHtml).toContain("bg-rose-700");

    const staffHtml = renderCard(rejected, oic);
    expect(staffHtml).toContain("Waiting for the user to upload new files");
    expect(staffHtml).not.toContain("Mark complete");
    expect(staffHtml).not.toContain("Reject (not feasible)");
  });

  it("hides the reject button when the server does not allow it", () => {
    const html = renderCard(printBooking({ fabrication_workflow: { ...workflow, can_reject: false } }), oic);
    expect(html).not.toContain("Reject (not feasible)");
    expect(html).toContain("Mark complete");
  });

  it("simplifies laser cutting bookings the same way", () => {
    const html = renderCard(printBooking({ equipment_profile_type: "LASER_CUT_2D", fabrication_parts: [] }), oic);
    expect(html).toContain("Reject (not feasible)");
    expect(html).not.toContain("Sample Accepted");
  });

  it("leaves other equipment unchanged", () => {
    const html = renderCard({ ...base } as unknown as BookingDetailCardBooking, oic);
    expect(html).not.toContain("Reject (not feasible)");
    expect(html).not.toContain("Mark complete");
    expect(html).toContain("Sample Accepted");
    expect(html).toContain("Booking Not Utilized");
    expect(html).toContain("Extend results deadline");
    expect(html).not.toContain("Time remaining to submit sample");
    expect(renderCard({ ...base } as unknown as BookingDetailCardBooking, owner)).toContain("Time remaining");
  });
});
