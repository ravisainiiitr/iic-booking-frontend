// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/api", () => {
  const empty = vi.fn(async () => ({ data: null }));
  const apiClient = new Proxy({ getProfilePictureUrl: () => "" } as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : empty),
  });
  return { API_BASE_URL: "/api", apiClient, default: apiClient };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, user_type: "manager" }, isAuthenticated: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import { BookingDetailCard, type BookingDetailCardBooking } from "./BookingDetailCard";

const booking = (fields: Record<string, unknown>) =>
  ({
    id: 72, booking_id: 72, virtual_booking_id: "IICXRD202600072", user: 7, user_email: "user@example.org",
    user_name: "Test User", equipment: 4, equipment_code: "XRD", equipment_name: "XRD", charge_profile: 1,
    user_type_snapshot: "student", total_time_minutes: 60, total_hours: 1, total_charge: "10.00", input_values: {},
    input_fields: [], selected_parameters: null, charge_breakdown: [], status: "BOOKED", status_display: "", notes: "",
    start_time: "2020-10-06T10:00:00+05:30", end_time: "2020-10-06T11:00:00+05:30", daily_slots: [], sample_trace: [],
    maintenance_disruption_flag: false, created_at: "2020-10-01T10:00:00Z", updated_at: "2020-10-06T05:00:00Z",
    charge_recalculation_pending_amount: "-40.00",
    ...fields,
  }) as unknown as BookingDetailCardBooking;

const card = (fields: Record<string, unknown>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard
        booking={booking(fields)}
        onClose={() => {}}
        onUpdated={() => {}}
        isOperator={false}
        isManagerOrAdmin
        currentUserType="manager"
        currentUserId={1}
      />
    </MemoryRouter>,
  );

describe("Refund after a charge recalculation", () => {
  it("can be confirmed on an active booking", () => {
    expect(card({})).toContain("Confirm refund");
  });

  it("is not offered on a Completed booking", () => {
    const html = card({ status: "COMPLETED" });
    expect(html).not.toContain("Confirm refund");
    expect(html).toContain("This booking is Completed, so this refund can no longer be made.");
  });

  it("is not offered on a booking settled during maintenance", () => {
    const html = card({ status: "BOOKING_NOT_UTILIZED", refund_locked: true });
    expect(html).not.toContain("Confirm refund");
    expect(html).toContain("settled during the equipment maintenance");
  });
});
