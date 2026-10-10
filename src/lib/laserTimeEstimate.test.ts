import { describe, expect, it } from "vitest";
import type { LaserJobTimeEstimate } from "@/lib/api";
import {
  formatMinutes,
  formatSeconds,
  laserJobEstimateFromInputs,
  laserJobEstimateLines,
  laserPartTimeText,
} from "@/lib/laserTimeEstimate";

const job: LaserJobTimeEstimate = {
  preset: "co2_laser",
  preset_label: "CO2 laser cutter (non-metals, 80-150 W)",
  cutting_min: 6.2,
  setup_min: 10,
  sheets: 2,
  sheet_min: 6,
  allowance_pct: 10,
  allowance_min: 2.2,
  total_min: 25,
  warnings: [],
};

describe("formatSeconds", () => {
  it("matches the booking email wording", () => {
    expect(formatSeconds(45.4)).toBe("45 s");
    expect(formatSeconds(725)).toBe("12 min 5 s");
    expect(formatSeconds(720)).toBe("12 min");
    expect(formatSeconds(7440)).toBe("2 h 4 min");
    expect(formatSeconds(7200)).toBe("2 h");
    expect(formatSeconds(null)).toBe("0 s");
    expect(formatMinutes(25)).toBe("25 min");
  });
});

describe("laserPartTimeText", () => {
  it("summarises one copy of a part", () => {
    expect(
      laserPartTimeText({
        cut_length_mm: 1996.4,
        pierces: 1,
        cut_speed_mm_s: 16,
        pierce_s: 0.5,
        seconds_each: 130,
        cutting_seconds_each: 125,
        pierce_seconds_each: 1,
        travel_seconds_each: 4,
        minutes_total: 2.2,
      }),
    ).toBe("2 min 10 s each · 1,996 mm cut · 1 pierce");
    expect(laserPartTimeText(null)).toBeNull();
  });
});

describe("laser job estimate", () => {
  it("is read from the calculate response's input values", () => {
    expect(laserJobEstimateFromInputs({ A: "1", _laser_time_estimate: job })).toEqual(job);
    expect(laserJobEstimateFromInputs({ A: "1" })).toBeNull();
    expect(laserJobEstimateFromInputs({ _laser_time_estimate: { total_min: 0, cutting_min: 0 } })).toBeNull();
    expect(laserJobEstimateFromInputs(null)).toBeNull();
  });

  it("lists cutting, setup, sheet loading and the allowance", () => {
    expect(laserJobEstimateLines(job)).toEqual([
      { label: "Cutting, piercing and head moves", minutes: 6.2 },
      { label: "Job setup", minutes: 10 },
      { label: "Loading 2 sheets", minutes: 6 },
      { label: "Allowance (10%)", minutes: 2.2 },
    ]);
    expect(laserJobEstimateLines({ ...job, setup_min: 0, allowance_min: 0, sheets: 1, sheet_min: 3 })).toEqual([
      { label: "Cutting, piercing and head moves", minutes: 6.2 },
      { label: "Loading 1 sheet", minutes: 3 },
    ]);
  });
});
