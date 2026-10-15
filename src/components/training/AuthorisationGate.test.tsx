// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthorisationStatus } from "@/lib/trainingAuthTypes";

const api = vi.hoisted(() => ({
  gatedEquipment: vi.fn(),
  authorisationStatus: vi.fn(),
  requestTraining: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/lib/trainingApi", () => ({ trainingApi: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AuthorisationGateCard, TrainingRequiredBadge } from "./AuthorisationGateCard";
import { resetGatedEquipment, useAuthorisationStatus } from "./useAuthorisation";

const base: AuthorisationStatus = {
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
  can_request: true,
  message: "Authorisation required: XRD can be booked only by users authorised as Trained. Request training first.",
};

const renderCard = (status: Partial<AuthorisationStatus> = {}, extra: { subjectName?: string; onChanged?: () => void } = {}) =>
  render(
    <MemoryRouter>
      <AuthorisationGateCard status={{ ...base, ...status }} equipmentId={7} equipmentName="XRD" {...extra} />
    </MemoryRouter>,
  );

beforeEach(() => {
  resetGatedEquipment();
  api.gatedEquipment.mockReset();
  api.authorisationStatus.mockReset();
  api.requestTraining.mockReset();
});

afterEach(() => cleanup());

describe("AuthorisationGateCard", () => {
  it("blocks with the reason and offers Request training", async () => {
    const onChanged = vi.fn();
    api.requestTraining.mockResolvedValue({ data: { id: 1 } });
    renderCard({}, { onChanged });
    expect(screen.getByRole("alert", { name: "Authorisation required" })).toBeTruthy();
    expect(screen.getByText("Not authorised")).toBeTruthy();
    expect(screen.getByText(/can be booked only by users authorised as Trained/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Request training/ }));
    fireEvent.change(screen.getByLabelText(/Message to the OIC/), { target: { value: "Used XRD in my MSc" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api.requestTraining).toHaveBeenCalledWith(7, "Used XRD in my MSc"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows Authorised until the expiry date without a request button", () => {
    renderCard({ status: "AUTHORISED", status_label: "Authorised", allowed: true, can_request: false, valid_until: "2027-03-31T10:00:00+05:30", message: "" });
    expect(screen.getByRole("status", { name: "Authorisation required" })).toBeTruthy();
    expect(screen.getByText(/You are authorised \(Trained\) until/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Request training/ })).toBeNull();
  });

  it("offers refresher training when expired and shows an open request", () => {
    renderCard({
      status: "EXPIRED",
      status_label: "Expired",
      can_request: false,
      message: "Your authorisation for XRD expired.",
      open_request: {
        id: 3,
        reference: "AR-0003",
        status: "SCHEDULED",
        status_label: "Scheduled",
        scheduled_start: "2026-10-20T10:00:00+05:30",
        scheduled_end: "2026-10-20T11:00:00+05:30",
        location: "Lab 2",
        created_at: "2026-10-10T10:00:00+05:30",
      },
    });
    expect(screen.getByText(/AR-0003/)).toBeTruthy();
    expect(screen.getByText(/at Lab 2/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Request/ })).toBeNull();
  });

  it("asks for a reason when the authorisation was revoked", () => {
    renderCard({ status: "REVOKED", status_label: "Revoked", message: "Your authorisation for XRD was revoked." });
    fireEvent.click(screen.getByRole("button", { name: /Request training/ }));
    expect(screen.getByLabelText(/Why are you asking again/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send request" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tells staff booking on behalf that the gate is bypassed and recorded", () => {
    renderCard({ staff_bypass: true }, { subjectName: "student@iitr.ac.in" });
    expect(screen.getByText(/student@iitr.ac.in is not authorised/)).toBeTruthy();
    expect(screen.getByText(/recorded in the training audit log/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Request training/ })).toBeNull();
  });

  it("renders the Training required badge", () => {
    render(<TrainingRequiredBadge />);
    expect(screen.getByText("Training required")).toBeTruthy();
  });
});

describe("useAuthorisationStatus", () => {
  it("does not ask for a status when the equipment is not gated", async () => {
    api.gatedEquipment.mockResolvedValue({ data: { equipment_ids: [99] } });
    const { result } = renderHook(() => useAuthorisationStatus(7));
    await waitFor(() => expect(api.gatedEquipment).toHaveBeenCalled());
    expect(api.authorisationStatus).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
    expect(result.current.blocked).toBe(false);
  });

  it("loads the status and reports blocked for gated equipment", async () => {
    api.gatedEquipment.mockResolvedValue({ data: { equipment_ids: [7] } });
    api.authorisationStatus.mockResolvedValue({ data: { results: { "7": base } } });
    const { result } = renderHook(() => useAuthorisationStatus(7));
    await waitFor(() => expect(result.current.status?.status).toBe("NOT_AUTHORISED"));
    expect(api.authorisationStatus).toHaveBeenCalledWith([7], undefined);
    expect(result.current.blocked).toBe(true);
  });

  it("is not blocked for staff booking on behalf (bypass)", async () => {
    api.gatedEquipment.mockResolvedValue({ data: { equipment_ids: [7] } });
    api.authorisationStatus.mockResolvedValue({ data: { results: { "7": { ...base, staff_bypass: true } } } });
    const { result } = renderHook(() => useAuthorisationStatus(7, { userId: 55 }));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(api.authorisationStatus).toHaveBeenCalledWith([7], 55);
    expect(result.current.blocked).toBe(false);
  });
});
