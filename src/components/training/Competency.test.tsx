// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthorisationStatus, SupervisedSession } from "@/lib/trainingAuthTypes";

const api = vi.hoisted(() => ({
  gatedEquipment: vi.fn(),
  authorisationStatus: vi.fn(),
  requestTraining: vi.fn(),
  requestAssessment: vi.fn(),
  supervisedSessions: vi.fn(),
  supervisionAction: vi.fn(),
  authorisedUsers: vi.fn(),
  authorisationAwardAction: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/lib/trainingApi", () => ({ trainingApi: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AuthorisationGateCard, CompetencyProgress } from "./AuthorisationGateCard";
import { AuthorisedUsersPanel } from "./AuthorisationPanels";
import { SupervisionPanel } from "./CompetencyPanels";
import { resetGatedEquipment, useAuthorisationStatus } from "./useAuthorisation";

const beginner: AuthorisationStatus = {
  equipment_id: 7,
  required: true,
  status: "NOT_AUTHORISED",
  status_label: "Not authorised",
  allowed: false,
  valid_until: null,
  award_id: null,
  certificate_no: "",
  level_name: "Trained",
  open_request: null,
  can_request: false,
  message: "You are a Beginner on XRD: book it with a supervisor (a trainer or Lab staff), or request the Expert assessment to book independently.",
  two_level: true,
  stage: "BEGINNER",
  stage_label: "Beginner - supervised use only",
  independent: false,
  supervised_only: true,
  can_request_assessment: true,
  supervisors: [
    { id: 11, name: "Lab Operator", role: "Staff" },
    { id: 12, name: "Senior Scholar", role: "Trainer" },
  ],
};

const session: SupervisedSession = {
  id: 5,
  booking_id: 99,
  booking_reference: "BK-99",
  equipment: { equipment_id: 7, name: "XRD", code: "XRD1" } as SupervisedSession["equipment"],
  student: { id: 3, name: "Student One" },
  supervisor: { id: 11, name: "Lab Operator" },
  status: "REQUESTED",
  status_label: "Awaiting supervisor",
  start: "2026-11-10T04:30:00Z",
  end: "2026-11-10T05:30:00Z",
  response_note: "",
  remarks: "",
  recorded_by: null,
  recorded_at: null,
  can_respond: true,
  can_record: false,
};

beforeEach(() => {
  resetGatedEquipment();
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(() => cleanup());

describe("Beginner on a two-level equipment", () => {
  it("shows the stage, a supervisor picker and Request Expert assessment instead of blocking", async () => {
    const onSupervisorChange = vi.fn();
    const onChanged = vi.fn();
    api.requestAssessment.mockResolvedValue({ data: { id: 2 } });
    render(
      <MemoryRouter>
        <AuthorisationGateCard
          status={beginner}
          equipmentId={7}
          equipmentName="XRD"
          onChanged={onChanged}
          supervisorId={null}
          onSupervisorChange={onSupervisorChange}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status", { name: "Authorisation required" })).toBeTruthy();
    expect(screen.getByTestId("competency-stage").textContent).toBe("Beginner - supervised use only");
    expect(screen.getByText(/book it with a supervisor/)).toBeTruthy();
    expect(screen.getByLabelText("Supervisor for this booking")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Request training/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Request Expert assessment/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api.requestAssessment).toHaveBeenCalledWith(7, ""));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("says when no supervisor is available", () => {
    render(
      <MemoryRouter>
        <AuthorisationGateCard status={{ ...beginner, supervisors: [] }} equipmentId={7} equipmentName="XRD" onSupervisorChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No supervisor is available/)).toBeTruthy();
  });

  it("the booking page is not blocked for a supervised Beginner, but is for an Expert whose authorisation expired", async () => {
    api.gatedEquipment.mockResolvedValue({ data: { equipment_ids: [7] } });
    api.authorisationStatus.mockResolvedValueOnce({ data: { results: { "7": beginner } } });
    const { result, rerender } = renderHook(({ id }) => useAuthorisationStatus(id), { initialProps: { id: 7 } });
    await waitFor(() => expect(result.current.status?.stage).toBe("BEGINNER"));
    expect(result.current.blocked).toBe(false);

    api.authorisationStatus.mockResolvedValueOnce({
      data: { results: { "7": { ...beginner, supervised_only: false, stage: "EXPIRED", stage_label: "Expired", can_request: true } } },
    });
    result.current.reload();
    rerender({ id: 7 });
    await waitFor(() => expect(result.current.status?.stage).toBe("EXPIRED"));
    expect(result.current.blocked).toBe(true);
  });
});

describe("SupervisionPanel", () => {
  it("lets the supervisor confirm, and asks a reason to decline", async () => {
    api.supervisedSessions.mockResolvedValue({ data: { results: [session] } });
    api.supervisionAction.mockResolvedValue({ data: { ...session, status: "CONFIRMED" } });
    render(<SupervisionPanel scope="supervising" />);
    expect(await screen.findByText("Student One")).toBeTruthy();
    expect(screen.getByText("Awaiting supervisor")).toBeTruthy();
    expect(api.supervisedSessions).toHaveBeenCalledWith("supervising");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.supervisionAction).toHaveBeenCalledWith(5, "confirm", ""));

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByText("Decline supervision")).toBeTruthy();
    expect(screen.getByLabelText(/Reason for the student/)).toBeTruthy();
  });

  it("shows the student's own sessions without actions", async () => {
    api.supervisedSessions.mockResolvedValue({ data: { results: [{ ...session, status: "ATTENDED", status_label: "Supervised session completed", remarks: "Good handling", can_respond: false }] } });
    render(<SupervisionPanel scope="mine" />);
    expect(await screen.findByText("Good handling")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });
});

describe("Minimum supervised sessions, Beginner expiry and downgrade", () => {
  it("shows sessions towards the Expert assessment and when Beginner status ends", () => {
    render(<CompetencyProgress status={{ ...beginner, supervised_sessions_done: 1, supervised_sessions_required: 2, beginner_valid_until: "2027-05-04T00:00:00Z" }} />);
    const text = screen.getByTestId("competency-progress").textContent ?? "";
    expect(text).toContain("Supervised sessions: 1 of 2 completed before the Expert assessment");
    expect(text).toContain("Beginner until");
  });

  it("lets the OIC downgrade an Expert to Beginner with a reason", async () => {
    const expert = {
      id: 40, user: { id: 3, name: "Student One" }, equipment: { equipment_id: 7, name: "XRD", code: "XRD1" },
      level: "EXPERT", level_name: "Expert (independent)", level_rank: 15, status: "ACTIVE", status_label: "Active",
      awarded_at: "2026-10-01T00:00:00Z", valid_until: "2027-10-01T00:00:00Z", source_event_id: null,
      expiring: false, supervisor: null, source: "assessment", awarded_by: null,
    };
    api.authorisedUsers.mockResolvedValue({ data: { results: [expert] } });
    api.authorisationAwardAction.mockResolvedValue({ data: { ...expert, id: 41, level: "BEGINNER" } });
    render(<AuthorisedUsersPanel equipmentId={7} equipmentName="XRD" equipmentCode="XRD1" validityMonths={24} twoLevel onChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Downgrade to Beginner" }));
    expect(await screen.findByText(/can book only with a supervisor/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsafe handling" } });
    fireEvent.click(screen.getByRole("button", { name: "Downgrade" }));
    await waitFor(() => expect(api.authorisationAwardAction).toHaveBeenCalledWith(40, "downgrade", { reason: "Unsafe handling", months: undefined }));
  });

  it("has no downgrade on single-step equipment", async () => {
    api.authorisedUsers.mockResolvedValue({ data: { results: [] } });
    render(<AuthorisedUsersPanel equipmentId={7} equipmentName="XRD" equipmentCode="XRD1" validityMonths={24} onChanged={vi.fn()} />);
    await waitFor(() => expect(api.authorisedUsers).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Downgrade to Beginner" })).toBeNull();
  });
});
