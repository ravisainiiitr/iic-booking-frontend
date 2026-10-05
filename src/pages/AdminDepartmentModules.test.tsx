// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: 1, user_type: "admin" } as { id: number; user_type: string } }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminDepartmentModules from "./AdminDepartmentModules";

const meta = (key: string, label: string) => ({
  key,
  label,
  test_users_only_help: `${label} test help`,
  off_help: `${label} off help`,
  usage_label: "things",
});

const cell = (enabled: boolean, extra: Record<string, unknown> = {}) => ({
  enabled,
  test_users_only: false,
  configured: true,
  source: "seed",
  note: "",
  disabled_at: null,
  test_only_since: null,
  updated_at: null,
  updated_by: null,
  usage: 0,
  ...extra,
});

const matrix = {
  modules: [
    meta("dsa", "Department Sync Agent"),
    meta("remote_analysis", "Remote Analysis"),
    meta("training", "Training & Certification"),
    meta("procurement", "Procurement & Assets"),
  ],
  departments: [
    {
      id: 33,
      name: "Institute Instrumentation Centre",
      code: "IIC",
      department_type: "internal",
      equipment_count: 33,
      cells: {
        dsa: cell(true, { usage: 32 }),
        remote_analysis: cell(true, { usage: 1 }),
        training: cell(true),
        procurement: cell(true, { test_users_only: true, source: "procurement", pilot_user_count: 6 }),
      },
    },
    {
      id: 47,
      name: "Tinkering Lab",
      code: "TL",
      department_type: "internal",
      equipment_count: 28,
      cells: {
        dsa: cell(false),
        remote_analysis: cell(false),
        training: cell(true, { test_users_only: true }),
        procurement: cell(false, { configured: false, source: "procurement" }),
      },
    },
    {
      id: 90,
      name: "Data Science Lab",
      code: "DSL",
      department_type: "internal",
      equipment_count: 0,
      cells: {
        dsa: cell(false, { source: "new" }),
        remote_analysis: cell(false, { configured: false, source: "new" }),
        training: cell(false, { source: "new" }),
        procurement: cell(false, { configured: false, source: "procurement" }),
      },
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  auth.user = { id: 1, user_type: "admin" };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/v1/admin/department-modules/")) return json(matrix);
    if (url.includes("/history/")) {
      return json({
        results: [
          {
            id: 9,
            created_at: "2026-10-05T04:00:00Z",
            department_id: 47,
            department: "Tinkering Lab",
            module_key: "dsa",
            action: "module.seeded",
            old: {},
            new: { enabled: false, test_users_only: false, configured: true },
            reason: "Initial state from existing data: no DSA profiles, agents or workspaces in use",
            actor: null,
          },
        ],
      });
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return json({ department_id: 33, module_key: "remote_analysis", cell: { ...cell(body.enabled ?? true), configured: true } });
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminDepartmentModules />
    </MemoryRouter>,
  );

describe("Department Modules (Main Administrator)", () => {
  it("is only for the Main Administrator", () => {
    auth.user = { id: 5, user_type: "dept_admin" };
    renderPage();
    expect(screen.getByText("Only the Main Administrator can manage department modules.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows departments as rows with a switch and a test-users-only toggle per module", async () => {
    renderPage();
    expect(await screen.findByText("Tinkering Lab")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Remote Analysis" })).toBeTruthy();
    const raIic = screen.getByRole("switch", { name: "Remote Analysis for Institute Instrumentation Centre" });
    expect(raIic.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Department Sync Agent for Tinkering Lab" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("checkbox", { name: "Test users only: Training & Certification for Tinkering Lab" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Pilot users only: Procurement & Assets for Institute Instrumentation Centre" })).toBeTruthy();
    expect(screen.getByText("32 things")).toBeTruthy();
  });

  it("marks departments created after the switches were introduced as new and off", async () => {
    renderPage();
    expect(await screen.findByText("Data Science Lab")).toBeTruthy();
    for (const label of ["Department Sync Agent", "Remote Analysis", "Training & Certification"]) {
      expect(screen.getByRole("switch", { name: `${label} for Data Science Lab` }).getAttribute("aria-checked")).toBe("false");
    }
    expect(screen.getAllByText("New department")).toHaveLength(3);
    expect(screen.queryByText("As before")).toBeNull();
  });

  it("asks for a reason before switching a module off and saves it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Remote Analysis for Institute Instrumentation Centre" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Switch Remote Analysis off for Institute Instrumentation Centre (IIC)")).toBeTruthy();
    expect(within(dialog).getByText(/Remote Analysis off help/)).toBeTruthy();
    const save = within(dialog).getByRole("button", { name: "Save change" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Workstation moved to TL" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/v1/admin/department-modules/33/remote_analysis/");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ enabled: false, reason: "Workstation moved to TL" });
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Remote Analysis for Institute Instrumentation Centre" }).getAttribute("aria-checked"),
      ).toBe("false"),
    );
  });

  it("cancelling the reason dialog changes nothing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Department Sync Agent for Tinkering Lab" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows a department's history", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "History for Tinkering Lab" }));
    expect(await screen.findByText("Starting state: Off")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/history/?department=47"))).toBe(true);
  });
});
