// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: 1, user_type: "admin" } as { id: number; user_type: string } }));
const api = vi.hoisted(() => ({ adminGetReceiptTemplate: vi.fn(), adminSaveReceiptTemplate: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/lib/paymentReceiptPdf", async (orig) => ({
  ...(await orig<typeof import("@/lib/paymentReceiptPdf")>()),
  generatePaymentReceiptPdf: vi.fn(async () => new Blob(["%PDF"], { type: "application/pdf" })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminReceiptTemplate, { sampleReceipt } from "./AdminReceiptTemplate";

const blank = {
  institution_name: "", office_name: "", address: "", institute_gstin: "", contact_email: "", website: "",
  receipt_heading: "", service_name: "", not_a_tax_invoice: "", refund_note: "", extra_note: "", computer_generated: "",
  brand_color: "", accent_color: "", show_gstin: true, show_logo: true, show_watermark: true,
};
const defaults = {
  ...blank, institution_name: "Indian Institute of Technology Roorkee", office_name: "Sponsored Research & Industrial Consultancy (SRIC)",
  address: "Roorkee – 247667, Uttarakhand, India", institute_gstin: "05AAALI0033R1Z5", contact_email: "arsric@iitr.ac.in",
  website: "equip.iitr.ac.in", receipt_heading: "Payment Receipt", service_name: "IIT Roorkee Equipment Booking Portal",
  not_a_tax_invoice: "Not a tax invoice.", refund_note: "Refunds go to the wallet.", computer_generated: "Computer generated.",
  brand_color: "#153F79", accent_color: "#C29938",
};
const state = (stored = blank) => ({
  stored, defaults, effective: { ...defaults, ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== "")) },
  updated_at: null, updated_by: "", collected_by: "DEAN SRIC IIT ROORKEE",
  history: [{ changed_at: "2026-11-08T10:00:00Z", changed_by: "Main Admin", fields: ["office_name"] }],
});

const renderPage = () => render(<MemoryRouter><AdminReceiptTemplate /></MemoryRouter>);

beforeEach(() => {
  auth.user = { id: 1, user_type: "admin" };
  api.adminGetReceiptTemplate.mockResolvedValue({ data: state() });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Receipt template page", () => {
  it("shows the defaults as placeholders, the fixed collector name and the change history", async () => {
    renderPage();
    const office = (await screen.findByLabelText("Office")) as HTMLInputElement;
    expect(office.value).toBe("");
    expect(office.placeholder).toContain("SRIC");
    expect(screen.getByText(/DEAN SRIC IIT ROORKEE/)).toBeTruthy();
    expect(screen.getByText(/changed office name/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Save template/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends only the changed fields and shows the server's message beside a field", async () => {
    api.adminSaveReceiptTemplate.mockResolvedValueOnce({ error: "Some values need correcting.", status: 400,
      fieldErrors: { institute_gstin: "Not a valid GSTIN (15 characters, e.g. 05AAALI0033R1Z5)." } });
    renderPage();
    fireEvent.change(await screen.findByLabelText("GSTIN"), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText("Office"), { target: { value: "Office of Dean SRIC" } });
    fireEvent.click(screen.getByRole("button", { name: /Save template/ }));
    await waitFor(() => expect(api.adminSaveReceiptTemplate).toHaveBeenCalledWith({ institute_gstin: "12345", office_name: "Office of Dean SRIC" }));
    expect(await screen.findByText(/Not a valid GSTIN/)).toBeTruthy();

    api.adminSaveReceiptTemplate.mockResolvedValueOnce({ data: state({ ...blank, office_name: "Office of Dean SRIC" }) });
    fireEvent.change(screen.getByLabelText("GSTIN"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Save template/ }));
    await waitFor(() => expect(api.adminSaveReceiptTemplate).toHaveBeenLastCalledWith({ office_name: "Office of Dean SRIC" }));
    expect(await screen.findByText("All changes saved")).toBeTruthy();
  });

  it("refuses a main colour too light for white text before sending", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Main colour"), { target: { value: "#FFEE88" } });
    expect(screen.getAllByText(/Too light/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Save template/ }));
    expect(api.adminSaveReceiptTemplate).not.toHaveBeenCalled();
  });

  it("builds the preview from the values on screen, hiding the GSTIN when switched off", () => {
    const r = sampleReceipt({ ...defaults, show_gstin: false, office_name: "Office X" }, "DEAN SRIC IIT ROORKEE");
    expect(r.institute_gstin).toBe("");
    expect(r.office).toBe("Office X");
    expect(r.template?.show_gstin).toBe(false);
  });

  it("sends other users back to the dashboard", async () => {
    auth.user = { id: 2, user_type: "finance" };
    renderPage();
    await waitFor(() => expect(api.adminGetReceiptTemplate).not.toHaveBeenCalled());
  });
});
