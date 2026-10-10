import { describe, expect, it } from "vitest";
import type { PrintEstimateBreakdown } from "@/lib/api";
import {
  formatPrintDuration,
  printEstimateSummary,
  printWeightSplit,
  sumPrintEstimates,
  supportModeSummary,
  supportTypeMaterialNote,
} from "@/lib/printEstimate";

function breakdown(over: Partial<PrintEstimateBreakdown> = {}): PrintEstimateBreakdown {
  return {
    technology: "FDM",
    model_g: 18.2,
    support_g: 3.1,
    waste_g: 0.5,
    total_g: 21.8,
    model_material_g: 21.8,
    support_material_g: 0,
    print_min: 145,
    support_min: 12,
    warmup_min: 10,
    total_min: 155,
    layers: 400,
    layer_height_mm: 0.1,
    infill_percent: 20,
    support_mode: "buildplate",
    support_mode_requested: "auto",
    overhang_area_mm2: 820,
    overhang_plate_mm2: 600,
    ...over,
  };
}

describe("print estimate breakdown", () => {
  it("formats durations", () => {
    expect(formatPrintDuration(45)).toBe("45 min");
    expect(formatPrintDuration(155)).toBe("2 h 35 m");
    expect(formatPrintDuration(120)).toBe("2 h");
  });

  it("summarises model, supports, waste and time with warm-up", () => {
    const totals = sumPrintEstimates([{ breakdown: breakdown(), quantity: 1 }]);
    expect(totals && printEstimateSummary(totals)).toBe(
      "Model 18.2 g + supports 3.1 g + waste 0.5 g; ~2 h 35 m incl. 10 min warm-up",
    );
    expect(totals && supportModeSummary(totals)).toBe("Auto → touching build plate only");
  });

  it("multiplies by copies and sets and names a separate support material", () => {
    const totals = sumPrintEstimates(
      [
        { breakdown: breakdown({ support_material_code: "PVA", support_material_g: 2.5 }), quantity: 2 },
        { breakdown: null, quantity: 5 },
      ],
      2,
    );
    expect(totals?.modelG).toBeCloseTo(72.8);
    expect(totals?.supportMaterialG).toBeCloseTo(10);
    expect(totals?.totalMin).toBe(620);
    expect(totals && printEstimateSummary(totals)).toContain("supports 12.4 g (PVA)");
  });

  it("leaves out empty parts and reports no breakdown for old analyses", () => {
    const totals = sumPrintEstimates([{ breakdown: breakdown({ support_g: 0, waste_g: 0, warmup_min: 0, total_min: 30 }), quantity: 1 }]);
    expect(totals && printEstimateSummary(totals)).toBe("Model 18.2 g; ~30 min");
    expect(sumPrintEstimates([{ breakdown: null, quantity: 1 }])).toBeNull();
  });

  it("adds the support type and brim / raft to the summary and the weight split", () => {
    const tree = breakdown({ support_type: "tree", support_type_label: "Tree", adhesion: "brim", adhesion_label: "Brim", adhesion_g: 0.6 });
    const totals = sumPrintEstimates([{ breakdown: tree, quantity: 2 }]);
    expect(totals && printEstimateSummary(totals)).toBe(
      "Model 36.4 g + supports 6.2 g + brim 1.2 g + waste 1.0 g; ~5 h 10 m incl. 20 min warm-up",
    );
    expect(totals && supportModeSummary(totals)).toBe("Tree · auto → touching build plate only · brim");
    expect(totals && printWeightSplit(totals)).toEqual(["model 36.4 g", "supports 6.2 g", "brim 1.2 g", "waste 1 g"]);

    const mixed = sumPrintEstimates([
      { breakdown: tree, quantity: 1 },
      { breakdown: breakdown({ support_type_label: "Organic tree", adhesion: "raft", adhesion_label: "Raft", adhesion_g: 2 }), quantity: 1 },
    ]);
    expect(mixed && supportModeSummary(mixed)).toBe("Mixed types · auto → touching build plate only · brim / raft");
    expect(mixed && printEstimateSummary(mixed)).toContain("brim / raft 2.6 g");
  });

  it("describes a support type's material against Normal", () => {
    expect(supportTypeMaterialNote(0.55)).toBe("About 45% less support material than Normal");
    expect(supportTypeMaterialNote(1.05)).toBe("About 5% more support material than Normal");
    expect(supportTypeMaterialNote(1)).toBe("");
  });
});
