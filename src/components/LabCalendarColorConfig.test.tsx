// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabCalendarColorConfig } from "./LabCalendarColorConfig";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getLabDashboardCalendarColors: vi.fn().mockResolvedValue({ data: { slot_colors: {} } }),
    updateLabDashboardCalendarColors: vi.fn(),
  },
}));

afterEach(cleanup);

const toggle = () => screen.getByRole("button", { name: /Calendar colours/ });

describe("LabCalendarColorConfig", () => {
  it("is collapsed by default", () => {
    render(<LabCalendarColorConfig equipmentId={1} equipmentLabel="PXRD" />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Save colours")).toBeNull();
  });

  it("reports toggles when controlled", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <LabCalendarColorConfig equipmentId={null} open={false} onOpenChange={onOpenChange} />,
    );
    await userEvent.setup().click(toggle());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(<LabCalendarColorConfig equipmentId={null} open onOpenChange={onOpenChange} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });
});
