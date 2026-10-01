import { describe, expect, it } from "vitest";
import { buildAnalysisChargeRowsForEquipment, type AnalysisChargeEquipment } from "./analysisChargeRows";
import { pivotAnalysisChargeRows } from "./analysisChargesExport";

const param = (user_type: string, param_code: string, unit_charge: string) => ({
  user_type,
  param_code,
  param_name: param_code,
  unit_charge,
  unit_time_minutes: 60,
  display_text: "",
  is_active: true,
});

const generic = (user_type: string, display_text: string) => ({
  user_type,
  profile_type: "GENERIC",
  primary_unit_charge: "50.00",
  secondary_unit_charge: "0.00",
  breakpoint: null,
  display_text,
  is_active: true,
});

const multi = (user_type: string) => ({
  user_type,
  profile_type: "MULTI_PARAM",
  primary_unit_charge: "0.00",
  secondary_unit_charge: "0.00",
  breakpoint: "1.00",
  display_text: "",
  is_active: true,
});

const NMR_OPTIONS = ["Proton NMR", "13C/31P NMR", "Any other"];

/** Production NMR (equipment 7): internal users GENERIC, external categories MULTI_PARAM. */
function nmr(internalDisplayText = "₹50 per Hour"): AnalysisChargeEquipment {
  return {
    name: "Nuclear Magnetic Resonance (NMR)",
    profile_type: "MULTI_PARAM",
    charge_profiles: [
      multi("external"),
      generic("faculty", internalDisplayText),
      multi("Industry"),
      multi("RND"),
      generic("student", internalDisplayText),
    ],
    input_fields: [
      { field_key: "B", user_type: "external", options: NMR_OPTIONS },
      { field_key: "B", user_type: "faculty", options: [] },
    ],
    slot_options: [
      param("external", "Proton NMR", "700.00"),
      param("external", "13C/31P NMR", "1000.00"),
      param("external", "Any other", "1500.00"),
      param("Industry", "Proton NMR", "2000.00"),
      param("Industry", "13C/31P NMR", "3000.00"),
      param("Industry", "Any other", "4000.00"),
      param("RND", "Proton NMR", "1000.00"),
      param("RND", "13C/31P NMR", "1500.00"),
      param("RND", "Any other", "2000.00"),
    ],
  };
}

function categoryLabel(table: ReturnType<typeof pivotAnalysisChargeRows>, re: RegExp): string {
  const cat = table.categories.find((c) => re.test(c));
  if (!cat) throw new Error(`no category matching ${re}: ${table.categories.join(", ")}`);
  return cat;
}

describe("Analysis Charges table for mixed Generic + Multi-parameter equipment", () => {
  it("shows the Generic display text for internal users against every NMR parameter row", () => {
    const table = pivotAnalysisChargeRows(buildAnalysisChargeRowsForEquipment(nmr(), null));

    expect(table.hasParameters).toBe(true);
    expect(table.rows.map((r) => r.parameter)).toEqual(NMR_OPTIONS);

    for (const re of [/student/i, /faculty/i]) {
      const cat = categoryLabel(table, re);
      const [first, ...rest] = table.rows.map((r) => r.cells[cat]);
      expect(first).toMatchObject({ amount: "₹50 per Hour", gst: "No GST", rowSpan: 3 });
      for (const covered of rest) {
        expect(covered).toMatchObject({ amount: "₹50 per Hour", spanned: true });
      }
    }

    const external = categoryLabel(table, /educational institute/i);
    expect(table.rows.map((r) => r.cells[external].amount)).toEqual([
      expect.stringMatching(/700.*Sample/),
      expect.stringMatching(/1,?000.*Sample/),
      expect.stringMatching(/1,?500.*Sample/),
    ]);
    expect(table.rows.every((r) => !r.cells[external].rowSpan && !r.cells[external].spanned)).toBe(true);
  });

  it("falls back to the Generic pc/sc charge when the display text is empty", () => {
    const table = pivotAnalysisChargeRows(buildAnalysisChargeRowsForEquipment(nmr(""), null));
    const cat = categoryLabel(table, /student/i);
    expect(table.rows[0].cells[cat]).toMatchObject({ amount: "pc ₹50", rowSpan: 3 });
    expect(table.rows[2].cells[cat]).toMatchObject({ amount: "pc ₹50", spanned: true });
  });

  it("works the other way round: internal Multi-parameter, external Generic", () => {
    const eq: AnalysisChargeEquipment = {
      name: "Reverse mixed",
      profile_type: "GENERIC",
      charge_profiles: [multi("student"), generic("external", "₹900 per Sample")],
      input_fields: [{ field_key: "B", user_type: "student", options: ["Mode A", "Mode B"] }],
      slot_options: [param("student", "Mode A", "100.00"), param("student", "Mode B", "200.00")],
    };
    const table = pivotAnalysisChargeRows(buildAnalysisChargeRowsForEquipment(eq, null));
    const external = categoryLabel(table, /educational institute/i);
    const student = categoryLabel(table, /student/i);

    expect(table.rows.map((r) => r.parameter)).toEqual(["Mode A", "Mode B"]);
    expect(table.rows[0].cells[external]).toMatchObject({ amount: "₹900 per Sample", rowSpan: 2 });
    expect(table.rows[1].cells[external]).toMatchObject({ spanned: true });
    expect(table.rows.map((r) => r.cells[student].amount)).toEqual([
      expect.stringMatching(/100/),
      expect.stringMatching(/200/),
    ]);
  });

  it("keeps all-Multi-parameter equipment per-option with no spanning cells", () => {
    const base = nmr();
    const eq = {
      ...base,
      charge_profiles: base.charge_profiles.filter((cp) => cp.profile_type === "MULTI_PARAM"),
    };
    const table = pivotAnalysisChargeRows(buildAnalysisChargeRowsForEquipment(eq, null));
    expect(table.rows).toHaveLength(3);
    for (const row of table.rows) {
      for (const cell of Object.values(row.cells)) {
        expect(cell.rowSpan).toBeUndefined();
        expect(cell.spanned).toBeUndefined();
      }
    }
  });

  it("keeps all-Generic equipment as a single row", () => {
    const eq: AnalysisChargeEquipment = {
      name: "All generic",
      profile_type: "GENERIC",
      charge_profiles: [generic("student", "₹40 per Hour"), generic("external", "₹400 per Hour")],
    };
    const table = pivotAnalysisChargeRows(buildAnalysisChargeRowsForEquipment(eq, null));
    expect(table.hasParameters).toBe(false);
    expect(table.rows).toHaveLength(1);
    expect(Object.values(table.rows[0].cells).map((c) => c.amount)).toEqual([
      "₹40 per Hour",
      "₹400 per Hour",
    ]);
  });

  it("filtering to internal users only collapses NMR to one Generic row", () => {
    const rows = buildAnalysisChargeRowsForEquipment(nmr(), new Set(["student", "faculty"]));
    const table = pivotAnalysisChargeRows(rows);
    expect(table.hasParameters).toBe(false);
    expect(table.rows).toHaveLength(1);
    expect(Object.values(table.rows[0].cells).every((c) => c.amount === "₹50 per Hour")).toBe(true);
  });
});
