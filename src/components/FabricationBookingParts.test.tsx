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
  getLaserCutDxfText: vi.fn(async () => ({ text: "" })),
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

import {
  FabricationBookingParts,
  fabricationPartDetail,
  resetShownFabricationPreviews,
  type FabricationBookingFields,
} from "@/components/FabricationBookingParts";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetShownFabricationPreviews();
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

  it("adds the support choice: included in the model material or separate", () => {
    const base = { kind: "print" as const, analysis_id: "p", name: "Gear", quantity: 2, weight_g_total: 40, time_min_total: 90 };
    expect(
      fabricationPartDetail({ ...base, support_mode: "everywhere", support_mode_label: "Everywhere", support_g_each: 3.5 }),
    ).toBe("40 g · 90 min total · Supports: Everywhere (~3.5 g each, included)");
    expect(
      fabricationPartDetail({
        ...base,
        support_mode: "buildplate",
        support_mode_label: "Touching build plate only",
        support_g_each: 4,
        support_material_code: "PVA",
        support_weight_g_each: 4,
        support_weight_g_total: 8,
      }),
    ).toBe("40 g · 90 min total · Supports: Touching build plate only (+8 g PVA)");
    expect(fabricationPartDetail({ ...base, support_mode: "none", support_mode_label: "None", support_g_each: 0 })).toBe(
      "40 g · 90 min total · Supports: None",
    );
    expect(
      fabricationPartDetail({ ...base, support_mode: "none", support_mode_label: "None", orientation: [1, 0, 0, 0, 0, -1, 0, 1, 0] }),
    ).toBe("40 g · 90 min total · Supports: None · User-selected orientation");
  });

  it("names the support type, interface and brim / raft with the weight make-up of each copy", () => {
    const base = { kind: "print" as const, analysis_id: "p", name: "Gear", quantity: 2, weight_g_total: 26, time_min_total: 90 };
    const part = {
      ...base,
      support_mode: "buildplate" as const,
      support_mode_label: "Touching build plate only",
      support_g_each: 3.2,
      support_type: "tree",
      support_type_label: "Tree",
      support_interface: false,
      adhesion: "raft",
      adhesion_label: "Raft",
      adhesion_g_each: 0.5,
      weight_composition: "model 8.0 g + supports 3.2 g + raft 0.5 g + purge 0.5 g",
    };
    expect(fabricationPartDetail(part)).toBe(
      "26 g · 90 min total · Supports: Tree (touching build plate only), no interface (~3.2 g each, included)" +
        " · Raft ~0.5 g each · Each: model 8.0 g + supports 3.2 g + raft 0.5 g + purge 0.5 g",
    );
    expect(fabricationPartDetail({ ...part, actual_weight: true })).not.toContain("Each:");
  });
});

describe("FabricationBookingParts", () => {
  it("shows Quantity Required and the sets on each part", () => {
    render(<FabricationBookingParts booking={booking({ fabrication_quantity: 3 })} />);
    expect(screen.getByTestId("fabrication-quantity").textContent).toContain("Quantity Required: 3");
    expect(screen.getByText(/× 5 × 3 sets/)).toBeTruthy();
  });

  it("counts an older booking without a quantity as 1", () => {
    render(<FabricationBookingParts booking={booking()} />);
    expect(screen.getByTestId("fabrication-quantity").textContent).toBe("Quantity Required: 1");
    expect(screen.queryByText(/sets/)).toBeNull();
  });

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

  it("keeps each STL preview hidden until Show preview is clicked, and Hide preview collapses it again", async () => {
    const printParts: FabricationPart[] = [
      { kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1, file_available: true },
      { kind: "print", analysis_id: "p2", name: "Hub", filename: "hub.stl", quantity: 2 },
    ];
    const printBooking = booking({ equipment_profile_type: "PRINT_3D", fabrication_parts: printParts });
    render(<FabricationBookingParts booking={printBooking} />);

    expect(screen.queryByTestId("booked-stl-stub")).toBeNull();
    const gearToggle = screen.getByTestId("fabrication-preview-toggle-p1");
    const hubToggle = screen.getByTestId("fabrication-preview-toggle-p2");
    expect(gearToggle.textContent).toContain("Show preview");
    expect(gearToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Show preview of Hub" })).toBe(hubToggle);

    fireEvent.click(hubToggle);
    expect((await screen.findByTestId("booked-stl-stub")).textContent).toBe("hub.stl");
    expect(screen.getByTestId("fabrication-part-p2").contains(screen.getByTestId("booked-stl-stub"))).toBe(true);
    expect(hubToggle.textContent).toContain("Hide preview");
    expect(hubToggle.getAttribute("aria-expanded")).toBe("true");
    expect(gearToggle.textContent).toContain("Show preview");

    fireEvent.click(hubToggle);
    expect(screen.queryByTestId("booked-stl-stub")).toBeNull();
    expect(hubToggle.textContent).toContain("Show preview");
  });

  it("remembers an opened preview for the rest of the page session", async () => {
    const printBooking = booking({
      equipment_profile_type: "PRINT_3D",
      fabrication_parts: [{ kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1 }],
    });
    const { unmount } = render(<FabricationBookingParts booking={printBooking} />);
    fireEvent.click(screen.getByTestId("fabrication-preview-toggle-p1"));
    await screen.findByTestId("booked-stl-stub");
    unmount();

    const again = render(<FabricationBookingParts booking={printBooking} />);
    expect((await screen.findByTestId("booked-stl-stub")).textContent).toBe("gear.stl");
    again.unmount();

    render(<FabricationBookingParts booking={{ ...printBooking, booking_id: 42 }} />);
    expect(screen.queryByTestId("booked-stl-stub")).toBeNull();
  });

  it("does not offer a preview on the printed job sheet", () => {
    const printBooking = booking({
      equipment_profile_type: "PRINT_3D",
      fabrication_parts: [{ kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1 }],
    });
    render(<FabricationBookingParts booking={printBooking} printable />);
    expect(screen.queryByTestId("fabrication-preview-toggle-p1")).toBeNull();
    expect(screen.queryByTestId("booked-stl-stub")).toBeNull();
  });

  it("does not fetch the DXF until its preview is shown", async () => {
    render(<FabricationBookingParts booking={booking()} />);
    expect(screen.queryByTestId("fabrication-preview-a1")).toBeNull();
    expect(api.getLaserCutDxfText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fabrication-preview-toggle-a1"));
    expect(screen.getByTestId("fabrication-preview-a1")).toBeTruthy();
    await waitFor(() => expect(api.getLaserCutDxfText).toHaveBeenCalledTimes(1));
    expect(api.getLaserCutDxfText).toHaveBeenCalledWith("a1");

    fireEvent.click(screen.getByTestId("fabrication-preview-toggle-a1"));
    expect(screen.queryByTestId("fabrication-preview-a1")).toBeNull();
  });

  it("previews only the STL files still stored and explains the ones deleted after completion", async () => {
    const printBooking = booking({
      equipment_profile_type: "PRINT_3D",
      fabrication_parts: [
        { kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1, file_available: false },
        { kind: "print", analysis_id: "p2", name: "Hub", filename: "hub.stl", quantity: 1, file_available: true },
      ],
    });
    const { unmount } = render(<FabricationBookingParts booking={printBooking} />);
    expect(screen.queryByTestId("fabrication-preview-toggle-p1")).toBeNull();
    fireEvent.click(screen.getByTestId("fabrication-preview-toggle-p2"));
    expect((await screen.findByTestId("booked-stl-stub")).textContent).toBe("hub.stl");
    expect(screen.getByTestId("fabrication-file-removed-p1").textContent).toBe("STL removed");
    expect(screen.queryByRole("button", { name: "Download gear.stl" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download hub.stl" })).toBeTruthy();
    expect(screen.getByTestId("fabrication-files-removed").textContent).toContain("Some STL files were deleted");
    unmount();

    render(
      <FabricationBookingParts
        booking={booking({
          equipment_profile_type: "PRINT_3D",
          fabrication_parts: [{ kind: "print", analysis_id: "p1", name: "Gear", filename: "gear.stl", quantity: 1, file_available: false }],
        })}
      />,
    );
    expect(screen.queryByTestId("fabrication-preview-toggle-p1")).toBeNull();
    expect(screen.queryByTestId("booked-stl-stub")).toBeNull();
    expect(screen.getByTestId("fabrication-files-removed").textContent).toContain("The STL files were deleted");
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
