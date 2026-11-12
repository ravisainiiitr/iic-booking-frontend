// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  api: {
    getIstemEquipmentDetails: vi.fn(),
    saveIstemEquipmentDetails: vi.fn(),
    syncIstemReferenceLists: vi.fn(),
    createIstemEquipment: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ apiClient: state.api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import IstemEquipmentCreateDialog from "./IstemEquipmentCreateDialog";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

const FIELDS = [
  { name: "equipment_name", label: "Equipment name", required: true },
  { name: "equipment_model", label: "Model", required: false },
  { name: "equipment_srno", label: "Serial number", required: true },
  { name: "funding_agency_id", label: "Funding agency", required: true },
];

function details(over: Record<string, unknown> = {}) {
  return {
    equipment: { id: 45, code: "FESEM-01", name: "Field Emission SEM", department: "IIC" },
    details: { equipment_name: "Field Emission SEM", equipment_model: "", equipment_srno: "", funding_agency_id: "" },
    fields: FIELDS,
    saved: false,
    problems: { equipment_srno: "Serial number is required by I-STEM.", funding_agency_id: "Funding agency is required by I-STEM." },
    created: null,
    last_error: "",
    mapping: null,
    choices: {
      istem_departments: [], funding_agencies: [{ id: "109", name: "Department of Science and Technology" }],
      funding_agency_types: [], equipment_categories: [], facilities: [],
    },
    ...over,
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Create on I-STEM dialog", () => {
  it("lists required fields first, shows what is missing and keeps Create disabled", async () => {
    state.api.getIstemEquipmentDetails.mockResolvedValue({ data: details() });
    render(<IstemEquipmentCreateDialog equipmentId={45} onClose={() => {}} onCreated={() => {}} />);
    await screen.findByText("Serial number is required by I-STEM.");
    const order = screen.getAllByTestId(/^field-(?!problem)/).map((el) => el.getAttribute("data-testid"));
    expect(order).toEqual(["field-equipment_name", "field-equipment_srno", "field-funding_agency_id", "field-equipment_model"]);
    expect(screen.getByLabelText("Serial number *")).toBeTruthy();
    expect((screen.getByTestId("istem-create-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves edits, then creates after confirmation", async () => {
    const ready = details({ problems: {}, details: { equipment_name: "Field Emission SEM", equipment_model: "", equipment_srno: "SN-1", funding_agency_id: "109" } });
    state.api.getIstemEquipmentDetails.mockResolvedValue({ data: details() });
    state.api.saveIstemEquipmentDetails.mockResolvedValue({ data: ready });
    state.api.createIstemEquipment.mockResolvedValue({ data: { ...ready, created: true, istem_equipment_id: "40001", warnings: [] } });
    const onCreated = vi.fn();
    render(<IstemEquipmentCreateDialog equipmentId={45} onClose={() => {}} onCreated={onCreated} />);
    fireEvent.change(await screen.findByLabelText("Serial number *"), { target: { value: "SN-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(state.api.saveIstemEquipmentDetails).toHaveBeenCalledWith(45, expect.objectContaining({ equipment_srno: "SN-1" })));
    const create = screen.getByTestId("istem-create-submit") as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);
    fireEvent.click(await screen.findByRole("button", { name: /Yes, create it/ }));
    await waitFor(() => expect(state.api.createIstemEquipment).toHaveBeenCalledWith(45, false));
    expect(onCreated).toHaveBeenCalled();
  });

  it("asks for I-STEM's alert email and the Yes / No support answers", async () => {
    const fields = [...FIELDS,
      { name: "alert_mailid", label: "Alert email (I-STEM sends this instrument's alerts here)", required: true },
      { name: "pre_experiment_support", label: "Pre-experiment support", required: true },
      { name: "post_experiment_support", label: "Post-experiment support", required: true }];
    const base = details();
    state.api.getIstemEquipmentDetails.mockResolvedValue({ data: details({
      fields,
      details: { ...base.details, alert_mailid: "oic@iitr.ac.in", pre_experiment_support: "No", post_experiment_support: "No" },
      choices: { ...base.choices, yes_no: [{ id: "Yes", name: "Yes" }, { id: "No", name: "No" }] },
    }) });
    render(<IstemEquipmentCreateDialog equipmentId={45} onClose={() => {}} onCreated={() => {}} />);
    expect(((await screen.findByLabelText("Alert email (I-STEM sends this instrument's alerts here) *")) as HTMLInputElement).value).toBe("oic@iitr.ac.in");
    const pre = screen.getByRole("combobox", { name: "Pre-experiment support" });
    expect(pre.textContent).toBe("No");  // a Yes / No choice, not free text
    expect(screen.getByRole("combobox", { name: "Post-experiment support" })).toBeTruthy();
  });

  it("shows an instrument already created", async () => {
    state.api.getIstemEquipmentDetails.mockResolvedValue({ data: details({ problems: {}, created: { istem_equipment_id: "40001", at: "2026-11-08" } }) });
    render(<IstemEquipmentCreateDialog equipmentId={45} onClose={() => {}} onCreated={() => {}} />);
    expect((await screen.findByTestId("istem-created")).textContent).toContain("40001");
    expect(screen.queryByTestId("istem-create-submit")).toBeNull();
  });
});
