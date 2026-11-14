import { describe, expect, it } from "vitest";
import { detectBrowser, evaluateClient, latencyCheck, MINIMUM_REQUIREMENTS } from "./analysisDevicePolicy";
import { friendlyAnalysisError, stripCategory } from "./analysisErrors";

const UA = {
  winChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  oldChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  ie11: "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
};

const desktopScreen = { screenWidth: 1920, screenHeight: 1080, viewportWidth: 1600, viewportHeight: 900, cookiesEnabled: true, webSocket: true, online: true };

describe("analysis device policy", () => {
  it.each([
    [UA.winChrome, "Windows", "Chrome"],
    [UA.winEdge, "Windows", "Edge"],
    [UA.macSafari, "macOS", "Safari"],
    [UA.linuxFirefox, "Linux", "Firefox"],
  ])("accepts a current desktop browser (%#)", (ua, os, browser) => {
    const r = evaluateClient({ userAgent: ua, ...desktopScreen });
    expect(r.device).toBe("desktop");
    expect(r.os).toBe(os);
    expect(r.browser).toBe(browser);
    expect(r.verdict).toBe("ok");
    expect(r.alternatives).toEqual([]);
  });

  it("blocks phones and offers alternatives, including watching the queue", () => {
    for (const ua of [UA.iphone, UA.androidPhone]) {
      const r = evaluateClient({ userAgent: ua, maxTouchPoints: 5, screenWidth: 390, screenHeight: 844, viewportWidth: 390, viewportHeight: 700 });
      expect(r.device).toBe("phone");
      expect(r.verdict).toBe("block");
      expect(r.headline).toMatch(/phone/i);
      expect(r.alternatives.join(" ")).toMatch(/laptop or desktop/);
      expect(r.alternatives.join(" ")).toMatch(/queue/);
    }
  });

  it("warns on tablets, including an iPad that reports itself as a Mac", () => {
    const android = evaluateClient({ userAgent: UA.androidTablet, maxTouchPoints: 5, screenWidth: 1280, screenHeight: 800, viewportWidth: 1280, viewportHeight: 760 });
    expect(android.device).toBe("tablet");
    expect(android.verdict).toBe("warn");
    const ipad = evaluateClient({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 5, screenWidth: 1024, screenHeight: 1366, viewportWidth: 1024, viewportHeight: 1300 });
    expect(ipad.os).toBe("iPadOS");
    expect(ipad.device).toBe("tablet");
  });

  it("blocks old browsers and Internet Explorer with an update hint", () => {
    const old = evaluateClient({ userAgent: UA.oldChrome, ...desktopScreen });
    expect(old.verdict).toBe("block");
    expect(old.checks.find((c) => c.id === "browser")?.detail).toMatch(/Update to Chrome 109/);
    expect(evaluateClient({ userAgent: UA.ie11, ...desktopScreen }).verdict).toBe("block");
  });

  it("warns about a small window and blocks without cookies, WebSockets or a network", () => {
    expect(evaluateClient({ userAgent: UA.winChrome, ...desktopScreen, viewportWidth: 800, viewportHeight: 500 }).verdict).toBe("warn");
    expect(evaluateClient({ userAgent: UA.winChrome, ...desktopScreen, cookiesEnabled: false }).verdict).toBe("block");
    expect(evaluateClient({ userAgent: UA.winChrome, ...desktopScreen, webSocket: false }).verdict).toBe("block");
    expect(evaluateClient({ userAgent: UA.winChrome, ...desktopScreen, online: false }).verdict).toBe("block");
  });

  it("detects Chrome on iOS and Firefox before Chrome", () => {
    expect(detectBrowser("Mozilla/5.0 (iPhone) CriOS/130.0 Mobile Safari/604.1").browser).toBe("Chrome");
    expect(detectBrowser(UA.linuxFirefox)).toEqual({ browser: "Firefox", version: 128 });
  });

  it("grades latency and states the minimum requirements", () => {
    expect(latencyCheck(40).verdict).toBe("ok");
    expect(latencyCheck(200).verdict).toBe("warn");
    expect(latencyCheck(null).verdict).toBe("block");
    expect(MINIMUM_REQUIREMENTS.join(" ")).toMatch(/Chrome or Edge 109\+/);
  });
});

describe("friendly analysis errors", () => {
  it("drops the internal category prefix", () => {
    expect(stripCategory("[credentials] Workstation Windows credentials are not configured.")).toBe(
      "Workstation Windows credentials are not configured.",
    );
  });

  it("maps known failures to an action", () => {
    expect(friendlyAnalysisError("[credentials] Workstation Windows credentials are not configured.")?.action).toBe("contact_lab");
    expect(friendlyAnalysisError("Check-in window expired. Please request analysis again.")?.action).toBe("request_again");
    expect(friendlyAnalysisError("Reverse tunnel is joining — try again")?.transient).toBe(true);
    expect(friendlyAnalysisError("", "queue_blocked")?.title).toMatch(/waiting/);
    expect(friendlyAnalysisError("Failed to fetch")?.action).toBe("reconnect");
    expect(friendlyAnalysisError("The previous user is saving their work. Your Analysis PC opens in about 2 minutes.")?.action).toBe("wait");
  });

  it("keeps unknown text and returns null for nothing", () => {
    expect(friendlyAnalysisError("Disk quota reached")?.detail).toBe("Disk quota reached");
    expect(friendlyAnalysisError(null)).toBeNull();
  });
});
