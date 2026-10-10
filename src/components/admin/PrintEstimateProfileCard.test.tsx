// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FabricationEquipmentRow, MasterPrintMaterial } from "@/lib/api";

const api = vi.hoisted(() => ({ updateFabricationMaterialEquipment: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));

import { PrintEstimateProfileCard } from "@/components/admin/PrintEstimateProfileCard";

const row: FabricationEquipmentRow = {
  equipment_id: 69,
  equipment_code: "P1S",
  equipment_name: "Bambu P1S",
  profile_type: "PRINT_3D",
  fabrication_notification_emails: [],
  own_material_fixed_charge: null,
  print_estimate: {
    preset: "",
    detected_preset: "fdm_bambu",
    effective_preset: "fdm_bambu",
    technology: "FDM",
    technology_label: "FDM (filament)",
    presets: [
      { key: "fdm_classic", label: "FDM - classic", technology: "FDM" },
      { key: "fdm_bambu", label: "FDM - Bambu Lab", technology: "FDM" },
    ],
    parameters: [
      { key: "perimeter_speed_mm_s", label: "Wall speed (effective average)", unit: "mm/s", min: 1, max: 1000, kind: "number", value: 103, default: 103 },
      { key: "warmup_min", label: "Warm-up", unit: "min", min: 0, max: 120, kind: "number", value: 6, default: 6 },
    ],
    overrides: {},
    calibration: {
      weight_factor: null,
      weight_samples: 1,
      weight_error_before_pct: null,
      weight_error_after_pct: null,
      time_factor: 1.2,
      time_samples: 4,
      time_error_before_pct: 25,
      time_error_after_pct: 6,
      min_samples: 3,
      applied: false,
    },
    support_material_ids: [],
    supports_available: true,
  },
};
const master = [
  { id: 3, code: "PLA", name: "PLA", is_active: true },
  { id: 4, code: "PVA", name: "PVA", is_active: true },
] as unknown as MasterPrintMaterial[];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PrintEstimateProfileCard", () => {
  it("shows the detected printer type and calibration, and saves overrides and support materials", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({ data: { equipment: row } });
    const onSaved = vi.fn();
    render(<PrintEstimateProfileCard equipment={row} master={master} onSaved={onSaved} />);

    expect(screen.getByTestId("print-estimate-preset").textContent).toContain("Detected: FDM - Bambu Lab");
    const calibration = screen.getByTestId("print-estimate-calibration").textContent;
    expect(calibration).toContain("Weight: not enough parts with actuals (1 of 3 needed)");
    expect(calibration).toContain("Time: × 1.2 from 4 part(s); median error 25% → 6%");

    const save = screen.getByRole("button", { name: "Save estimate settings" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Wall speed (effective average) (mm/s)"), { target: { value: "80" } });
    fireEvent.click(screen.getByLabelText("Support material PVA"));
    fireEvent.click(save);

    await waitFor(() => expect(api.updateFabricationMaterialEquipment).toHaveBeenCalled());
    expect(api.updateFabricationMaterialEquipment.mock.calls[0][0]).toEqual({
      equipment_id: 69,
      print_estimate_overrides: { perimeter_speed_mm_s: 80 },
      print_estimate_support_material_ids: [4],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(row));
  });

  it("lets the OIC choose the support types, default, factors and bed adhesion", async () => {
    const withTypes: FabricationEquipmentRow = {
      ...row,
      print_estimate: {
        ...row.print_estimate!,
        support_options: {
          types: [
            { key: "normal", label: "Normal (grid)", description: "Columns.", enabled: true, volume_factor: 1, speed_factor: 1, default_volume_factor: 1, default_speed_factor: 1 },
            { key: "lines", label: "Lines", description: "Lines.", enabled: true, volume_factor: 0.85, speed_factor: 1.1, default_volume_factor: 0.85, default_speed_factor: 1.1 },
            { key: "tree", label: "Tree", description: "Branches.", enabled: true, volume_factor: 0.55, speed_factor: 0.85, default_volume_factor: 0.55, default_speed_factor: 0.85 },
          ],
          default_type: "normal",
          adhesion: [
            { key: "none", label: "Skirt / none", description: "", enabled: true },
            { key: "brim", label: "Brim", description: "", enabled: true },
            { key: "raft", label: "Raft", description: "", enabled: true },
          ],
        },
      },
    };
    api.updateFabricationMaterialEquipment.mockResolvedValue({ data: { equipment: withTypes } });
    render(<PrintEstimateProfileCard equipment={withTypes} master={master} onSaved={vi.fn()} />);
    expect(screen.getByTestId("support-type-row-tree").textContent).toContain("Branches.");

    fireEvent.click(screen.getByLabelText("Offer Lines supports"));
    fireEvent.click(screen.getByLabelText("Tree is the default"));
    fireEvent.change(screen.getByLabelText("Tree material factor"), { target: { value: "9" } });
    fireEvent.click(screen.getByLabelText("Offer Raft"));
    fireEvent.click(screen.getByRole("button", { name: "Save estimate settings" }));
    expect(toast.error).toHaveBeenCalledWith("Tree: material factor must be between 0.05 and 3.");
    expect(api.updateFabricationMaterialEquipment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Tree material factor"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save estimate settings" }));
    await waitFor(() => expect(api.updateFabricationMaterialEquipment).toHaveBeenCalled());
    expect(api.updateFabricationMaterialEquipment.mock.calls[0][0]).toEqual({
      equipment_id: 69,
      print_estimate_support_options: {
        types: ["normal", "tree"],
        default_type: "tree",
        factors: { tree: { volume_factor: 0.5 } },
        adhesion: ["none", "brim"],
      },
    });
  });

  it("refuses an out-of-range value and applies a fitted calibration", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({ data: { equipment: row } });
    render(<PrintEstimateProfileCard equipment={row} master={master} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Warm-up (min)"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save estimate settings" }));
    expect(toast.error).toHaveBeenCalledWith("Warm-up must be between 0 and 120 min.");
    expect(api.updateFabricationMaterialEquipment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply factors" }));
    await waitFor(() =>
      expect(api.updateFabricationMaterialEquipment).toHaveBeenCalledWith({ equipment_id: 69, print_estimate_calibration: "apply" }),
    );
  });
});
