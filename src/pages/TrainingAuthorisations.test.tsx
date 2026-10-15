// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthorisationRequest, AuthorisedUser, ManagedAuthorisationEquipment } from "@/lib/trainingAuthTypes";

const api = vi.hoisted(() => ({
  authorisationEquipment: vi.fn(),
  authorisationRequests: vi.fn(),
  authorisationRequestAction: vi.fn(),
  authorisedUsers: vi.fn(),
  authorisationAwardAction: vi.fn(),
  grantAuthorisation: vi.fn(),
  authorisationPeople: vi.fn(),
  exportAuthorisedUsers: vi.fn(),
  saveAuthorisationSetting: vi.fn(),
  levels: vi.fn(),
  grandfatherPreview: vi.fn(),
  grandfatherApply: vi.fn(),
}));
const avail = vi.hoisted(() => ({ menus: { training_authorisations: true } as Record<string, boolean> }));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/lib/trainingApi", () => ({ trainingApi: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ BackButton: () => null }));
vi.mock("@/components/training/useTrainingAvailability", () => ({
  useTrainingAvailability: () => ({ loading: false, bootstrap: null, enabled: true, menu: (k: string) => Boolean(avail.menus[k]) }),
}));

import TrainingAuthorisations from "./TrainingAuthorisations";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const eq = { equipment_id: 7, code: "XRD", name: "X-ray Diffractometer", department: "IIC" };
const equipmentRow: ManagedAuthorisationEquipment = {
  equipment: eq,
  required: false,
  live: false,
  module_enabled: true,
  in_training_scope: true,
  audience: "TEST_ACCOUNTS",
  applies_to: "INTERNAL",
  applies_to_choices: [
    { value: "INTERNAL", label: "Internal users (self-operated) only" },
    { value: "ALL", label: "Everyone who books" },
  ],
  min_level_code: "TRAINED",
  min_level_name: "Trained",
  validity_months: 24,
  grace_completed_bookings: 0,
  grace_months: 12,
  note: "",
  updated_at: null,
  updated_by: null,
  open_requests: 1,
  can_configure: true,
};
const student = { id: 21, name: "Asha Student", email: "asha@iitr.ac.in", department: "Chemistry" };
const request: AuthorisationRequest = {
  id: 5,
  reference: "AR-0005",
  status: "PENDING",
  status_label: "Pending",
  scheduled_start: null,
  scheduled_end: null,
  location: "",
  created_at: "2026-10-12T10:00:00+05:30",
  user: student,
  supervisor: { id: 2, name: "Prof. Rao" },
  equipment: eq,
  message: "Need XRD for thin films",
  staff_note: "",
  decision_reason: "",
  decided_by: null,
  decided_at: null,
  award_id: null,
  history: { completed_bookings_12m: 3 },
  can_handle: true,
  can_withdraw: false,
};
const award: AuthorisedUser = {
  id: 40,
  user: student,
  equipment: eq,
  level: "TRAINED",
  level_name: "Trained",
  status: "ACTIVE",
  status_label: "Active",
  awarded_at: "2026-01-10T10:00:00+05:30",
  valid_until: "2028-01-10T10:00:00+05:30",
  source_event_id: null,
  expiring: false,
  supervisor: null,
  source: "bulk",
  awarded_by: null,
};

const renderPage = (path = "/training/authorisations") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TrainingAuthorisations />
    </MemoryRouter>,
  );

beforeEach(() => {
  avail.menus = { training_authorisations: true };
  Object.values(api).forEach((fn) => fn.mockReset());
  api.authorisationEquipment.mockResolvedValue({ data: { results: [equipmentRow], total: 1 } });
  api.authorisationRequests.mockResolvedValue({ data: { results: [request] } });
  api.authorisedUsers.mockResolvedValue({ data: { results: [award] } });
  api.levels.mockResolvedValue({ data: { results: [{ code: "TRAINED", name: "Trained", rank: 10 }] } });
});

afterEach(() => cleanup());

describe("TrainingAuthorisations", () => {
  it("is not available without the menu", () => {
    avail.menus = {};
    renderPage();
    expect(screen.getByText("Training & Certification is not available")).toBeTruthy();
    expect(api.authorisationEquipment).not.toHaveBeenCalled();
  });

  it("lists open requests and rejects one with a reason", async () => {
    api.authorisationRequestAction.mockResolvedValue({ data: { ...request, status: "REJECTED" } });
    renderPage();
    expect(await screen.findByText("Asha Student")).toBeTruthy();
    expect(screen.getByText("Gate off")).toBeTruthy();
    expect(screen.getByText(/3 completed bookings \(12 months\)/)).toBeTruthy();
    expect(api.authorisationRequests).toHaveBeenCalledWith({ scope: "inbox", equipment_id: 7, status: "open" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Please attend the October group session" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(api.authorisationRequestAction).toHaveBeenCalledWith(5, "reject", { reason: "Please attend the October group session" }),
    );
  });

  it("marks a requester trained with a validity", async () => {
    api.authorisationRequestAction.mockResolvedValue({ data: { ...request, status: "APPROVED" } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mark trained" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Valid for/), { target: { value: "12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Authorise" }));
    await waitFor(() => expect(api.authorisationRequestAction).toHaveBeenCalledWith(5, "approve", { note: "", months: 12 }));
  });

  it("revokes an authorised user with a reason", async () => {
    api.authorisationAwardAction.mockResolvedValue({ data: { ...award, status: "REVOKED" } });
    renderPage("/training/authorisations?tab=users");
    expect(await screen.findByText("Bulk grant")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Unsafe handling" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(api.authorisationAwardAction).toHaveBeenCalledWith(40, "revoke", { reason: "Unsafe handling", months: undefined }));
  });

  it("saves the booking gate setting", async () => {
    api.saveAuthorisationSetting.mockResolvedValue({ data: { ...equipmentRow, required: true } });
    renderPage("/training/authorisations?tab=settings");
    const toggle = await screen.findByRole("switch", { name: /Authorisation required to book/ });
    fireEvent.click(toggle);
    expect(screen.getByText(/test accounts only \(pilot\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Reason for the change/), { target: { value: "Pilot" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(api.saveAuthorisationSetting).toHaveBeenCalledWith(7, expect.objectContaining({ required: true, validity_months: 24, reason: "Pilot" })),
    );
  });

  it("previews grandfathering and applies only after typing GRANDFATHER", async () => {
    api.grandfatherPreview.mockResolvedValue({
      data: {
        dry_run: true,
        min_bookings: 2,
        months: 12,
        candidates: [
          { user: student, completed_bookings: 4, last_completed: "2026-09-01T10:00:00+05:30", already_authorised: false },
          { user: { id: 22, name: "Ravi Already" }, completed_bookings: 2, last_completed: null, already_authorised: true },
        ],
        would_authorise: 1,
        already_authorised: 1,
      },
    });
    api.grandfatherApply.mockResolvedValue({ data: { granted: 1 } });
    renderPage("/training/authorisations?tab=grandfather");
    fireEvent.click(await screen.findByRole("button", { name: "Preview (dry run)" }));
    expect(await screen.findByText("Ravi Already")).toBeTruthy();
    expect(api.grandfatherPreview).toHaveBeenCalledWith(7, { min_bookings: 2, months: 12 });
    const apply = screen.getByRole("button", { name: "Authorise 1 user" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type GRANDFATHER"), { target: { value: "GRANDFATHER" } });
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() =>
      expect(api.grandfatherApply).toHaveBeenCalledWith(7, {
        min_bookings: 2,
        months: 12,
        confirm: "GRANDFATHER",
        user_ids: [21],
        validity_months: undefined,
      }),
    );
  });
});
