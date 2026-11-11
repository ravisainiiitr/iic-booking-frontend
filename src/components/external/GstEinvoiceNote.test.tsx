// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ myBooking: vi.fn() }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/lib/gstEinvoiceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gstEinvoiceApi")>();
  return { ...actual, gstEinvoiceApi: { myBooking: m.myBooking } };
});

import { GstEinvoiceNote } from "./GstEinvoiceNote";

afterEach(() => cleanup());

const base = {
  number: "EBP/26-27/0001", status: "irn_generated", status_label: "E-invoice issued (IRN)", supply_type: "B2B", issued: true,
  mode: "sandbox", simulated: true, invoice_date: "2026-11-11", irn: "SIMULATED-abc", ack_number: "SIM1", total: "10620.00",
  receipt_number: "IITR/IIC/2026/TEST-00003", signed_at: null, download_url: "/x", next_step: "Download the invoice.",
} as const;

describe("GST e-invoice note", () => {
  it("shows the IRN, receipt and the sandbox warning", async () => {
    m.myBooking.mockResolvedValue({ enabled: true, invoice: base });
    render(<GstEinvoiceNote bookingId={7} />);
    expect(await screen.findByText(/Tax invoice EBP\/26-27\/0001/)).toBeTruthy();
    expect(screen.getByText(/IRN SIMULATED-abc/)).toBeTruthy();
    expect(screen.getByText(/against receipt IITR\/IIC\/2026\/TEST-00003/)).toBeTruthy();
    expect(screen.getByText(/not a valid tax invoice \(simulated IRN\)/)).toBeTruthy();
  });

  it("explains the DSC step for a buyer without GSTIN", async () => {
    m.myBooking.mockResolvedValue({
      enabled: true,
      invoice: { ...base, supply_type: "B2C", status: "awaiting_signature", status_label: "Waiting for the signatory's DSC", issued: false, irn: "", next_step: "SRIC's authorised signatory signs it with their DSC; it appears here once signed." },
    });
    render(<GstEinvoiceNote bookingId={7} />);
    expect(await screen.findByText(/signs it with their DSC/)).toBeTruthy();
  });

  it("renders nothing when the module is off or there is no invoice", async () => {
    m.myBooking.mockResolvedValue({ enabled: false, invoice: null });
    const { container } = render(<GstEinvoiceNote bookingId={7} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});
