// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  status: vi.fn(),
  invoices: vi.fn(),
  certificates: vi.fn(),
  devices: vi.fn(),
  register: vi.fn(),
  gstr1Preview: vi.fn(),
  downloadGstr1: vi.fn(),
  invoice: vi.fn(),
  allowCreditNote: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/gstEinvoiceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gstEinvoiceApi")>();
  return { ...actual, gstEinvoiceApi: {
      status: m.status,
      invoices: m.invoices,
      certificates: m.certificates,
      devices: m.devices,
      register: m.register,
      gstr1Preview: m.gstr1Preview,
      downloadGstr1: m.downloadGstr1,
      invoice: m.invoice,
      allowCreditNote: m.allowCreditNote,
    },
  };
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

  it("offers the GSTR-1 B2C export with each month's warnings", async () => {
    m.status.mockResolvedValue(status);
    m.certificates.mockResolvedValue({ results: [] });
    m.invoices.mockResolvedValue({ results: [] });
    m.register.mockResolvedValue({
      year: 2026, month: 11, mode: "sandbox", rows: [], series: [],
      totals: { taxable_value: "0", cgst: "0", sgst: "0", igst: "0", total: "0" },
      counts: { b2b: 0, b2c: 0, not_yet_issued: 0 },
    });
    m.gstr1Preview.mockResolvedValue({
      b2cl_limit: "100000.00",
      months: [
        {
          fp: "112026", from: "2026-11-01", to: "2026-11-30",
          warnings: ["No credit notes: the portal issues none; the CDNUR section is empty."],
          summary: {
            b2c_invoices: 4, b2cl_invoices: 1, b2cs_rows: 2, credit_notes: 0, credit_notes_available: false,
            taxable_value: "28800.00", tax: "5184.00", documents_issued: 9, unsigned_excluded: 0,
          },
        },
      ],
    });
    m.downloadGstr1.mockResolvedValue(undefined);
    render(<MemoryRouter><GstInvoices /></MemoryRouter>);
    const tab = await screen.findByRole("tab", { name: "Monthly register" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    expect(await screen.findByTestId("gstr1-112026")).toBeTruthy();
    expect(screen.getByText(/CDNUR section is empty/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /GSTR-1 JSON \(upload\)/ }));
    expect(m.downloadGstr1).toHaveBeenCalledWith(expect.any(String), expect.any(String), "json");
    for (const [name, kind] of [
      [/All files \(zip\)/, "all"],
      [/Invoice Register/, "invoice_register"],
      [/Credit Note Register/, "credit_note_register"],
      [/B2B e-invoices/, "b2b_register"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(m.downloadGstr1).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), kind);
    }
  });

  it("lets the Main Administrator allow a credit note for one issued invoice", async () => {
    m.status.mockResolvedValue({ ...status, can_administer: true, settings: { supplier_legal_name: "IITR", supplier_gstin: "05AAALI0033R1Z5", supplier_pan: "AAALI0033R", supplier_state_code: "05", review_above_amount: "200000.00", auto_issue: true, approver_emails: "" }, tax_rules: [] });
    m.certificates.mockResolvedValue({ results: [] });
    const row = { id: 1, number: "EBP/26-27/0001", invoice_date: "2026-11-11", booking_reference: "IICXRF1", is_demo: false, status: "irn_generated", status_label: "E-invoice issued (IRN)", supply_type: "B2B", total: "10620.00", buyer: { name: "Asha Labs Pvt Ltd", gstin: "07AAACX0000X1Z2" } };
    m.invoices.mockResolvedValue({ results: [row] });
    const detail = { ...row, doc_type: "INV", booking_id: 7, review_reasons: [], buyer: { ...row.buyer, gstin_status_label: "Format valid", state: "Delhi", state_code: "07", location: "New Delhi" }, place_of_supply: "07", inter_state: true, taxable_value: "9000.00", cgst: "0.00", sgst: "0.00", igst: "1620.00", round_off: "0.00", portal_total: "10620.00", irn: "abc", ack_number: "1", ack_date: null, signed_at: null, signed_by: "", delivered_at: null, created_at: "", has_pdf: true, has_signed_pdf: false, pdf_url: "/x", receipt_number: "", equipment: "", facility: "", fbr_number: "", sric_request_id: 3, invoice_number: "EBP/26-27/0001", mode: "sandbox", provider: "mock", simulated: true, supply_type_label: "", lines: [], events: [], attempts: [], credit_note_permission: null, credit_notes: [] };
    m.invoice.mockResolvedValue(detail);
    m.allowCreditNote.mockResolvedValue({ ...detail, credit_note_permission: { enabled_by: "Main Admin", reason: "XRD under maintenance", enabled_at: "2026-11-12T10:00:00+05:30" } });
    render(<MemoryRouter><GstInvoices /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "EBP/26-27/0001" }));
    expect(await screen.findByText(/Not allowed: a refund of this booking returns the base amount only/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Reason to allow/), { target: { value: "XRD under maintenance" } });
    fireEvent.click(screen.getByRole("button", { name: "Allow a credit note on refund" }));
    expect(m.allowCreditNote).toHaveBeenCalledWith(1, "XRD under maintenance");
    expect(await screen.findByText(/Allowed by Main Admin/)).toBeTruthy();
  });
});

