// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { PrintAnalysisResult } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: {},
}));

import { print3DItemFromAnalysis } from "@/components/Print3DBookingPanel";

function analysis(over: Partial<PrintAnalysisResult> = {}): PrintAnalysisResult {
  return {
    id: "s1",
    status: "COMPLETED",
    stl_filename: "gear.stl",
    weight_grams: "11.2",
    estimated_time_minutes: 30,
    quantity: 3,
    part_name: "",
    ...over,
  } as PrintAnalysisResult;
}

describe("print3DItemFromAnalysis", () => {
  it("multiplies the per-copy estimate by the quantity", () => {
    const item = print3DItemFromAnalysis(analysis());
    expect(item).toMatchObject({ quantity: 3, weightGramsEach: 12, timeMinutesEach: 30, weightGrams: 36, timeMinutes: 90 });
  });

  it("names the part after the file unless a name was given", () => {
    expect(print3DItemFromAnalysis(analysis()).partName).toBe("gear");
    expect(print3DItemFromAnalysis(analysis({ part_name: "Drive gear" })).partName).toBe("Drive gear");
  });

  it("treats a missing or invalid quantity as one copy", () => {
    expect(print3DItemFromAnalysis(analysis({ quantity: undefined })).weightGrams).toBe(12);
    expect(print3DItemFromAnalysis(analysis({ quantity: 0 })).quantity).toBe(1);
  });
});
