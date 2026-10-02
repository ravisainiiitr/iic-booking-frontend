import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { NumericFieldInput } from "@/components/NumericFieldInput";

const render = (value: unknown, bounds = { min: 1, max: 10, step: 1 }, maxHint?: string) =>
  renderToStaticMarkup(
    <NumericFieldInput id="A" value={value} bounds={bounds} maxHint={maxHint} label="No. of samples" onValueChange={() => {}} />,
  );

const arrow = (html: string, label: "Increase" | "Decrease") =>
  new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label} by 1"`).test(html);

describe("NumericFieldInput", () => {
  it("disables the down arrow at the min only", () => {
    const html = render("1");
    expect(arrow(html, "Decrease")).toBe(true);
    expect(arrow(html, "Increase")).toBe(false);
    expect(html).toContain('title="Minimum is 1"');
  });

  it("disables the up arrow and shows the hint at the max", () => {
    const html = render("10");
    expect(arrow(html, "Increase")).toBe(true);
    expect(arrow(html, "Decrease")).toBe(false);
    expect(html).toContain("Max 10 reached");
  });

  it("shows the combined A / B hint", () => {
    expect(render("4", { min: 1, max: 4, step: 1 }, "Combined max of 20 reached across all sample sets")).toContain(
      "Combined max of 20 reached across all sample sets",
    );
  });

  it("asks to change a legacy 0 and marks the box invalid", () => {
    const html = render(0);
    expect(html).toContain("Minimum is 1 — please change this value");
    expect(html).toContain('aria-invalid="true"');
  });

  it("exposes the limits to assistive technology", () => {
    const html = render("5");
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="10"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-describedby="A-limit-hint"');
  });
});
