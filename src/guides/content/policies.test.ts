import { describe, expect, it } from "vitest";
import { gate } from "../gate";
import type { GuideFeatureFlags } from "../types";
import { samplesSection } from "./policies";

const rulesFor = (audience: "student" | "external") =>
  samplesSection(gate({ audience, flags: {} as GuideFeatureFlags })).rules?.join("\n") ?? "";

describe("samplesSection", () => {
  it("covers early submission, results turnaround and delays for every booker", () => {
    for (const audience of ["student", "external"] as const) {
      const rules = rulesFor(audience);
      expect(rules).toContain("submit your sample before the deadline, provided it is not atmosphere-sensitive");
      expect(rules).toContain("Early submission does not lead to earlier analysis or earlier results");
      expect(rules).toContain("in most cases results arrive within it");
      expect(rules).toContain("results may be delayed; the lab will inform you if this happens");
    }
  });
});
