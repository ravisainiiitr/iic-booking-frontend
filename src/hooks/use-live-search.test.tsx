// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { nextLiveSearchTerm, useLiveSearchTerm } from "./use-live-search";

describe("nextLiveSearchTerm", () => {
  it("clears on empty text, keeps the current term for one character and trims longer text", () => {
    expect(nextLiveSearchTerm("", "xps")).toBe("");
    expect(nextLiveSearchTerm("   ", "xps")).toBe("");
    expect(nextLiveSearchTerm("a", "")).toBe("");
    expect(nextLiveSearchTerm(" a ", "xps")).toBe("xps");
    expect(nextLiveSearchTerm(" xp ", "")).toBe("xp");
  });
});

describe("useLiveSearchTerm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
    });

  it("applies 2+ characters after the pause, restarting the pause on each keystroke", async () => {
    const { result, rerender } = renderHook(({ raw }) => useLiveSearchTerm(raw, { delayMs: 300 }), {
      initialProps: { raw: "" },
    });
    rerender({ raw: "xp" });
    await advance(200);
    rerender({ raw: "xps" });
    await advance(200);
    expect(result.current[0]).toBe("");
    await advance(100);
    expect(result.current[0]).toBe("xps");
  });

  it("does not search for a single character", async () => {
    const { result, rerender } = renderHook(({ raw }) => useLiveSearchTerm(raw, { delayMs: 300 }), {
      initialProps: { raw: "" },
    });
    rerender({ raw: "x" });
    await advance(1000);
    expect(result.current[0]).toBe("");

    rerender({ raw: "xps" });
    await advance(300);
    rerender({ raw: "x" });
    await advance(1000);
    expect(result.current[0]).toBe("xps");
  });

  it("resets at once when the box is cleared, cancelling a pending term", async () => {
    const { result, rerender } = renderHook(({ raw }) => useLiveSearchTerm(raw, { delayMs: 300 }), {
      initialProps: { raw: "xps" },
    });
    expect(result.current[0]).toBe("xps");
    rerender({ raw: "xrd" });
    await advance(100);
    rerender({ raw: "" });
    expect(result.current[0]).toBe("");
    await advance(1000);
    expect(result.current[0]).toBe("");
  });

  it("lets the page apply a term immediately", async () => {
    const { result, rerender } = renderHook(({ raw }) => useLiveSearchTerm(raw, { delayMs: 300 }), {
      initialProps: { raw: "" },
    });
    act(() => result.current[1]("XPS202600077"));
    rerender({ raw: "XPS202600077" });
    expect(result.current[0]).toBe("XPS202600077");
  });
});
