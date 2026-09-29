import { beforeEach, describe, expect, it, vi } from "vitest";

const getEquipments = vi.fn();
const getCatalogDepartments = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    getToken: () => "token-a",
    getEquipments: (...args: unknown[]) => getEquipments(...args),
    getCatalogDepartments: () => getCatalogDepartments(),
  },
}));

const row = (id: number, status = "ACTIVE") => ({ equipment_id: id, status });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("catalogCache", () => {
  beforeEach(() => {
    vi.resetModules();
    getEquipments.mockReset();
    getCatalogDepartments.mockReset();
  });

  it("shares one request between concurrent callers and serves the result from cache", async () => {
    getEquipments.mockResolvedValue({ data: { equipments: [row(1)], count: 1 } });
    const { loadCatalogEquipment, peekCatalogEquipment } = await import("./catalogCache");

    const [a, b] = await Promise.all([loadCatalogEquipment(33, null), loadCatalogEquipment(33, null)]);

    expect(getEquipments).toHaveBeenCalledTimes(1);
    expect(getEquipments).toHaveBeenCalledWith(undefined, undefined, undefined, true, 33, null);
    expect(a).toBe(b);
    expect(peekCatalogEquipment(33, null)?.data).toEqual([row(1)]);
    expect(peekCatalogEquipment(33, "managed")).toBeNull();
  });

  it("does not let an older in-flight response overwrite a forced reload", async () => {
    const stale = deferred<unknown>();
    getEquipments
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ data: { equipments: [row(1, "REPAIR")], count: 1 } });
    const { loadCatalogEquipment, peekCatalogEquipment } = await import("./catalogCache");

    const first = loadCatalogEquipment(33, null);
    await loadCatalogEquipment(33, null, { force: true });
    stale.resolve({ data: { equipments: [row(1, "ACTIVE")], count: 1 } });
    await first;

    expect(getEquipments).toHaveBeenCalledTimes(2);
    expect(peekCatalogEquipment(33, null)?.data).toEqual([row(1, "REPAIR")]);
  });

  it("does not cache failed catalog requests", async () => {
    getEquipments.mockResolvedValueOnce({ error: "boom" });
    const { loadCatalogEquipment, peekCatalogEquipment } = await import("./catalogCache");

    await expect(loadCatalogEquipment("all", null)).rejects.toThrow("boom");
    expect(peekCatalogEquipment("all", null)).toBeNull();
  });

  it("drops the Admin department and caches the list", async () => {
    getCatalogDepartments.mockResolvedValue({
      data: {
        departments: [
          { id: 1, name: "Admin", code: "ADMIN", equipment_count: 0 },
          { id: 33, name: "Institute Instrumentation Centre", code: "IIC", equipment_count: 29 },
        ],
        unassigned_count: 0,
      },
    });
    const { loadCatalogDepartments, peekCatalogDepartments } = await import("./catalogCache");

    const list = await loadCatalogDepartments();
    await loadCatalogDepartments();

    expect(list?.map((d) => d.id)).toEqual([33]);
    expect(peekCatalogDepartments()?.map((d) => d.id)).toEqual([33]);
    expect(getCatalogDepartments).toHaveBeenCalledTimes(1);
  });
});
