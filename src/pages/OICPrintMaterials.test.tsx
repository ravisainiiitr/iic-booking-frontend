// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FabricationEquipmentRow, MasterPrintMaterial } from "@/lib/api";

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

  it("saves the maximum print size and the rotation choice; blank axes mean no limit", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({
      data: {
        equipment: {
          ...row,
          max_print_size_x_mm: "250.0",
          max_print_size_y_mm: "210.0",
          max_print_size_z_mm: null,
          allow_print_rotation_to_fit: false,
        },
      },
    });
    renderPage();

    const x = (await screen.findByLabelText("X (width)")) as HTMLInputElement;
    expect(x.value).toBe("");
    expect(screen.getByRole("switch", { name: "Allow rotation to fit" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(x, { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Y (depth)"), { target: { value: "210" } });
    fireEvent.click(screen.getByRole("switch", { name: "Allow rotation to fit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(api.updateFabricationMaterialEquipment).toHaveBeenCalledWith(
        expect.objectContaining({
          equipment_id: 21,
          max_print_size_x_mm: "250",
          max_print_size_y_mm: "210",
          max_print_size_z_mm: null,
          allow_print_rotation_to_fit: false,
        }),
      ),
    );
    await waitFor(() => expect((screen.getByLabelText("X (width)") as HTMLInputElement).value).toBe("250"));
    await waitFor(() => expect(screen.queryByTestId("max-print-size-missing")).toBeNull());
  });

  it("warns that any size can be booked while no maximum print size is saved", async () => {
    renderPage();
    const warning = await screen.findByTestId("max-print-size-missing");
    expect(warning.textContent).toContain("models of any size can be booked");
    // Typing a size is not enough: the warning follows the saved setting.
    fireEvent.change(screen.getByLabelText("X (width)"), { target: { value: "250" } });
    expect(screen.getByTestId("max-print-size-missing")).toBeTruthy();
  });

  it("refuses a maximum print size of zero", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Z (height)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Maximum print size Z")));
    expect(api.updateFabricationMaterialEquipment).not.toHaveBeenCalled();
  });
});

function master(id: number, code: string, name: string, extra: Partial<MasterPrintMaterial> = {}): MasterPrintMaterial {
  return {
    id,
    code,
    name,
    density_g_per_cm3: "1.24",
    price_per_gram: "5",
    user_type: null,
    is_active: true,
    display_order: id,
    home_equipment_id: 21,
    home_equipment_code: "TEST-3DP-01",
    home_equipment_name: "Sample 3D Printer (TEST)",
    can_edit: true,
    supported_equipment_count: 1,
    ...extra,
  };
}

function renderWithMaster(materials: MasterPrintMaterial[], supported: number[]) {
  api.getFabricationMaterialEquipment.mockResolvedValue({
    data: { equipments: [{ ...row, supported_material_ids: supported }], master_print_materials: materials },
  });
  return render(
    <MemoryRouter>
      <OICPrintMaterials />
    </MemoryRouter>,
  );
}

describe("OICPrintMaterials supported materials", () => {
  const pla = master(1, "PLA", "PLA white");
  const abs = master(2, "ABS", "ABS black", {
    home_equipment_id: 99,
    home_equipment_code: "TEST-3DP-02",
    home_equipment_name: "Other printer (TEST)",
    can_edit: false,
  });
  const petg = master(3, "PETG", "PETG clear", { is_active: false });

  it("lists the category master list with enabled state and saves the ticked ones", async () => {
    api.updateFabricationMaterialEquipment.mockResolvedValue({
      data: { equipment: { ...row, supported_material_ids: [1, 2] } },
    });
    renderWithMaster([pla, abs, petg], [1]);

    const card = await screen.findByTestId("supported-materials");
    expect(card.textContent).toContain("Added for Other printer (TEST)");
    expect(card.textContent).toContain("Disabled");
    expect(screen.getByLabelText(/PLA white/).getAttribute("data-state")).toBe("checked");

    fireEvent.click(screen.getByLabelText(/ABS black/));
    fireEvent.click(screen.getByTestId("save-supported-materials"));

    await waitFor(() =>
      expect(api.updateFabricationMaterialEquipment).toHaveBeenCalledWith({ equipment_id: 21, supported_material_ids: [1, 2] }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Supported materials saved."));
  });

  it("warns the OIC when users would see no material", async () => {
    renderWithMaster([pla, petg], [3]);
    const warning = await screen.findByTestId("supported-materials-warning");
    expect(warning.textContent).toContain("All supported materials are disabled");

    fireEvent.click(screen.getByLabelText(/PETG clear/));
    await waitFor(() => expect(screen.getByTestId("supported-materials-warning").textContent).toContain("No materials are supported"));
  });

  it("blocks saving two materials with the same code", async () => {
    const otherPla = master(4, "pla", "PLA from other lab", { home_equipment_id: 99, home_equipment_code: "TEST-3DP-02" });
    renderWithMaster([pla, otherPla], [1]);
    fireEvent.click(await screen.findByLabelText(/PLA from other lab/));
    expect(await screen.findByText(/share the code/)).toBeTruthy();
    expect((screen.getByTestId("save-supported-materials") as HTMLButtonElement).disabled).toBe(true);
  });
});
