// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SlotExchangeOptions } from "@/lib/api";

const getOptions = vi.fn();
const create = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getSlotExchangeOptions: (...args: unknown[]) => getOptions(...args),
    createSlotExchange: (...args: unknown[]) => create(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import BookedSlotDialog from "./BookedSlotDialog";

const slot = (id: number, label: string) => ({ id, start: "", end: "", label });

const options: SlotExchangeOptions = {
  slot_id: 11,
  booking_id: 5,
  booking_ref: "IICXRD0005",
  booker: {
    name: "Asha Verma",
    email: "asha@iitr.ac.in",
    phone: "9876500000",
    user_type: "student",
    user_type_display: "IITR Student",
    department: "Chemistry",
    department_code: "CY",
  },
  is_own_booking: false,
  equipment: { id: 1, name: "XRD", code: "XRD", slot_exchange_enabled: true },
  their_slots: [slot(11, "Wed 04 Nov 2026, 10:00–11:00"), slot(12, "Wed 04 Nov 2026, 11:00–12:00")],
  their_per_slot_charge: "100.00",
  exchange_available: true,
  exchange_unavailable_reason: null,
  my_bookings: [
    {
      booking_id: 9,
      booking_ref: "IICXRD0009",
      equipment_name: "XRD",
      same_equipment: true,
      per_slot_charge: "100.00",
      slots: [slot(21, "Thu 05 Nov 2026, 10:00–11:00")],
    },
  ],
};

describe("BookedSlotDialog", () => {
  beforeEach(() => {
    getOptions.mockResolvedValue({ data: options });
    create.mockResolvedValue({ data: { id: 1 } });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the booker's details", async () => {
    render(<BookedSlotDialog slotId={11} onOpenChange={() => {}} />);
    expect(await screen.findByText("Asha Verma")).toBeTruthy();
    expect(screen.getByText("asha@iitr.ac.in")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
  });

  it("sends one slot for the clicked slot", async () => {
    const onRequested = vi.fn();
    render(<BookedSlotDialog slotId={11} onOpenChange={() => {}} onRequested={onRequested} />);
    await screen.findByText("Asha Verma");
    const send = screen.getByRole("button", { name: "Send exchange request" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true); // nothing offered yet
    fireEvent.click(screen.getByLabelText("Thu 05 Nov 2026, 10:00–11:00"));
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(create).toHaveBeenCalledWith([21], [11], ""));
    expect(onRequested).toHaveBeenCalled();
  });

  it("explains when an exchange is not possible", async () => {
    getOptions.mockResolvedValue({
      data: { ...options, exchange_available: false, exchange_unavailable_reason: "Slot Exchange is not enabled for this equipment." },
    });
    render(<BookedSlotDialog slotId={11} onOpenChange={() => {}} />);
    expect(await screen.findByText("Slot Exchange is not enabled for this equipment.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send exchange request" })).toBeNull();
  });
});
