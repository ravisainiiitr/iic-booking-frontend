import { describe, expect, it } from "vitest";
import { buildChargeCategoryPresentation } from "./chargeCategoryPresentation";
import { buildChargeCategorySummaryRows } from "./chargeCategorySummary";

const nmrSlot = (user_type: string, param_code: string, unit_charge: string) => ({
  user_type,
  param_code,
  param_name: param_code,
  unit_time_minutes: 60,
  unit_charge,
  is_active: true,
});

const nmr = {
  profile_type: "MULTI_PARAM",
  charge_profiles: [
    { user_type: "student", profile_type: "GENERIC", primary_unit_charge: "50.00", secondary_unit_charge: "0.00", breakpoint: null, display_text: "₹50 per Hour", is_active: true },
    { user_type: "faculty", profile_type: "GENERIC", primary_unit_charge: "50.00", secondary_unit_charge: "0.00", breakpoint: null, display_text: "₹50 per Hour", is_active: true },
    { user_type: "external", profile_type: "MULTI_PARAM", primary_unit_charge: "0.00", secondary_unit_charge: "0.00", breakpoint: "1.00", display_text: "", is_active: true },
    { user_type: "Industry", profile_type: "MULTI_PARAM", primary_unit_charge: "0.00", secondary_unit_charge: "0.00", breakpoint: "1.00", display_text: "", is_active: true },
  ],
  slot_options: [
    nmrSlot("external", "Proton NMR", "700.00"),
    nmrSlot("external", "13C/31P NMR", "1000.00"),
    nmrSlot("Industry", "Proton NMR", "2000.00"),
    nmrSlot("Industry", "13C/31P NMR", "3000.00"),
  ],
};

describe("buildChargeCategoryPresentation with mixed profiles", () => {
  it("shows internal GENERIC categories with their own rate, not another category's options", () => {
    const rows = buildChargeCategorySummaryRows(nmr);
    const p = buildChargeCategoryPresentation(nmr.profile_type, rows, { slotOptions: nmr.slot_options });

    expect(p.mode).toBe("multi_param");
    const byType = Object.fromEntries((p.multiParamRows ?? []).map((r) => [r.userType.toLowerCase(), r]));

    expect(byType.student.chargeLine).toBe("₹50 per Hour");
    expect(byType.faculty.chargeLine).toBe("₹50 per Hour");
    expect(byType.student.chargesByOption).toEqual({});

    expect(byType.external.chargeLine).toBeUndefined();
    expect(byType.external.chargesByOption["Proton NMR"]).toMatch(/700/);
    expect(byType.external.chargesByOption["Proton NMR"]).toMatch(/Sample/);
    expect(byType.industry.chargesByOption["13C/31P NMR"]).toMatch(/3,?000/);
  });

  it("presents GENERIC + SAMPLE equipment per category", () => {
    const eq = {
      profile_type: "GENERIC",
      charge_profiles: [
        { user_type: "student", profile_type: "GENERIC", primary_unit_charge: "40.00", display_text: "₹40 per Hour", is_active: true },
        { user_type: "external", profile_type: "SAMPLE", primary_unit_charge: "900.00", secondary_unit_charge: "0.00", display_text: "", is_active: true },
      ],
    };
    const p = buildChargeCategoryPresentation(eq.profile_type, buildChargeCategorySummaryRows(eq));
    const byType = Object.fromEntries(p.rows.map((r) => [r.userType, r.chargeLine]));

    expect(p.simplified).toBe(true);
    expect(byType.student).toBe("₹40 per Hour");
    expect(byType.external).toMatch(/900/);
    expect(byType.external).toMatch(/\/Sample$/);
  });

  it("keeps the single-profile multi-parameter table unchanged", () => {
    const eq = {
      profile_type: "MULTI_PARAM",
      charge_profiles: nmr.charge_profiles.filter((cp) => cp.profile_type === "MULTI_PARAM"),
      slot_options: nmr.slot_options,
    };
    const p = buildChargeCategoryPresentation(eq.profile_type, buildChargeCategorySummaryRows(eq), {
      slotOptions: eq.slot_options,
    });
    expect(p.mode).toBe("multi_param");
    expect((p.multiParamRows ?? []).every((r) => r.chargeLine === undefined)).toBe(true);
    expect(p.subtitle).toBe("");
  });
});
