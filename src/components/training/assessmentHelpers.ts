import type { AssessmentResult, ChecklistItem } from "@/lib/trainingOpsTypes";

export interface GradePreview {
  practicalPct: number | null;
  unmarked: number;
  result: AssessmentResult | null;
  reasons: string[];
}

/** Same rule as the server: every critical item must pass and both scores must reach the pass marks. */
export function previewGrade(
  items: ChecklistItem[],
  marks: Record<string, boolean | undefined>,
  theoryPct: number | null,
  pass: { theory: number; practical: number },
): GradePreview {
  let passed = 0;
  let total = 0;
  let unmarked = 0;
  const criticalFailed: string[] = [];
  for (const item of items) {
    const mark = marks[item.key];
    if (mark === undefined) {
      unmarked += 1;
      continue;
    }
    total += 1;
    if (mark) passed += 1;
    else if (item.critical) criticalFailed.push(item.label);
  }
  const practicalPct = total ? Math.round((passed * 10000) / total) / 100 : null;
  if (unmarked) return { practicalPct, unmarked, result: null, reasons: [] };
  const reasons: string[] = [];
  if (criticalFailed.length) reasons.push(`Critical item not passed: ${criticalFailed.join("; ")}`);
  if (practicalPct !== null && practicalPct < pass.practical) reasons.push(`Practical ${practicalPct}% is below ${pass.practical}%`);
  if (theoryPct !== null && theoryPct < pass.theory) reasons.push(`Theory ${theoryPct}% is below ${pass.theory}%`);
  let result: AssessmentResult = "PASS";
  if (reasons.length) {
    result = criticalFailed.length && practicalPct !== null && practicalPct < pass.practical / 2 ? "FAIL" : "RETAKE";
  }
  return { practicalPct, unmarked, result, reasons };
}

export function slugKey(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "item";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}
