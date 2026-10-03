// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ apiClient: { getToken: () => "" } }));
vi.mock("@/lib/catalogCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalogCache")>();
  return {
    ...actual,
    peekCatalogDepartments: () => null,
    loadCatalogDepartments: () =>
      Promise.resolve([
        { id: 1, name: "Institute Instrumentation Centre", code: "IIC", equipment_count: 40 },
        { id: 2, name: "Chemistry", code: "CY", equipment_count: 12 },
        { id: 3, name: "Physics", code: "PH", equipment_count: 8 },
      ]),
  };
});

import DepartmentFilter from "./DepartmentFilter";

describe("DepartmentFilter", () => {
  let onChange: ReturnType<typeof vi.fn>;
  let onResolved: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    onResolved = vi.fn();
  });

  afterEach(cleanup);

  it("defaults to IIC when no restriction is given", async () => {
    render(<DepartmentFilter value="all" onChange={onChange} onResolved={onResolved} defaultDepartmentName="Institute Instrumentation Centre" />);
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(1));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("keeps IIC as the default when it is among the allowed departments", async () => {
    render(
      <DepartmentFilter
        value="all"
        onChange={onChange}
        onResolved={onResolved}
        defaultDepartmentName="Institute Instrumentation Centre"
        allowedDepartmentIds={[3, 1]}
        showAllOption={false}
      />,
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(1));
  });

  it("falls back to the first allowed department when IIC is not allowed", async () => {
    render(
      <DepartmentFilter
        value="all"
        onChange={onChange}
        onResolved={onResolved}
        defaultDepartmentName="Institute Instrumentation Centre"
        allowedDepartmentIds={[3, 2]}
        showAllOption={false}
      />,
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(2));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("shows only the code and count on a compact trigger, with the full name as its tooltip", async () => {
    const { getByRole } = render(
      <DepartmentFilter value={1} onChange={onChange} onResolved={onResolved} hideLabel compactTrigger />,
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    const trigger = getByRole("combobox");
    await waitFor(() => expect(trigger.textContent).toContain("IIC · 40"));
    expect(trigger.textContent).not.toContain("Institute Instrumentation Centre");
    expect(trigger.getAttribute("title")).toBe("Institute Instrumentation Centre (IIC): 40 equipment");
  });
});
