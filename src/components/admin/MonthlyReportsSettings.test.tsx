// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MonthlyReportsSettings from "./MonthlyReportsSettings";

const SETTINGS = {
  enabled: false,
  faculty_enabled: true,
  oic_enabled: true,
  hod_enabled: true,
  attach_excel: true,
  schedule: "1st of each month at 09:10 IST",
  default_month: "2026-09",
  last_run: null,
};

const api = vi.hoisted(() => ({
  getMonthlyReportSettings: vi.fn(),
  updateMonthlyReportSettings: vi.fn(),
  searchMonthlyReportRecipients: vi.fn(),
  previewMonthlyReport: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MonthlyReportsSettings", () => {
  it("shows the master switch off and saves an audience toggle on its own", async () => {
    api.getMonthlyReportSettings.mockResolvedValue({ data: SETTINGS });
    api.updateMonthlyReportSettings.mockImplementation(async (body) => ({ data: { ...SETTINGS, ...body } }));
    render(<MonthlyReportsSettings />);

    const master = await screen.findByRole("switch", { name: "Send monthly usage reports" });
    expect(master.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("switch", { name: "Heads of Department" }));

    await waitFor(() => expect(api.updateMonthlyReportSettings).toHaveBeenCalledWith({ hod_enabled: false }));
    expect(screen.getByRole("switch", { name: "Send monthly usage reports" }).getAttribute("aria-checked")).toBe("false");
  });

  it("previews a recipient's report for the chosen month without sending", async () => {
    api.getMonthlyReportSettings.mockResolvedValue({ data: SETTINGS });
    api.searchMonthlyReportRecipients.mockResolvedValue({
      data: {
        results: [
          { id: 78, name: "Test Faculty", email: "t@example.org", audiences: ["faculty", "oic"], is_test_account: true },
        ],
      },
    });
    api.previewMonthlyReport.mockResolvedValue({
      data: {
        month: "2026-09",
        month_label: "September 2026",
        subject: "Your September 2026 usage report",
        html: "<p>Report body</p>",
        text: "Report body",
        audiences: ["faculty", "oic"],
        active_audiences: ["faculty"],
        has_activity: true,
        would_send: false,
        reason: "Test account: excluded from scheduled sends (use the test send).",
        excel: false,
        recipient: { id: 78, name: "Test Faculty", is_test_account: true },
      },
    });
    render(<MonthlyReportsSettings />);

    fireEvent.change(await screen.findByLabelText("Recipient"), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Test account")).toBeTruthy();
    expect(screen.getByText(/Faculty, Officer in Charge/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(api.previewMonthlyReport).toHaveBeenCalledWith(78, "2026-09"));
    expect(await screen.findByText("Your September 2026 usage report")).toBeTruthy();
    expect(screen.getByText(/Test account: excluded from scheduled sends/)).toBeTruthy();
    const frame = screen.getByTitle("Monthly report preview") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toBe("<p>Report body</p>");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(api.updateMonthlyReportSettings).not.toHaveBeenCalled();
  });
});
