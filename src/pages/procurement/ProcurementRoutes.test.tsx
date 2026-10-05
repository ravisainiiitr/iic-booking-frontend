// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => false }));

function serve(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = new URL(url, "http://x").pathname.replace("/api/v1/procurement/", "");
    const body = routes[path];
    return new Response(JSON.stringify(body ?? { detail: "Not found." }), { status: body ? 200 : 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function mount(path: string) {
  vi.resetModules();
  const { default: ProcurementRoutes } = await import("./ProcurementRoutes");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/procurement/*" element={<ProcurementRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const boot = { departments: [], menus: {}, oic_equipment_ids: [], operator_equipment_ids: [], equipment: [] };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProcurementRoutes", () => {
  it("renders standalone (brings its own query client) and explains when the module is off", async () => {
    const fetchMock = serve({ "bootstrap/": { ...boot, enabled: false, can_configure: false } });
    await mount("/procurement");
    expect(await screen.findByText(/not enabled for your department/i)).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Token tok" } });
  });

  it("sends the Main Administrator without a department to settings", async () => {
    serve({ "bootstrap/": { ...boot, enabled: false, can_configure: true }, "config/": { results: [] } });
    await mount("/procurement");
    expect(await screen.findByText("No internal departments.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  });
});
