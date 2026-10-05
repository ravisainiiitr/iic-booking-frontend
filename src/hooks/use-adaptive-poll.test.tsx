// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAdaptivePoll } from "./use-adaptive-poll";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = () => act(async () => {
  await Promise.resolve();
});

describe("useAdaptivePoll", () => {
  it("runs immediately and then after the delay the task returns", async () => {
    const task = vi.fn().mockResolvedValue(3000);
    renderHook(() => useAdaptivePoll(task));
    await flush();
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("stops when the task returns false", async () => {
    const task = vi.fn().mockResolvedValue(false);
    renderHook(() => useAdaptivePoll(task));
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("pauses while the tab is hidden and resumes on return", async () => {
    const task = vi.fn().mockResolvedValue(1000);
    renderHook(() => useAdaptivePoll(task));
    await flush();
    setVisibility("hidden");
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    const whileHidden = task.mock.calls.length;
    expect(whileHidden).toBeLessThanOrEqual(2);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(task).toHaveBeenCalledTimes(whileHidden);
    await act(async () => {
      setVisibility("visible");
    });
    await flush();
    expect(task).toHaveBeenCalledTimes(whileHidden + 1);
  });

  it("keeps one loop across re-renders with a new task function", async () => {
    let calls = 0;
    const { rerender } = renderHook(({ n }) => useAdaptivePoll(async () => {
      calls += n;
      return 5000;
    }), { initialProps: { n: 1 } });
    await flush();
    rerender({ n: 10 });
    rerender({ n: 10 });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(calls).toBe(11);
  });

  it("does nothing when disabled", async () => {
    const task = vi.fn().mockResolvedValue(1000);
    renderHook(() => useAdaptivePoll(task, { enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(task).not.toHaveBeenCalled();
  });
});
