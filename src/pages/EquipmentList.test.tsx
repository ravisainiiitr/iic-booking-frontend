// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import EquipmentList from "./EquipmentList";

const row = (id: number, name: string, category: string, from_price: string | null, unit: string | null) => ({
  equipment_id: id,
  code: `EQ${id}`,
  name,
  profile_type: "SAMPLE",
  profile_type_display: "Sample",
  status: "ACTIVE",
  status_display: "Operational",
  location: "",
  image_url: "",
  category_name: category,
  from_price,
  from_price_unit: unit,
  created_at: "",
  updated_at: "",
});

const CATALOG = [
  row(1, "XPS", "Spectroscopy", "1500.00", "sample"),
  row(2, "FE-SEM", "Microscopy", "800.00", "hour"),
  row(3, "Raman", "Spectroscopy", null, null),
];

const mocks = vi.hoisted(() => ({
  getEquipments: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, user_type: "student" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/use-peak-window", () => ({
  usePeakWindow: () => ({ loaded: true, active: false, externalPaused: false, externalNotice: false, window: null, message: "" }),
}));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => false }));
vi.mock("@/components/WorkspaceHeaderActions", () => ({ useWorkspaceChrome: () => null }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/DepartmentFilter", () => ({ default: () => null }));
vi.mock("@/components/NoticeExpiryDialog", () => ({ NoticeExpiryDialog: () => null }));
vi.mock("@/components/EquipmentImage", () => ({ default: () => null }));
vi.mock("@/lib/catalogCache", () => ({
  CATALOG_REVALIDATE_AFTER_MS: 60_000,
  DEFAULT_CATALOG_DEPARTMENT_NAME: "Institute Instrumentation Centre",
  findPreferredDepartment: () => null,
  loadCatalogEquipment: vi.fn(async () => CATALOG),
  peekCatalogDepartments: () => null,
  peekCatalogEquipment: () => ({ data: CATALOG, ageMs: 0 }),
}));
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "/api",
  apiClient: {
    getToken: () => "tok",
    getCurrentUser: vi.fn(async () => ({ data: { id: 1 } })),
    getEquipments: mocks.getEquipments,
    getEquipmentImageProxyPath: (id: number) => `/img/${id}`,
  },
}));

beforeAll(() => {
  // Radix Select relies on these in jsdom.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
  mocks.getEquipments.mockImplementation(async (search?: string) => ({
    data: { equipments: CATALOG.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase())) },
  }));
});

afterEach(() => cleanup());

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

function DetailPage() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

const renderList = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/equipment"
          element={
            <>
              <EquipmentList />
              <Where />
            </>
          }
        />
        <Route path="/equipment/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Equipment catalog page", () => {
  it("shows from-prices for the viewer and hides unknown ones", async () => {
    renderList("/equipment?dept=all");
    expect(await screen.findByText("from ₹1,500/sample")).toBeTruthy();
    expect(screen.getByText("from ₹800/hour")).toBeTruthy();
    expect(screen.getAllByText(/from ₹/)).toHaveLength(2);
  });

  it("filters by category from the URL", async () => {
    renderList("/equipment?dept=all&category=Spectroscopy");
    await screen.findByText("XPS");
    expect(screen.getByText("Raman")).toBeTruthy();
    expect(screen.queryByText("FE-SEM")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Filter by category or technique" }).textContent).toContain("Spectroscopy");
  });

  it("keeps search text in the URL so Back from an equipment page restores it", async () => {
    renderList("/equipment?dept=all");
    await screen.findByText("FE-SEM");
    fireEvent.change(screen.getByPlaceholderText("Search by name or code..."), { target: { value: "xps" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("q=xps"));
    await waitFor(() => expect(screen.queryByText("FE-SEM")).toBeNull(), { timeout: 2000 });

    fireEvent.click(screen.getByText("XPS"));
    fireEvent.click(await screen.findByRole("button", { name: "Go back" }));

    const search = (await screen.findByPlaceholderText("Search by name or code...")) as HTMLInputElement;
    expect(search.value).toBe("xps");
    expect(screen.getByTestId("where").textContent).toContain("q=xps");
  });
});
