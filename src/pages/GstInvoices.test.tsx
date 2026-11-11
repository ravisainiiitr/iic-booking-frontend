// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ status: vi.fn(), invoices: vi.fn(), certificates: vi.fn(), devices: vi.fn() }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/gstEinvoiceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gstEinvoiceApi")>();
  return { ...actual, gstEinvoiceApi: { status: m.status, invoices: m.invoices, certificates: m.certificates, devices: m.devices } };
});

import GstInvoices from "./GstInvoices";

afterEach(() => cleanup());

const status = {
  enabled: true, mode: "sandbox", provider: "mock", provider_label: "Simulated sandbox (mock)", simulated: true, sandbox_host: "einv-apisandbox.nic.in",
  problem: "", production_available: false, can_review: true, can_administer: false, is_signatory: false,
  counts: { pending_review: 1, rejected: 0, submitting: 0, submission_failed: 0, submission_uncertain: 0, irn_generated: 2, awaiting_signature: 1, signed: 0 },
};

describe("GST invoices page", () => {
  it("shows the sandbox banner and the invoice list to a reviewer", async () => {
    m.status.mockResolvedValue(status);
    m.certificates.mockResolvedValue({ results: [] });
    m.invoices.mockResolvedValue({
      results: [{ id: 1, number: "EBP/26-27/0001", invoice_date: "2026-11-11", booking_reference: "IICXRF1", is_demo: false, status: "irn_generated", status_label: "E-invoice issued (IRN)", supply_type: "B2B", total: "10620.00", buyer: { name: "Asha Labs Pvt Ltd", gstin: "07AAACX0000X1Z2" } }],
    });
    render(<MemoryRouter><GstInvoices /></MemoryRouter>);
    expect(await screen.findByText(/Sandbox demonstration: nothing here is a real tax invoice/)).toBeTruthy();
    expect(await screen.findByText("EBP/26-27/0001")).toBeTruthy();
    expect(screen.getByText(/1 waiting for the DSC/)).toBeTruthy();
  });

  it("points to the e-mail route when switched off", async () => {
    m.status.mockResolvedValue({ ...status, enabled: false });
    render(<MemoryRouter><GstInvoices /></MemoryRouter>);
    expect(await screen.findByText(/Invoice requests to SRIC/)).toBeTruthy();
  });
});
