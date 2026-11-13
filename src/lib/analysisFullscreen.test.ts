import { afterEach, describe, expect, it, vi } from "vitest";
import { enterPageFullscreen } from "./analysisFullscreen";

function setPointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: coarse }) as unknown as typeof window.matchMedia;
}

describe("enterPageFullscreen", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks the browser for full screen on a desktop", () => {
    setPointer(false);
    const request = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = request;
    enterPageFullscreen();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("skips phones and tablets", () => {
    setPointer(true);
    const request = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = request;
    enterPageFullscreen();
    expect(request).not.toHaveBeenCalled();
  });

  it("never throws when the browser refuses", async () => {
    setPointer(false);
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    expect(() => enterPageFullscreen()).not.toThrow();
    await Promise.resolve();
  });
});
