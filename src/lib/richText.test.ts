// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  FONT_FAMILIES,
  fontToken,
  instructionToHtml,
  looksLikeRichHtml,
  paletteColor,
  plainTextToHtml,
  richTextToPlain,
  sanitizeRichHtml,
} from "./richText";
import { convertWordLists, normalizeLinkInput } from "./richTextEditing";

describe("sanitizeRichHtml", () => {
  it("keeps the editor's formatting", () => {
    const html =
      '<h3 style="text-align: center">Before you book</h3>' +
      "<p><strong>Dry</strong> <em>samples</em> <u>only</u> <s>no liquids</s><br>second line</p>" +
      "<ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li></ul>" +
      '<ol start="3"><li><p>Three</p></li></ol><h4>Large</h4>' +
      '<p style="text-align: right"><span style="color: var(--rt-red)">red</span> ' +
      '<mark style="background-color: var(--rt-hl-yellow)">hl</mark></p>' +
      '<p><a href="https://iitr.ac.in/x" target="_blank" rel="noopener noreferrer">site</a></p>';
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("drops scripts, event handlers and arbitrary styles", () => {
    const clean = sanitizeRichHtml(
      '<p style="color: rgb(185, 28, 28); font-family: Comic Sans MS; position: fixed">' +
        '<b onclick="steal()">Dry</b> <img src=x onerror="alert(1)"></p>' +
        "<script>alert(1)</script><svg><script>alert(2)</script></svg><iframe src=x></iframe>" +
        '<span style="background-image: url(javascript:alert(1))">x</span>'
    );
    expect(clean).toBe("<p><strong>Dry</strong> </p>x");
    for (const bad of ["script", "onerror", "onclick", "iframe", "font-family", "position", "url("]) {
      expect(clean).not.toContain(bad);
    }
  });

  it("only keeps http(s)/mailto links and opens them in a new tab", () => {
    const clean = sanitizeRichHtml(
      '<p><a href="https://ok.example/a" target="_self">ok</a> <a href="mailto:lab@iitr.ac.in">mail</a> ' +
        '<a href="javascript:alert(1)">js</a> <a href="data:text/html,x">data</a></p>'
    );
    expect(clean).toBe(
      '<p><a href="https://ok.example/a" target="_blank" rel="noopener noreferrer">ok</a> ' +
        '<a href="mailto:lab@iitr.ac.in" target="_blank" rel="noopener noreferrer">mail</a> js data</p>'
    );
  });

  it("converts the older toolbar's markup", () => {
    expect(
      sanitizeRichHtml(
        '<div style="text-align: center">Centre</div><h1>Big</h1>' +
          '<span style="font-weight: bold; text-decoration: underline">bu</span> ' +
          '<font color="#b91c1c" size="5" face="Arial">red</font> ' +
          '<span style="background-color: rgb(254, 240, 138); color: #000000">hl</span>'
      )
    ).toBe(
      '<p style="text-align: center">Centre</p><h3>Big</h3><strong><u>bu</u></strong> ' +
        '<span style="font-family: var(--rt-font-sans); color: var(--rt-red)">red</span> ' +
        '<mark style="background-color: var(--rt-hl-yellow)">hl</mark>'
    );
  });

  it("strips Google Docs junk styles but keeps lists and bold", () => {
    const pasted =
      '<b style="font-weight:normal;" id="docs-internal-guid-1"><ul><li dir="ltr" style="list-style-type:disc">' +
      '<p dir="ltr" style="line-height:1.38"><span style="font-size:11pt;font-family:Arial;color:#000000;' +
      'background-color:transparent;font-weight:700">Bold item</span></p></li></ul></b>';
    expect(sanitizeRichHtml(pasted)).toBe(
      '<ul><li><p><span style="font-family: var(--rt-font-sans)"><strong>Bold item</strong></span></p></li></ul>'
    );
  });
});

describe("font families", () => {
  it("keeps allowed font tokens next to palette colours", () => {
    const html =
      '<p><span style="font-family: var(--rt-font-serif); color: var(--rt-red)">serif</span> ' +
      '<span style="font-family: var(--rt-font-devanagari)">हिंदी</span></p>';
    expect(sanitizeRichHtml(html)).toBe(html);
    for (const { name } of FONT_FAMILIES) expect(fontToken(`var(--rt-font-${name})`)).toBe(`var(--rt-font-${name})`);
  });

  it("maps Word / Docs fonts to the nearest option and drops the rest", () => {
    expect(fontToken('"Times New Roman", serif')).toBe("var(--rt-font-serif)");
    expect(fontToken("Calibri, sans-serif")).toBe("var(--rt-font-sans)");
    expect(fontToken("Cambria")).toBe("var(--rt-font-serif)");
    expect(fontToken("'Courier New'")).toBe("var(--rt-font-courier)");
    expect(fontToken("Consolas")).toBe("var(--rt-font-mono)");
    expect(fontToken("Mangal")).toBe("var(--rt-font-devanagari)");
    expect(fontToken("Wingdings, Comic Sans MS")).toBeNull();
    expect(fontToken("var(--rt-font-evil)")).toBeNull();
    expect(paletteColor("var(--rt-font-serif)", "text")).toBeNull();

    const pasted =
      '<p style="font-family: Cambria"><span style="font-family: &quot;Courier New&quot;">code</span> body</p>';
    expect(sanitizeRichHtml(pasted)).toBe(
      '<p><span style="font-family: var(--rt-font-serif)">' +
        '<span style="font-family: var(--rt-font-courier)">code</span> body</span></p>'
    );
    expect(richTextToPlain(pasted)).toBe("code body");
  });

  it("strips arbitrary fonts and CSS injection", () => {
    expect(
      sanitizeRichHtml(
        '<span style="font-family: expression(alert(1))">a</span>' +
          '<span style="font-family: x; background-image: url(javascript:alert(1))">b</span>' +
          '<span style="font-family: var(--rt-font-serif), url(https://evil/x.woff)">c</span>' +
          '<span style="font-family: Papyrus">d</span>' +
          "<span style=\"font-family: 'Arial'; font-size: 30px\">e</span>"
      )
    ).toBe('abcd<span style="font-family: var(--rt-font-sans)">e</span>');
  });
});

describe("palette colours", () => {
  it("snaps to the palette and drops black/white", () => {
    expect(paletteColor("#b91c1c", "text")).toBe("var(--rt-red)");
    expect(paletteColor("rgb(29, 78, 216)", "text")).toBe("var(--rt-blue)");
    expect(paletteColor("#000", "text")).toBeNull();
    expect(paletteColor("#6b7280", "text")).toBe("var(--rt-gray)");
    expect(paletteColor("var(--rt-evil)", "text")).toBeNull();
    expect(paletteColor("#fef08a", "highlight")).toBe("var(--rt-hl-yellow)");
  });
});

describe("plain text (older instructions)", () => {
  it("is detected and converted to paragraphs and line breaks", () => {
    expect(looksLikeRichHtml("Use <5 mg\nper sample")).toBe(false);
    expect(plainTextToHtml("Line 1\nLine 2\n\nPara <2>")).toBe("<p>Line 1<br>Line 2</p><p>Para &lt;2&gt;</p>");
    expect(instructionToHtml("  Wear gloves.\r\nBring vials.  ")).toBe("<p>Wear gloves.<br>Bring vials.</p>");
    expect(instructionToHtml("")).toBe("");
  });

  it("renders HTML as plain text with bullets and numbers", () => {
    expect(
      richTextToPlain(
        "<p>Intro</p><ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li><li><p>Two</p></li></ul>" +
          '<ol start="2"><li><p>Second</p></li><li><p>Third</p></li></ol><p>a<br>b &amp; c</p>'
      )
    ).toBe("Intro\n• One\n  • Nested\n• Two\n2. Second\n3. Third\na\nb & c");
    expect(richTextToPlain("Line 1\nLine 2")).toBe("Line 1\nLine 2");
  });
});

describe("editor helpers", () => {
  it("rebuilds Word lists", () => {
    const word =
      "<p class=MsoNormal>Intro</p>" +
      "<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>1.<span> </span></span>First</p>" +
      "<p class=MsoListParagraph style='mso-list:l0 level2 lfo1'><span style='mso-list:Ignore'>a.<span> </span></span>Sub</p>" +
      "<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>2.<span> </span></span>Second</p>" +
      "<p class=MsoNormal>After</p>" +
      "<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>·<span> </span></span>Bullet</p>";
    expect(sanitizeRichHtml(convertWordLists(word))).toBe(
      "<p>Intro</p><ol><li><p>First</p><ol><li><p>Sub</p></li></ol></li><li><p>Second</p></li></ol>" +
        "<p>After</p><ul><li><p>Bullet</p></li></ul>"
    );
  });

  it("normalizes link input", () => {
    expect(normalizeLinkInput("https://iitr.ac.in")).toBe("https://iitr.ac.in");
    expect(normalizeLinkInput("iitr.ac.in/iic")).toBe("https://iitr.ac.in/iic");
    expect(normalizeLinkInput("lab@iitr.ac.in")).toBe("mailto:lab@iitr.ac.in");
    expect(normalizeLinkInput("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkInput("not a link")).toBeNull();
  });
});
