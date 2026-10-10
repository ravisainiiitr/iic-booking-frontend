// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import {
  DATE_RANGE_ORDER_MESSAGE,
  dateRangeError,
  filtersFromSearchParams,
  isCompleteIsoDate,
  useLatestRequest,
  useLiveFilters,
  useSyncFiltersToUrl,
} from "./use-live-filters";

const DEFAULTS = { outcome: "ALL", equipment_id: "", reason: "", date_from: "", date_to: "" };
const OPTIONS = { text: ["reason"], dateRanges: [["date_from", "date_to"]], delayMs: 300 } as const;

function setup(start?: Partial<typeof DEFAULTS>) {
  return renderHook(() => useLiveFilters(DEFAULTS, { ...OPTIONS, start }));
}

describe("date helpers", () => {
  it("accepts only complete real ISO dates", () => {
    expect(isCompleteIsoDate("2026-10-01")).toBe(true);
    expect(isCompleteIsoDate("2026-02-30")).toBe(false);
    expect(isCompleteIsoDate("2026-10")).toBe(false);
    expect(isCompleteIsoDate("")).toBe(false);
  });

  it("flags a range only when both ends are set and out of order", () => {
    expect(dateRangeError("2026-10-05", "2026-10-01")).toBe(DATE_RANGE_ORDER_MESSAGE);
    expect(dateRangeError("2026-10-01", "2026-10-01")).toBeNull();
    expect(dateRangeError("2026-10-05", "")).toBeNull();
    expect(dateRangeError("2026-10", "2026-01-01")).toBeNull();
  });
});

describe("useLiveFilters", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
    });

  it("applies selects immediately", () => {
    const { result } = setup();
    act(() => result.current.set("outcome", "FAILED"));
    expect(result.current.applied.outcome).toBe("FAILED");
    act(() => result.current.setValues({ equipment_id: "7" }));
    expect(result.current.applied).toMatchObject({ outcome: "FAILED", equipment_id: "7" });
  });

  it("debounces text, restarting the pause on each keystroke, and ignores a single character", async () => {
    const { result } = setup();
    act(() => result.current.set("reason", "q"));
    await advance(1000);
    expect(result.current.applied.reason).toBe("");

    act(() => result.current.set("reason", "qu"));
    await advance(200);
    act(() => result.current.set("reason", "quota"));
    expect(result.current.values.reason).toBe("quota");
    expect(result.current.pending).toBe(true);
    await advance(200);
    expect(result.current.applied.reason).toBe("");
    await advance(100);
    expect(result.current.applied.reason).toBe("quota");
    expect(result.current.pending).toBe(false);
  });

  it("applies a cleared search box at once and applies typed text on Enter", async () => {
    const { result } = setup({ reason: "quota" });
    expect(result.current.applied.reason).toBe("quota");
    act(() => result.current.set("reason", ""));
    expect(result.current.applied.reason).toBe("");

    act(() => result.current.set("reason", "slot"));
    const preventDefault = vi.fn();
    act(() => result.current.onSearchKeyDown({ key: "Enter", preventDefault } as unknown as KeyboardEvent<HTMLElement>));
    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.applied.reason).toBe("slot");
    await advance(1000);
    expect(result.current.applied.reason).toBe("slot");
  });

  it("ignores incomplete dates and keeps the last complete one", () => {
    const { result } = setup();
    act(() => result.current.set("date_from", "2026-10-01"));
    expect(result.current.applied.date_from).toBe("2026-10-01");
    act(() => result.current.set("date_from", "2026-1"));
    expect(result.current.values.date_from).toBe("2026-1");
    expect(result.current.applied.date_from).toBe("2026-10-01");
    act(() => result.current.set("date_from", ""));
    expect(result.current.applied.date_from).toBe("");
  });

  it("does not apply anything while the range is out of order and shows the hint", () => {
    const { result } = setup();
    act(() => result.current.set("date_to", "2026-10-01"));
    const before = result.current.appliedKey;
    act(() => result.current.set("date_from", "2026-10-05"));
    expect(result.current.dateError).toBe(DATE_RANGE_ORDER_MESSAGE);
    act(() => result.current.set("outcome", "FAILED"));
    expect(result.current.appliedKey).toBe(before);

    act(() => result.current.set("date_to", "2026-10-09"));
    expect(result.current.dateError).toBeNull();
    expect(result.current.applied).toMatchObject({ outcome: "FAILED", date_from: "2026-10-05", date_to: "2026-10-09" });
  });

  it("goes back to page 1 whenever the applied filters change, not while text is pending", async () => {
    const { result } = setup();
    act(() => result.current.setPage(4));
    expect(result.current.page).toBe(4);
    act(() => result.current.set("outcome", "SUCCESS"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.set("reason", "quota"));
    expect(result.current.page).toBe(3);
    await advance(300);
    expect(result.current.page).toBe(1);
  });

  it("keeps the same applied object when nothing applied changed", () => {
    const { result } = setup();
    const applied = result.current.applied;
    act(() => result.current.set("reason", "x"));
    expect(result.current.applied).toBe(applied);
  });

  it("reset goes back to the defaults at once and always changes the key so Clear refetches", () => {
    const { result } = setup({ outcome: "FAILED", reason: "quota" });
    expect(result.current.isDefault).toBe(false);
    act(() => result.current.setPage(2));
    const key = result.current.appliedKey;
    act(() => result.current.reset());
    expect(result.current.values).toEqual(DEFAULTS);
    expect(result.current.applied).toEqual(DEFAULTS);
    expect(result.current.isDefault).toBe(true);
    expect(result.current.page).toBe(1);
    expect(result.current.appliedKey).not.toBe(key);

    const cleared = result.current.appliedKey;
    act(() => result.current.reset());
    expect(result.current.appliedKey).not.toBe(cleared);
  });

  it("starts from out-of-order dates by leaving that range out", () => {
    const { result } = setup({ date_from: "2026-10-05", date_to: "2026-10-01" });
    expect(result.current.dateError).toBe(DATE_RANGE_ORDER_MESSAGE);
    expect(result.current.applied).toMatchObject({ date_from: "", date_to: "" });
  });
});

describe("useLatestRequest", () => {
  it("only the newest request is latest, and starting one aborts the previous signal", () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    const first = result.current();
    const second = result.current();
    expect(first.isLatest()).toBe(false);
    expect(first.signal.aborted).toBe(true);
    expect(second.isLatest()).toBe(true);
    unmount();
    expect(second.isLatest()).toBe(false);
    expect(second.signal.aborted).toBe(true);
  });
});

describe("URL helpers", () => {
  it("reads only the filter keys", () => {
    const params = new URLSearchParams("outcome=FAILED&tab=x&reason=quota");
    expect(filtersFromSearchParams(params, DEFAULTS)).toEqual({ outcome: "FAILED", reason: "quota" });
  });

  it("writes non-default applied values and keeps other params", () => {
    const setSearchParams = vi.fn();
    const params = new URLSearchParams("tab=sric&outcome=FAILED");
    renderHook(() =>
      useSyncFiltersToUrl({ ...DEFAULTS, outcome: "ALL", reason: "quota" }, DEFAULTS, params, setSearchParams),
    );
    expect(setSearchParams).toHaveBeenCalledTimes(1);
    const [next, opts] = setSearchParams.mock.calls[0];
    expect((next as URLSearchParams).toString()).toBe("tab=sric&reason=quota");
    expect(opts).toEqual({ replace: true });
  });

  it("does nothing when the URL already matches", () => {
    const setSearchParams = vi.fn();
    renderHook(() => useSyncFiltersToUrl({ ...DEFAULTS, reason: "quota" }, DEFAULTS, new URLSearchParams("reason=quota"), setSearchParams));
    expect(setSearchParams).not.toHaveBeenCalled();
  });
});
