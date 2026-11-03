// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getBookingStatusOverride: vi.fn(),
  overrideBookingStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const empty = vi.fn(async () => ({ data: null }));
  const apiClient = new Proxy(api as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : empty),
  });
  (api as Record<string, unknown>).getProfilePictureUrl = () => "";
  return { API_BASE_URL: "/api", apiClient, default: apiClient };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, user_type: "admin" }, isAuthenticated: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import { BookingDetailCard, type BookingDetailCardBooking } from "./BookingDetailCard";
import BookingStatusOverrideDialog from "./booking/BookingStatusOverrideDialog";

const booking = (status: string) =>
  ({
    id: 72, booking_id: 72, virtual_booking_id: "IICTEM202699999", user: 7, user_email: "user@example.org",
    user_name: "Test User", equipment: 4, equipment_code: "TEM", equipment_name: "TEM", charge_profile: 1,
    user_type_snapshot: "student", total_time_minutes: 60, total_hours: 1, total_charge: "500.00", input_values: {},
    input_fields: [], selected_parameters: null, charge_breakdown: [], status, status_display: status, notes: "",
    start_time: "2020-10-06T10:00:00+05:30", end_time: "2020-10-06T11:00:00+05:30", daily_slots: [], sample_trace: [],
    maintenance_disruption_flag: false, created_at: "2020-10-01T10:00:00Z", updated_at: "2020-10-06T05:00:00Z",
  }) as unknown as BookingDetailCardBooking;

function card(status: string, currentUserType: string) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard
        booking={booking(status)}
        onClose={() => {}}
        onUpdated={() => {}}
        isOperator={false}
        isManagerOrAdmin
        currentUserType={currentUserType}
        currentUserId={1}
      />
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Change status (Main Administrator)", () => {
  it("is offered to the Main Administrator on disruption outcomes only", () => {
    for (const status of ["BOOKING_NOT_UTILIZED", "DISRUPTION_PENDING", "ABSENT"]) {
      expect(card(status, "admin"), status).toContain("Change status");
    }
    for (const status of ["COMPLETED", "BOOKED", "REFUNDED"]) {
      expect(card(status, "admin"), status).not.toContain("Change status");
    }
    expect(card("BOOKING_NOT_UTILIZED", "manager")).not.toContain("Change status");
    expect(card("BOOKING_NOT_UTILIZED", "operator")).not.toContain("Change status");
  });

  it("changes Not Utilized to Completed with a reason and the user email", async () => {
    api.getBookingStatusOverride.mockResolvedValue({ data: {
      booking_id: 72, current_status: "BOOKING_NOT_UTILIZED", current_status_label: "Booking Not Utilized",
      allowed: true, refusal: "", reason_min_length: 10,
      targets: [
        { value: "COMPLETED", label: "Completed", help: "The analysis was done." },
        { value: "BOOKED", label: "Booked", help: "Reopen the booking." },
      ],
    } });
    api.overrideBookingStatus.mockResolvedValue({ data: { message: "Status changed to Completed.", status: "COMPLETED" } });
    const onChanged = vi.fn();
    render(<BookingStatusOverrideDialog bookingId={72} bookingRef="IICTEM202699999" onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    const save = await screen.findByRole("button", { name: "Change to Completed" });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Analysis was done; marked by mistake." } });
    fireEvent.click(save);

    await waitFor(() => expect(api.overrideBookingStatus).toHaveBeenCalledWith(72, {
      status: "COMPLETED", reason: "Analysis was done; marked by mistake.", notify_user: true,
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("explains why a refunded outcome cannot be changed", async () => {
    api.getBookingStatusOverride.mockResolvedValue({ data: {
      booking_id: 72, current_status: "ABSENT", current_status_label: "Operator Unavailable", allowed: false,
      refusal: "This booking is Operator Unavailable: the charge was already refunded.", reason_min_length: 10, targets: [],
    } });
    render(<BookingStatusOverrideDialog bookingId={72} bookingRef="IICTEM202699999" onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    expect(await screen.findByText(/already refunded/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Change to/ })).toBeNull();
  });
});
