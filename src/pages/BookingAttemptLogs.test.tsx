// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookingAttemptLogs from "./BookingAttemptLogs";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  quotaBreakdown: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@iitr.ac.in", name: "Admin", user_type: "admin" },
    isAuthenticated: true,
    loading: false,
  }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "listBookingAttemptLogs") return api.list;
        if (prop === "getBookingAttemptLogDetail") return api.detail;
        if (prop === "getQuotaBreakdown") return api.quotaBreakdown;
        if (prop === "isAdminPanelUser") return () => true;
        return vi.fn(async () => ({ data: [] }));
      },
    },
  ),
}));

const technical =
  "Quota check failed: Individual Weekly quota exceeded: current usage 120 min + requested 90 min = 210 min; configured limit 270 min; remaining before this request 150 min.";
const friendly = "Weekly booking limit reached: you had used 120 min and requested 90 min; the weekly limit is 270 min.";

const row = {
  id: 41,
  user_id: 9,
  user_name: "Pragya Sharma",
  user_email: "pragya@iitr.ac.in",
  equipment_id: 3,
  equipment_code: "XPS",
  equipment_name: "X-Ray Photoelectron Spectroscopy (XPS)",
  requested_at: "2026-09-30T16:32:01Z",
  outcome: "FAILED",
  failure_reason: technical,
  failure_title: "Weekly booking limit reached",
  failure_summary: friendly,
  number_of_samples: 2,
  slots_requested: 2,
  duration_minutes: 90,
  booking_id: null,
  additional_info: { input_values: { B_elements: "C,Lu,W", "Sample Details": '[["1","N","5"]]' } },
};

const detail = {
  id: 41,
  requested_at: row.requested_at,
  outcome: "FAILED",
  equipment_id: 3,
  equipment_code: "XPS",
  equipment_name: row.equipment_name,
  real_booking_id: null,
  display_booking_id: null,
  slots_requested: 2,
  duration_minutes: 90,
  user: {
    id: 9,
    name: "Pragya Sharma",
    email: "pragya@iitr.ac.in",
    phone: "9876543210",
    user_type_label: "IITR Student",
    department_name: "Department of Physics",
    department_code: "PH",
    supervisor_name: "Prof. Anil Kumar",
  },
  requested_slots: [
    { id: 1, start_datetime: "2026-10-06T04:30:00Z", end_datetime: "2026-10-06T05:30:00Z" },
    { id: 2, start_datetime: "2026-10-06T05:30:00Z", end_datetime: "2026-10-06T06:00:00Z" },
  ],
  input_fields: [
    { field_key: "A", field_label: "No of samples", field_type: "NUMERIC" },
    { field_key: "B", field_label: "Select Element", field_type: "PERIODIC_TABLE" },
    { field_key: "C", field_label: "Sample Type", field_type: "RADIO", options: [{ value: "1", label: "Solid/Films" }] },
    { field_key: "D", field_label: "Sample Details", field_type: "TABLE", options: ["S.No.", "Name", "Count"] },
  ],
  input_values: { A: "2", B: "5", B_elements: "C,Lu,W", C: "1", D: [["1", "N", "5"], ["2", "", ""]] },
  comments: "",
  selected_parameters: [],
  outcome_details: { status: "FAILED", title: "Weekly booking limit reached", message: friendly, notes: [], technical, code: "quota_time" },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openFromFailureReason() {
  api.list.mockResolvedValue({ data: { results: [row], total_count: 1 } });
  api.detail.mockResolvedValue({ data: detail });
  render(
    <MemoryRouter>
      <BookingAttemptLogs />
    </MemoryRouter>,
  );
  const trigger = await screen.findByRole("button", { name: /View attempt details: Weekly booking limit reached/ });
  expect(trigger.getAttribute("title")).toBe("View attempt details");
  expect(trigger.textContent).toBe(friendly);
  fireEvent.click(trigger);
  return screen.findByRole("dialog");
}

describe("Booking Attempt Log details", () => {
  it("opens from the failure reason cell (not the user name) and shows the user, slots, inputs table and outcome last", async () => {
    const dialog = await openFromFailureReason();
    expect(api.detail).toHaveBeenCalledWith(41);
    await within(dialog).findByText("User details");

    expect(within(dialog).getByText("IITR Student")).toBeTruthy();
    expect(within(dialog).getByText("Department of Physics (PH)")).toBeTruthy();
    expect(within(dialog).getByText("Prof. Anil Kumar")).toBeTruthy();
    expect(within(dialog).getByText("9876543210")).toBeTruthy();
    expect(within(dialog).getByText(/2 slots/)).toBeTruthy();

    const inputs = within(dialog).getByTestId("sample-requirements");
    expect(within(inputs).getByRole("heading", { name: "User inputs" })).toBeTruthy();
    const table = within(inputs).getAllByRole("table")[0];
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(0, 5)).toEqual(["Set", "No of samples", "Select Element", "Sample Type", "Sample Details"]);
    expect(within(table).getByText("C, Lu, W")).toBeTruthy();
    expect(within(table).getByText("Solid/Films")).toBeTruthy();
    const inner = table.querySelector("table.jobsheet-subtable") as HTMLTableElement;
    expect(inner.querySelectorAll(":scope > tbody > tr")).toHaveLength(2);

    expect(dialog.textContent).not.toContain("[[");
    expect(dialog.textContent).not.toContain("B_elements");

    const outcome = within(dialog).getByTestId("attempt-outcome");
    expect(within(outcome).getByText(friendly)).toBeTruthy();
    const sections = Array.from(dialog.querySelectorAll("section"));
    expect(sections[sections.length - 1]).toBe(outcome);
    const technicalSummary = within(outcome).getByText("Technical details");
    expect(technicalSummary.closest("details")?.hasAttribute("open")).toBe(false);
  });

  it("shows the bookings counted toward the limit for a quota failure, for the requested slot's week", async () => {
    api.quotaBreakdown.mockResolvedValue({
      data: {
        equipment: { id: 3, name: row.equipment_name, code: "XPS" },
        equipment_group_name: null,
        scope: "individual",
        scope_label: "Individual Weekly",
        period: "WEEKLY",
        period_start: "2026-10-05T00:00:00+05:30",
        period_end: "2026-10-11T23:59:59+05:30",
        period_label: "Week of Mon 5 Oct – Sun 11 Oct 2026",
        limit_minutes: 270,
        used_minutes: 120,
        requested_minutes: 90,
        remaining_minutes: 150,
        over_by_minutes: 0,
        effectively_unlimited: false,
        subject: { id: 9, name: "Pragya Sharma" },
        group_owner: null,
        group_members_count: null,
        excluded_booking_id: null,
        counted: [
          {
            booking_id: 77,
            display_booking_id: "XPS202600077",
            equipment_id: 3,
            equipment_name: row.equipment_name,
            equipment_code: "XPS",
            slot_start: "2026-10-07T04:30:00Z",
            slot_end: "2026-10-07T06:30:00Z",
            minutes: 120,
            counted: true,
            status: "BOOKED",
            status_label: "Booked",
            user_id: 9,
            user_name: "Pragya Sharma",
            note: null,
            is_viewer: false,
            can_open: true,
          },
        ],
        not_counted: [],
        not_counted_truncated: false,
        members: [],
        viewer_access: "staff",
        full_details: true,
        computed_at: "2026-10-03T10:00:00Z",
        historical: true,
        attempt: {
          attempted_at: row.requested_at,
          period_source: "requested_slot",
          logged_used_minutes: 120,
          logged_limit_minutes: 270,
          logged_requested_minutes: 90,
          limit_changed: false,
          usage_changed: false,
        },
      },
    });
    const dialog = await openFromFailureReason();
    await within(dialog).findByText("User details");
    fireEvent.click(within(dialog).getByRole("button", { name: "View bookings counted" }));
    expect(await within(dialog).findByText("Week of Mon 5 Oct – Sun 11 Oct 2026")).toBeTruthy();
    expect(api.quotaBreakdown).toHaveBeenCalledWith({ logId: 41 });
    expect(within(dialog).getByText("XPS202600077")).toBeTruthy();
    expect(within(dialog).queryByText(/No events in this period/)).toBeNull();
  });

  it("keeps a details button in Actions and leaves the user name as plain text", async () => {
    api.list.mockResolvedValue({ data: { results: [row], total_count: 1 } });
    api.detail.mockResolvedValue({ data: detail });
    render(
      <MemoryRouter>
        <BookingAttemptLogs />
      </MemoryRouter>,
    );
    const name = await screen.findByText("Pragya Sharma");
    expect(name.closest("button")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View attempt details" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
