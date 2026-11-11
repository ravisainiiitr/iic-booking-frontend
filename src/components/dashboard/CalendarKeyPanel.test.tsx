// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CalendarKeyPanel } from "./CalendarKeyPanel";

afterEach(cleanup);

describe("CalendarKeyPanel", () => {
  it("starts collapsed and opens on click", () => {
    render(
      <CalendarKeyPanel>
        <p>Legend and colours</p>
      </CalendarKeyPanel>,
    );
    const toggle = screen.getByRole("button", { name: /Calendar key/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Legend and colours")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Legend and colours")).toBeTruthy();
  });
});
