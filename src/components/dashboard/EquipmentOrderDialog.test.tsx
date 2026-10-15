// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EquipmentOrderDialog from "./EquipmentOrderDialog";

afterEach(cleanup);

const items = [
  { id: 1, label: "Depth Profiling (XPS)" },
  { id: 2, label: "X-Ray Photoelectron Spectroscopy (XPS)" },
  { id: 3, label: "Raman Spectrometer" },
];

function rowLabels() {
  return screen.getAllByTestId("equipment-order-row").map((row) => row.textContent);
}

describe("EquipmentOrderDialog", () => {
  it("reorders with the up and down buttons and saves top priority first", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    const onOpenChange = vi.fn();
    render(<EquipmentOrderDialog open onOpenChange={onOpenChange} items={items} defaultItems={items} onSave={onSave} />);

    expect(screen.getByRole("button", { name: "Move Depth Profiling (XPS) up" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Move Raman Spectrometer up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Raman Spectrometer up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Depth Profiling (XPS) down" }));
    expect(rowLabels()[0]).toContain("Raman Spectrometer");
    expect(within(screen.getAllByTestId("equipment-order-row")[0]).getByText("1")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Save order" }));
    expect(onSave).toHaveBeenCalledWith([3, 2, 1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Reset to default clears the saved order", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    const current = [items[2], items[0], items[1]];
    render(<EquipmentOrderDialog open onOpenChange={vi.fn()} items={current} defaultItems={items} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /Reset to default/ }));
    expect(rowLabels()[0]).toContain("Depth Profiling (XPS)");
    await userEvent.click(screen.getByRole("button", { name: "Save order" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("keeps the dialog open and shows the error when saving fails", async () => {
    const onSave = vi.fn().mockResolvedValue("Could not save the equipment order.");
    const onOpenChange = vi.fn();
    render(<EquipmentOrderDialog open onOpenChange={onOpenChange} items={items} defaultItems={items} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Save order" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
