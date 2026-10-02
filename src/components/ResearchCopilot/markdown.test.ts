import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./markdown";

describe("safeHref", () => {
  it("allows portal paths and http(s)", () => {
    expect(safeHref("/booking-templates")).toBe("/booking-templates");
    expect(safeHref("https://equip.iitr.ac.in/")).toBe("https://equip.iitr.ac.in/");
  });

  it("drops internal and dangerous targets", () => {
    expect(safeHref("seed://What's New — October 2026")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("/admin-settings/knowledge?doc=1")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses bold, code and links", () => {
    expect(parseInline("Open **Wallet** then [Booking Templates](/booking-templates) or `XRD`")).toEqual([
      { kind: "text", text: "Open " },
      { kind: "bold", children: [{ kind: "text", text: "Wallet" }] },
      { kind: "text", text: " then " },
      { kind: "link", href: "/booking-templates", external: false, children: [{ kind: "text", text: "Booking Templates" }] },
      { kind: "text", text: " or " },
      { kind: "code", text: "XRD" },
    ]);
  });

  it("renders unsafe links as plain text", () => {
    expect(parseInline("[What's New](seed://What's New)")).toEqual([{ kind: "text", text: "What's New" }]);
  });

  it("never produces HTML", () => {
    const tokens = parseInline("<img src=x onerror=alert(1)> **<b>x</b>**");
    expect(JSON.stringify(tokens)).toContain("<img src=x onerror=alert(1)>");
    expect(tokens[0]).toEqual({ kind: "text", text: "<img src=x onerror=alert(1)> " });
  });
});

describe("parseMarkdown", () => {
  it("builds numbered lists with nested bullets", () => {
    const blocks = parseMarkdown(
      "**How to recharge your wallet**\n\n1. Open **Wallet**.\n2. Choose the method:\n   - **Direct Cash Deposit / Bank Transfer** — deposit.\n   - **Pay online** — Awaiting Competent Authority Approval.\n3. Enter the amount.",
    );
    expect(blocks[0].kind).toBe("paragraph");
    const list = blocks[1];
    expect(list.kind).toBe("list");
    if (list.kind !== "list") return;
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(3);
    expect(list.items[1].sub).toHaveLength(2);
    expect(list.items[2].inlines).toEqual([{ kind: "text", text: "Enter the amount." }]);
  });

  it("keeps line breaks inside a paragraph and splits on blank lines", () => {
    const blocks = parseMarkdown("Line one\nLine two\n\nNext paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      lines: [[{ kind: "text", text: "Line one" }], [{ kind: "text", text: "Line two" }]],
    });
  });

  it("parses bullets, rules and headings", () => {
    const blocks = parseMarkdown("## Title\n- a\n- b\n\n---\nend");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "list", "rule", "paragraph"]);
  });
});
