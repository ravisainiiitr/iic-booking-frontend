import { describe, expect, it } from "vitest";
import { cleanLabel, initials, isEmail, parseEquipmentText, safePhotoUrl, telHref, textLength } from "./equipmentText";

describe("parseEquipmentText", () => {
  it("keeps the wording and recognises lists, label rows, headings and paragraphs", () => {
    const blocks = parseEquipmentText(
      "Intro line one\nline two.\n\nApplications:\nMaterial Science, Electronics\n\n1) 200 kV\n2) X-FEG\n- extra\n\nMake- THERMOFISHER\nModel: TALOS F200X",
    );
    expect(blocks).toEqual([
      { type: "paragraph", text: "Intro line one line two." },
      { type: "heading", text: "Applications" },
      { type: "paragraph", text: "Material Science, Electronics" },
      { type: "list", items: ["200 kV", "X-FEG", "extra"] },
      { type: "pairs", rows: [{ label: "Make", value: "THERMOFISHER" }, { label: "Model", value: "TALOS F200X" }] },
    ]);
  });

  it("does not turn ordinary sentences into rows", () => {
    expect(parseEquipmentText("The resolution is excellent - better than 1 nm in most modes of operation here.")[0].type).toBe("paragraph");
    expect(parseEquipmentText("Note: bring samples")).toEqual([{ type: "paragraph", text: "Note: bring samples" }]);
    expect(parseEquipmentText("")).toEqual([]);
    expect(parseEquipmentText(null)).toEqual([]);
  });
});

describe("contact helpers", () => {
  it("builds safe tel: and mailto values", () => {
    expect(telHref("+91 99999-00000")).toBe("tel:+919999900000");
    expect(telHref("ext 12")).toBe("");
    expect(isEmail("lab@iitr.ac.in")).toBe(true);
    expect(isEmail("javascript:alert(1)")).toBe(false);
    expect(initials("Prof. Asha Rao")).toBe("AR");
    expect(initials("Ravi")).toBe("R");
    expect(cleanLabel("General Information: ")).toBe("General Information");
    expect(textLength("  a   b ")).toBe(3);
  });

  it("keeps photo URLs on safe schemes", () => {
    expect(safePhotoUrl("https://x/p.png")).toBe("https://x/p.png");
    expect(safePhotoUrl("/api/users/1/profile-picture/")).toBe("/api/users/1/profile-picture/");
    expect(safePhotoUrl("javascript:alert(1)")).toBe("");
    expect(safePhotoUrl("")).toBe("");
  });
});
