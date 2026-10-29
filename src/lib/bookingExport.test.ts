// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, bookingExportFilename, bookingListFilterQuery } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("booking list export", () => {
  it("builds the same filter query as the list, dropping blanks and unknown values", () => {
    const q = bookingListFilterQuery({
      status: "BOOKED",
      search: "  xrd ",
      start_date: "2026-10-01",
      end_date: "",
      equipment_id: "12",
      user_type_filter: "everyone",
      istem_fbr: "verified",
      ordering: "-start_time",
      results_overdue: false,
    });
    expect(Object.fromEntries(q)).toEqual({
      status: "BOOKED",
      search: "xrd",
      start_date: "2026-10-01",
      equipment_id: "12",
      istem_fbr: "verified",
      ordering: "-start_time",
    });
  });

  it("names files bookings_<YYYY-MM-DD_HHMM> in IST", () => {
    expect(bookingExportFilename("xlsx", new Date("2026-10-07T18:45:00Z"))).toBe("bookings_2026-10-08_0015.xlsx");
    expect(bookingExportFilename("pdf", new Date("2026-01-02T03:04:00Z"))).toBe("bookings_2026-01-02_0834.pdf");
  });

  it("requests /bookings/export/ with export_format and view, and downloads under the server's filename", async () => {
    apiClient.setToken("tok");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response("a,b\r\n", {
          status: 200,
          headers: {
            "Content-Disposition": 'attachment; filename="bookings_2026-10-07_1530.csv"',
            "X-Export-Row-Count": "1",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    let res: Awaited<ReturnType<typeof apiClient.exportBookings>>;
    try {
      res = await apiClient.exportBookings("csv", "staff", { status: "COMPLETED", search: "xps" });
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
    expect(downloads).toEqual(["bookings_2026-10-07_1530.csv"]);

    expect(res).toEqual({ rowCount: 1 });
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://x");
    expect(url.pathname.endsWith("/bookings/export/")).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "COMPLETED",
      search: "xps",
      export_format: "csv",
      view: "staff",
    });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("returns the server's error message instead of downloading", async () => {
    apiClient.setToken("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "exports are limited to 10,000" }), { status: 400 })),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await apiClient.exportBookings("pdf", "my")).toEqual({ error: "exports are limited to 10,000" });
    expect(click).not.toHaveBeenCalled();
  });
});
