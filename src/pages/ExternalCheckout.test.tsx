// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  checkout: vi.fn(),
  payCheckout: vi.fn(),
  cancelCheckout: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  API_BASE_URL: "/api",
  apiClient: { getToken: () => "tok", verifyRazorpayCheckout: api.verify, getWallet: () => Promise.resolve({ data: { balance: "0.00" } }) },
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/PageShell", () => ({
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/razorpay", () => ({ loadRazorpayScript: () => Promise.resolve(true) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return {
    ...actual,
    externalBookingApi: { checkout: api.checkout, payCheckout: api.payCheckout, cancelCheckout: api.cancelCheckout },
  };
});

import type { BookingCheckout, CheckoutOption } from "@/lib/externalBookingApi";
import { ExternalBookingApiError } from "@/lib/externalBookingApi";
import { INSTITUTION } from "@/lib/institutionIdentity";
import ExternalCheckout from "./ExternalCheckout";
import ExternalCheckoutConfirmation from "./ExternalCheckoutConfirmation";

const opt = (choice: CheckoutOption["choice"], wallet: string, gateway: string, after: string): CheckoutOption => ({
  choice,
  label: { full_gateway: "Full amount via online payment", wallet_plus_gateway: "Wallet balance + remaining amount online", full_wallet: "Full amount via wallet" }[choice],
  wallet_amount: wallet,
  gateway_amount: gateway,
  gateway_fee: gateway === "0.00" ? "0.00" : "236.00",
  gateway_total: gateway === "0.00" ? "0.00" : (Number(gateway) + 236).toFixed(2),
  wallet_after: after,
});

function checkout(over: Partial<BookingCheckout> = {}): BookingCheckout {
  return {
    id: "c0ffee00-0000-4000-8000-000000000001",
    state: "quoted",
    state_label: "Awaiting payment choice",
    summary: {
      equipment_id: 2,
      equipment_name: "Synthetic XRD",
      equipment_code: "ACCXRD",
      slots: [{ start: "2026-11-11T09:00:00+05:30", end: "2026-11-11T10:00:00+05:30" }],
      number_of_samples: 1,
      total_time_minutes: 60,
      charge_breakdown: [
        { description: "Analysis charge", amount: "8474.58" },
        { description: "GST (18%)", amount: "1525.42" },
      ],
      total: "10000.00",
    },
    total_amount: "10000.00",
    choice: null,
    wallet_amount: "0.00",
    gateway_amount: "0.00",
    expires_at: null,
    created_at: "2026-10-28T21:06:00+05:30",
    confirmed_at: null,
    slot_held: false,
    wallet_balance: "0.00",
    options: [opt("full_gateway", "0.00", "10000.00", "0.00")],
    ...over,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/external-checkout/:checkoutId" element={<ExternalCheckout />} />
        <Route path="/external-checkout/:checkoutId/confirmation" element={<ExternalCheckoutConfirmation />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const ID = "c0ffee00-0000-4000-8000-000000000001";
let razorpayOptions: Record<string, unknown> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  razorpayOptions = null;
  (window as unknown as { Razorpay: unknown }).Razorpay = vi.fn().mockImplementation((options: Record<string, unknown>) => {
    razorpayOptions = options;
    return { open: vi.fn(), on: vi.fn() };
  });
});
afterEach(() => cleanup());

describe("payment selection", () => {
  it("zero wallet: one online option, no wallet choice, amount shown", async () => {
    api.checkout.mockResolvedValue(checkout());
    renderAt(`/external-checkout/${ID}`);
    expect(await screen.findByText("Payment")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByTestId("option-full_wallet")).toBeNull();
    expect(screen.queryByTestId("option-wallet_plus_gateway")).toBeNull();
    expect(screen.getByTestId("checkout-total").textContent).toBe("₹10,000.00");
    expect(screen.getByTestId("pay-button").textContent).toContain("₹10,236.00");
  });

  it("partial wallet: full online or wallet + remainder, with the breakdown", async () => {
    api.checkout.mockResolvedValue(
      checkout({
        wallet_balance: "3000.00",
        options: [opt("full_gateway", "0.00", "10000.00", "3000.00"), opt("wallet_plus_gateway", "3000.00", "7000.00", "0.00")],
      }),
    );
    renderAt(`/external-checkout/${ID}`);
    const split = await screen.findByTestId("option-wallet_plus_gateway");
    const full = screen.getByTestId("option-full_gateway").textContent ?? "";
    expect(full).toContain("₹10,236.00"); // online amount including the gateway fee
    expect(full).not.toContain("Wallet"); // no wallet line when the wallet is not used
    expect(split.textContent).toContain("₹3,000.00"); // wallet part
    expect(split.textContent).toContain("₹7,236.00"); // online remainder including the gateway fee
    expect(split.textContent).not.toMatch(/help|UPI|net banking/i); // no explanatory text on the cards
    expect(screen.queryByTestId("option-full_wallet")).toBeNull();
    fireEvent.click(split);
    expect(screen.getByTestId("pay-button").textContent).toContain("₹7,236.00");
  });

  it("sufficient wallet: full online or full wallet, wallet-only confirms without the gateway", async () => {
    api.checkout.mockResolvedValue(
      checkout({
        wallet_balance: "15000.00",
        options: [opt("full_gateway", "0.00", "10000.00", "15000.00"), opt("full_wallet", "10000.00", "0.00", "5000.00")],
      }),
    );
    let resolvePay: (v: unknown) => void = () => undefined;
    api.payCheckout.mockReturnValue(new Promise((r) => (resolvePay = r)));
    renderAt(`/external-checkout/${ID}`);
    fireEvent.click(await screen.findByTestId("option-full_wallet"));
    expect(screen.getByTestId("option-full_wallet").textContent).toContain("₹5,000.00");
    const pay = screen.getByTestId("pay-button");
    expect(pay.textContent).toContain("Pay ₹10,000.00 from wallet");
    fireEvent.click(pay);
    fireEvent.click(pay); // duplicate click while the first request is running
    expect(api.payCheckout).toHaveBeenCalledTimes(1);
    expect(api.payCheckout).toHaveBeenCalledWith(ID, "full_wallet");
    api.checkout.mockResolvedValue(checkout({ state: "confirmed", choice: "full_wallet", wallet_amount: "10000.00", booking: { id: 7, reference: "IICX-7", status: "BOOKED" } }));
    await act(async () => resolvePay({ checkout: checkout({ state: "confirmed" }), order: null }));
    expect(await screen.findByText("Booking confirmed")).toBeTruthy();
    expect(window.Razorpay).not.toHaveBeenCalled();
  });

  it("online payment opens Razorpay with the IIT Roorkee branding and the server's order", async () => {
    api.checkout.mockResolvedValue(checkout());
    api.payCheckout.mockResolvedValue({
      checkout: checkout({ state: "awaiting_payment", choice: "full_gateway" }),
      order: { order_id: "order_MOCK1", amount: 1023600, currency: "INR", key: "rzp_test_X", breakup: { base_amount: "10000.00", convenience_fee: "200.00", fee_gst: "36.00", total_amount: "10236.00" } },
    });
    renderAt(`/external-checkout/${ID}`);
    fireEvent.click(await screen.findByTestId("pay-button"));
    await waitFor(() => expect(razorpayOptions).not.toBeNull());
    expect(razorpayOptions).toMatchObject({
      order_id: "order_MOCK1",
      amount: 1023600,
      name: INSTITUTION.checkoutName,
      theme: { color: INSTITUTION.themeColor },
    });
    expect(String(razorpayOptions?.image)).toMatch(/\/IITR_Logo\.png$/);
    expect(razorpayOptions?.description).toBe("IIC equipment booking");
    expect(Object.keys(razorpayOptions ?? {}).sort()).toEqual(
      ["amount", "currency", "description", "handler", "image", "key", "modal", "name", "order_id", "theme"],
    ); // only documented Standard Checkout options
  });

  it("closing the gateway re-enables the page and says nothing was charged", async () => {
    const { toast } = await import("sonner");
    api.checkout.mockResolvedValue(checkout());
    api.payCheckout.mockResolvedValue({
      checkout: checkout({ state: "awaiting_payment", choice: "full_gateway" }),
      order: { order_id: "order_MOCK2", amount: 1023600, currency: "INR", key: "k", breakup: { base_amount: "10000.00", convenience_fee: "200.00", fee_gst: "36.00", total_amount: "10236.00" } },
    });
    renderAt(`/external-checkout/${ID}`);
    fireEvent.click(await screen.findByTestId("pay-button"));
    await waitFor(() => expect(razorpayOptions).not.toBeNull());
    act(() => (razorpayOptions?.modal as { ondismiss: () => void }).ondismiss());
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Nothing was charged"));
  });

  it("a refused payment shows the server's reason", async () => {
    api.checkout.mockResolvedValue(checkout());
    api.payCheckout.mockRejectedValue(new ExternalBookingApiError(409, { error: "The slot is no longer available.", code: "booking_not_possible" }));
    renderAt(`/external-checkout/${ID}`);
    fireEvent.click(await screen.findByTestId("pay-button"));
    expect(await screen.findByText("The slot is no longer available.")).toBeTruthy();
    expect((screen.getByTestId("pay-button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the institution's details and the logo without stretching it", async () => {
    api.checkout.mockResolvedValue(checkout());
    renderAt(`/external-checkout/${ID}`);
    const banner = await screen.findByTestId("institution-banner");
    expect(banner.textContent).toContain("Indian Institute of Technology Roorkee");
    expect(banner.textContent).toContain("Sponsored Research & Industrial Consultancy (SRIC)");
    expect(banner.textContent).toContain("05AAALI0033R1Z5");
    expect(banner.textContent).toContain("Code: 05");
    expect(banner.textContent).toContain("arsric@iitr.ac.in");
    const logo = screen.getByAltText(INSTITUTION.logoAlt) as HTMLImageElement;
    expect(logo.getAttribute("src")).toBe("/IITR_Logo.png");
    expect(logo.className).toContain("object-contain");
    expect(logo.getAttribute("width")).toBe(logo.getAttribute("height"));
  });
});

describe("confirmation page (server-verified state only)", () => {
  it("wallet-only payment says so", async () => {
    api.checkout.mockResolvedValue(checkout({ state: "confirmed", choice: "full_wallet", wallet_amount: "10000.00", confirmed_at: "2026-10-28T21:10:00+05:30", booking: { id: 7, reference: "IICX-7", status: "BOOKED" } }));
    renderAt(`/external-checkout/${ID}/confirmation`);
    expect(await screen.findByText("Paid entirely from your wallet.")).toBeTruthy();
    expect(screen.getByTestId("booking-reference").textContent).toBe("IICX-7");
    expect(screen.getByTestId("wallet-used").textContent).toBe("₹10,000.00");
    expect(screen.getByTestId("online-paid").textContent).toBe("₹0.00");
    expect(screen.getByTestId("payment-status").textContent).toBe("Paid from wallet");
  });

  it("combined payment shows the wallet and online parts separately", async () => {
    api.checkout.mockResolvedValue(
      checkout({
        state: "confirmed", choice: "wallet_plus_gateway", wallet_amount: "3000.00", gateway_amount: "7000.00",
        booking: { id: 8, reference: "IICX-8", status: "BOOKED" },
        payment: { order_status: "PAID", gateway_total: "7165.20", convenience_fee: "140.00", fee_gst: "25.20", razorpay_order_id: "order_X", razorpay_payment_id: "pay_X", method: "upi", paid_at: "2026-10-28T21:12:00+05:30" },
      }),
    );
    renderAt(`/external-checkout/${ID}/confirmation`);
    expect(await screen.findByText("Booking confirmed")).toBeTruthy();
    expect(screen.getByTestId("wallet-used").textContent).toBe("₹3,000.00");
    expect(screen.getByTestId("online-paid").textContent).toBe("₹7,165.20");
    expect(screen.getByTestId("payment-status").textContent).toBe("Paid online (verified)");
    expect(screen.getByText("pay_X")).toBeTruthy();
  });

  it("a browser callback alone never shows success: pending until the server confirms", async () => {
    api.checkout.mockResolvedValue(checkout({ state: "awaiting_payment", choice: "full_gateway" }));
    renderAt(`/external-checkout/${ID}/confirmation`);
    expect(await screen.findByText("Confirming your payment…")).toBeTruthy();
    expect(screen.queryByText("Booking confirmed")).toBeNull();
    expect(screen.getByTestId("payment-status").textContent).toBe("Awaiting gateway confirmation");
  });

  it("paid but not confirmed explains the refund", async () => {
    api.checkout.mockResolvedValue(checkout({ state: "paid_not_confirmed", choice: "full_gateway", message: "Your payment was received, but the booking could not be confirmed." }));
    renderAt(`/external-checkout/${ID}/confirmation`);
    expect(await screen.findByText("Payment received — booking not confirmed")).toBeTruthy();
    expect(screen.getByText(/could not be confirmed/)).toBeTruthy();
  });

  it("cancelled checkout shows no payment", async () => {
    api.checkout.mockResolvedValue(checkout({ state: "cancelled", state_label: "Cancelled" }));
    renderAt(`/external-checkout/${ID}/confirmation`);
    expect(await screen.findByText("No payment was completed")).toBeTruthy();
  });
});
