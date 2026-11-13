/**
 * Which devices and browsers can run a Remote Analysis session, and what to tell people on the others.
 *
 * The Analysis PC is reached only through the portal's in-browser remote desktop (HTML5, over the portal's
 * own HTTPS address). There is no RDP file or app option: the Analysis PCs sit on the equipment LAN behind
 * the portal's reverse tunnel, so a desktop RDP client could not reach them, and the portal never hands
 * out the PC's Windows password.
 *
 * The rules follow what the large virtual-desktop services publish:
 * - Microsoft's Remote Desktop web client does not support mobile phone browsers (phones use the app).
 * - Amazon WorkSpaces web access supports the latest Chrome, Edge, Firefox and Safari on Windows, macOS and
 *   Linux, and only Chrome and Safari on tablets.
 * Analysis software is mouse-and-keyboard desktop software, so a phone is blocked and a tablet is a warning.
 */

export type DeviceClass = "desktop" | "tablet" | "phone";
export type Verdict = "ok" | "warn" | "block";

export type ClientInfo = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  screenWidth?: number;
  screenHeight?: number;
  /** CSS pixels of the window the desktop will be drawn in. */
  viewportWidth?: number;
  viewportHeight?: number;
  cookiesEnabled?: boolean;
  webSocket?: boolean;
  online?: boolean;
};

export type DeviceCheck = {
  id: "device" | "browser" | "screen" | "features" | "network";
  label: string;
  verdict: Verdict;
  detail: string;
};

export type DeviceReport = {
  device: DeviceClass;
  os: string;
  browser: string;
  browserVersion: number | null;
  verdict: Verdict;
  checks: DeviceCheck[];
  /** One sentence for the top of the panel. */
  headline: string;
  /** What to do instead, shown when the verdict is not ok. */
  alternatives: string[];
};

/** Oldest major version accepted per browser: roughly two years of releases, so school and lab PCs still pass. */
export const MIN_BROWSER_VERSION: Record<string, number> = {
  Chrome: 109,
  Edge: 109,
  Firefox: 115,
  Safari: 16,
  Opera: 95,
};

export const MIN_VIEWPORT = { width: 1024, height: 600 };

/** The published minimum requirements, as shown to users. */
export const MINIMUM_REQUIREMENTS: string[] = [
  "A laptop or desktop computer running Windows 10 or later, macOS 12 or later, Linux, or ChromeOS.",
  `A current browser: Chrome or Edge ${MIN_BROWSER_VERSION.Chrome}+, Firefox ${MIN_BROWSER_VERSION.Firefox}+ or Safari ${MIN_BROWSER_VERSION.Safari}+.`,
  `A screen at least ${MIN_VIEWPORT.width} × ${MIN_VIEWPORT.height} pixels, with a keyboard and mouse or trackpad.`,
  "A steady connection of 2 Mbps or more with under 150 ms delay to the portal (campus LAN or Wi-Fi, or a good home connection). Nothing to install; no VPN needed.",
  "Cookies allowed for equip.iitr.ac.in. Pop-up or script blockers must allow the portal.",
];

function versionOf(ua: string, re: RegExp): number | null {
  const m = ua.match(re);
  return m ? Number.parseInt(m[1], 10) : null;
}

export function detectBrowser(ua: string): { browser: string; version: number | null } {
  if (/EdgA?\/|Edg\//.test(ua)) return { browser: "Edge", version: versionOf(ua, /Edg[A-Za-z]*\/(\d+)/) };
  if (/OPR\//.test(ua)) return { browser: "Opera", version: versionOf(ua, /OPR\/(\d+)/) };
  if (/SamsungBrowser\//.test(ua)) return { browser: "Samsung Internet", version: versionOf(ua, /SamsungBrowser\/(\d+)/) };
  if (/FxiOS\//.test(ua)) return { browser: "Firefox", version: versionOf(ua, /FxiOS\/(\d+)/) };
  if (/CriOS\//.test(ua)) return { browser: "Chrome", version: versionOf(ua, /CriOS\/(\d+)/) };
  if (/Firefox\//.test(ua)) return { browser: "Firefox", version: versionOf(ua, /Firefox\/(\d+)/) };
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return { browser: "Chrome", version: versionOf(ua, /Chrom(?:e|ium)\/(\d+)/) };
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return { browser: "Safari", version: versionOf(ua, /Version\/(\d+)/) };
  if (/MSIE |Trident\//.test(ua)) return { browser: "Internet Explorer", version: null };
  return { browser: "Unknown browser", version: null };
}

export function detectOs(ua: string, platform = "", maxTouchPoints = 0): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/iPad/.test(ua)) return "iPadOS";
  // iPadOS 13+ reports itself as a Mac; only a touch screen tells them apart.
  if (/Macintosh|Mac OS X/.test(ua)) return maxTouchPoints > 1 ? "iPadOS" : "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux|X11/.test(ua) || /Linux/.test(platform)) return "Linux";
  return "Unknown system";
}

export function detectDevice(ua: string, os: string, info: Pick<ClientInfo, "maxTouchPoints" | "screenWidth" | "screenHeight">): DeviceClass {
  if (/iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua)) || /Windows Phone|Mobi/.test(ua)) return "phone";
  if (os === "iPadOS" || /iPad|Tablet/.test(ua) || (os === "Android" && !/Mobile/.test(ua))) return "tablet";
  const shortSide = Math.min(info.screenWidth || 0, info.screenHeight || 0);
  if ((info.maxTouchPoints || 0) > 1 && shortSide > 0 && shortSide < 480 && os !== "Windows") return "phone";
  return "desktop";
}

const ALTERNATIVES_PHONE = [
  "Use a laptop or desktop computer — a campus lab PC or your own — and open this booking there.",
  "You can keep this page open on your phone to watch your place in the queue; you will be told here, by email and on WhatsApp when your Analysis PC is ready.",
  "Need help? Ask the Lab Operator from the booking details page.",
];

export function evaluateClient(info: ClientInfo): DeviceReport {
  const ua = info.userAgent || "";
  const os = detectOs(ua, info.platform, info.maxTouchPoints);
  const { browser, version } = detectBrowser(ua);
  const device = detectDevice(ua, os, info);
  const checks: DeviceCheck[] = [];

  if (device === "phone") {
    checks.push({
      id: "device",
      label: "Device",
      verdict: "block",
      detail: "Phones are not supported: the analysis software needs a large screen, a keyboard and a mouse.",
    });
  } else if (device === "tablet") {
    checks.push({
      id: "device",
      label: "Device",
      verdict: "warn",
      detail: "Tablets work best with a keyboard and mouse attached. Some software may be hard to use by touch.",
    });
  } else {
    checks.push({ id: "device", label: "Device", verdict: "ok", detail: `${os} computer` });
  }

  const min = MIN_BROWSER_VERSION[browser];
  if (browser === "Internet Explorer") {
    checks.push({ id: "browser", label: "Browser", verdict: "block", detail: "Internet Explorer cannot run the remote desktop. Use Chrome, Edge, Firefox or Safari." });
  } else if (min == null) {
    checks.push({
      id: "browser",
      label: "Browser",
      verdict: "warn",
      detail: `${browser} has not been tested. If the desktop does not appear, switch to Chrome, Edge, Firefox or Safari.`,
    });
  } else if (version != null && version < min) {
    checks.push({
      id: "browser",
      label: "Browser",
      verdict: "block",
      detail: `${browser} ${version} is too old. Update to ${browser} ${min} or later, or use another current browser.`,
    });
  } else if (device === "tablet" && !["Chrome", "Safari"].includes(browser)) {
    checks.push({ id: "browser", label: "Browser", verdict: "warn", detail: `On a tablet, use Chrome or Safari for the best results.` });
  } else {
    checks.push({ id: "browser", label: "Browser", verdict: "ok", detail: `${browser}${version ? ` ${version}` : ""}` });
  }

  const w = info.viewportWidth || info.screenWidth || 0;
  const h = info.viewportHeight || info.screenHeight || 0;
  if (w && h && (w < MIN_VIEWPORT.width || h < MIN_VIEWPORT.height)) {
    checks.push({
      id: "screen",
      label: "Screen",
      verdict: device === "phone" ? "block" : "warn",
      detail: `This window is ${w} × ${h}. The desktop needs at least ${MIN_VIEWPORT.width} × ${MIN_VIEWPORT.height}; maximise the window or use Fullscreen.`,
    });
  } else if (w && h) {
    checks.push({ id: "screen", label: "Screen", verdict: "ok", detail: `${w} × ${h}` });
  }

  const missing: string[] = [];
  if (info.webSocket === false) missing.push("WebSockets");
  if (info.cookiesEnabled === false) missing.push("cookies");
  checks.push(
    missing.length
      ? { id: "features", label: "Browser settings", verdict: "block", detail: `Turn on ${missing.join(" and ")} for this site, then reload.` }
      : { id: "features", label: "Browser settings", verdict: "ok", detail: "Cookies and secure connections allowed" },
  );

  if (info.online === false) {
    checks.push({ id: "network", label: "Network", verdict: "block", detail: "You are offline. Reconnect to the internet, then try again." });
  }

  const verdict: Verdict = checks.some((c) => c.verdict === "block") ? "block" : checks.some((c) => c.verdict === "warn") ? "warn" : "ok";
  const headline =
    verdict === "ok"
      ? "This device is ready for a Remote Analysis session."
      : verdict === "warn"
        ? "This device should work, with the notes below."
        : device === "phone"
          ? "Remote Analysis sessions cannot be run from a phone."
          : "This browser cannot run the session yet — see below.";
  const alternatives =
    verdict === "ok"
      ? []
      : device === "phone"
        ? ALTERNATIVES_PHONE
        : [
            "Use Chrome, Edge, Firefox or Safari, kept up to date, on a laptop or desktop.",
            "Campus lab PCs meet these requirements.",
            "Need help? Ask the Lab Operator from the booking details page.",
          ];
  return { device, os, browser, browserVersion: version, verdict, checks, headline, alternatives };
}

export function currentClientInfo(): ClientInfo {
  if (typeof window === "undefined") return { userAgent: "" };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    cookiesEnabled: navigator.cookieEnabled,
    webSocket: typeof window.WebSocket === "function",
    online: navigator.onLine,
  };
}

/** Round-trip time to the portal in ms, or null when the request failed. */
export async function measurePortalLatency(url = "/robots.txt", samples = 3): Promise<number | null> {
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const t0 = performance.now();
    try {
      await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}${i}`, { method: "GET", cache: "no-store", credentials: "omit" });
      times.push(performance.now() - t0);
    } catch {
      return null;
    }
  }
  times.sort((a, b) => a - b);
  return Math.round(times[Math.floor(times.length / 2)]);
}

export function latencyCheck(ms: number | null): DeviceCheck {
  if (ms == null) return { id: "network", label: "Network", verdict: "block", detail: "The portal could not be reached. Check your connection, then try again." };
  if (ms > 300) return { id: "network", label: "Network", verdict: "warn", detail: `Slow connection (${ms} ms). The desktop may lag; a wired or campus connection helps.` };
  if (ms > 150) return { id: "network", label: "Network", verdict: "warn", detail: `Connection delay ${ms} ms. Usable, but typing may feel slightly delayed.` };
  return { id: "network", label: "Network", verdict: "ok", detail: `Good connection (${ms} ms)` };
}
