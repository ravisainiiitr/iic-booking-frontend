// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const getServerTime = vi.fn();
const getSlotWindowOpening = vi.fn();
vi.mock("@/lib/api", () => ({
  apiClient: {
    getServerTime: (...args: unknown[]) => getServerTime(...args),
    getSlotWindowOpening: (...args: unknown[]) => getSlotWindowOpening(...args),
  },
}));

const auth: { userType: string | null | undefined } = { userType: undefined };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => {
    if (auth.userType === undefined) throw new Error("useAuth must be used within an AuthProvider");
    return { user: auth.userType ? { user_type: auth.userType } : null };
  },
}));

import { NextWeekOpeningCountdown } from "./NextWeekOpeningCountdown";
import { __resetServerClockOffsetCache } from "@/lib/useServerClockOffset";
import { __resetSlotWindowScheduleCache } from "@/lib/slotWindowSchedule";

const IST = 330;
function ist(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return Date.UTC(y, mo - 1, d, h, mi, s) - IST * 60_000;
}

function opening(weekday: number | null, time: string | null) {
  const applies = weekday != null && time != null;
  return {
    data: {
      equipment_id: 7,
      applies,
      weekday,
      time,
      source: applies ? "equipment" : null,
      next_opens_at: null,
      server_time: new Date().toISOString(),
      utc_offset_minutes: IST,
    },
  };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  getServerTime.mockImplementation(async () => ({
    data: { server_time: "", epoch_ms: Date.now(), timezone: "Asia/Kolkata", utc_offset_minutes: IST },
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  getServerTime.mockReset();
  getSlotWindowOpening.mockReset();
  __resetServerClockOffsetCache();
  __resetSlotWindowScheduleCache();
  auth.userType = undefined;
});

describe("NextWeekOpeningCountdown", () => {
  it("shows the equipment's opening and the time left (Tue 9 pm → Wed 9 pm is 1d 0h)", async () => {
    vi.setSystemTime(ist(2026, 10, 6, 21, 0));
    getSlotWindowOpening.mockResolvedValue(opening(2, "21:00"));

    render(<NextWeekOpeningCountdown equipmentId={7} />);
    await flush();

    const el = screen.getByTestId("slot-opening-countdown");
    expect(getSlotWindowOpening).toHaveBeenCalledWith("7");
    expect(el.textContent).toContain("Next week's slots open Wed 9:00 pm");
    expect(el.textContent).toContain("in 1d 0h");
  });

  it("rolls over to the following week once the opening passes and calls onOpen once", async () => {
    vi.setSystemTime(ist(2026, 10, 7, 20, 59, 30));
    getSlotWindowOpening.mockResolvedValue(opening(2, "21:00"));
    const onOpen = vi.fn();

    render(<NextWeekOpeningCountdown equipmentId={7} onOpen={onOpen} />);
    await flush();
    expect(screen.getByTestId("slot-opening-countdown").textContent).toContain("in 30s");

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    const text = screen.getByTestId("slot-opening-countdown").textContent ?? "";
    expect(text).toContain("Wed 9:00 pm");
    expect(text).toContain("in 6d 23h");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("ticks at least once a minute", async () => {
    vi.setSystemTime(ist(2026, 10, 7, 18, 0));
    getSlotWindowOpening.mockResolvedValue(opening(2, "21:00"));

    render(<NextWeekOpeningCountdown equipmentId={7} />);
    await flush();
    expect(screen.getByTestId("slot-opening-countdown").textContent).toContain("in 3h 0m");

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("slot-opening-countdown").textContent).toContain("in 2h 59m");
  });

  it("is hidden when no opening rule applies or the lookup fails", async () => {
    vi.setSystemTime(ist(2026, 10, 6, 21, 0));
    getSlotWindowOpening.mockResolvedValueOnce(opening(null, null));
    getSlotWindowOpening.mockResolvedValueOnce({ error: "Equipment not found." });

    render(
      <>
        <NextWeekOpeningCountdown equipmentId={7} />
        <NextWeekOpeningCountdown equipmentId={8} />
      </>,
    );
    await flush();

    expect(screen.queryByTestId("slot-opening-countdown")).toBeNull();
  });

  it("tells staff when slots open for users, and external users that new slots open", async () => {
    vi.setSystemTime(ist(2026, 10, 6, 21, 0));
    getSlotWindowOpening.mockResolvedValue(opening(2, "21:00"));

    auth.userType = "manager";
    const { unmount } = render(<NextWeekOpeningCountdown equipmentId={7} />);
    await flush();
    expect(screen.getByTestId("slot-opening-countdown").textContent).toContain("Next week's slots open for users Wed 9:00 pm");
    unmount();

    auth.userType = "industry";
    render(<NextWeekOpeningCountdown equipmentId={7} />);
    await flush();
    expect(screen.getByTestId("slot-opening-countdown").textContent).toContain("New slots open Wed 9:00 pm");
  });

  it("uses a rule the caller already has without a lookup, and shares one lookup per equipment", async () => {
    vi.setSystemTime(ist(2026, 10, 6, 21, 0));
    getSlotWindowOpening.mockResolvedValue(opening(4, "09:30"));

    render(
      <>
        <NextWeekOpeningCountdown refWeekday={2} refTime="21:00" />
        <NextWeekOpeningCountdown equipmentId={9} />
        <NextWeekOpeningCountdown equipmentId={9} />
      </>,
    );
    await flush();

    const all = screen.getAllByTestId("slot-opening-countdown");
    expect(all).toHaveLength(3);
    expect(all[0].textContent).toContain("Wed 9:00 pm");
    expect(all[1].textContent).toContain("Fri 9:30 am");
    expect(getSlotWindowOpening).toHaveBeenCalledTimes(1);
    expect(getSlotWindowOpening).toHaveBeenCalledWith("9");
  });

  it("has a single polite live region per page, worded calmly", async () => {
    vi.setSystemTime(ist(2026, 10, 6, 21, 0));
    getSlotWindowOpening.mockResolvedValue(opening(2, "21:00"));

    const { container } = render(
      <>
        <NextWeekOpeningCountdown equipmentId={7} />
        <NextWeekOpeningCountdown equipmentId={7} />
      </>,
    );
    await flush();

    const live = container.querySelectorAll('[aria-live="polite"]');
    expect(live).toHaveLength(1);
    expect(live[0].textContent).toBe("in 1 day");
  });
});
