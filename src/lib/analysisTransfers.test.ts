import { describe, expect, it } from "vitest";
import {
  describeEstimate,
  describeInputPreload,
  describeOutputUpload,
  formatEta,
  formatLinkSpeed,
  secondsFor,
  transferPercent,
} from "./analysisTransfers";

const GB = 1024 ** 3;

describe("formatEta", () => {
  it("speaks in plain minutes and hours", () => {
    expect(formatEta(30)).toBe("under a minute");
    expect(formatEta(6 * 60)).toBe("about 6 min");
    expect(formatEta(80 * 60)).toBe("about 1 h 20 min");
    expect(formatEta(120 * 60)).toBe("about 2 h");
    expect(formatEta(null)).toBeNull();
  });
});

describe("transfer maths", () => {
  it("computes percent and time from Mbps", () => {
    expect(transferPercent(5, 10)).toBe(50);
    expect(transferPercent(5, 0)).toBeNull();
    // 20 GB at 100 Mbps ≈ 29 minutes (the plan's example).
    expect(Math.round((secondsFor(20 * GB, 100) ?? 0) / 60)).toBe(29);
  });
});

describe("describeInputPreload", () => {
  it("shows files, size and time while downloading", () => {
    const v = describeInputPreload({
      state: "downloading",
      files_done: 3,
      files_total: 5,
      bytes_done: 12 * GB,
      bytes_total: 40 * GB,
      eta_seconds: 360,
    });
    expect(v?.tone).toBe("progress");
    expect(v?.detail).toContain("3 of 5 files");
    expect(v?.detail).toContain("about 6 min");
    expect(v?.percent).toBe(30);
  });

  it("is calm when it cannot pre-load", () => {
    expect(describeInputPreload({ state: "failed", detail: "disk_full" })?.detail).toMatch(/short of space/);
    expect(describeInputPreload(null)).toBeNull();
  });
});

describe("describeOutputUpload", () => {
  it("tells the user they can close the page while uploading", () => {
    const v = describeOutputUpload({ state: "uploading", bytes_done: 18 * GB, bytes_total: 40 * GB, eta_seconds: 1200 });
    expect(v?.title).toBe("Uploading your results to My Research");
    expect(v?.detail).toMatch(/You can close this page/);
  });

  it("names the destination when done and explains a pause", () => {
    expect(describeOutputUpload({ state: "done", destination_label: "My Research › Polymer", files_total: 2 })?.title).toBe(
      "Your results are in My Research › Polymer",
    );
    expect(describeOutputUpload({ state: "paused", paused_reason: "The Analysis PC is offline" })?.detail).toContain("offline");
  });
});

describe("describeEstimate", () => {
  it("warns over the limit and estimates big inputs", () => {
    expect(describeEstimate({ size_limit_bytes: 10 * GB, input_bytes: 12 * GB })?.warn).toBe(true);
    const est = describeEstimate({ input_bytes: 20 * GB, download_mbps: 100 });
    expect(est?.warn).toBe(false);
    expect(est?.text).toMatch(/it starts before you join/);
    expect(describeEstimate({ input_bytes: 100 * 1024 ** 2, download_mbps: 100 })).toBeNull();
  });
});

describe("formatLinkSpeed", () => {
  it("shows up and down speeds", () => {
    expect(formatLinkSpeed({ upload_mbps: 94.4, download_mbps: 310 })).toBe("↑ 94 / ↓ 310 Mbps");
    expect(formatLinkSpeed(null)).toBeNull();
  });
});
