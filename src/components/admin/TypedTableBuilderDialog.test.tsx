// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TypedTableBuilderDialog from "@/components/admin/TypedTableBuilderDialog";

const config = {
  columns: [
    { key: "initial_temp_c", label: "Initial Temp. (°C)", type: "NUMERIC", min: 30, max: 1350, default: 30, required: true },
    { key: "atmosphere", label: "Atmosphere", type: "COMBO", options: ["Air", "Nitrogen"], default: "Nitrogen" },
  ],
  rows: { mode: "USER", min_rows: 1, max_rows: 50, initial_rows: 1, serial_column: true, allow_duplicate: true },
};

function previewRows(): number {
  const table = within(screen.getByTestId("ttb-preview")).getByRole("table");
  return within(table).getAllByRole("row").length - 1;
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("TypedTableBuilderDialog preview", () => {
  it("shows exactly the rows at start and follows changes to the row rules", () => {
    render(
      <TypedTableBuilderDialog open onOpenChange={() => {}} fieldLabel="Samples Details" fieldKey="C" value={config} numericFields={[]} onSave={() => {}} />,
    );
    expect(previewRows()).toBe(1);

    const initial = screen.getByLabelText("Rows at start");
    fireEvent.change(initial, { target: { value: "3" } });
    expect(previewRows()).toBe(3);
    fireEvent.change(initial, { target: { value: "1" } });
    expect(previewRows()).toBe(1);

    fireEvent.click(within(screen.getByTestId("ttb-preview")).getByRole("button", { name: "Add row" }));
    expect(previewRows()).toBe(2);
    fireEvent.change(screen.getByLabelText("Minimum rows"), { target: { value: "0" } });
    fireEvent.change(initial, { target: { value: "2" } });
    fireEvent.change(initial, { target: { value: "1" } });
    expect(previewRows()).toBe(1);
  });
});
