import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listBookingAnalysisInputSources: vi.fn(),
  getBookingAnalysisDataBrowser: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import { inputSourceSummary, loadInputSources } from "./analysisInputSources";

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe("loadInputSources", () => {
  it("uses input-sources when the backend serves it", async () => {
    api.listBookingAnalysisInputSources.mockResolvedValue({
      data: {
        count: 25,
        results: [
          { booking_id: 42, virtual_id: "IICDSA0042", equipment_name: "DSA", date: "2026-10-02", status: "COMPLETED", file_count: 3, is_current: true, locked_reason: null },
        ],
      },
      status: 200,
    });
    const res = await loadInputSources(42, { q: "dsa" });
    expect(api.listBookingAnalysisInputSources).toHaveBeenCalledWith(42, { q: "dsa", page: 1, page_size: 20 });
    expect(res).toMatchObject({ legacy: false, hasMore: true });
    expect(res.rows[0].virtual_id).toBe("IICDSA0042");
  });

  it("falls back to the data browser when input-sources is not deployed", async () => {
    api.listBookingAnalysisInputSources.mockResolvedValue({ error: "Not found.", status: 404 });
    api.getBookingAnalysisDataBrowser.mockResolvedValue({
      data: {
        datasets: [
          { booking_pk: 17, virtual_booking_id: "IICDSA0017", equipment_name: "DSA", booking_date: "2026-08-14", folders: [{ file_count: 2 }, { files: [1, 2, 3] }] },
        ],
        pagination: { has_more: false },
      },
      status: 200,
    });
    const res = await loadInputSources(42);
    expect(res.legacy).toBe(true);
    expect(res.rows[0]).toMatchObject({ booking_id: 17, virtual_id: "IICDSA0017", file_count: 5, is_current: false });
  });

  it("surfaces other errors instead of silently falling back", async () => {
    api.listBookingAnalysisInputSources.mockResolvedValue({ error: "Forbidden", status: 403 });
    await expect(loadInputSources(42)).rejects.toThrow("Forbidden");
    expect(api.getBookingAnalysisDataBrowser).not.toHaveBeenCalled();
  });
});

describe("inputSourceSummary", () => {
  it("joins equipment, date, status and file count", () => {
    expect(
      inputSourceSummary({ equipment_name: "DSA", date: "2026-10-02", status: "ANALYSIS_COMPLETED", file_count: 1 }),
    ).toBe("DSA · 02 Oct 2026 · Analysis completed · 1 file");
  });
});
