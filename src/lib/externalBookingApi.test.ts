import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import {
  describeWindow,
  externalBookingApi,
  ExternalBookingApiError,
  formatDay,
  formatInstant,
  isShortNotice,
  isValidIndianPin,
  timeLeft,
  type ExternalWindow,
} from "./externalBookingApi";

const open: ExternalWindow = {
  enabled: true,
  is_open: true,
  first_date: "2026-11-09",
  last_date: "2026-12-06",
  opens_at: "2026-10-28T21:00:00+05:30",
  next_expansion_at: "2026-11-04T21:00:00+05:30",
  next_week_start: "2026-12-07",
  next_week_end: "2026-12-13",
  timezone: "Asia/Kolkata",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("date formatting", () => {
  it("formats calendar dates without shifting the day", () => {
    expect(formatDay("2026-11-09")).toMatch(/Mon.*9 Nov.*2026/);
    expect(formatDay("2027-01-03")).toMatch(/3 Jan.*2027/);
  });

  it("formats instants in IST whatever the browser time zone", () => {
    expect(formatInstant("2026-10-28T15:30:00Z")).toMatch(/28 Oct.*2026.*9:00\s?pm IST/i);
  });
});

describe("describeWindow", () => {
  it("says nothing when the central window is off", () => {
    expect(describeWindow({ ...open, enabled: false })).toBe("");
  });

  it("gives the open range and the next opening in IST", () => {
    const text = describeWindow(open);
    expect(text).toMatch(/9 Nov.*2026/);
    expect(text).toMatch(/6 Dec.*2026/);
    expect(text).toMatch(/7 Dec.*2026/);
    expect(text).toMatch(/4 Nov.*2026.*IST/);
  });

  it("explains when bookings are not open yet", () => {
    expect(describeWindow({ ...open, is_open: false, first_date: null, last_date: null })).toMatch(/open on .*28 Oct.*2026/);
  });
});

describe("timing helpers", () => {
  const now = new Date("2026-11-01T10:00:00+05:30");

  it("counts down to a deadline", () => {
    expect(timeLeft("2026-11-01T15:12:00+05:30", now)).toBe("5 h 12 min left");
    expect(timeLeft("2026-11-03T12:00:00+05:30", now)).toBe("2 d 2 h left");
    expect(timeLeft("2026-11-01T09:59:00+05:30", now)).toBe("Deadline passed");
  });

  it("applies the short-notice boundary like the server (exactly 12 days is not short notice)", () => {
    expect(isShortNotice("2026-11-13T09:59:59+05:30", 12, now)).toBe(true);
    expect(isShortNotice("2026-11-13T10:00:00+05:30", 12, now)).toBe(false);
  });

  it("checks Indian PIN codes", () => {
    expect(isValidIndianPin("247667")).toBe(true);
    expect(isValidIndianPin("047667")).toBe(false);
    expect(isValidIndianPin("24766")).toBe(false);
  });
});

describe("request errors", () => {
  it("exposes the server's message, code and field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Choose a time in the future.", code: "invalid", field: "preferred_start" }), { status: 400 })),
    );
    const err = await externalBookingApi.mySpecial().catch((e) => e);
    expect(err).toBeInstanceOf(ExternalBookingApiError);
    expect(err.message).toBe("Choose a time in the future.");
    expect(err.field).toBe("preferred_start");
    expect(err.status).toBe(400);
  });

  it("sends the token and JSON body", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await externalBookingApi.respondSpecial(7, "Ten to eighty degrees");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/external-booking/special-requests/7/respond/");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token tok");
    expect(JSON.parse(String(init.body))).toEqual({ message: "Ten to eighty degrees" });
  });
});
