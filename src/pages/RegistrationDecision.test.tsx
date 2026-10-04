// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegistrationDecision from "./RegistrationDecision";

const item = {
  id: 11,
  kind: "registration",
  status: "pending_faculty",
  user: { id: 7, name: "Asha Verma", email: "asha@gmail.com", department: "Chemistry" },
  user_type_label: "IITR Post Doctoral Fellows",
  employee_id: "PDF-1",
  phone: "9876543210",
  programme_start: null,
  programme_validity: "2027-10-04",
  registered_at: null,
  forwarded_at: null,
  decision_deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
  decided_at: null,
  decision_reason: "",
  disclaimer_text: "",
  disclaimer_template: "I confirm that Asha Verma works under my supervision.",
  disclaimer_version: "v1",
  faculty_name: "Prof. Rakesh Sharma",
  department: "Chemistry",
  decision_deadline_display: "",
  window_hours: 24,
};

const api = vi.hoisted(() => ({
  getEmailDecisionRequest: vi.fn(),
  submitEmailDecision: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/registration-decision?${query}`]}>
      <RegistrationDecision />
    </MemoryRouter>,
  );

beforeEach(() => {
  api.getEmailDecisionRequest.mockResolvedValue({ data: { item } });
  api.submitEmailDecision.mockResolvedValue({ data: { decision: "approved", message: "Approved.", account_removed: false } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Registration decision from the faculty email", () => {
  it("needs the confirmation tick before approving and shows the deadline", async () => {
    renderAt("token=abc&action=approve");
    expect(await screen.findByText("I confirm that Asha Verma works under my supervision.")).toBeTruthy();
    expect(screen.getByText(/Please respond by/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Approve registration" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.submitEmailDecision).toHaveBeenCalledWith(
        expect.objectContaining({ token: "abc", decision: "approve", disclaimer_accepted: true, disclaimer_version: "v1" }),
      ),
    );
    expect(await screen.findByText("Registration approved")).toBeTruthy();
  });

  it("opens on Decline from the email button and requires a reason", async () => {
    api.submitEmailDecision.mockResolvedValue({ data: { decision: "declined", message: "Declined.", account_removed: true } });
    renderAt("token=abc&action=decline");
    const submit = (await screen.findByRole("button", { name: "Decline request" })) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Reason for declining/), { target: { value: "Not in my group" } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.submitEmailDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: "decline", reason: "Not in my group" })),
    );
    expect(await screen.findByText("Registration declined")).toBeTruthy();
  });

  it("shows Request timed out for a late click and offers no buttons", async () => {
    api.getEmailDecisionRequest.mockResolvedValue({ error: "Request timed out. The 24-hour window has passed.", errorCode: "timed_out" });
    renderAt("token=abc&action=approve");
    expect(await screen.findByText("Request timed out")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve registration" })).toBeNull();
  });

  it("switches to the timed-out state when the window closes while the page is open", async () => {
    api.submitEmailDecision.mockResolvedValue({ error: "Request timed out.", errorCode: "timed_out" });
    renderAt("token=abc");
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve registration" }));
    expect(await screen.findByText("Request timed out")).toBeTruthy();
  });
});
