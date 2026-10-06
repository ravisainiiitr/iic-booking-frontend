// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OICSubstitute from "./OICSubstitute";

const auth = vi.hoisted(() => ({
  state: {
    user: { id: 3, email: "oic@iitr.ac.in", name: "Alpha", user_type: "manager" } as Record<string, unknown>,
    isAuthenticated: true,
    loading: false,
  },
}));

const api = vi.hoisted(() => ({ bulk: vi.fn(), bulkEnd: vi.fn(), granted: [] as unknown[] }));

const EQUIPMENTS = [
  { id: 1, code: "XRD-1", name: "XRD" },
  { id: 2, code: "SEM-1", name: "SEM" },
  { id: 3, code: "TEM-1", name: "TEM" },
];
const BETA = { id: 11, name: "Beta Colleague", email: "beta@iitr.ac.in" };
const GAMMA = { id: 12, name: "Gamma Colleague", email: "gamma@iitr.ac.in" };

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: () => null,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api", () => {
  const handlers: Record<string, unknown> = {
    getOicSubstituteOptions: async () => ({
      data: {
        role: "oic",
        department: { id: 1, name: "Physics" },
        equipments: EQUIPMENTS,
        max_substitutes: 5,
        today: "2026-10-06",
      },
    }),
    searchOicSubstituteCandidates: async () => ({ data: { department: { id: 1, name: "Physics" }, candidates: [BETA, GAMMA] } }),
    getOicSubstitutions: async () => ({ data: { scope: "oic", granted: api.granted, assigned_to_me: [] } }),
    createOicSubstitutionsBulk: (...args: unknown[]) => api.bulk(...args),
    endOicSubstitutionsBulk: (...args: unknown[]) => api.bulkEnd(...args),
  };
  return {
    apiClient: new Proxy(handlers, { get: (target, key: string) => target[key] ?? (async () => ({ data: null })) }),
  };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

const renderPage = () =>
  render(
    <MemoryRouter>
      <OICSubstitute />
    </MemoryRouter>,
  );

const pick = async (comboLabel: string, personName: string) => {
  const trigger = screen.getByRole("combobox", { name: comboLabel });
  fireEvent.click(trigger);
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: new RegExp(personName) }));
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

const sub = (id: number, eq: (typeof EQUIPMENTS)[number], person: typeof BETA, status = "active") => ({
  id,
  batch_id: "b",
  equipment: eq,
  primary_oic: { id: 3, name: "Alpha", email: "oic@iitr.ac.in" },
  substitute: person,
  start_at: "2026-10-06T04:30:00Z",
  resume_at: "2026-10-08T18:30:00Z",
  start_display: "",
  end_display: "",
  status,
  status_label: status === "active" ? "Active" : "Scheduled",
  reason: "Leave",
  created_at: "2026-10-06T04:30:00Z",
  created_by: null,
  ended_at: null,
  ended_by: null,
  end_reason: "",
  can_end: true,
  events: [],
});

beforeEach(() => {
  api.bulk.mockReset();
  api.bulkEnd.mockReset();
  api.granted = [];
});
afterEach(() => cleanup());

describe("OIC Substitute: assign several equipment", () => {
  it("assigns all equipment with one shortcut, overrides one row and reviews per substitute", async () => {
    api.bulk.mockResolvedValue({ data: { items: [], message: "Substitutes assigned for 3 equipment." } });
    renderPage();
    expect(await screen.findByText("TEM")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all equipment" }));
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();

    await pick("Substitute for all selected equipment", "Beta");
    fireEvent.click(screen.getByRole("button", { name: "Apply to 3 selected" }));

    await pick("Substitute for TEM", "Beta");
    await pick("Substitute for TEM", "Gamma");

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Conference" } });
    fireEvent.click(screen.getByRole("button", { name: /Review and assign/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Beta Colleague")).toBeTruthy();
    expect(within(dialog).getByText("2 equipment")).toBeTruthy();
    expect(within(dialog).getByText("Gamma Colleague")).toBeTruthy();
    expect(within(dialog).getByText("1 equipment")).toBeTruthy();
    expect(within(dialog).getByText("Conference")).toBeTruthy();
    expect(within(dialog).getAllByText(/to 06-10-2026/).length).toBe(3);

    fireEvent.click(within(dialog).getByRole("button", { name: /Confirm and assign/ }));
    await waitFor(() => expect(api.bulk).toHaveBeenCalledTimes(1));
    expect(api.bulk.mock.calls[0][0]).toEqual({
      assignments: [
        { equipment_id: 1, substitute_ids: [11] },
        { equipment_id: 2, substitute_ids: [11] },
        { equipment_id: 3, substitute_ids: [12] },
      ],
      start_date: "2026-10-06",
      end_date: "2026-10-06",
      reason: "Conference",
    });
  });

  it("shows server row errors on the matching equipment and keeps the form", async () => {
    api.bulk.mockResolvedValue({
      error: "Nothing was assigned. Please fix 1 row and try again.",
      data: { row_errors: [{ index: 1, equipment_id: 2, message: "Beta already has substitute access to this equipment." }] },
    });
    renderPage();
    expect(await screen.findByText("SEM")).toBeTruthy();
    await pick("Substitute for XRD", "Beta");
    await pick("Substitute for SEM", "Beta");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leave" } });
    fireEvent.click(screen.getByRole("button", { name: /Review and assign/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Confirm and assign/ }));

    expect(await screen.findByText("Beta already has substitute access to this equipment.")).toBeTruthy();
    expect(screen.getByText("2 of 3 selected")).toBeTruthy();
  });

  it("asks for a substitute on selected rows before review", async () => {
    renderPage();
    expect(await screen.findByText("XRD")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select XRD" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leave" } });
    fireEvent.click(screen.getByRole("button", { name: /Review and assign/ }));
    expect(await screen.findByText("Choose a substitute.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("OIC Substitute: lists grouped by substitute", () => {
  it("groups by substitute and revokes several with one reason", async () => {
    api.granted = [sub(101, EQUIPMENTS[0], BETA), sub(102, EQUIPMENTS[1], BETA), sub(103, EQUIPMENTS[2], GAMMA)];
    api.bulkEnd.mockResolvedValue({ data: { items: [], message: "3 substitutions ended." } });
    renderPage();
    expect(await screen.findByRole("button", { name: "Revoke all (3)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke all (2)" })).toBeTruthy();
    expect(screen.getAllByText("06-10-2026 to 08-10-2026").length).toBe(3);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all for Beta Colleague" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke selected (2)" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Back early" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke 2" }));
    await waitFor(() => expect(api.bulkEnd).toHaveBeenCalledWith([101, 102], "Back early"));
  });
});
