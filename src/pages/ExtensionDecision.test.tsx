// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExtensionDecision from "./ExtensionDecision";

const item = {
  id: 21,
  kind: "extension",
  user: { id: 8, name: "Ravi Kumar", email: "ravi@iitr.ac.in", department: "Chemistry" },
  user_type_label: "IITR Students",
  category_label: "IITR Students",
  status: "pending",
  faculty: null,
  previous_end_date: "2026-10-20",
  max_until: "2027-04-20",
  approved_until: null,
  user_reason: "Thesis submission pending",
  requested_channel: "portal",
  created_at: null,
  decided_at: null,
  decided_role: "",
  decided_by: "",
  decision_reason: "",
  disclaimer_text: "",
  max_months: 6,
  disclaimer_template: "I request that their access be extended up to 20 Apr 2027.",
  disclaimer_version: "v1",
  faculty_name: "Prof. Rakesh Sharma",
  degree_name: "Doctor of Philosophy",
  end_date_source_note: "Joining date + 5 years (Ph.D.)",
};

const api = vi.hoisted(() => ({
  getExtensionDecision: vi.fn(),
  submitExtensionDecision: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/extension-decision?${query}`]}>
      <ExtensionDecision />
    </MemoryRouter>,
  );

beforeEach(() => {
  api.getExtensionDecision.mockResolvedValue({ data: { item } });
  api.submitExtensionDecision.mockResolvedValue({ data: { decision: "approved", message: "Extended until 20 Apr 2027." } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Extension decision from the faculty email", () => {
  it("shows the degree and how the end date was set, and needs the confirmation to approve", async () => {
    renderAt("token=abc&action=approve");
    expect(await screen.findByText("Doctor of Philosophy")).toBeTruthy();
    expect(screen.getByText("Joining date + 5 years (Ph.D.)")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Grant extension" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.submitExtensionDecision).toHaveBeenCalledWith(
        expect.objectContaining({ token: "abc", decision: "approve", until: "2027-04-20", disclaimer_accepted: true, disclaimer_version: "v1" }),
      ),
    );
    expect(await screen.findByText("Extension granted")).toBeTruthy();
  });

  it("opens on Decline from the email button and requires a reason", async () => {
    api.submitExtensionDecision.mockResolvedValue({ data: { decision: "declined", message: "Declined." } });
    renderAt("token=abc&action=decline");
    const submit = (await screen.findByRole("button", { name: "Decline request" })) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Reason for declining/), { target: { value: "Left the group" } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.submitExtensionDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: "disapprove", reason: "Left the group" })),
    );
    expect(await screen.findByText("Extension declined")).toBeTruthy();
  });

  it("explains a link that was already used", async () => {
    api.getExtensionDecision.mockResolvedValue({ error: "This request was already decided.", errorCode: "already_decided" });
    renderAt("token=abc");
    expect(await screen.findByText("Already decided")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Grant extension" })).toBeNull();
  });
});
