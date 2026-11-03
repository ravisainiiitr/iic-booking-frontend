// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getCmsPublications = vi.fn();
vi.mock("@/lib/api", () => ({ apiClient: { getCmsPublications: (...a: unknown[]) => getCmsPublications(...a) } }));
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import Publications from "./Publications";

const page = (over: Record<string, unknown> = {}) => ({ data: {
  count: 30, page: 1, page_size: 25, num_pages: 2,
  results: [{ id: 1, title: "Microstructure of HEA", citation: "Kumar A. (2025)", url: "", doi: "10.1016/j.matlet.2025.100",
    year: 2025, equipment: [{ id: 4, name: "FESEM", code: "FESEM" }, { id: 5, name: "XRD", code: "XRD" }],
    equipment_id: 4, equipment_name: "FESEM", equipment_code: "FESEM", record_count: 2 }],
  facets: { equipment: [{ id: 4, name: "FESEM", code: "FESEM", count: 20 }], years: [2025, 2024] },
  ...over,
} });

afterEach(() => { cleanup(); getCmsPublications.mockReset(); });

describe("Publications", () => {
  it("lists each paper once with every instrument and pages on the server", async () => {
    getCmsPublications.mockResolvedValue(page());
    render(<MemoryRouter><Publications /></MemoryRouter>);
    const list = await screen.findByTestId("publication-list");
    expect(within(list).getByText("FESEM")).toBeTruthy();
    expect(within(list).getByText("XRD")).toBeTruthy();
    expect(screen.getByText(/30 publications listed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(getCmsPublications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("searches on the server", async () => {
    getCmsPublications.mockResolvedValue(page());
    render(<MemoryRouter><Publications /></MemoryRouter>);
    await screen.findByTestId("publication-list");
    fireEvent.change(screen.getByLabelText("Search publications"), { target: { value: "hea" } });
    await waitFor(() => expect(getCmsPublications).toHaveBeenLastCalledWith(expect.objectContaining({ q: "hea", page: 1 })), { timeout: 2000 });
  });
});
