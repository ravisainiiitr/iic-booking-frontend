// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  funding: vi.fn(),
  addFunding: vi.fn(),
  updateFunding: vi.fn(),
  policy: vi.fn(),
  savePolicy: vi.fn(),
  checkAcknowledgement: vi.fn(),
  myOrcid: vi.fn(),
  setOrcid: vi.fn(),
  removeOrcid: vi.fn(),
  suggestions: vi.fn(),
  checkSuggestions: vi.fn(),
  dismissSuggestion: vi.fn(),
  report: vi.fn(),
  downloadReport: vi.fn(),
}));
const auth = vi.hoisted(() => ({ value: { user: { id: 1, user_type: "admin" } } }));

vi.mock("@/lib/impactApi", () => ({ impactApi: api }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/components/training/trainingUi", async (orig) => {
  const actual = await orig<typeof import("@/components/training/trainingUi")>();
  return {
    ...actual,
    TrainingPageFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    ),
  };
});

import { AcknowledgementCheck, PublicationDiscovery } from "./PublicationDiscovery";
import FunderImpactReport, { currentFinancialYear } from "@/pages/FunderImpactReport";

const suggestion = { id: 4, doi: "10.1000/new.paper", title: "New paper on XRD", journal: "J. Materials", year: 2026,
  authors: "Student One", equipment_ids: [7], status: "NEW", status_label: "New", source: "openalex" };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.policy.mockResolvedValue({ data: { wording: "We thank the IIC.", required_phrases: ["IIC"], include_equipment_name: false, updated_at: null } });
});
afterEach(() => cleanup());

describe("Find my papers", () => {
  it("saves an ORCID iD, lists suggestions and fills the claim form from one", async () => {
    api.myOrcid.mockResolvedValue({ data: { orcid: "", discovery_enabled: true, last_checked_at: null, last_error: "" } });
    api.suggestions.mockResolvedValue({ data: { results: [suggestion] } });
    api.setOrcid.mockResolvedValue({ data: { orcid: "0000-0002-1825-0097" } });
    const onUse = vi.fn();
    render(<PublicationDiscovery onUse={onUse} />);
    expect(await screen.findByText("New paper on XRD")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("ORCID iD"), { target: { value: "0000-0002-1825-0097" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.setOrcid).toHaveBeenCalledWith("0000-0002-1825-0097"));
    fireEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(onUse).toHaveBeenCalledWith(suggestion);
  });

  it("dismisses a suggestion", async () => {
    api.myOrcid.mockResolvedValue({ data: { orcid: "0000-0002-1825-0097", discovery_enabled: true, last_checked_at: null, last_error: "" } });
    api.suggestions.mockResolvedValue({ data: { results: [suggestion] } });
    api.dismissSuggestion.mockResolvedValue({ data: { ...suggestion, status: "DISMISSED" } });
    render(<PublicationDiscovery onUse={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Not mine/ }));
    await waitFor(() => expect(screen.queryByText("New paper on XRD")).toBeNull());
    expect(api.dismissSuggestion).toHaveBeenCalledWith(4);
  });
});

describe("Acknowledgement check", () => {
  it("shows the suggested wording and what is missing", async () => {
    api.checkAcknowledgement.mockResolvedValue({
      data: { result: "PARTIAL", found: [{ phrase: "IIC", for: "Facility" }], missing: [{ phrase: "DST-FIST|FIST programme", for: "DST FIST" }], wording: "", stored: false },
    });
    render(<AcknowledgementCheck equipmentIds={[7]} />);
    expect(await screen.findByText("We thank the IIC.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Acknowledgement in the paper/), { target: { value: "Thanks IIC" } });
    fireEvent.click(screen.getByRole("button", { name: "Check acknowledgement" }));
    const result = await screen.findByTestId("ack-result");
    expect(result.textContent).toContain("Acknowledgement incomplete");
    expect(result.textContent).toContain("DST FIST: add “DST-FIST”");
    expect(api.checkAcknowledgement).toHaveBeenCalledWith("Thanks IIC", [7]);
  });

  it("asks for instruments before checking", () => {
    render(<AcknowledgementCheck equipmentIds={[]} />);
    expect((screen.getByRole("button", { name: "Check acknowledgement" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Funder impact report", () => {
  const report = {
    date_from: "2026-04-01", date_to: "2027-03-31", equipment_count: 2, totals: {},
    notes: ["Publications are unique papers."],
    groups: [
      {
        funder: "DST", scheme: "FIST", equipment: [
          { equipment_id: 7, name: "XRD", code: "XRD1", bookings: 10, booking_hours: 25.5, users_internal: 4, users_external: 1,
            samples: 30, revenue: 1000, publications: 1, impact_factor_sum: 4.5, people_authorised: 3, downtime_hours: 2 },
        ],
        totals: { equipment: 1, bookings: 10, booking_hours: 25.5, users_internal: 4, users_external: 1, samples: 30, revenue: 1000,
          publications_unique: 1, impact_factor_sum: 4.5, people_authorised: 3, sanctioned_amount: 12500000 },
      },
    ],
  };

  it("defaults to the current financial year, shows groups and exports", async () => {
    api.report.mockResolvedValue({ data: report });
    api.funding.mockResolvedValue({ data: { results: [], funders: [{ funder: "DST", scheme: "FIST" }] } });
    api.downloadReport.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <FunderImpactReport />
      </MemoryRouter>,
    );
    expect(await screen.findByText("DST · FIST")).toBeTruthy();
    const fy = currentFinancialYear();
    expect(api.report).toHaveBeenCalledWith({ date_from: fy.from, date_to: fy.to });
    expect(screen.getByTestId("group-total").textContent).toContain("4 / 1");
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(api.downloadReport).toHaveBeenCalledWith({ date_from: fy.from, date_to: fy.to }, "xlsx"));
    expect(screen.getByText(/Acknowledgement wording/)).toBeTruthy(); // Main Admin only
  });

  it("financial year runs April to March", () => {
    expect(currentFinancialYear(new Date(2026, 1, 10))).toEqual({ from: "2025-04-01", to: "2026-03-31" });
    expect(currentFinancialYear(new Date(2026, 3, 1))).toEqual({ from: "2026-04-01", to: "2027-03-31" });
  });
});
