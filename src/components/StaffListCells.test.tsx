// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClampedText, StackedDateTime } from "./StaffListCells";

afterEach(cleanup);

describe("StackedDateTime", () => {
  it("puts the date and the time on separate lines that do not wrap", () => {
    const local = new Date(2026, 8, 30, 22, 49);
    const { container } = render(<StackedDateTime value={local.toISOString()} />);
    const lines = container.querySelectorAll("time > span");
    expect(Array.from(lines, (l) => l.textContent)).toEqual(["30 Sep 2026", "10:49 pm"]);
    lines.forEach((l) => expect(l.className).toContain("whitespace-nowrap"));
  });

  it("shows a dash without a date", () => {
    const { container } = render(<StackedDateTime value={null} />);
    expect(container.textContent).toBe("—");
  });
});

describe("ClampedText", () => {
  it("clamps to two lines with the full text as a tooltip", () => {
    const { getByTitle } = render(<ClampedText text="A long reason" />);
    expect(getByTitle("A long reason").className).toContain("line-clamp-2");
  });

  it("reveals hidden details with more and hides them again with less", () => {
    const { getByRole, queryByText } = render(<ClampedText text="Reason" details={<span>Inputs: XPS survey</span>} />);
    expect(queryByText("Inputs: XPS survey")).toBeNull();
    fireEvent.click(getByRole("button", { name: "more" }));
    expect(queryByText("Inputs: XPS survey")).not.toBeNull();
    fireEvent.click(getByRole("button", { name: "less" }));
    expect(queryByText("Inputs: XPS survey")).toBeNull();
  });
});
