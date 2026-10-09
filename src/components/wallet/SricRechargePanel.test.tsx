// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import SricRechargePanel from "./SricRechargePanel";

const api = vi.hoisted(() => ({
  getMySricRecharges: vi.fn(),
  refreshMySricRecharges: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));

const creditedRow = {
  id: 11,
  reference: "SWR-000011",
  project_number: "XYZ-9001/26-27",
  ledger_id: "L-0042",
  receiver_code: "IIC-000-002",
  receiver_label: "IIC",
  department_id: 3,
  department_name: "Example Centre",
  amount: "15000.00",
  amount_raw: "15,000",
  financial_year: "2026-27",
  status: "credited",
  status_display: "Credited",
  review_reason: "",
  review_message: "",
  credited_at: "2026-10-01T10:00:00+05:30",
  balance_after: "15000.00",
  email_date: "2026-10-01T09:55:00+05:30",
  created_at: "2026-10-01T09:56:00+05:30",
  fund_receipt_verified: false,
};

function info(results: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    data: {
      portal_url: "https://rnd.iitr.ac.in",
      scan_enabled: true,
      auto_credit_enabled: false,
      last_scan_at: null,
      receivers: [
        { code: "IIC-000-002", label: "IIC" },
        { code: "TINK-000-01", label: "Tinkering" },
      ],
      results,
      ...extra,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SricRechargePanel", () => {
  it("shows the SRIC procedure and opens the portal in a new tab", async () => {
    api.getMySricRecharges.mockResolvedValue(info());
    render(<SricRechargePanel />);
    expect(screen.getByText("How to recharge your wallet from a project")).toBeTruthy();
    expect(screen.getByText("New Wallet Recharge")).toBeTruthy();
    expect(await screen.findByText(/IIC or Tinkering/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open SRIC portal/ });
    expect(link.getAttribute("href")).toBe("https://rnd.iitr.ac.in");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(await screen.findByText("No SRIC recharges yet.")).toBeTruthy();
    expect(screen.getByText(/checked by the IIC office/)).toBeTruthy();
  });

  it("reports no new recharges after Refresh and starts a cooldown", async () => {
    api.getMySricRecharges.mockResolvedValue(info());
    api.refreshMySricRecharges.mockResolvedValue({
      data: { status: "ok", debounced: false, message: "No new recharges.", results: [] },
    });
    render(<SricRechargePanel />);
    fireEvent.click(screen.getByTestId("sric-refresh-button"));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "No new recharges.");
    const button = screen.getByTestId("sric-refresh-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/Refresh \(\d+s\)/);
  });

  it("shows the credited amount and ledger and reloads the wallet", async () => {
    api.getMySricRecharges.mockResolvedValueOnce(info()).mockResolvedValue(info([creditedRow]));
    api.refreshMySricRecharges.mockResolvedValue({
      data: { status: "ok", debounced: false, message: "Credited ₹15,000.00 (ledger L-0042)", results: [creditedRow] },
    });
    const onCredited = vi.fn();
    render(<SricRechargePanel onCredited={onCredited} />);
    fireEvent.click(screen.getByTestId("sric-refresh-button"));
    expect((await screen.findByRole("status")).textContent).toContain("Credited ₹15,000.00 (ledger L-0042)");
    await waitFor(() => expect(onCredited).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("sric-recent-list")).toBeTruthy();
    expect(screen.getByText(/Ledger L-0042/)).toBeTruthy();
  });

  it("explains the wait when refreshing too often", async () => {
    api.getMySricRecharges.mockResolvedValue(info());
    api.refreshMySricRecharges.mockResolvedValue({
      error: "Please wait 42 seconds before refreshing again.",
      status: 429,
      errorCode: "RATE_LIMITED",
    });
    render(<SricRechargePanel />);
    fireEvent.click(screen.getByTestId("sric-refresh-button"));
    expect((await screen.findByRole("status")).textContent).toContain("Please wait 42 seconds");
    expect((screen.getByTestId("sric-refresh-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("badges a test entry and shows a reversed credit", async () => {
    const testRow = { ...creditedRow, id: 12, ledger_id: "TEST-L-0043", is_test: true, reversed: true, reversed_at: "2026-10-09T20:10:00+05:30" };
    api.getMySricRecharges.mockResolvedValue(info([testRow, creditedRow]));
    render(<SricRechargePanel />);
    const list = await screen.findByTestId("sric-recent-list");
    expect(list.querySelectorAll("li")[0].textContent).toContain("TEST");
    expect(list.querySelectorAll("li")[0].textContent).toContain("Reversed");
    expect(screen.getByText(/This credit was reversed by the IIC office/)).toBeTruthy();
    expect(list.querySelectorAll("li")[1].textContent).not.toContain("TEST");
    expect(list.querySelectorAll("li")[1].textContent).toContain("Credited");
  });
});
