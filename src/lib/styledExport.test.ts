import { describe, expect, it } from "vitest";
import { freezeHeaderXml, pdfTableStyle } from "./styledExport";

describe("freezeHeaderXml", () => {
  const pane = '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>';

  it("replaces the sheet views SheetJS writes", () => {
    const xml = '<worksheet><dimension ref="A1"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData/></worksheet>';
    const out = freezeHeaderXml(xml, 3);
    expect(out).toContain(pane);
    expect(out.match(/<sheetViews>/g)).toHaveLength(1);
  });

  it("adds sheet views before the columns when there are none", () => {
    const out = freezeHeaderXml('<worksheet><dimension ref="A1"/><cols/><sheetData/></worksheet>', 3);
    expect(out.indexOf("<sheetViews>")).toBeLessThan(out.indexOf("<cols"));
    expect(out).toContain(pane);
  });
});

describe("pdfTableStyle", () => {
  it("centres headers and cells and repeats the header on every page", () => {
    const style = pdfTableStyle({ fontSize: 7 });
    expect(style.showHead).toBe("everyPage");
    expect(style.styles).toMatchObject({ halign: "center", valign: "middle", fontSize: 7 });
    expect(style.headStyles).toMatchObject({ halign: "center" });
  });
});
