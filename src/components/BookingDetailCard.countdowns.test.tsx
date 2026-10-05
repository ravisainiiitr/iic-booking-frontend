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
  useAuth: () => ({ user: { id: 99, user_type: "operator" }, isAuthenticated: true }),
}));

const OWNER_ID = 7;
const base = {
  id: 601,
  booking_id: 601,
  virtual_booking_id: "XRD-#601",
  user: OWNER_ID,
  user_email: "neha@example.org",
  user_name: "Neha",
  equipment: 3,
  equipment_code: "PXRD",
  equipment_name: "Powder X-Ray Diffractometer (PXRD) [A]",
  charge_profile: 1,
  user_type_snapshot: "student",
  user_type_snapshot_display: "Student",
  total_time_minutes: 60,
  total_hours: 1,
  total_charge: "500.00",
  input_values: {},
  selected_parameters: null,
  charge_breakdown: [],
  notes: "",
  start_time: "2026-10-12T10:00:00+05:30",
  end_time: "2026-10-12T11:00:00+05:30",
  daily_slots: [],
  sample_trace: [],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};

const countdown = (phase: string) => ({
  enabled: true,
  phase,
  started_at: "2026-10-01T10:00:00Z",
  deadline_at: "2099-01-01T00:00:00Z",
  remaining_seconds: 100000,
  is_overdue: false,
});

const submitBooking = {
  ...base,
  status: "BOOKED",
  status_display: "Booked",
  lifecycle_countdown: countdown("submit_sample"),
} as unknown as BookingDetailCardBooking;

const collectBooking = {
  ...base,
  status: "COMPLETED",
  status_display: "Completed",
  completed_at: "2026-10-12T12:00:00+05:30",
  sample_collection_deadline_at: "2099-01-01T00:00:00Z",
  lifecycle_countdown: countdown("collect_sample"),
} as unknown as BookingDetailCardBooking;

type Viewer = { isOperator: boolean; isManagerOrAdmin?: boolean; currentUserType: string; currentUserId: number };
const OWNER: Viewer = { isOperator: false, currentUserType: "student", currentUserId: OWNER_ID };
const FACULTY_OWNER: Viewer = { isOperator: false, currentUserType: "faculty", currentUserId: 40 };
const OIC: Viewer = { isOperator: false, isManagerOrAdmin: true, currentUserType: "manager", currentUserId: 50 };
const ADMIN: Viewer = { isOperator: false, isManagerOrAdmin: true, currentUserType: "admin", currentUserId: 1 };
const OPERATOR: Viewer = { isOperator: true, currentUserType: "operator", currentUserId: 99 };
const OIC_OWN: Viewer = { ...OIC, currentUserId: OWNER_ID };

function render(booking: BookingDetailCardBooking, viewer: Viewer) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard booking={booking} onClose={() => {}} onUpdated={() => {}} {...viewer} />
    </MemoryRouter>,
  );
}

const SUBMIT = "Time remaining to submit sample";
const COLLECT = "Time remaining to collect sample";
const COLLECTION_BOX = "Sample Collection Deadline";

describe("BookingDetailCard sample countdowns by role", () => {
  it("shows the submission countdown to the booking user, faculty owner and Lab Operator only", () => {
    expect(render(submitBooking, OWNER)).toContain(SUBMIT);
    expect(render(submitBooking, FACULTY_OWNER)).toContain(SUBMIT);
    expect(render(submitBooking, OPERATOR)).toContain(SUBMIT);
    expect(render(submitBooking, OIC)).not.toContain(SUBMIT);
    expect(render(submitBooking, ADMIN)).not.toContain(SUBMIT);
  });

  it("shows the discard countdown and collection deadline to the booking user and faculty owner only", () => {
    for (const viewer of [OWNER, FACULTY_OWNER]) {
      const html = render(collectBooking, viewer);
      expect(html).toContain(COLLECT);
      expect(html).toContain(COLLECTION_BOX);
    }
    for (const viewer of [OIC, ADMIN, OPERATOR]) {
      const html = render(collectBooking, viewer);
      expect(html).not.toContain(COLLECT);
      expect(html).not.toContain(COLLECTION_BOX);
      expect(html).not.toContain("Sample collection by");
    }
  });

  it("keeps both countdowns on an Officer in Charge's own booking", () => {
    expect(render(submitBooking, OIC_OWN)).toContain(SUBMIT);
    expect(render(collectBooking, OIC_OWN)).toContain(COLLECT);
  });
});
