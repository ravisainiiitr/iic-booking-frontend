// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BookingMaterialChargeRow, MaterialChargeOverview, MaterialChargePreview } from "@/lib/api";

const api = vi.hoisted(() => ({
  getBookingMaterialCharges: vi.fn(),
  previewBookingMaterialCharge: vi.fn(),
  createBookingMaterialCharge: vi.fn(),
  reverseBookingMaterialCharge: vi.fn(),
  getToken: vi.fn(() => "tok"),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));

import { OwnMaterialChargePanel } from "@/components/OwnMaterialChargePanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const overview = (over: Partial<MaterialChargeOverview> = {}): MaterialChargeOverview => ({
  eligible: true,
  ineligible_reason: null,
  reversal_blocked_reason: null,
  can_override_amount: false,
  profile_type: "LASER_CUT_2D",
  unit: "sheet",
  gst_percent: "0",
  discounted_profile: false,
  pending_amount: null,
  materials: [
    { id: 7, code: "MS-1", name: "Mild steel 1 mm", unit_price: "1000", thickness_mm: "1", sheet_width_mm: "600", sheet_height_mm: "300" },
    { id: 8, code: "AC-3", name: "Acrylic 3 mm", unit_price: "450.50" },
  ],
  charges: [],
  ...over,
});

const preview = (over: Partial<MaterialChargePreview> = {}): MaterialChargePreview => ({
  material_id: 7,
  material_code: "MS-1",
  material_name: "Mild steel 1 mm",
  quantity: "1",
  unit: "sheet",
  unit_label: "sheet",
  unit_price: "1000",
  material_cost: "1000.00",
  base_amount: "1000.00",
  gst_percent: "0",
  gst_amount: "0.00",
  computed_amount: "1000.00",
  amount: "1000.00",
  amount_overridden: false,
  discounted_profile: false,
  can_confirm: true,
  line: "IIC material used: Mild steel 1 mm × 1 sheet",
  collection: {
    pending_before: "0.00",
    amount_to_collect: "1000.00",
    mode: "deduct",
    message: "₹1000 will be deducted from the wallet now.",
  },
  ...over,
});

const chargeRow = (over: Partial<BookingMaterialChargeRow> = {}): BookingMaterialChargeRow => ({
  id: 31,
  line: "IIC material used: Mild steel 1 mm × 1 sheet",
  material_code: "MS-1",
  material_name: "Mild steel 1 mm",
  quantity: "1",
  unit: "sheet",
  unit_label: "sheet",
  unit_price: "1000",
  base_amount: "1000.00",
  gst_percent: "0",
  gst_amount: "0.00",
  computed_amount: "1000.00",
  amount: "1000.00",
  amount_overridden: false,
  reason: "User's sheet was insufficient",
  created_at: "2026-10-07T10:30:00+05:30",
  created_by_name: "OIC",
  deducted_from_wallet: true,
  reversed: false,
  reversed_at: null,
  reversed_by_name: "",
  reversal_reason: "",
  ...over,
});

const openDialog = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /Charge for IIC material used/ }));
};

describe("OwnMaterialChargePanel", () => {
  it("previews the amount, then posts the charge and hands the updated booking back", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({ data: overview() });
    api.previewBookingMaterialCharge.mockResolvedValue({ data: preview() });
    api.createBookingMaterialCharge.mockResolvedValue({
      data: { message: "₹1000 deducted from the wallet.", charge: chargeRow(), booking: { booking_id: 501 } },
    });
    const onUpdated = vi.fn();
    render(<OwnMaterialChargePanel bookingId={501} profileType="LASER_CUT_2D" onUpdated={onUpdated} />);

    expect(await screen.findByText(/I will bring my own sheet material/)).toBeTruthy();
    await openDialog();
    fireEvent.change(screen.getByLabelText("IIC material used"), { target: { value: "7" } });
    expect(screen.getByText(/sheet size 600 × 300 mm/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Sheets used"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "User's sheet was insufficient" } });
    expect(screen.queryByLabelText(/Amount to charge instead/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview amount" }));

    await waitFor(() =>
      expect(api.previewBookingMaterialCharge).toHaveBeenCalledWith(501, { material_id: 7, quantity: "1" }),
    );
    const box = await screen.findByTestId("own-material-preview");
    expect(box.textContent).toContain("IIC material used: Mild steel 1 mm × 1 sheet");
    expect(box.textContent).toContain("₹1000 will be deducted from the wallet now.");
    expect(api.createBookingMaterialCharge).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Confirm charge of ₹1000/ }));
    await waitFor(() =>
      expect(api.createBookingMaterialCharge).toHaveBeenCalledWith(501, {
        material_id: 7,
        quantity: "1",
        reason: "User's sheet was insufficient",
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ booking_id: 501 }));
    expect(toast.success).toHaveBeenCalledWith("₹1000 deducted from the wallet.");
    expect(api.getBookingMaterialCharges).toHaveBeenCalledTimes(2);
  });

  it("asks for the reason before previewing", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({ data: overview() });
    render(<OwnMaterialChargePanel bookingId={501} profileType="LASER_CUT_2D" />);
    await openDialog();
    fireEvent.change(screen.getByLabelText("IIC material used"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Sheets used"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview amount" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Enter the reason/);
    expect(api.previewBookingMaterialCharge).not.toHaveBeenCalled();
  });

  it("shows the amount due when the wallet cannot cover it and blocks confirm when the server says so", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({
      data: overview({ profile_type: "PRINT_3D", unit: "g", materials: [{ id: 3, code: "PLA", name: "PLA", unit_price: "1.44" }] }),
    });
    api.previewBookingMaterialCharge.mockResolvedValue({
      data: preview({
        material_id: 3,
        unit: "g",
        unit_label: "g",
        quantity: "41",
        unit_price: "1.44",
        amount: "59.00",
        line: "IIC material used: PLA × 41 g",
        can_confirm: false,
        message: "Booking was cancelled meanwhile.",
        collection: { pending_before: "0.00", amount_to_collect: "59.00", mode: "pay_now", message: "Balance is not enough: ₹59 is added to the amount to pay." },
      }),
    });
    render(<OwnMaterialChargePanel bookingId={77} profileType="PRINT_3D" />);
    expect(await screen.findByText(/I will bring my own printing material/)).toBeTruthy();
    await openDialog();
    expect(screen.getByRole("option", { name: /PLA \(PLA\) — ₹1\.44 per g/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Material used (g)"), { target: { value: "40.2" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Spool ran out" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview amount" }));

    await waitFor(() => expect(api.previewBookingMaterialCharge).toHaveBeenCalledWith(77, { material_id: 3, quantity: "40.2" }));
    expect(await screen.findByText(/₹59 is added to the amount to pay/)).toBeTruthy();
    expect(screen.getByText("Booking was cancelled meanwhile.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Confirm charge/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the Main Administrator's override amount", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({ data: overview({ can_override_amount: true }) });
    api.previewBookingMaterialCharge.mockResolvedValue({
      data: preview({ amount: "800.00", amount_overridden: true }),
    });
    render(<OwnMaterialChargePanel bookingId={501} profileType="LASER_CUT_2D" />);
    await openDialog();
    fireEvent.change(screen.getByLabelText("IIC material used"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Sheets used"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Amount to charge instead/), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Offcut used" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview amount" }));
    await waitFor(() =>
      expect(api.previewBookingMaterialCharge).toHaveBeenCalledWith(501, { material_id: 7, quantity: "1", override_amount: "800" }),
    );
    expect(await screen.findByText("Amount set by the Main Administrator")).toBeTruthy();
  });

  it("explains why a booking cannot be charged", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({
      data: overview({ eligible: false, ineligible_reason: "This booking is cancelled, so material cannot be charged.", materials: [] }),
    });
    render(<OwnMaterialChargePanel bookingId={9} profileType="LASER_CUT_2D" />);
    expect((await screen.findByTestId("own-material-ineligible")).textContent).toContain("cancelled");
    expect(screen.queryByRole("button", { name: /Charge for IIC material used/ })).toBeNull();
  });

  it("renders nothing for users who may not charge", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({ error: "Only the Officer In Charge …", status: 403 });
    const { container } = render(<OwnMaterialChargePanel bookingId={9} profileType="PRINT_3D" />);
    await waitFor(() => expect(api.getBookingMaterialCharges).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("lists charges and reverses one with a reason", async () => {
    api.getBookingMaterialCharges.mockResolvedValue({
      data: overview({
        charges: [
          chargeRow(),
          chargeRow({ id: 32, deducted_from_wallet: false, reversed: true, reversed_at: "2026-10-07T11:00:00+05:30", reversal_reason: "Entered twice" }),
        ],
      }),
    });
    api.reverseBookingMaterialCharge.mockResolvedValue({
      data: { message: "Charge reversed. ₹1000 awaits refund confirmation.", charge: chargeRow({ reversed: true }), booking: { booking_id: 501 } },
    });
    const onUpdated = vi.fn();
    render(<OwnMaterialChargePanel bookingId={501} profileType="LASER_CUT_2D" onUpdated={onUpdated} />);

    expect(await screen.findByText("Deducted from wallet")).toBeTruthy();
    expect(screen.getByText("Reversed")).toBeTruthy();
    expect(screen.getByText(/Reversed 07-10-2026 11:00/)).toBeTruthy();
    const reverseButtons = screen.getAllByRole("button", { name: /Reverse/ });
    expect(reverseButtons).toHaveLength(1);

    fireEvent.click(reverseButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reverse charge" }));
    expect(toast.error).toHaveBeenCalledWith("Enter the reason for the reversal.");
    expect(api.reverseBookingMaterialCharge).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for the reversal"), { target: { value: "Charged in error" } });
    fireEvent.click(screen.getByRole("button", { name: "Reverse charge" }));
    await waitFor(() => expect(api.reverseBookingMaterialCharge).toHaveBeenCalledWith(501, 31, "Charged in error"));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ booking_id: 501 }));
  });
});
