// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UrgentAllocationQuote, UrgentAllocationSlot } from "@/lib/api";
import UrgentAllocateDialog, { firstBackToBackRun, type UrgentAllocateTarget } from "./UrgentAllocateDialog";

const api = vi.hoisted(() => ({
  getUrgentAllocationSlots: vi.fn(),
  quoteUrgentAllocation: vi.fn(),
  allocateUrgentRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const slot = (id: number, start: string, end: string, extra: Partial<UrgentAllocationSlot> = {}): UrgentAllocationSlot => ({
  id,
  start_datetime: start,
  end_datetime: end,
  status: "AVAILABLE",
  status_display: "Available",
  selectable: true,
  notes: [],
  booked_by: null,
  ...extra,
});

const SLOTS = [
  slot(11, "2026-10-10T09:00:00+05:30", "2026-10-10T10:00:00+05:30", { notes: ["Weekend"] }),
  slot(12, "2026-10-10T10:00:00+05:30", "2026-10-10T11:00:00+05:30", { notes: ["Weekend"] }),
  slot(13, "2026-10-10T11:00:00+05:30", "2026-10-10T12:00:00+05:30", {
    status: "BOOKED",
    status_display: "Booked",
    selectable: false,
  }),
];

const quote = (overrides: Partial<UrgentAllocationQuote> = {}): UrgentAllocationQuote => ({
  required_minutes: 90,
  required_slots: 2,
  slot_duration_minutes: 60,
  total_charge: "1350.00",
  urgent_surcharge_amount: "450.00",
  gst_percent: 0,
  gst_amount: "0.00",
  charge_breakdown: [{ description: "Urgent surcharge (50%)", amount: 450 }],
  slot_minutes: 120,
  covers_required_time: true,
  slot_ids: [11, 12],
  slot_times: [],
  warnings: ["Some chosen slots are outside normal booking (Weekend)."],
  submitted_estimate: "1350.00",
  amount_changed: false,
  wallet: { has_wallet: true, available: "5000.00", sufficient: true, shortfall: "0.00", message: "" },
  can_allocate: true,
  ...overrides,
});

const target: UrgentAllocateTarget = {
  id: 7,
  user_name: "Requester",
  user_email: "requester@example.test",
  equipment_name: "Test equipment",
  requirement: {
    input_values_by_key: { A: 2 },
    input_fields: [],
    input_summary: [{ key: "A", label: "Samples", value: "2" }],
    required_minutes: 90,
    required_slots: 2,
    estimated_charge: "1350.00",
    estimated_charge_breakdown: [],
    preferred_schedule: "Any day this week",
  },
};

beforeEach(() => {
  api.getUrgentAllocationSlots.mockResolvedValue({
    data: { date: "2026-10-10", is_weekend: true, holiday: null, slot_duration_minutes: 60, required_minutes: 90, required_slots: 2, slots: SLOTS },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDialog = (onAllocated = vi.fn()) =>
  render(<UrgentAllocateDialog open onOpenChange={() => {}} request={target} onAllocated={onAllocated} />);

describe("Approve & allocate dialog", () => {
  it("shows the user's requirement and every slot of the day, including weekend warnings", async () => {
    renderDialog();
    expect(screen.getByTestId("urgent-requirement-time").textContent).toContain("1 h 30 min");
    expect(screen.getByText("Any day this week")).toBeTruthy();
    expect(await screen.findByText("Weekend")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect((screen.getAllByRole("checkbox")[2] as HTMLButtonElement).disabled).toBe(true);
  });

  it("checks the amount and allocates with the amount shown", async () => {
    api.quoteUrgentAllocation.mockResolvedValue({ data: quote() });
    api.allocateUrgentRequest.mockResolvedValue({
      data: { message: "Booking allocated.", id: 7, status: "APPROVED", booking_id: 99, booking_display_id: "B-99", total_charge: "1350.00", slot_times: [] },
    });
    const onAllocated = vi.fn();
    renderDialog(onAllocated);
    await screen.findByText("Weekend");
    fireEvent.click(screen.getByRole("button", { name: /Select 2 back-to-back slots/ }));
    await waitFor(() => expect(api.quoteUrgentAllocation).toHaveBeenCalledWith(7, [11, 12]));
    expect(await screen.findByTestId("urgent-alloc-quote")).toBeTruthy();
    expect(screen.getByText(/outside normal booking/)).toBeTruthy();
    const allocate = screen.getByRole("button", { name: /Allocate booking/ }) as HTMLButtonElement;
    await waitFor(() => expect(allocate.disabled).toBe(false));
    fireEvent.click(allocate);
    await waitFor(() =>
      expect(api.allocateUrgentRequest).toHaveBeenCalledWith(7, { slot_ids: [11, 12], expected_total: "1350.00", admin_notes: undefined }),
    );
    expect(onAllocated).toHaveBeenCalled();
  });

  it("blocks allocation and shows the shortfall when the wallet is short", async () => {
    api.quoteUrgentAllocation.mockResolvedValue({
      data: quote({
        can_allocate: false,
        wallet: {
          has_wallet: true,
          available: "1000.00",
          sufficient: false,
          shortfall: "350.00",
          message: "Insufficient wallet balance. Required: ₹1350.00, Available: ₹1000.00",
        },
      }),
    });
    renderDialog();
    await screen.findByText("Weekend");
    fireEvent.click(screen.getByRole("button", { name: /Select 2 back-to-back slots/ }));
    const shortfall = await screen.findByTestId("urgent-alloc-shortfall");
    expect(shortfall.textContent).toContain("Shortfall");
    expect(shortfall.textContent).toContain("350");
    expect((screen.getByRole("button", { name: /Allocate booking/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.allocateUrgentRequest).not.toHaveBeenCalled();
  });
});

describe("firstBackToBackRun", () => {
  it("finds consecutive free slots and skips booked ones", () => {
    expect(firstBackToBackRun(SLOTS, 2)).toEqual([11, 12]);
    expect(firstBackToBackRun(SLOTS, 3)).toEqual([]);
    expect(firstBackToBackRun(SLOTS, 1)).toEqual([11]);
  });
});
