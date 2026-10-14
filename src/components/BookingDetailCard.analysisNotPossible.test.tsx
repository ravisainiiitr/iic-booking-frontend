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
  useAuth: () => ({ user: { id: 60, user_type: "operator" }, isAuthenticated: true }),
}));

const base = {
  id: 801,
  booking_id: 801,
  virtual_booking_id: "ICPMS-#801",
  user: 7,
  user_email: "asha@example.org",
  user_name: "Asha Verma",
  user_department: "Chemistry",
  equipment: 4,
  equipment_code: "ICPMS",
  equipment_name: "ICP-MS",
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
  status_display: "Pending",
  notes: "",
  start_time: "2020-10-06T10:00:00+05:30",
  end_time: "2020-10-06T11:00:00+05:30",
  daily_slots: [],
  sample_trace: [
    { id: 1, status: "SAMPLE_SENT", created_at: "2020-10-05T10:00:00Z" },
    { id: 2, status: "SAMPLE_ACCEPTED", created_at: "2020-10-06T05:00:00Z" },
  ],
  maintenance_disruption_flag: false,
  created_at: "2020-10-01T10:00:00Z",
  updated_at: "2020-10-06T05:00:00Z",
};

const booking = (over: Record<string, unknown> = {}) => ({ ...base, ...over }) as unknown as BookingDetailCardBooking;

const operator = { isOperator: true, isManagerOrAdmin: false, currentUserType: "operator", currentUserId: 60 };
const oic = { isOperator: false, isManagerOrAdmin: true, currentUserType: "manager", currentUserId: 50 };
const owner = { isOperator: false, currentUserType: "student", currentUserId: 7 };

function renderCard(
  b: BookingDetailCardBooking,
  props: { isOperator: boolean; isManagerOrAdmin?: boolean; currentUserType: string; currentUserId: number },
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard booking={b} onClose={() => {}} onUpdated={() => {}} {...props} />
    </MemoryRouter>,
  );
}

const ANP = "Analysis Not Possible";

describe("BookingDetailCard Analysis Not Possible", () => {
  it("is offered to the Lab Operator after the sample is accepted, as it is to the OIC", () => {
    expect(renderCard(booking(), operator)).toContain(ANP);
    expect(renderCard(booking(), oic)).toContain(ANP);
  });

  it("is offered to the Lab Operator in the same statuses as the OIC", () => {
    for (const status of ["BOOKED", "PENDING"]) {
      expect(renderCard(booking({ status, sample_trace: [] }), operator), status).toContain(ANP);
    }
    for (const status of ["COMPLETED", "REFUNDED", "CANCELLED", "DISRUPTION_PENDING", "HOLD", "ABSENT"]) {
      expect(renderCard(booking({ status }), operator), status).not.toContain(ANP);
      expect(renderCard(booking({ status }), oic), status).not.toContain(ANP);
    }
  });

  it("is hidden once the booking is already under a lab disruption", () => {
    const flagged = booking({ maintenance_disruption_flag: true });
    expect(renderCard(flagged, operator)).not.toContain(ANP);
    expect(renderCard(flagged, oic)).not.toContain(ANP);
  });

  it("is hidden for fabrication bookings and for the booking user", () => {
    const print = booking({ equipment_profile_type: "PRINT_3D", sample_trace: [], fabrication_parts: [] });
    expect(renderCard(print, operator)).not.toContain(ANP);
    expect(renderCard(booking(), owner)).not.toContain(ANP);
  });

  it("still keeps OIC-only actions away from the Lab Operator", () => {
    const html = renderCard(booking(), operator);
    expect(html).not.toContain("Under maintenance");
  });
});
