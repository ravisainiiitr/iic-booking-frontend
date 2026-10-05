// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FabricationEquipmentRow } from "@/lib/api";

const row: FabricationEquipmentRow = {
  equipment_id: 21,
  equipment_code: "TEST-3DP-01",
  equipment_name: "Sample 3D Printer (TEST)",
  profile_type: "PRINT_3D",
  fabrication_notification_emails: ["lab@example.org"],
  own_material_fixed_charge: null,
  fabrication_replace_window_hours: 24,
  print_materials: [],
  laser_sheet_materials: [],
};

const api = vi.hoisted(() => ({
  getFabricationMaterialEquipment: vi.fn(),
  getOicPrintMaterials: vi.fn(async () => ({ data: { equipments: [] } })),
  updateFabricationMaterialEquipment: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/PageShell", () => ({ StandaloneOnly: () => null }));

import OICPrintMaterials from "@/pages/OICPrintMaterials";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  api.getFabricationMaterialEquipment.mockResolvedValue({ data: { equipments: [row] } });
  return render(
    <MemoryRouter>
      <OICPrintMaterials />
    </MemoryRouter>,
  );
}

describe("OICPrintMaterials lab settings", () => {
  it("saves the time users have to replace rejected files", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({
      data: { equipment: { ...row, fabrication_replace_window_hours: 6 } },
    });
    renderPage();

    const input = (await screen.findByLabelText("Time to replace files after rejection (hours)")) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("24"));
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(api.updateFabricationMaterialEquipment).toHaveBeenCalledWith(
        expect.objectContaining({ equipment_id: 21, fabrication_replace_window_hours: 6 }),
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved."));
  });

  it("refuses a window outside 1 to 168 hours", async () => {
    renderPage();
    const input = await screen.findByLabelText("Time to replace files after rejection (hours)");
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("from 1 to 168")));
    expect(api.updateFabricationMaterialEquipment).not.toHaveBeenCalled();
  });
});
