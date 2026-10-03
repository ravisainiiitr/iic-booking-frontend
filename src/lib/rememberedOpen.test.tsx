// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { rememberedOpenKey, useRememberedOpen } from "./rememberedOpen";

afterEach(() => localStorage.clear());

describe("useRememberedOpen", () => {
  it("starts collapsed when the default is collapsed", () => {
    const { result } = renderHook(() => useRememberedOpen("lab-dash-booking-overview", 7, false));
    expect(result.current[0]).toBe(false);
  });

  it("remembers the user's choice per user", () => {
    const { result, unmount } = renderHook(() => useRememberedOpen("lab-dash-booking-overview", 7, false));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(rememberedOpenKey("lab-dash-booking-overview", 7))).toBe("1");
    unmount();

    expect(renderHook(() => useRememberedOpen("lab-dash-booking-overview", 7, false)).result.current[0]).toBe(true);
    expect(renderHook(() => useRememberedOpen("lab-dash-booking-overview", 8, false)).result.current[0]).toBe(false);
  });

  it("follows the default until the user toggles", () => {
    const { result, rerender } = renderHook(({ def }) => useRememberedOpen("panel", 1, def), {
      initialProps: { def: true },
    });
    expect(result.current[0]).toBe(true);
    rerender({ def: false });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    rerender({ def: false });
    expect(result.current[0]).toBe(true);
  });
});
