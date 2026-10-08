// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { scrollWhenReady } from "@/lib/scrollWhenReady";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("scrollWhenReady", () => {
  it("scrolls once the element renders", () => {
    vi.useFakeTimers();
    scrollWhenReady("lab-messages-12");
    vi.advanceTimersByTime(300);
    const el = document.createElement("div");
    el.id = "lab-messages-12";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    vi.advanceTimersByTime(300);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("stops when cancelled", () => {
    vi.useFakeTimers();
    const cancel = scrollWhenReady("lab-messages-13");
    cancel();
    const el = document.createElement("div");
    el.id = "lab-messages-13";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    vi.advanceTimersByTime(1000);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });
});
