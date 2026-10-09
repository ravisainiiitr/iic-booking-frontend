import { describe, expect, it } from "vitest";
import type { PrintEstimateBreakdown } from "@/lib/api";
import { formatPrintDuration, printEstimateSummary, sumPrintEstimates, supportModeSummary } from "@/lib/printEstimate";

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
});
