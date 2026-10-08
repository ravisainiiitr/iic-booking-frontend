// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ downloadReportExport: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast }));

import { ExportMenu } from "./ExportMenu";

const openAndPick = async (label: RegExp) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Export/ }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ExportMenu", () => {
  it("offers Excel (.xlsx), CSV and PDF under the description", async () => {
    render(<ExportMenu report="waitlist" description="All waitlist entries matching the filters" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Export" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Excel (.xlsx)Formatted workbook",
      "CSVPlain data",
      "PDFPrintable report",
    ]);
    expect(screen.getByText("All waitlist entries matching the filters")).toBeTruthy();
  });

  it("sends the filters on screen when a format is chosen, plus the section", async () => {
    api.downloadReportExport.mockResolvedValue({ rowCount: 1 });
    let params: Record<string, string> = { status: "PENDING" };
    render(<ExportMenu report="equipment-performance" table="revenue_department" noun="requests" getParams={() => params} />);
    params = { status: "APPROVED", equipment_id: "4" };
    await openAndPick(/CSV/);
    await waitFor(() =>
      expect(api.downloadReportExport).toHaveBeenCalledWith("equipment-performance", "csv", {
        status: "APPROVED",
        equipment_id: "4",
        table: "revenue_department",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exported 1 request."));
  });

  it("shows a loading state and blocks a second export until done", async () => {
    let finish: (v: { rowCount: number }) => void = () => {};
    api.downloadReportExport.mockReturnValue(new Promise((r) => (finish = r)));
    render(<ExportMenu report="urgent-requests" />);
    await openAndPick(/PDF/);
    const button = await screen.findByRole("button", { name: /Exporting/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ rowCount: 12000 }));
    expect(((await screen.findByRole("button", { name: "Export" })) as HTMLButtonElement).disabled).toBe(false);
    expect(api.downloadReportExport).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Exported 12,000 rows.");
  });

  it("shows the server's message (e.g. the PDF cap) as an error toast", async () => {
    const message = "2,500 rows match these filters; PDF exports are limited to 2,000 rows.";
    api.downloadReportExport.mockResolvedValue({ error: message });
    render(<ExportMenu report="booking-attempt-logs" />);
    await openAndPick(/PDF/);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("tells the user when nothing matched", async () => {
    api.downloadReportExport.mockResolvedValue({ rowCount: 0 });
    render(<ExportMenu report="waitlist" />);
    await openAndPick(/Excel/);
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
  });
});
