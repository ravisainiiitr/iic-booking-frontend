// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OicRequestRegistration from "@/components/booking/OicRequestRegistration";
import OicRequestAudit from "./OicRequestAudit";

const api = vi.hoisted(() => ({
  getOicRequestAudit: vi.fn(),
  downloadOicRequestAuditCsv: vi.fn(),
  getOicRegisteredRequests: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/components/PageShell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const row = {
  id: 1,
  created_at: "2026-11-06T10:00:00+05:30",
  action: "REFUSED",
  action_display: "Attempt refused",
  equipment_id: 344,
  equipment_code: "RL",
  equipment_name: "Repair Lab",
  department_name: "Instrument Centre",
  booking_id: null,
  booking_reference: "",
  event_type: "",
  previous_status: "",
  new_status: "",
  route: "booking",
  detail: "Only an Officer In-charge can raise a request.",
  actor_id: 7,
  actor_label: "A Student",
  actor_email: "student@example.ac.in",
  actor_role: "student",
  actor_department: "Physics",
  is_system: false,
  source: "Web portal",
  ip_address: "10.0.0.1",
  user_agent: "test",
};

const page = { count: 1, page: 1, page_size: 25, num_pages: 1, results: [row], actions: [{ value: "REFUSED", label: "Attempt refused" }] };

beforeEach(() => {
  api.getOicRequestAudit.mockReset().mockResolvedValue({ data: page });
  api.downloadOicRequestAuditCsv.mockReset().mockResolvedValue({});
  api.getOicRegisteredRequests.mockReset().mockResolvedValue({ data: { allowed: true, equipment_id: 344, results: [] } });
});
afterEach(() => cleanup());

const renderAudit = (path = "/oic-request-audit?equipment_id=344") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OicRequestAudit />
    </MemoryRouter>,
  );

describe("OIC request audit page", () => {
  it("lists who did what, when and from where, for the equipment in the link", async () => {
    renderAudit();
    const entry = await screen.findByTestId("audit-row");
    for (const text of ["Attempt refused", "Repair Lab", "A Student", "student@example.ac.in", "Only an Officer In-charge can raise a request.", "10.0.0.1"]) {
      expect(entry.textContent).toContain(text);
    }
    expect(api.getOicRequestAudit).toHaveBeenCalledWith(expect.objectContaining({ equipment_id: "344", page: 1 }));
  });

  it("exports with the filters on screen", async () => {
    renderAudit();
    await screen.findByTestId("audit-row");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "student" } });
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() =>
      expect(api.downloadOicRequestAuditCsv).toHaveBeenCalledWith(expect.objectContaining({ equipment_id: "344", q: "student" })),
    );
  });

  it("shows the server's refusal", async () => {
    api.getOicRequestAudit.mockResolvedValue({ error: "Not allowed" });
    renderAudit();
    expect((await screen.findByRole("alert")).textContent).toContain("Not allowed");
  });
});

describe("locked OIC request panel", () => {
  it("has no switch and links to the audit", async () => {
    render(<OicRequestRegistration equipmentId={344} active onActiveChange={() => undefined} locked />);
    expect(screen.getByRole("heading", { name: "Raise an OIC request" })).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("link", { name: "View the audit" }).getAttribute("href")).toBe("/oic-request-audit?equipment_id=344");
    await screen.findByText("None yet.");
  });
});
