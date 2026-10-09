// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UrgentAllocationQuote, UrgentAllocationSlot } from "@/lib/api";
import UrgentAllocateDialog, { firstBackToBackRun, slotOverrideReasons, type UrgentAllocateTarget } from "./UrgentAllocateDialog";

const api = vi.hoisted(() => ({
  getUrgentAllocationSlots: vi.fn(),
  quoteUrgentAllocation: vi.fn(),
  allocateUrgentRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const slot = (id: number, date: string, from: string, to: string, extra: Partial<UrgentAllocationSlot> = {}): UrgentAllocationSlot => ({
  id,
  date,
  past: false,
  start_datetime: `${date}T${from}:00`,
  end_datetime: `${date}T${to}:00`,
  status: "AVAILABLE",
  status_display: "Available",
  selectable: true,
  notes: [],
  booked_by: null,
  ...extra,
});

const SLOTS = [
  slot(14, "2026-10-09", "09:00", "10:00"),
  slot(11, "2026-10-10", "09:00", "10:00"),
  slot(12, "2026-10-10", "10:00", "11:00", { status: "NOT_AVAILABLE", status_display: "Not Available" }),
  slot(13, "2026-10-10", "11:00", "12:00", { status: "BOOKED", status_display: "Booked", selectable: false, booked_by: "Another user" }),
];

const HOLIDAYS = { "2026-10-09": "Founders Day" };

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
  samples: "2 samples",
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
  api.getUrgentAllocationSlots.mockResolvedValue({
    data: { date: "2026-10-05", is_weekend: false, holiday: null, holidays: HOLIDAYS, slot_duration_minutes: 60, required_minutes: 90, required_slots: 2, slots: SLOTS },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const renderDialog = (onAllocated = vi.fn()) =>
  render(<UrgentAllocateDialog open onOpenChange={() => {}} request={target} onAllocated={onAllocated} />);

const cell = (name: RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Approve & allocate weekly calendar", () => {
  it("loads the whole week and shows every slot, with weekend and holiday headers", async () => {
    renderDialog();
    await waitFor(() =>
      expect(api.getUrgentAllocationSlots).toHaveBeenCalledWith(7, { start_date: "2026-10-05", end_date: "2026-10-11" }),
    );
    expect(screen.getByTestId("urgent-requirement-time").textContent).toContain("1 h 30 min");
    expect(screen.getByText("Any day this week")).toBeTruthy();
    const calendar = await screen.findByTestId("urgent-alloc-calendar");
    expect(within(calendar).getAllByText("Weekend").length).toBeGreaterThan(0);
    expect(within(calendar).getByText("Founders Day")).toBeTruthy();
    expect(cell(/Friday 9 October 09:00 – 10:00/).disabled).toBe(false);
    expect(cell(/Saturday 10 October 10:00 – 11:00, Not Available/).disabled).toBe(false);
    expect(cell(/Saturday 10 October 11:00 – 12:00, Booked, booked by someone else/).disabled).toBe(true);
  });

  it("allocates Not Available and weekend slots with a warning, after checking the amount", async () => {
    api.quoteUrgentAllocation.mockResolvedValue({ data: quote() });
    api.allocateUrgentRequest.mockResolvedValue({
      data: { message: "Booking allocated.", id: 7, status: "APPROVED", booking_id: 99, booking_display_id: "B-99", total_charge: "1350.00", slot_times: [] },
    });
    const onAllocated = vi.fn();
    renderDialog(onAllocated);
    await screen.findByTestId("urgent-alloc-calendar");
    fireEvent.click(cell(/Saturday 10 October 10:00 – 11:00/));
    fireEvent.click(cell(/Saturday 10 October 09:00 – 10:00/));
    const warning = screen.getByTestId("urgent-alloc-override-warning");
    expect(warning.textContent).toContain("Not Available");
    expect(warning.textContent).toContain("Weekend");
    expect(screen.getByTestId("urgent-alloc-running-total").textContent).toContain("2 slots · 2 h of 1 h 30 min");
    await waitFor(() => expect(api.quoteUrgentAllocation).toHaveBeenCalledWith(7, [11, 12]));
    expect(await screen.findByTestId("urgent-alloc-quote")).toBeTruthy();
    const allocate = screen.getByRole("button", { name: /Allocate booking/ }) as HTMLButtonElement;
    await waitFor(() => expect(allocate.disabled).toBe(false));
    fireEvent.click(allocate);
    await waitFor(() =>
      expect(api.allocateUrgentRequest).toHaveBeenCalledWith(7, { slot_ids: [11, 12], expected_total: "1350.00", admin_notes: undefined }),
    );
    expect(onAllocated).toHaveBeenCalled();
  });

  it("opens any later week and keeps the selection", async () => {
    renderDialog();
    await screen.findByTestId("urgent-alloc-calendar");
    fireEvent.click(cell(/Friday 9 October 09:00 – 10:00/));
    fireEvent.click(screen.getByRole("button", { name: /Next Week/ }));
    await waitFor(() =>
      expect(api.getUrgentAllocationSlots).toHaveBeenCalledWith(7, { start_date: "2026-10-12", end_date: "2026-10-18" }),
    );
    expect(screen.getByTestId("urgent-alloc-running-total").textContent).toContain("1 slot");
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
    await screen.findByTestId("urgent-alloc-calendar");
    fireEvent.click(screen.getByRole("button", { name: /Select 2 back-to-back slots/ }));
    const shortfall = await screen.findByTestId("urgent-alloc-shortfall");
    expect(shortfall.textContent).toContain("Shortfall");
    expect(shortfall.textContent).toContain("350");
    expect((screen.getByRole("button", { name: /Allocate booking/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.allocateUrgentRequest).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("finds consecutive free slots and skips booked ones", () => {
    const day = SLOTS.slice(1);
    expect(firstBackToBackRun(day, 2)).toEqual([11, 12]);
    expect(firstBackToBackRun(day, 3)).toEqual([]);
    expect(firstBackToBackRun(day, 1)).toEqual([11]);
  });

  it("names why a slot is outside normal booking", () => {
    expect(slotOverrideReasons(SLOTS[0], HOLIDAYS)).toEqual(["Holiday: Founders Day"]);
    expect(slotOverrideReasons(SLOTS[2], HOLIDAYS)).toEqual(["Weekend", "Not Available"]);
    expect(slotOverrideReasons(slot(1, "2026-10-07", "09:00", "10:00"), HOLIDAYS)).toEqual([]);
  });
});
