import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api" }));

import { derivePeakSnapshot, formatPeakClock, isPeakBlockableUserType, type PeakWindowStatus } from "./peakWindow";

// Wednesday 7 Oct 2026, opening 21:00 IST; window 20:55–21:15; notice from 20:25.
const WINDOW = {
  opening_at: "2026-10-07T21:00:00+05:30",
  starts_at: "2026-10-07T20:55:00+05:30",
  ends_at: "2026-10-07T21:15:00+05:30",
};

const offPeakStatus = (over: Partial<PeakWindowStatus> = {}): PeakWindowStatus => ({
  enabled: true,
  peak_window_active: false,
  starts_at: null,
  ends_at: null,
  opening_at: null,
  next_window: WINDOW,
  block_external_users: true,
  external_access_paused: false,
  external_notice_active: false,
  external_notice_starts_at: "2026-10-07T20:25:00+05:30",
  external_paused_message:
    "To give IIT Roorkee users a fair chance when new slots open, external access is paused from 8:55 pm to 9:15 pm on Wednesdays. Please come back after 9:15 pm.",
  server_time: "2026-10-07T18:00:00+05:30",
  ...over,
});

const at = (hhmmss: string) => Date.parse(`2026-10-07T${hhmmss}+05:30`);

describe("derivePeakSnapshot", () => {
  it("is idle well before the window", () => {
    const s = derivePeakSnapshot(offPeakStatus(), at("19:00:00"));
    expect(s).toMatchObject({ loaded: true, active: false, externalPaused: false, externalNotice: false });
    expect(s.window?.starts_at).toBe(WINDOW.starts_at);
  });

  it("shows the external notice in the 30 minutes before the window", () => {
    expect(derivePeakSnapshot(offPeakStatus(), at("20:24:59")).externalNotice).toBe(false);
    expect(derivePeakSnapshot(offPeakStatus(), at("20:25:00")).externalNotice).toBe(true);
    expect(derivePeakSnapshot(offPeakStatus(), at("20:54:59")).externalNotice).toBe(true);
  });

  it("flips to active exactly at opening − 5 min and back at opening + 15 min, using the cached next window", () => {
    const status = offPeakStatus();
    expect(derivePeakSnapshot(status, at("20:54:59")).active).toBe(false);
    const open = derivePeakSnapshot(status, at("20:55:00"));
    expect(open).toMatchObject({ active: true, externalPaused: true, externalNotice: false });
    expect(derivePeakSnapshot(status, at("21:14:59")).active).toBe(true);
    expect(derivePeakSnapshot(status, at("21:15:00")).active).toBe(false);
  });

  it("does not pause external users when blocking is switched off", () => {
    const s = derivePeakSnapshot(offPeakStatus({ block_external_users: false }), at("21:00:00"));
    expect(s.active).toBe(true);
    expect(s.externalPaused).toBe(false);
    expect(derivePeakSnapshot(offPeakStatus({ block_external_users: false }), at("20:30:00")).externalNotice).toBe(false);
  });

  it("is never active when the feature is disabled", () => {
    const s = derivePeakSnapshot(offPeakStatus({ enabled: false }), at("21:00:00"));
    expect(s).toMatchObject({ loaded: true, active: false, externalPaused: false });
  });

  it("is unloaded without a status", () => {
    expect(derivePeakSnapshot(null, at("21:00:00")).loaded).toBe(false);
  });
});

describe("helpers", () => {
  it("formats times in IST regardless of the browser zone", () => {
    expect(formatPeakClock(WINDOW.starts_at)).toBe("8:55 pm");
    expect(formatPeakClock(WINDOW.ends_at)).toBe("9:15 pm");
  });

  it("treats external, R&D, industry, startup/MSME and other as blockable", () => {
    for (const t of ["external", "RND", "Industry", "external_startup_msme", "other"]) {
      expect(isPeakBlockableUserType(t)).toBe(true);
    }
    for (const t of ["student", "faculty", "admin", "manager", "dept_admin", "operator", "finance", "org_admin", 1, 2]) {
      expect(isPeakBlockableUserType(t)).toBe(false);
    }
  });
});
