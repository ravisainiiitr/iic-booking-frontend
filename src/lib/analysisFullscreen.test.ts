// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { enterPageFullscreen, fullscreenMode, sessionViewport } from "./analysisFullscreen";

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

describe("sessionViewport", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens the desktop at the full screen size on a computer", () => {
    setPointer(false);
    vi.spyOn(window, "screen", "get").mockReturnValue({ width: 1536, height: 864 } as Screen);
    expect(sessionViewport(null, 64)).toMatchObject({ width: 1536, height: 864 });
  });

  it("uses the visible area on phones", () => {
    setPointer(true);
    vi.spyOn(window, "screen", "get").mockReturnValue({ width: 1536, height: 864 } as Screen);
    const v = sessionViewport(null, 64);
    expect(v.width).toBe(window.innerWidth);
  });
});

describe("fullscreenMode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("treats a browser window as large as the screen (F11) as full screen", () => {
    vi.spyOn(window, "screen", "get").mockReturnValue({ width: 1280, height: 720 } as Screen);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(720);
    expect(fullscreenMode()).toBe("browser");
  });

  it("is not full screen in a normal window", () => {
    vi.spyOn(window, "screen", "get").mockReturnValue({ width: 1280, height: 720 } as Screen);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(640);
    expect(fullscreenMode()).toBeNull();
  });
});
