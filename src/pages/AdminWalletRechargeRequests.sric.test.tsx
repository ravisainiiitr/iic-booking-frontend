// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { cashbookUploadSummary, formatCutoffDate } from "@/lib/walletRecharge";

const adminList = vi.fn();
const deleteRequest = vi.fn();
const reminderPreview = vi.fn();
const reminderSend = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getCatalogDepartments: async () => ({ data: { departments: [] } }),
    adminSingletonGet: async () => ({ data: { cashbook_match_from_date: "2026-09-30" } }),
    adminList: (...args: unknown[]) => adminList(...args),
    adminGet: async () => ({ error: "skip" }),
    adminWalletRechargeRequestDelete: (...args: unknown[]) => deleteRequest(...args),
    adminWalletRechargeSricReminderPreview: (...args: unknown[]) => reminderPreview(...args),
    adminWalletRechargeSricReminderSend: (...args: unknown[]) => reminderSend(...args),
  },
  extractAdminListItems: (d: { results?: unknown[] }) => d?.results ?? [],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { user_type: "admin" }, loading: false, isAuthenticated: true }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({ ExportMenu: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import AdminWalletRechargeRequests from "./AdminWalletRechargeRequests";

const pendingRow = {
  id: 48,
  transaction_number: "IIC-TXN-000048",
  request_id: "WRR-48",
  user: 5,
  user_name: "Test Requester",
  user_email: "requester@example.test",
  employee_number: "100001",
  amount: "2000.00",
  status: "PENDING",
  status_display: "Pending",
  user_otp_verified: true,
  recharge_mode: "project_grant",
  delete_blocked_reason: "",
  sric_reminder_blocked_reason: "",
  sric_reminder_count: 1,
  sric_reminder_last_sent_at: "2026-10-05T10:00:00Z",
};

const creditedRow = {
  ...pendingRow,
  id: 49,
  transaction_number: "IIC-TXN-000049",
  request_id: "WRR-49",
  status: "APPROVED",
  status_display: "Approved",
  sric_reminder_count: 0,
  sric_reminder_blocked_reason: "Reminders can be sent only for pending requests.",
  delete_blocked_reason: "This request has credited the wallet. Use Wallet ledger to debit before deleting.",
};

const preview = {
  eligible: true,
  blocked_reason: "",
  cooldown_seconds: 0,
  reminder_number: 2,
  subject: "Reminder #2: [IIC-TXN-000048] Wallet Recharge ₹2,000.00",
  to: ["sric.office@example.test"],
  cc: ["requester@example.test"],
  includes_action_links: true,
  text: "",
  html: "<h2>Wallet Recharge Request — Reminder #2</h2>",
  reminders_sent: 1,
  last_sent_at: "2026-10-05T10:00:00Z",
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminWalletRechargeRequests />
    </MemoryRouter>,
  );

const rowFor = async (txn: string) => {
  const cell = await screen.findByText(txn);
  return cell.closest("tr") as HTMLElement;
};

describe("Wallet recharge requests: delete, show deleted, SRIC reminder", () => {
  beforeEach(() => {
    adminList.mockResolvedValue({ data: { results: [pendingRow, creditedRow] } });
    deleteRequest.mockResolvedValue({ data: { message: "IIC-TXN-000048 deleted." } });
    reminderPreview.mockResolvedValue({ data: preview });
    reminderSend.mockResolvedValue({ data: { message: "Reminder #2 sent to the SRIC office.", reminder_number: 2 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("confirms delete with transaction details and a required reason", async () => {
    renderPage();
    const row = await rowFor("IIC-TXN-000048");
    fireEvent.click(within(row).getByRole("button", { name: "Delete request" }));

    const dialog = await screen.findByRole("dialog");
    const summary = within(dialog).getByTestId("delete-summary");
    expect(summary.textContent).toContain("IIC-TXN-000048");
    expect(summary.textContent).toContain("₹2000.00");
    expect(summary.textContent).toContain("Pending");
    expect(summary.textContent).toContain("Test Requester");

    const confirm = within(dialog).getByRole("button", { name: "Delete request" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Reason (required)"), { target: { value: "Duplicate request" } });
    expect(
      within(dialog).getByRole("checkbox", { name: "Inform requester by email" }).getAttribute("data-state"),
    ).toBe("unchecked");
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(48, { reason: "Duplicate request", inform_requester: false }),
    );
  });

  it("shows the block message instead of a delete button for credited requests", async () => {
    renderPage();
    const row = await rowFor("IIC-TXN-000049");
    fireEvent.click(within(row).getByRole("button", { name: "Delete request" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toContain("Use Wallet ledger to debit before deleting.");
    expect(within(dialog).queryByRole("button", { name: "Delete request" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Send reminder to SRIC" })).toBeNull();
  });

  it("show deleted toggle asks the API for deleted requests", async () => {
    renderPage();
    await rowFor("IIC-TXN-000048");
    expect(adminList.mock.calls[0][1]).not.toHaveProperty("show_deleted");
    fireEvent.click(screen.getByRole("switch", { name: "Show deleted" }));
    await waitFor(() => expect(adminList.mock.calls.at(-1)?.[1]).toMatchObject({ show_deleted: "1" }));
  });

  it("previews recipients and sends the reminder only after confirmation", async () => {
    renderPage();
    const row = await rowFor("IIC-TXN-000048");
    expect(within(row).getByTestId("reminder-info").textContent).toContain("1 reminder");
    fireEvent.click(within(row).getByRole("button", { name: "Send reminder to SRIC" }));

    const dialog = await screen.findByRole("dialog");
    const recipients = await within(dialog).findByTestId("reminder-recipients");
    expect(reminderPreview).toHaveBeenCalledWith(48, "", "");
    expect(recipients.textContent).toContain("sric.office@example.test");
    expect(recipients.textContent).toContain("requester@example.test");
    expect(within(dialog).getByTitle("Reminder email preview").getAttribute("sandbox")).toBe("");

    const send = within(dialog).getByRole("button", { name: "Send reminder" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Additional note (optional)"), { target: { value: "Kindly expedite" } });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(reminderSend).toHaveBeenCalledWith(48, { note: "Kindly expedite", extra_cc: "" }));
  });

  it("blocks sending during the cooldown", async () => {
    reminderPreview.mockResolvedValueOnce({ data: { ...preview, cooldown_seconds: 300 } });
    renderPage();
    const row = await rowFor("IIC-TXN-000048");
    fireEvent.click(within(row).getByRole("button", { name: "Send reminder to SRIC" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/Another can be sent in about 5 minute/);
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect((within(dialog).getByRole("button", { name: "Send reminder" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("cash-book upload summary", () => {
  it("reports rows ignored before the cutoff", () => {
    expect(formatCutoffDate("2026-09-30")).toBe("30 Sep 2026");
    const text = cashbookUploadSummary(
      { stored: 4, matched: 1, ignored_before_cutoff: 3, ignored_undated: 0, skipped_without_emp_or_receipt: 0 },
      "2026-09-30",
    );
    expect(text).toBe("4 cash-book rows loaded; ignored: before 30 Sep 2026: 3; 1 request auto-matched.");
  });
});
