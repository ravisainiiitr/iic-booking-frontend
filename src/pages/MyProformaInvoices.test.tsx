// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import MyProformaInvoices from "./MyProformaInvoices";
import AdminProformaInvoices from "./AdminProformaInvoices";
import { readRevisingProforma } from "@/lib/savedProformas";
import { readProformaLineItemsFromStorage } from "@/lib/proformaInvoiceStorage";

const api = vi.hoisted(() => ({
  getMyProformaInvoices: vi.fn(),
  getProformaInvoice: vi.fn(),
  cancelProformaInvoice: vi.fn(),
  getStaffProformaInvoices: vi.fn(),
  downloadProformaFile: vi.fn(),
  payProformaInvoiceOnline: vi.fn(),
  recordProformaOfflinePayment: vi.fn(),
  getDepartmentsForRecharge: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { user_type: "external" } as { user_type: string } }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  heroButtonClass: { secondary: "", primary: "" },
}));

const state = (over = {}) => ({
  key: "issued",
  label: "Issued",
  credited: "0.00",
  pending: "0.00",
  reconciled: "0.00",
  outstanding: "17700.00",
  can_pay: true,
  can_edit: true,
  can_cancel: true,
  ...over,
});

const pi = (over = {}) => ({
  id: 7,
  number: "IIC-PI-20261111-1430-7F3A",
  issued_at: "2026-11-11T14:30:00+05:30",
  valid_until: "2026-12-11",
  department: { id: 3, name: "Institute Instrumentation Centre" },
  buyer: { name: "Acme Labs", organisation: "", email: "a@example.com", gstin: "" },
  user_id: 1,
  lines: [{ title: "FE-SEM (APREO)", details: ["5 slots of 1.5 hours @ ₹3,000 per slot"], taxable: "15000.00", gst: "2700.00", total: "17700.00" }],
  request_items: [{ equipment_id: 41, equipment_code: "APREO", equipment_name: "FE-SEM", input_values: { A: 15, B: 5 } }],
  taxable_total: "15000.00",
  gst_total: "2700.00",
  total: "17700.00",
  place_of_supply: "05",
  place_of_supply_name: "Uttarakhand",
  inter_state: false,
  amount_source: "SERVER",
  revision: 0,
  replaces: "",
  replaced_by: "",
  cancel_reason: "",
  cancelled_at: null,
  state: state(),
  payments: [],
  ...over,
});

beforeEach(() => {
  auth.user = { user_type: "external" };
  sessionStorage.clear();
  api.getProformaInvoice.mockResolvedValue({ data: { ...pi(), history: [{ at: "2026-11-11T09:00:00Z", action: "issued", detail: {}, actor: "Acme" }] } });
  api.getDepartmentsForRecharge.mockResolvedValue({ data: { departments: [] } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderMine() {
  return render(
    <MemoryRouter>
      <MyProformaInvoices />
    </MemoryRouter>,
  );
}

describe("My proforma invoices", () => {
  it("lists proformas with every action an open proforma allows", async () => {
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {} } });
    renderMine();
    expect(await screen.findByText("IIC-PI-20261111-1430-7F3A")).toBeTruthy();
    expect(screen.getByTestId("pi-state-issued")).toBeTruthy();
    for (const label of ["Pay online", "Record offline payment", "Edit", "Cancel", "PDF"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it("hides pay, edit and cancel once a payment is waiting for approval", async () => {
    api.getMyProformaInvoices.mockResolvedValue({
      data: {
        results: [pi({ state: state({ key: "payment_submitted", label: "Payment submitted", pending: "17700.00", outstanding: "0.00", can_pay: false, can_edit: false, can_cancel: false }) })],
        states: {},
      },
    });
    renderMine();
    await screen.findByTestId("pi-state-payment_submitted");
    for (const label of ["Pay online", "Record offline payment", "Edit", "Cancel"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${label}`) })).toBeNull();
    }
  });

  it("offers the offline payment to external users only", async () => {
    auth.user = { user_type: "faculty" };
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {} } });
    renderMine();
    await screen.findByText("IIC-PI-20261111-1430-7F3A");
    expect(screen.queryByRole("button", { name: /Record offline payment/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Pay online/ })).toBeTruthy();
  });

  it("cancels with a reason", async () => {
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {} } });
    api.cancelProformaInvoice.mockResolvedValue({ data: pi({ state: state({ key: "cancelled" }) }) });
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: /^Cancel$/ }));
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Not needed" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancel proforma/ }));
    await waitFor(() => expect(api.cancelProformaInvoice).toHaveBeenCalledWith(7, "Not needed"));
  });

  it("edit loads the equipment and inputs into the proforma page and marks the revision", async () => {
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {} } });
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    expect(navigate).toHaveBeenCalledWith("/proforma-invoice");
    expect(readRevisingProforma()).toEqual({ id: 7, number: "IIC-PI-20261111-1430-7F3A", department: "Institute Instrumentation Centre" });
    expect(readProformaLineItemsFromStorage()).toEqual([
      { equipment_id: 41, equipment_code: "APREO", equipment_name: "FE-SEM", profile_type: "", input_fields: [], input_values: { A: 15, B: 5 } },
    ]);
  });

  it("opens the offline payment form fixed to the proforma's department", async () => {
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {} } });
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: /Record offline payment/ }));
    expect(await screen.findByText(/Record an offline payment for proforma IIC-PI-20261111-1430-7F3A/)).toBeTruthy();
    expect(screen.getByTestId("orc-fixed-department").textContent).toBe("Institute Instrumentation Centre");
    expect((screen.getByLabelText("Amount paid (₹)") as HTMLInputElement).value).toBe("17700");
    expect(api.getDepartmentsForRecharge).not.toHaveBeenCalled();
  });

  it("shows payments with their references and the history", async () => {
    const withPayment = pi({
      payments: [{ id: 1, kind: "OFFLINE", amount: "17700.00", created_at: "2026-11-11T10:00:00Z", state: "credited", credited: "17700.00", pending: "0.00", reconciled: true, references: { utr: "SBIN99990001", reconciled_reference: "GRANT-77" } }],
    });
    api.getMyProformaInvoices.mockResolvedValue({ data: { results: [withPayment], states: {} } });
    api.getProformaInvoice.mockResolvedValue({ data: { ...withPayment, history: [{ at: "2026-11-11T09:00:00Z", action: "offline_payment_submitted", detail: {}, actor: "Acme" }] } });
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: /Details/ }));
    const payments = await screen.findByTestId("pi-payments");
    expect(payments.textContent).toContain("SBIN99990001");
    expect(payments.textContent).toContain("GRANT-77");
    expect(payments.textContent).toContain("reconciled");
    expect((await screen.findByTestId("pi-history")).textContent).toContain("Offline payment submitted");
  });
});

describe("Staff proforma invoices", () => {
  it("lists the proformas in scope and exports the CSV", async () => {
    api.getStaffProformaInvoices.mockResolvedValue({ data: { results: [pi()], states: {}, role: "accounts" } });
    api.downloadProformaFile.mockResolvedValue({ blob: new Blob(["x"]) });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(
      <MemoryRouter>
        <AdminProformaInvoices />
      </MemoryRouter>,
    );
    expect(await screen.findByText("IIC-PI-20261111-1430-7F3A")).toBeTruthy();
    expect(screen.getByText(/your department's proformas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    await waitFor(() => expect(api.downloadProformaFile).toHaveBeenCalledWith("/admin/proforma-invoices/?export=csv"));
  });
});
