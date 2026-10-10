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

const booking = {
  id: 501,
  booking_id: 501,
  virtual_booking_id: "XRD-#501",
  user: 7,
  user_email: "asha@example.org",
  user_name: "Asha Verma",
  user_phone: "+91 98765 43210",
  user_department: "Chemistry",
  equipment: 3,
  equipment_code: "XRD",
  equipment_name: "X-Ray Diffractometer",
  wallet_owner_name: "Prof. R. Kumar",
  charge_profile: 1,
  user_type_snapshot: "faculty",
  user_type_snapshot_display: "Faculty",
  total_time_minutes: 120,
  total_hours: 2,
  total_charge: "1234.00",
  input_values: { A: "4", B: "pwd", comments: "Grind gently", _sample_sets: [{ A: "2", B: "liq" }] },
  input_fields: [
    { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC" },
    { field_key: "B", field_label: "Sample form", field_type: "RADIO", options: [{ value: "pwd", label: "Powder" }, { value: "liq", label: "Liquid" }] },
    { field_key: "comments", field_label: "Comments", field_type: "TEXT" },
  ],
  selected_parameters: null,
  charge_breakdown: [{ amount: 1234, description: "Analysis charge" }],
  status: "BOOKED",
  status_display: "Booked",
  notes: "",
  start_time: "2026-10-06T10:00:00+05:30",
  end_time: "2026-10-06T12:00:00+05:30",
  daily_slots: [],
  sample_trace: [],
  accounts_in_charge: { user_id: 11, name: "Accounts Person", email: "acc@example.org" },
  lab_in_charge: { user_id: 12, name: "Lab Person" },
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
} as unknown as BookingDetailCardBooking;

function renderCard(props: { isOperator: boolean; isManagerOrAdmin?: boolean; currentUserType: string; currentUserId: number }) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BookingDetailCard booking={booking} onClose={() => {}} onUpdated={() => {}} {...props} />
    </MemoryRouter>,
  );
}

describe("BookingDetailCard job sheet", () => {
  it("gives Lab Operators the job sheet with the requirements table and no charges or billing", () => {
    const html = renderCard({ isOperator: true, currentUserType: "operator", currentUserId: 99 });
    expect(html).toContain("Job sheet");
    expect(html).toContain("Print job sheet");
    expect(html).toContain("Prof. Asha Verma");
    expect(html).toContain('href="tel:+919876543210"');
    expect(html).toContain('href="mailto:asha@example.org"');
    expect(html).toContain("Instructions from the user");
    expect(html).toContain("Grind gently");
    expect(html).toContain("Set 2");
    expect(html).toContain("Liquid");
    for (const hidden of ["₹", "1,234", "Total Cost", "Charge Breakdown", "Invoice", "Accounts Person"]) {
      expect(html, hidden).not.toContain(hidden);
    }
  });

  it("shows Lab Operators the laser parts, the own-material flag and DXF downloads", () => {
    const laser = {
      ...booking,
      equipment_profile_type: "LASER_CUT_2D",
      own_material: true,
      fabrication_parts: [
        {
          kind: "laser",
          analysis_id: "a1",
          name: "Bracket",
          filename: "bracket.dxf",
          quantity: 5,
          material_name: "Acrylic sheet 3 mm",
          width_mm: "200.00",
          height_mm: "100.00",
          area_mm2: "20000.00",
          time_estimate: {
            cut_length_mm: 996.4,
            pierces: 6,
            cut_speed_mm_s: 16,
            pierce_s: 0.5,
            seconds_each: 72.4,
            cutting_seconds_each: 66,
            pierce_seconds_each: 4.2,
            travel_seconds_each: 2.2,
            minutes_total: 6,
            warning: null,
          },
        },
      ],
      laser_time_estimate: {
        preset: "co2_laser",
        preset_label: "CO2 laser cutter (non-metals, 80-150 W)",
        cutting_min: 6,
        setup_min: 10,
        sheets: 1,
        sheet_min: 3,
        allowance_pct: 10,
        allowance_min: 1.9,
        total_min: 21,
        warnings: [],
      },
      fabrication_file_changes: [],
      fabrication_files_replaceable: { allowed: false, reason: null },
    } as unknown as BookingDetailCardBooking;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BookingDetailCard booking={laser} onClose={() => {}} onUpdated={() => {}} isOperator currentUserType="operator" currentUserId={99} />
      </MemoryRouter>,
    );
    expect(html).toContain("Job sheet");
    expect(html).toContain("Laser cutting parts");
    expect(html).toContain("Acrylic sheet 3 mm · 200 × 100 mm (0.0200 m² each)");
    expect(html).toContain("User brings own material");
    expect(html).toContain("Download bracket.dxf");
    expect(html).toContain("Machine time: 1 min 12 s each · 996 mm cut · 6 pierces");
    expect(html).toContain("Estimated machine time");
    expect(html).toContain("21 min");
    expect(html).toContain("Loading 1 sheet");
  });

  it("leaves the booking owner's view unchanged", () => {
    const html = renderCard({ isOperator: false, currentUserType: "faculty", currentUserId: 7 });
    expect(html).not.toContain("Job sheet");
    expect(html).toContain("Total Cost");
    expect(html).toContain("Charge Breakdown");
    expect(html).toContain("For Invoice Related Query");
  });

  it("shows Accounts the return shipping actions once an external user's sample is analysed", () => {
    const external = (status: string) =>
      ({
        ...booking,
        user_type_snapshot: "industry",
        user_type_snapshot_display: "Industry",
        sample_return_after_analysis: true,
        status,
        status_display: status,
      }) as unknown as BookingDetailCardBooking;
    const asFinance = (b: BookingDetailCardBooking) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <BookingDetailCard
            booking={b}
            onClose={() => {}}
            onUpdated={() => {}}
            isOperator={false}
            currentUserType="finance"
            currentUserId={11}
          />
        </MemoryRouter>,
      );
    expect(asFinance(external("COMPLETED"))).toContain("Return shipping label");
    expect(asFinance(external("BOOKED"))).not.toContain("Return shipping label");
  });

  describe("deadlines for Lab Operators", () => {
    const withDeadlines = (over: Record<string, unknown> = {}) =>
      ({
        ...booking,
        lifecycle_countdown: {
          enabled: true,
          phase: "submit_sample",
          started_at: "2026-10-01T10:00:00Z",
          deadline_at: "2099-10-06T04:30:00Z",
        },
        results_deadline: {
          value: 2,
          unit: "WORKING_DAYS",
          label: "within 2 working days after the slot",
          due_at: "2099-10-08T18:29:59Z",
          due_display: "Thu 08 Oct",
          extended: false,
          overdue: false,
          visible_to_user: true,
        },
        ...over,
      }) as unknown as BookingDetailCardBooking;
    const render = (b: BookingDetailCardBooking, props: { isOperator: boolean; isManagerOrAdmin?: boolean; currentUserType: string; currentUserId: number }) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <BookingDetailCard booking={b} onClose={() => {}} onUpdated={() => {}} {...props} />
        </MemoryRouter>,
      );
    const operator = { isOperator: true, currentUserType: "operator", currentUserId: 99 };

    it("hides the booking user's Time remaining countdown and the results date before Sample Accepted", () => {
      const html = render(withDeadlines(), operator);
      expect(html).not.toContain("Time remaining");
      expect(html).not.toContain("job-sheet-results-due");
      expect(html).not.toContain("Results due");
    });

    it("shows the results deadline once the sample is accepted, flagged when overdue", () => {
      const accepted = [{ status: "SAMPLE_ACCEPTED", created_at: "2026-10-06T05:00:00Z" }];
      const due = render(withDeadlines({ sample_trace: accepted }), operator);
      expect(due).not.toContain("Time remaining");
      expect(due).toContain("job-sheet-results-due");
      expect(due).toContain("Results deadline");

      const late = render(
        withDeadlines({
          sample_trace: accepted,
          results_deadline: { ...(withDeadlines().results_deadline as object), overdue: true },
        }),
        operator,
      );
      expect(late).toContain("Results deadline (passed)");
    });

    it("shows when results become overdue, and the overdue hours after that", () => {
      const accepted = [{ status: "SAMPLE_ACCEPTED", created_at: "2026-10-06T05:00:00Z" }];
      const resultsOverdue = {
        hours: 24,
        label: "24 hours after the booking end",
        due_at: "2099-10-07T13:01:00Z",
        due_display: "Wed 07 Oct 2099, 06:31 PM",
        overdue: false,
        overdue_by: null,
        waiting_for_user: false,
        extended: false,
        anchor_at: "2099-10-06T13:01:00Z",
        slot_end_at: "2099-10-06T09:00:00Z",
        sample_received_at: "2099-10-06T10:31:00Z",
        booked_minutes: 150,
        counted_from_receipt: true,
        visible_to_user: false,
      };
      const due = render(withDeadlines({ sample_trace: accepted, results_overdue: resultsOverdue }), operator);
      expect(due).toContain("job-sheet-results-overdue");
      expect(due).toContain("Results due by");
      expect(due).toContain("Wed 07 Oct 2099, 06:31 PM");

      const late = render(
        withDeadlines({ sample_trace: accepted, results_overdue: { ...resultsOverdue, overdue: true, overdue_by: "13 h" } }),
        operator,
      );
      expect(late).toContain("Results overdue");
      expect(late).toContain("by 13 h (due by Wed 07 Oct 2099, 06:31 PM)");
    });

    it("still shows the countdown to the booking user, not to the Officer In Charge", () => {
      expect(render(withDeadlines(), { isOperator: false, currentUserType: "faculty", currentUserId: 7 })).toContain(
        "Time remaining to submit sample",
      );
      expect(
        render(withDeadlines(), { isOperator: false, isManagerOrAdmin: true, currentUserType: "manager", currentUserId: 50 }),
      ).not.toContain("Time remaining to submit sample");
    });
  });

  it("leaves the Officer In Charge's view unchanged", () => {
    const html = renderCard({ isOperator: false, isManagerOrAdmin: true, currentUserType: "manager", currentUserId: 50 });
    expect(html).not.toContain("Job sheet");
    expect(html).toContain("Total Cost");
    expect(html).toContain("Charge Breakdown");
  });
});
