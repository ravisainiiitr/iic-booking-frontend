// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MyAuthorisations as Data } from "@/lib/trainingAuthTypes";

const api = vi.hoisted(() => ({
  myAuthorisations: vi.fn(),
  requestTraining: vi.fn(),
  authorisationRequestAction: vi.fn(),
  certification: vi.fn(),
}));
const avail = vi.hoisted(() => ({ menus: { my_authorisations: true } as Record<string, boolean> }));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("@/lib/trainingApi", () => ({ trainingApi: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ BackButton: () => null }));
vi.mock("@/components/training/useTrainingAvailability", () => ({
  useTrainingAvailability: () => ({ loading: false, bootstrap: null, enabled: true, menu: (k: string) => Boolean(avail.menus[k]) }),
}));
vi.mock("@/components/training/CertificateDialog", () => ({ CertificateDialog: () => null }));

import MyAuthorisations from "./MyAuthorisations";

const xrd = { equipment_id: 7, code: "XRD", name: "X-ray Diffractometer" };
const sem = { equipment_id: 8, code: "SEM", name: "Scanning Electron Microscope" };

const data: Data = {
  equipment: [
    {
      equipment: xrd,
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
      message: "Authorisation required: X-ray Diffractometer can be booked only by users authorised as Trained.",
    },
    {
      equipment: sem,
      equipment_id: 8,
      required: true,
      status: "AUTHORISED",
      status_label: "Authorised",
      allowed: true,
      valid_until: "2027-06-30T10:00:00+05:30",
      award_id: 3,
      certificate_no: "IIC-T-0003",
      level_name: "Trained",
      open_request: null,
      can_request: false,
      message: "",
    },
  ],
  certifications: [],
  requests: [
    {
      id: 9,
      reference: "AR-0009",
      status: "PENDING",
      status_label: "Pending",
      scheduled_start: null,
      scheduled_end: null,
      location: "",
      created_at: "2026-10-12T10:00:00+05:30",
      user: { id: 1, name: "Me" },
      supervisor: null,
      equipment: sem,
      message: "Refresher please",
      staff_note: "",
      decision_reason: "",
      decided_by: null,
      decided_at: null,
      award_id: null,
      history: null,
      can_handle: false,
      can_withdraw: true,
    },
  ],
  supervisor: {
    equipment: [xrd],
    students: [
      {
        student: { id: 30, name: "Neha Student", department: "Physics" },
        equipment: [{ equipment_id: 7, status: "EXPIRED", status_label: "Expired", valid_until: "2026-01-01T00:00:00+05:30", required: true, open_request: null }],
      },
    ],
  },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyAuthorisations />
    </MemoryRouter>,
  );

beforeEach(() => {
  avail.menus = { my_authorisations: true };
  Object.values(api).forEach((fn) => fn.mockReset());
  api.myAuthorisations.mockResolvedValue({ data });
});

afterEach(() => cleanup());

describe("MyAuthorisations", () => {
  it("shows each gated equipment with the user's status", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: "X-ray Diffractometer" })).toBeTruthy();
    expect(screen.getByText("Not authorised")).toBeTruthy();
    expect(screen.getAllByText("Authorised").length).toBeGreaterThan(0);
    expect(screen.getByText(/valid until/)).toBeTruthy();
    expect(screen.getByText("You need training before you can book 1 of these.")).toBeTruthy();
  });

  it("requests training from the list", async () => {
    api.requestTraining.mockResolvedValue({ data: { id: 10 } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Request training/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api.requestTraining).toHaveBeenCalledWith(7, ""));
    await waitFor(() => expect(api.myAuthorisations).toHaveBeenCalledTimes(2));
  });

  it("withdraws an open request", async () => {
    api.authorisationRequestAction.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(api.authorisationRequestAction).toHaveBeenCalledWith(9, "withdraw"));
  });

  it("shows a supervisor their students' status", async () => {
    renderPage();
    expect(await screen.findByText("Your students")).toBeTruthy();
    expect(screen.getByText("Neha Student")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("is not available without the menu", () => {
    avail.menus = {};
    renderPage();
    expect(screen.getByText("Training & Certification is not available")).toBeTruthy();
    expect(api.myAuthorisations).not.toHaveBeenCalled();
  });
});
