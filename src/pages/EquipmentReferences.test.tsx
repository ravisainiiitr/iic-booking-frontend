// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getReferenceInstruments: vi.fn(),
  getEquipmentReferences: vi.fn(),
  addEquipmentReference: vi.fn(),
  refreshEquipmentReference: vi.fn(),
  removeEquipmentReference: vi.fn(),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import EquipmentReferences from "./EquipmentReferences";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const eq = { id: 5, name: "Field Emission SEM", code: "FESEM-01", make: "Carl Zeiss", model: "Sigma 300" };
const ref = {
  id: "r1", title: "Carl Zeiss Sigma 300 — Product page: ZEISS Sigma", url: "https://www.zeiss.com/sigma", kind: "product_page",
  kind_label: "Product page", official: true, source_type: "html", retrieved_at: "2026-11-02T04:00:00Z", index_status: "indexed",
  chunks: 4, error: "",
};

describe("EquipmentReferences", () => {
  it("lists the instrument's references with source and adds a new one", async () => {
    api.getReferenceInstruments.mockResolvedValue({ data: { results: [{ ...eq, references: 1 }] } });
    api.getEquipmentReferences.mockResolvedValue({ data: { equipment: eq, kinds: {}, results: [ref] } });
    api.addEquipmentReference.mockResolvedValue({ data: { ...ref, id: "r2" } });
    render(<MemoryRouter initialEntries={["/equipment-references?equipment=5"]}><EquipmentReferences /></MemoryRouter>);

    expect(await screen.findByText(/Manufacturer's site/)).toBeTruthy();
    expect(screen.getByText(/4 passages indexed/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /zeiss\.com\/sigma/ }).getAttribute("rel")).toContain("noopener");
    fireEvent.change(screen.getByLabelText("Web address of the page or PDF"), { target: { value: "https://www.zeiss.com/datasheet.pdf" } });
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "datasheet" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.addEquipmentReference).toHaveBeenCalledWith(5, { url: "https://www.zeiss.com/datasheet.pdf", kind: "datasheet" }));
  });

  it("asks to choose an instrument first", async () => {
    api.getReferenceInstruments.mockResolvedValue({ data: { results: [{ ...eq, references: 0 }] } });
    render(<MemoryRouter initialEntries={["/equipment-references"]}><EquipmentReferences /></MemoryRouter>);
    expect(await screen.findByText(/Choose an instrument/)).toBeTruthy();
    expect(await screen.findByText(/0 references/)).toBeTruthy();
  });
});
