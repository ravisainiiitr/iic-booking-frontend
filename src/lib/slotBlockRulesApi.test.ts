import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import { describeRule, presetRange, slotBlockRulesApi } from "./slotBlockRulesApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presetRange", () => {
  const today = new Date(2026, 9, 5);

  it("covers the rest of this month", () => {
    expect(presetRange("rest_of_month", today)).toEqual({ start: "2026-10-05", end: "2026-10-31" });
  });

  it("covers the next 12 months up to the day before the same date next year", () => {
    expect(presetRange("next_12_months", today)).toEqual({ start: "2026-10-05", end: "2027-10-04" });
  });
});

describe("describeRule", () => {
  it("names weekdays and times in order", () => {
    expect(
      describeRule({ weekdays: [3, 0], slot_times: ["14:00", "10:00"], start_date: "2026-10-05", end_date: "2026-10-31" }),
    ).toBe("Every Mon & Thu at 10:00, 14:00 · 5 Oct 2026 – 31 Oct 2026");
    expect(
      describeRule({ weekdays: [0, 1, 2, 3, 4, 5, 6], slot_times: ["09:00"], start_date: "2026-10-05", end_date: "2026-10-05" }),
    ).toBe("Every day at 09:00 · 5 Oct 2026 – 5 Oct 2026");
  });
});

describe("slotBlockRulesApi", () => {
  const input = { weekdays: [0, 3], slot_times: ["10:00"], start_date: "2026-10-05", end_date: "2026-10-31", label: "" };

  it("posts a preview with the token", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ preview: { to_block_count: 4 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await slotBlockRulesApi.preview(12, input);
    expect(res.preview.to_block_count).toBe(4);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/equipment/12/slot-block-rules/preview/");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Token tok");
  });

  it("removes a rule through its remove endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ rule: { id: 7 }, result: { unblocked_count: 3 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await slotBlockRulesApi.remove(12, 7);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/equipment/12/slot-block-rules/7/remove/");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("surfaces the server message, code and field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ detail: "The start date cannot be in the past.", code: "start_in_past", field: "start_date" }),
          { status: 400 },
        ),
      ),
    );
    await expect(slotBlockRulesApi.create(12, input)).rejects.toMatchObject({
      message: "The start date cannot be in the past.",
      code: "start_in_past",
      field: "start_date",
      status: 400,
    });
  });
});
