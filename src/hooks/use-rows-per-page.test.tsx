// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { normalizeRowsPerPage, rowsPerPageStorageKey, useRowsPerPage } from "./use-rows-per-page";

afterEach(() => window.localStorage.clear());

describe("useRowsPerPage", () => {
  it("uses the default until a size is chosen, then remembers it per user and page", () => {
    const { result, rerender } = renderHook(({ userId }) => useRowsPerPage("my-bookings", userId, 50), {
      initialProps: { userId: 7 as number | null },
    });
    expect(result.current[0]).toBe(50);
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(100);
    expect(window.localStorage.getItem(rowsPerPageStorageKey("my-bookings", 7))).toBe("100");
    expect(window.localStorage.getItem(rowsPerPageStorageKey("view-booking", 7))).toBeNull();

    rerender({ userId: 8 });
    expect(result.current[0]).toBe(50);
    rerender({ userId: 7 });
    expect(result.current[0]).toBe(100);
  });

  it("ignores stored values that are not offered and does not store without a user", () => {
    window.localStorage.setItem(rowsPerPageStorageKey("view-booking", 3), "7");
    const { result } = renderHook(() => useRowsPerPage("view-booking", 3, 10));
    expect(result.current[0]).toBe(10);
    const anonymous = renderHook(() => useRowsPerPage("view-booking", null, 10));
    act(() => anonymous.result.current[1](25));
    expect(anonymous.result.current[0]).toBe(25);
    expect(Object.keys(window.localStorage)).toEqual([rowsPerPageStorageKey("view-booking", 3)]);
  });

  it("normalizes to the offered sizes", () => {
    expect(normalizeRowsPerPage("500", 10)).toBe(500);
    expect(normalizeRowsPerPage(1000, 10)).toBe(10);
    expect(normalizeRowsPerPage(null, 50)).toBe(50);
  });
});
