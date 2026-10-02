import { describe, expect, it } from "vitest";
import {
  coursePurposeHint,
  deadlineCountdown,
  demoTermsParts,
  durationPresets,
  estimateCharge,
  formatDuration,
  formatScore,
  fromLocalInputValue,
  humanizeCode,
  isCurtailed,
  parseIdList,
  scoreBreakdownRows,
  scoreFactorLabel,
  statusMeta,
  toLocalInputValue,
  trainingBadgeLabel,
} from "./trainingHelpers";

describe("statusMeta", () => {
  it("maps known statuses to a label and tone", () => {
    expect(statusMeta("demo", "PROPOSED_ALTERNATIVE")).toEqual({ label: "New time proposed", tone: "warning" });
    expect(statusMeta("demo", "REJECTED").tone).toBe("danger");
    expect(statusMeta("nomination", "CONFIRMED")).toEqual({ label: "Seat confirmed", tone: "success" });
    expect(statusMeta("call", "PUBLISHED").tone).toBe("accent");
    expect(statusMeta("session", "cancelled").tone).toBe("muted");
  });

  it("prefers the server label and humanizes unknown codes", () => {
    expect(statusMeta("demo", "SUBMITTED", "Awaiting OIC").label).toBe("Awaiting OIC");
    expect(statusMeta("event", "SOMETHING_NEW")).toEqual({ label: "Something new", tone: "neutral" });
    expect(statusMeta("demo", null).label).toBe("—");
  });

  it("humanizes codes", () => {
    expect(humanizeCode("HANDS_ON")).toBe("Hands on");
    expect(humanizeCode("")).toBe("");
  });
});

describe("score breakdown", () => {
  it("orders known factors first, keeps extras and drops empty values", () => {
    const rows = scoreBreakdownRows({
      cooldown: -2,
      extra_bonus: "1.5",
      research_need: 3,
      first_time_equipment: 2,
      demand: null,
    });
    expect(rows.map((r) => r.key)).toEqual(["first_time_equipment", "research_need", "cooldown", "extra_bonus"]);
    expect(rows[3]).toEqual({ key: "extra_bonus", label: "Extra bonus", value: 1.5 });
    expect(scoreBreakdownRows(null)).toEqual([]);
  });

  it("labels factors", () => {
    expect(scoreFactorLabel("department_underrepresentation")).toBe("Department under-represented");
    expect(scoreFactorLabel("prior_no_show")).toBe("Prior no-show");
  });

  it("formats scores", () => {
    expect(formatScore(7)).toBe("7");
    expect(formatScore("6.456")).toBe("6.46");
    expect(formatScore(null)).toBe("—");
  });
});

describe("isCurtailed", () => {
  it("detects reduced duration or participants", () => {
    expect(isCurtailed({ duration: 120, participants: 10 }, { duration: 90, participants: 10 })).toBe(true);
    expect(isCurtailed({ duration: 120, participants: 10 }, { duration: 120, participants: 8 })).toBe(true);
  });

  it("is false when approving as requested, more, or with missing values", () => {
    expect(isCurtailed({ duration: 120, participants: 10 }, { duration: 120, participants: 10 })).toBe(false);
    expect(isCurtailed({ duration: 60, participants: 5 }, { duration: 90, participants: 6 })).toBe(false);
    expect(isCurtailed({ duration: 60 }, { duration: null, participants: 3 })).toBe(false);
  });
});

describe("charges", () => {
  it("builds the policy banner from the Training Policy terms", () => {
    expect(demoTermsParts({ demo_max_minutes: 180, demo_refund_full_days: 7, demo_refund_half_days: 2 })).toEqual([
      "Charged at internal IITR rates",
      "Max 3 h per demonstration",
      "Full refund if cancelled ≥ 7 day(s) ahead, half refund ≥ 2 day(s)",
      "Amount is deducted from your wallet",
    ]);
    expect(demoTermsParts({ demo_max_minutes: 90, demo_refund_full_days: 10, demo_refund_half_days: null, course_demos_free: true })).toEqual([
      "Charged at internal IITR rates (course/curricular demonstrations free)",
      "Max 1 h 30 min per demonstration",
      "Full refund if cancelled ≥ 10 day(s) ahead",
      "Amount is deducted from your wallet",
    ]);
    expect(demoTermsParts(null)).toEqual(["Charged at internal IITR rates", "Amount is deducted from your wallet"]);
  });

  it("hides duration chips above the policy maximum", () => {
    expect(durationPresets(180)).toEqual([60, 90, 120, 180]);
    expect(durationPresets(null)).toEqual([60, 90, 120, 180, 240]);
  });

  it("describes whether course demonstrations are free", () => {
    expect(coursePurposeHint(true)).toBe("Course/curricular demonstrations are free.");
    expect(coursePurposeHint(false)).toMatch(/charged at the internal IITR rate/);
  });

  it("estimates the charge from the hourly rate", () => {
    expect(estimateCharge("600", 90)).toBe(900);
    expect(estimateCharge("bad", 60)).toBe(0);
    expect(estimateCharge("600", 0)).toBe(0);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
    expect(formatDuration(0)).toBe("—");
  });

  it("round-trips datetime-local values in local time", () => {
    const local = "2026-10-12T10:30";
    const iso = fromLocalInputValue(local);
    expect(iso).not.toBe("");
    expect(toLocalInputValue(iso)).toBe(local);
    expect(fromLocalInputValue("")).toBe("");
    expect(toLocalInputValue(null)).toBe("");
  });

  it("shows a countdown to a deadline", () => {
    const now = new Date("2026-10-02T10:00:00Z");
    expect(deadlineCountdown("2026-10-04T14:00:00Z", now)).toBe("2 d 4 h left");
    expect(deadlineCountdown("2026-10-02T12:30:00Z", now)).toBe("2 h 30 min left");
    expect(deadlineCountdown("2026-10-02T09:00:00Z", now)).toBe("Deadline passed");
    expect(deadlineCountdown(null, now)).toBe("");
  });

  it("parses id lists", () => {
    expect(parseIdList("3, 5 5;x 12,-1")).toEqual([3, 5, 12]);
    expect(parseIdList("")).toEqual([]);
  });

  it("labels badges", () => {
    expect(trainingBadgeLabel({ level: "TRAINED", name: "Trained", equipment_code: "XRD-01", equipment_name: "XRD" })).toBe(
      "Trained · XRD-01",
    );
    expect(trainingBadgeLabel({ level: "CERT_L1", name: "Certified L1", equipment_code: "", equipment_name: "SEM" })).toBe(
      "Certified L1 · SEM",
    );
  });
});
