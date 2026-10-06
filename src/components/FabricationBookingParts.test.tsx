// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FabricationFilesState, FabricationPart } from "@/lib/api";

const api = vi.hoisted(() => ({
  getLaserCutDxfPresign: vi.fn(),
  getPrintAnalysisStlPresign: vi.fn(),
  getBookingFabricationFiles: vi.fn(),
  replaceBookingFabricationFiles: vi.fn(),
  getEquipmentLaserSheetMaterials: vi.fn(async () => ({ data: { materials: [], own_material_fixed_charge: "250.00" } })),
  getToken: vi.fn(() => "tok"),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/components/DxfModelPreview", () => ({ default: () => null }));
vi.mock("@/components/BookedStlPreview", () => ({
  default: ({ parts }: { parts: FabricationPart[] }) => <div data-testid="booked-stl-stub">{parts.map((p) => p.filename).join(",")}</div>,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { FabricationBookingParts, fabricationPartDetail, type FabricationBookingFields } from "@/components/FabricationBookingParts";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const laserPart: FabricationPart = {
  kind: "laser",
  analysis_id: "a1",
  name: "Bracket",
  filename: "bracket.dxf",
  quantity: 5,
  material_id: 7,
  material_name: "Acrylic 3 mm",
  width_mm: "200.00",
  height_mm: "100.00",
  area_mm2: "20000.00",
  units: "mm",
  units_assumed: false,
};

function booking(over: Partial<FabricationBookingFields> = {}): FabricationBookingFields {
  return {
    booking_id: 41,
    equipment: 12,
    equipment_profile_type: "LASER_CUT_2D",
    user_type_snapshot: "student",
    own_material: true,
    fabrication_parts: [laserPart],
    fabrication_file_changes: [],
    fabrication_files_replaceable: { allowed: true, reason: null },
    ...over,
  };
}

const filesState: FabricationFilesState = {
  profile_type: "LASER_CUT_2D",
  can_replace: true,
  blocked_reason: null,
  own_material: true,
  own_material_available: true,
  own_material_fixed_charge: "250.00",
  parts: [laserPart],
  changes: [],
};

describe("fabricationPartDetail", () => {
  it("describes a laser part with its sheet, size and area", () => {
    expect(fabricationPartDetail(laserPart)).toBe("Acrylic 3 mm · 200 × 100 mm (0.0200 m² each)");
  });

  it("describes a 3D print part with total weight and time", () => {
    expect(
      fabricationPartDetail({ kind: "print", analysis_id: "p", name: "Gear", quantity: 3, weight_g_total: 36, time_min_total: 90 }),
    ).toBe("36 g · 90 min total");
  });
});

describe("FabricationBookingParts", () => {
  it("lists the parts, the own-material flag and a DXF download", async () => {
    api.getLaserCutDxfPresign.mockResolvedValue({ data: { url: "https://s3.example/bracket.dxf?sig=1" } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<FabricationBookingParts booking={booking()} />);

    expect(screen.getByTestId("own-material-badge").textContent).toContain("own material");
    expect(screen.getByTestId("fabrication-part-a1").textContent).toContain("Bracket × 5");
    fireEvent.click(screen.getByRole("button", { name: "Download bracket.dxf" }));

    await waitFor(() => expect(api.getLaserCutDxfPresign).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://s3.example/bracket.dxf?sig=1", "_blank", "noopener,noreferrer"));
    open.mockRestore();
  });

  it("explains why files can't be changed instead of offering the button", () => {
    render(
      <FabricationBookingParts
        booking={booking({ fabrication_files_replaceable: { allowed: false, reason: "Files can only be replaced before the booked slot starts." } })}
      />,
    );
    expect(screen.queryByTestId("replace-files-button")).toBeNull();
    expect(screen.getByText("Files can only be replaced before the booked slot starts.")).toBeTruthy();
  });

  it("offers Replace files while the lab's rejection is open, and nothing after booking otherwise", () => {
    const { unmount } = render(
      <FabricationBookingParts booking={booking({ fabrication_workflow: { rejected: true } })} />,
    );
    expect(screen.getByTestId("replace-files-button").textContent).toContain("Replace files");
    unmount();

    render(
      <FabricationBookingParts
        booking={booking({
          fabrication_workflow: { rejected: false },
          fabrication_files_replaceable: {
            allowed: false,
            reason: "Files cannot be changed after booking. If the lab finds a problem with your files, you will be asked to upload new ones.",
          },
        })}
      />,
    );
    expect(screen.queryByTestId("replace-files-button")).toBeNull();
    expect(screen.getByText(/Files cannot be changed after booking/)).toBeTruthy();
  });

  it("keeps the Change files label for lab staff before the slot starts", () => {
    render(<FabricationBookingParts booking={booking({ fabrication_workflow: { rejected: false } })} />);
    expect(screen.getByTestId("replace-files-button").textContent).toContain("Change files");
  });

  it("sends part edits and the own-material choice through the recalculation endpoint", async () => {
    api.getBookingFabricationFiles.mockResolvedValue({ data: filesState });
    const updated = { booking_id: 41, total_charge: "131.00" };
    api.replaceBookingFabricationFiles.mockResolvedValue({
      data: { message: "Files updated. Charges recalculated.", booking: updated, charge_recalculation_summary: {}, fabrication: filesState },
    });
    const onUpdated = vi.fn();
    render(<FabricationBookingParts booking={booking()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByTestId("replace-files-button"));
    const qty = await screen.findByLabelText("Quantity of bracket.dxf");
    const submit = screen.getByTestId("fabrication-replace-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(qty, { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("User brings own material"));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() =>
      expect(api.replaceBookingFabricationFiles).toHaveBeenCalledWith(41, {
        part_updates: [{ analysis_id: "a1", quantity: 3 }],
        own_material: false,
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it("uses the numeric booking id when the booking shows its display id", async () => {
    api.getBookingFabricationFiles.mockResolvedValue({ data: filesState });
    api.replaceBookingFabricationFiles.mockResolvedValue({
      data: { message: "Files updated.", booking: {}, charge_recalculation_summary: {}, fabrication: filesState },
    });
    render(<FabricationBookingParts booking={booking({ booking_id: "IICTEST-LASER-01202600001", real_booking_id: 673 })} />);

    fireEvent.click(screen.getByTestId("replace-files-button"));
    const qty = await screen.findByLabelText("Quantity of bracket.dxf");
    expect(api.getBookingFabricationFiles).toHaveBeenCalledWith(673);
    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("fabrication-replace-submit"));

    await waitFor(() => expect(api.replaceBookingFabricationFiles).toHaveBeenCalledWith(673, expect.any(Object)));
  });

  it("offers a 3D preview of the STL files on a 3D print booking, but not on the printed job sheet", async () => {
    const printParts: FabricationPart[] = [
      { kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1 },
      { kind: "print", analysis_id: "p2", name: "Hub", filename: "hub.stl", quantity: 2 },
    ];
    const printBooking = booking({ equipment_profile_type: "PRINT_3D", fabrication_parts: printParts });
    const { unmount } = render(<FabricationBookingParts booking={printBooking} />);

    const toggle = screen.getByTestId("print-preview-toggle");
    expect(toggle.textContent).toContain("Preview 2 STL files");
    fireEvent.click(toggle);
    expect((await screen.findByTestId("booked-stl-stub")).textContent).toBe("gear.stl,hub.stl");
    expect(toggle.textContent).toContain("Hide preview");
    unmount();

    render(<FabricationBookingParts booking={printBooking} printable />);
    expect(screen.queryByTestId("print-preview-toggle")).toBeNull();
  });

  it("blocks a quantity below one", async () => {
    api.getBookingFabricationFiles.mockResolvedValue({ data: filesState });
    render(<FabricationBookingParts booking={booking()} />);
    fireEvent.click(screen.getByTestId("replace-files-button"));
    const qty = await screen.findByLabelText("Quantity of bracket.dxf");
    fireEvent.change(qty, { target: { value: "0" } });
    expect(screen.getByText("Bracket: quantity must be a whole number of 1 or more.")).toBeTruthy();
    expect((screen.getByTestId("fabrication-replace-submit") as HTMLButtonElement).disabled).toBe(true);
  });
});
