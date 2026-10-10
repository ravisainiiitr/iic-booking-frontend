// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FabricationEquipmentRow } from "@/lib/api";

const api = vi.hoisted(() => ({ updateFabricationMaterialEquipment: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));

import { LaserEstimateProfileCard } from "@/components/admin/LaserEstimateProfileCard";

const row: FabricationEquipmentRow = {
  equipment_id: 94,
  equipment_code: "L1",
  equipment_name: "Laser Cutter",
  profile_type: "LASER_CUT_2D",
  fabrication_notification_emails: [],
  own_material_fixed_charge: null,
  laser_estimate: {
    preset: "",
    detected_preset: "co2_laser",
    effective_preset: "co2_laser",
    effective_preset_label: "CO2 laser cutter (non-metals, 80-150 W)",
    presets: [
      { key: "co2_laser", label: "CO2 laser cutter (non-metals, 80-150 W)" },
      { key: "fiber_laser", label: "Fibre laser cutter (metals, 1.5-3 kW)" },
    ],
    parameters: [
      { key: "setup_min", label: "Setup per job (file, focus, test cut)", unit: "min", min: 0, max: 600, value: 10, default: 10 },
      { key: "allowance_pct", label: "Time allowance", unit: "%", min: 0, max: 200, value: 10, default: 10 },
    ],
    overrides: {},
    materials: [
      {
        material_id: 7,
        code: "ACR3",
        name: "Acrylic 3 mm",
        material_family: "ACRYLIC",
        thickness_mm: "3.00",
        chart_cut_speed_mm_s: 16,
        chart_pierce_s: 0.3,
        cut_speed_mm_s: null,
        pierce_s: null,
        warning: null,
      },
      {
        material_id: 8,
        code: "MS2",
        name: "Mild steel 2 mm",
        material_family: "MS",
        thickness_mm: "2.00",
        chart_cut_speed_mm_s: 1,
        chart_pierce_s: 5,
        cut_speed_mm_s: null,
        pierce_s: null,
        warning: "This machine type (CO2 laser cutter) does not normally cut MS; the cutting time is a rough guess.",
      },
    ],
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LaserEstimateProfileCard", () => {
  it("shows the detected machine type and chart speeds, and saves parameter and sheet overrides", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({ data: { equipment: row } });
    const onSaved = vi.fn();
    render(<LaserEstimateProfileCard equipment={row} onSaved={onSaved} />);

    expect(screen.getByTestId("laser-estimate-preset").textContent).toContain("Detected: CO2 laser cutter");
    expect((screen.getByLabelText("Cutting speed for Acrylic 3 mm") as HTMLInputElement).placeholder).toBe("16");
    expect(screen.getByTestId("laser-estimate-materials").textContent).toContain("does not normally cut MS");

    const save = screen.getByRole("button", { name: "Save cutting time settings" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Setup per job (file, focus, test cut) (min)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Cutting speed for Acrylic 3 mm"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Pierce time for Acrylic 3 mm"), { target: { value: "0.5" } });
    fireEvent.click(save);

    await waitFor(() => expect(api.updateFabricationMaterialEquipment).toHaveBeenCalled());
    expect(api.updateFabricationMaterialEquipment.mock.calls[0][0]).toEqual({
      equipment_id: 94,
      laser_estimate_overrides: { setup_min: 15 },
      laser_estimate_material_overrides: { "7": { cut_speed_mm_s: 20, pierce_s: 0.5 } },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(row));
  });

  it("refuses an out-of-range value", () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({ data: { equipment: row } });
    render(<LaserEstimateProfileCard equipment={row} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Time allowance (%)"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save cutting time settings" }));
    expect(toast.error).toHaveBeenCalledWith("Time allowance must be between 0 and 200 %.");
    expect(api.updateFabricationMaterialEquipment).not.toHaveBeenCalled();
  });
});
