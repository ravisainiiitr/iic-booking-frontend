// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getMaintenanceSettlement: vi.fn(),
  settleMaintenanceBooking: vi.fn(),
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
  useAuth: () => ({ user: { id: 1, user_type: "manager" }, isAuthenticated: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn() } }));

import MaintenanceSettlementDialog from "./MaintenanceSettlementDialog";
import { BookingDetailCard, type BookingDetailCardBooking } from "../BookingDetailCard";

const overview = {
  equipment_id: 4,
  equipment_name: "XRD",
  equipment_status: "REPAIR",
  under_maintenance: true,
  reason_min_length: 10,
  targets: [
    { value: "COMPLETED", label: "Completed", help: "The analysis was done." },
    { value: "BOOKING_NOT_UTILIZED", label: "Booking Not Utilized", help: "The slot was not used." },
  ],
  bookings: [
    {
      booking_id: 72, booking_ref: "IICXRD202600072", user_name: "Test User", user_email: "u@example.org",
      start: "2026-11-12T10:00:00+05:30", end: "2026-11-12T11:00:00+05:30", total_charge: "500.00",
      waiting_for_reschedule: true,
    },
  ],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MaintenanceSettlementDialog", () => {
  it("lists bookings on hold and settles one with a reason", async () => {
    api.getMaintenanceSettlement.mockResolvedValue({ data: overview });
    api.settleMaintenanceBooking.mockResolvedValue({
      data: { message: "Booking settled as Completed.", booking_id: 72, status: "COMPLETED", refund_locked: true },
    });
    const onContinue = vi.fn();
    const onSettled = vi.fn();
    render(
      <MaintenanceSettlementDialog
        open
        onOpenChange={() => {}}
        equipmentId={4}
        continueLabel="Mark Operational"
        onContinue={onContinue}
        onSettled={onSettled}
      />,
    );
    expect(await screen.findByText("IICXRD202600072")).toBeTruthy();
    expect(screen.getByText(/can no longer be refunded/)).toBeTruthy();
    expect(screen.getByText("Waiting for the automatic reschedule")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Settle" }));
    const save = screen.getByRole("button", { name: /Settle as Completed/ });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Analysed before the breakdown." } });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(72));
    expect(api.settleMaintenanceBooking).toHaveBeenCalledWith(72, {
      status: "COMPLETED",
      reason: "Analysed before the breakdown.",
      notify_user: true,
    });
    expect(screen.getByText(/Settled as Completed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mark Operational/ }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows the server's refusal (e.g. not the OIC of this equipment)", async () => {
    api.getMaintenanceSettlement.mockResolvedValue({ error: "Only the Officer In-Charge of this equipment..." });
    render(<MaintenanceSettlementDialog open onOpenChange={() => {}} equipmentId={4} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

const booking = (fields: Record<string, unknown>) =>
  ({
    id: 72, booking_id: 72, virtual_booking_id: "IICXRD202600072", user: 7, user_email: "user@example.org",
    user_name: "Test User", equipment: 4, equipment_code: "XRD", equipment_name: "XRD", charge_profile: 1,
    user_type_snapshot: "student", total_time_minutes: 60, total_hours: 1, total_charge: "500.00", input_values: {},
    input_fields: [], selected_parameters: null, charge_breakdown: [], status: "BOOKED", status_display: "", notes: "",
    start_time: "2020-10-06T10:00:00+05:30", end_time: "2020-10-06T11:00:00+05:30", daily_slots: [], sample_trace: [],
    maintenance_disruption_flag: false, created_at: "2020-10-01T10:00:00Z", updated_at: "2020-10-06T05:00:00Z",
    ...fields,
  }) as unknown as BookingDetailCardBooking;

function card(fields: Record<string, unknown>, currentUserType: string) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard
        booking={booking(fields)}
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

describe("Booking details", () => {
  const hold = { status: "DISRUPTION_PENDING", disruption_kind: "MAINTENANCE", maintenance_disruption_flag: true };

  it("offers Settle booking on a maintenance hold to the OIC and the Main Administrator only", () => {
    expect(card(hold, "manager")).toContain("Settle booking");
    expect(card(hold, "admin")).toContain("Settle booking");
    for (const t of ["operator", "dept_admin", "student", "finance"]) {
      expect(card(hold, t), t).not.toContain("Settle booking");
    }
    expect(card({ ...hold, disruption_kind: "OPERATOR_ABSENT" }, "manager")).not.toContain("Settle booking");
  });

  it("disables the refund once the booking was settled", () => {
    const open = card({ status: "BOOKING_NOT_UTILIZED" }, "manager");
    expect(open).not.toContain("Refund locked");
    const locked = card({ status: "BOOKING_NOT_UTILIZED", refund_locked: true }, "manager");
    expect(locked).toContain("Refund locked");
    expect(locked).not.toMatch(/>Refund<\/button>/);
  });
});
