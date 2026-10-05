// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

const boot = { departments: [], menus: {}, oic_equipment_ids: [], operator_equipment_ids: [], equipment: [] };

function serveBootstrap(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function availability() {
  vi.resetModules();
  const { useProcurementAvailability } = await import("./useProcurementAvailability");
  return renderHook(() => useProcurementAvailability(true));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useProcurementAvailability (dashboard tile and admin menu)", () => {
  it("hides the entry for users outside the pilot, Main Administrators included", async () => {
    const fetchMock = serveBootstrap({ ...boot, enabled: false, can_configure: false });
    const { result } = await availability();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.bootstrap).not.toBeNull());
    expect(result.current.available).toBe(false);
  });

  it("shows the entry for pilot users", async () => {
    serveBootstrap({ ...boot, enabled: true, can_configure: false, departments: [{ department: { id: 33, name: "IIC" } }] });
    const { result } = await availability();
    await waitFor(() => expect(result.current.available).toBe(true));
  });

  it("stays hidden when the bootstrap call fails", async () => {
    const fetchMock = serveBootstrap({ detail: "Procurement & Assets is not enabled for your account.", code: "procurement_disabled" }, 403);
    const { result } = await availability();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.available).toBe(false);
  });
});
