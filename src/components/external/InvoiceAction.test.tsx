// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ invoice: vi.fn(), downloadInvoice: vi.fn(), bookingArrival: vi.fn() }));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return {
    ...actual,
    externalBookingApi: {
      invoice: m.invoice,
      downloadInvoice: m.downloadInvoice,
      downloadProvisional: vi.fn(),
      addresses: () => Promise.resolve({ addresses: [] }),
      myCopies: () => Promise.resolve({ copies: [] }),
    },
  };
});
vi.mock("@/lib/courierTrackingApi", () => ({ courierTrackingApi: { bookingArrival: m.bookingArrival } }));

import type { InvoiceStatus } from "@/lib/externalBookingApi";
import { SampleDispatchAction } from "@/components/courier/SampleDispatchAction";
import { InvoiceAction } from "./InvoiceAction";

function status(over: Partial<InvoiceStatus> = {}): InvoiceStatus {
  return {
    booking_id: 7,
    enabled: true,
    is_external: true,
    early_allowed: false,
    early_policy: null,
    preference: null,
    payment_realised: true,
    request: null,
    document: null,
    stage: "waiting_for_analysis",
    next_step: "Choose when you want the GST invoice.",
    provisional_invoice_url: "",
    ...over,
  };
}

const legacy = vi.fn();
const renderInvoice = () =>
  render(<InvoiceAction bookingId={7} legacy={legacy} legacyAvailable={false} legacyBusy={false} />);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Invoice action", () => {
  it("official GST invoice available: downloads it directly, no proforma or choices", async () => {
    m.invoice.mockResolvedValue(
      status({ stage: "invoice_available", document: { id: 55, invoice_number: "SRIC/26/001", uploaded_at: "", download_url: "" } }),
    );
    m.downloadInvoice.mockResolvedValue(undefined);
    renderInvoice();
    const button = await screen.findByTestId("invoice-download-gst");
    expect(button.textContent).toContain("GST invoice SRIC/26/001");
    fireEvent.click(button);
    expect(m.downloadInvoice).toHaveBeenCalledWith(55);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Proforma/)).toBeNull();
  });

  it("no invoice yet: options stay hidden until the button is clicked", async () => {
    m.invoice.mockResolvedValue(status());
    renderInvoice();
    const button = await screen.findByTestId("invoice-open");
    expect(screen.queryByText("When do you want the official GST invoice?")).toBeNull();
    fireEvent.click(button);
    expect(await screen.findByText("When do you want the official GST invoice?")).toBeTruthy();
    expect(screen.getByText(/Proforma invoice/)).toBeTruthy();
  });

  it("external invoice service off: previous portal invoice button", async () => {
    m.invoice.mockRejectedValue(new Error("off"));
    renderInvoice();
    const button = await screen.findByRole("button", { name: /Invoice \(PDF\)/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); // available after completion only, as before
  });
});

describe("Mark Sample Submitted", () => {
  it("external user: opens the courier registration (live tracking)", async () => {
    m.bookingArrival.mockResolvedValue({
      booking_id: 7,
      eligibility: { may_declare: true, manual_allowed: true, courier_allowed: true, is_external: true, department_enabled: true, default_mode: "COURIER", reasons: [], courier_reason: "" },
      active: null,
      history: [],
    });
    render(<SampleDispatchAction bookingId={7} fallback={<span>old dialog</span>} onSaved={() => undefined} />);
    expect((await screen.findByTestId("sample-dispatch")).textContent).toContain("Mark Sample Submitted");
    expect(screen.queryByText("old dialog")).toBeNull();
  });

  it("internal user or service unavailable: keeps the previous action", async () => {
    m.bookingArrival.mockResolvedValue({
      booking_id: 7,
      eligibility: { may_declare: true, manual_allowed: true, courier_allowed: false, is_external: false, department_enabled: true, default_mode: "MANUAL", reasons: [], courier_reason: "" },
      active: null,
      history: [],
    });
    render(<SampleDispatchAction bookingId={7} fallback={<span>old dialog</span>} onSaved={() => undefined} />);
    expect(await screen.findByText("old dialog")).toBeTruthy();
    cleanup();
    m.bookingArrival.mockRejectedValue(new Error("down"));
    render(<SampleDispatchAction bookingId={7} fallback={<span>old dialog</span>} onSaved={() => undefined} />);
    expect(await screen.findByText("old dialog")).toBeTruthy();
  });
});
