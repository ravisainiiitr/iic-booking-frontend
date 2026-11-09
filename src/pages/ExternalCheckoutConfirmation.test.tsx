// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  checkout: vi.fn(),
  addresses: vi.fn(),
  sampleLabelBytes: vi.fn(),
  getBooking: vi.fn(),
  getWallet: vi.fn(async () => ({ data: { balance: 0 } })),
  getBookingShippingLabelPdfBlob: vi.fn(),
  saveBlob: vi.fn(),
  mergePdfs: vi.fn(async () => new Blob(["pack"])),
}));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/externalBookingApi")>()),
  externalBookingApi: { checkout: m.checkout, addresses: m.addresses, sampleLabelBytes: m.sampleLabelBytes },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: { getBooking: m.getBooking, getWallet: m.getWallet, getBookingShippingLabelPdfBlob: m.getBookingShippingLabelPdfBlob },
}));
vi.mock("@/lib/dispatchPack", () => ({ saveBlob: m.saveBlob, mergePdfs: m.mergePdfs, dispatchPackName: (r: string) => `pack_${r}.pdf` }));
vi.mock("@/lib/externalRequisitionFormPdf", () => ({ generateExternalEquipmentRequisitionFormPdf: vi.fn(async () => new Blob(["form"])) }));
vi.mock("@/lib/receiptDownload", () => ({ bookingReceiptPdfs: vi.fn(async () => [new Blob(["receipt"])]), downloadReceipt: vi.fn() }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/external/InstitutionBanner", () => ({ InstitutionBanner: () => null }));
vi.mock("@/components/external/CheckoutSummary", () => ({ CheckoutSummary: () => null }));
vi.mock("@/components/external/SampleLabelDialog", () => ({ SampleLabelDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="label-dialog" /> : null) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ExternalCheckoutConfirmation from "./ExternalCheckoutConfirmation";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

const confirmed = {
  id: "c1", state: "confirmed", choice: "gateway", total_amount: "944.00", wallet_amount: "0", created_at: "2026-11-09T08:00:00Z",
  booking: { id: 9, reference: "IICXRD1", status: "Booked" },
  payment: { razorpay_payment_id: "pay_1", gateway_total: "944.00", convenience_fee: "0", fee_gst: "0" },
};
const booking = { input_fields: [{ field_key: "f1", field_label: "No. of Samples", field_type: "NUMERIC" }], input_values: { f1: "3" } };

const open = () =>
  render(
    <MemoryRouter initialEntries={["/external-checkout/c1/confirmation"]}>
      <Routes><Route path="/external-checkout/:checkoutId/confirmation" element={<ExternalCheckoutConfirmation />} /></Routes>
    </MemoryRouter>,
  );

describe("after the payment is confirmed", () => {
  it("downloads the label, requisition form and receipt as one PDF by itself, once", async () => {
    m.checkout.mockResolvedValue(confirmed);
    m.getBooking.mockResolvedValue({ data: booking });
    m.addresses.mockResolvedValue({ addresses: [{ id: 4, is_default: true }], sample_labels_enabled: true });
    m.sampleLabelBytes.mockResolvedValue(new ArrayBuffer(4));
    open();
    await waitFor(() => expect(m.saveBlob).toHaveBeenCalledTimes(1));
    expect(m.sampleLabelBytes).toHaveBeenCalledWith(9, { sample_count: 3, description: "", address_id: 4 });
    expect(m.mergePdfs.mock.calls[0][0]).toHaveLength(3);
    expect(m.saveBlob.mock.calls[0][1]).toBe("pack_IICXRD1.pdf");
    cleanup();
    open(); // a reload in the same tab does not download again
    await screen.findByTestId("documents-prompt");
    expect(m.saveBlob).toHaveBeenCalledTimes(1);
  });

  it("asks for the sender address when none is saved", async () => {
    m.checkout.mockResolvedValue(confirmed);
    m.getBooking.mockResolvedValue({ data: booking });
    m.addresses.mockResolvedValue({ addresses: [], sample_labels_enabled: true });
    open();
    expect(await screen.findByTestId("label-dialog")).toBeTruthy();
    expect(m.saveBlob).not.toHaveBeenCalled();
  });

  it("uses the plain label while sample labels are switched off", async () => {
    m.checkout.mockResolvedValue(confirmed);
    m.getBooking.mockResolvedValue({ data: booking });
    m.addresses.mockResolvedValue({ addresses: [], sample_labels_enabled: false });
    m.getBookingShippingLabelPdfBlob.mockResolvedValue({ blob: new Blob(["plain"]) });
    open();
    await waitFor(() => expect(m.saveBlob).toHaveBeenCalled());
    expect(m.sampleLabelBytes).not.toHaveBeenCalled();
  });
});
