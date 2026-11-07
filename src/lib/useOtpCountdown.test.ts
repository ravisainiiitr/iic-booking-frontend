// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOtpCountdown } from "./useOtpCountdown";

describe("useOtpCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts down and then reports the code has expired", () => {
    const { result } = renderHook(() => useOtpCountdown(Date.now() + 300_000));
    expect(result.current).toEqual({ label: "This code expires in 5:00.", expired: false });
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(result.current.label).toBe("This code expires in 3:59.");
    act(() => { vi.advanceTimersByTime(240_000); });
    expect(result.current.expired).toBe(true);
    expect(result.current.label).toContain("expired");
  });

  it("shows nothing without a deadline", () => {
    expect(renderHook(() => useOtpCountdown(null)).result.current).toEqual({ label: "", expired: false });
  });
});
