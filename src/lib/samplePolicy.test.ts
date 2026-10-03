import { describe, expect, it } from "vitest";
import {
  bookingSampleDeadline,
  bringsSampleToSlot,
  estimateSampleDeadline,
  isWalkInSampleEquipment,
  sampleAtSlotEquipment,
  sampleAtSlotShortList,
  shortEquipmentLabel,
  typicalSampleLeadHours,
  type SamplePolicyEquipment,
} from "./samplePolicy";

const eq = (id: number, name: string, lead: number | null, collect = 72, parent: number | null = null): SamplePolicyEquipment => ({
  equipment_id: id,
  code: `C${id}`,
  name,
  parent_equipment: parent,
  sample_submission_lead_hours: lead,
  sample_collect_deadline_hours: collect,
});

const ROWS = [
  eq(10, "Field Emission Scanning Electron Microscope (FE-SEM)-APREO", 0, 0),
  eq(5, "Field Emission Scanning Electron Microscope (FE-SEM)-GEMINI 300", 0),
  eq(37, "Electron Backscatter Diffraction (EBSD)", 0, 72, 10),
  eq(38, "Transmission Electron Microscope (TEM)", 0),
  eq(42, "Scanning Probe Microscope (SPM)", 0),
  eq(1, "Powder X-Ray Diffractometer (PXRD) [A]", 24),
  eq(7, "Nuclear Magnetic Resonance (NMR)", 24),
  eq(4, "X-Ray Photoelectron Spectroscopy (XPS)", 48),
  eq(99, "Unknown timing", null),
];

describe("sample policy from equipment configuration", () => {
  it("treats a lead time of 0 as brought to the slot, and unknown timings as not", () => {
    expect(bringsSampleToSlot(ROWS[0])).toBe(true);
    expect(bringsSampleToSlot(ROWS[5])).toBe(false);
    expect(bringsSampleToSlot(ROWS[8])).toBe(false);
    expect(isWalkInSampleEquipment(ROWS[0])).toBe(true);
    expect(isWalkInSampleEquipment(ROWS[1])).toBe(false);
  });

  it("lists brought-to-the-slot equipment and short names of top-level instruments", () => {
    expect(sampleAtSlotEquipment(ROWS).map((r) => r.equipment_id)).toEqual([37, 10, 5, 42, 38]);
    expect(sampleAtSlotShortList(ROWS)).toBe("FE-SEM, SPM and TEM");
    expect(sampleAtSlotShortList([])).toBe("");
    expect(shortEquipmentLabel({ name: "CNC Lathe", code: "CNCL1" })).toBe("CNCL1");
  });

  it("finds the most common lead time", () => {
    expect(typicalSampleLeadHours(ROWS)).toBe(24);
    expect(typicalSampleLeadHours([ROWS[0]])).toBeNull();
  });

  it("moves an estimated deadline back over the weekend keeping the time", () => {
    const tue = estimateSampleDeadline(new Date(2026, 9, 6, 10, 0), 24);
    expect(tue.deadline).toEqual(new Date(2026, 9, 5, 10, 0));
    expect(tue.movedFromWeekend).toBe(false);
    const mon = estimateSampleDeadline(new Date(2026, 9, 5, 10, 0), 24);
    expect(mon.deadline).toEqual(new Date(2026, 9, 2, 10, 0));
    expect(mon.movedFromWeekend).toBe(true);
  });

  it("describes a booking's deadline: at the slot, reported by the server, estimated or unknown", () => {
    const start = new Date(2026, 9, 6, 10, 0).toISOString();
    expect(bookingSampleDeadline({ equipmentId: 38, startTime: start, deadlineAt: "2026-10-05T04:30:00Z" }, ROWS)).toEqual({
      kind: "at-slot",
      walkIn: false,
    });
    expect(bookingSampleDeadline({ equipmentId: 1, startTime: start, deadlineAt: "2026-10-05T04:30:00Z", leadHours: 24 }, ROWS)).toEqual({
      kind: "deadline",
      deadlineAt: "2026-10-05T04:30:00Z",
      leadHours: 24,
    });
    expect(bookingSampleDeadline({ equipmentId: 4, startTime: start }, ROWS)).toMatchObject({ kind: "estimate", leadHours: 48 });
    expect(bookingSampleDeadline({ equipmentId: 1234, startTime: start }, ROWS)).toEqual({ kind: "unknown" });
  });
});
