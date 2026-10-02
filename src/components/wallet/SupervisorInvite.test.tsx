// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SupervisorInvite } from "@/lib/api";
import SupervisorInviteSection, {
  DEFAULT_INVITE_LIMITS,
  SupervisorInviteForm,
  SupervisorInviteList,
  validateInviteEmail,
} from "./SupervisorInvite";

const api = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  getSupervisorInvites: vi.fn(),
  createSupervisorInvite: vi.fn(),
  resendSupervisorInvite: vi.fn(),
  cancelSupervisorInvite: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast }));

const invite = (over: Partial<SupervisorInvite> = {}): SupervisorInvite => ({
  id: 1,
  email: "prof.a@iitr.ac.in",
  supervisor_name: "Prof. A",
  department_id: null,
  department_name: "Chemistry",
  message: "",
  status: "pending",
  status_display: "Pending",
  join_request_id: null,
  created_at: "2026-10-01T10:00:00Z",
  expires_at: "2026-10-31T10:00:00Z",
  last_sent_at: "2026-10-01T10:00:00Z",
  accepted_at: null,
  can_resend: false,
  can_resend_at: "2026-10-02T10:00:00Z",
  can_cancel: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getDepartments.mockResolvedValue({
    data: { departments: [{ id: 7, name: "Chemistry", department_type: "INTERNAL" }] },
  });
  api.getSupervisorInvites.mockResolvedValue({ data: { invites: [], limits: DEFAULT_INVITE_LIMITS } });
});

afterEach(() => cleanup());

const renderForm = (props: Partial<Parameters<typeof SupervisorInviteForm>[0]> = {}) => {
  const onSent = vi.fn();
  const onFacultyOnPortal = vi.fn();
  render(
    <SupervisorInviteForm
      selfEmail="student@iitr.ac.in"
      limits={DEFAULT_INVITE_LIMITS}
      onSent={onSent}
      onCancel={vi.fn()}
      onFacultyOnPortal={onFacultyOnPortal}
      {...props}
    />
  );
  return { onSent, onFacultyOnPortal };
};

const typeEmail = (value: string) =>
  fireEvent.change(screen.getByLabelText("Supervisor's IIT Roorkee email"), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

describe("validateInviteEmail", () => {
  const opts = { allowedDomains: ["iitr.ac.in"], selfEmail: "me@iitr.ac.in" };

  it("accepts institute and departmental addresses", () => {
    expect(validateInviteEmail("Prof@IITR.ac.in", opts)).toBeNull();
    expect(validateInviteEmail("prof@ch.iitr.ac.in", opts)).toBeNull();
  });

  it("rejects other domains, bad addresses and self-invites", () => {
    expect(validateInviteEmail("", opts)).toMatch(/enter your supervisor's email/i);
    expect(validateInviteEmail("not-an-email", opts)).toMatch(/valid email/i);
    expect(validateInviteEmail("prof@gmail.com", opts)).toMatch(/@iitr\.ac\.in/);
    expect(validateInviteEmail("prof@fakeiitr.ac.in", opts)).toMatch(/@iitr\.ac\.in/);
    expect(validateInviteEmail(" ME@iitr.ac.in ", opts)).toMatch(/cannot invite yourself/i);
  });

  it("uses extra domains from settings", () => {
    expect(validateInviteEmail("prof@other.ac.in", { allowedDomains: ["iitr.ac.in", "other.ac.in"] })).toBeNull();
  });
});

describe("SupervisorInviteForm", () => {
  it("shows a validation message without calling the server", async () => {
    renderForm();
    typeEmail("prof@gmail.com");
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/institute email address/i);
    expect(api.createSupervisorInvite).not.toHaveBeenCalled();
  });

  it("refuses the student's own email", async () => {
    renderForm();
    typeEmail("student@iitr.ac.in");
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/cannot invite yourself/i);
  });

  it("sends the invitation with the optional fields", async () => {
    const sent = invite();
    api.createSupervisorInvite.mockResolvedValue({ data: { invite: sent, message: "Invitation sent." } });
    const { onSent } = renderForm();
    typeEmail(" prof.a@iitr.ac.in ");
    fireEvent.change(screen.getByLabelText("Supervisor's name (optional)"), { target: { value: "Prof. A" } });
    await screen.findByRole("option", { name: "Chemistry" });
    fireEvent.change(screen.getByLabelText("Department (optional)"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Message (optional)"), { target: { value: "PhD student" } });
    submit();
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sent));
    expect(api.createSupervisorInvite).toHaveBeenCalledWith({
      email: "prof.a@iitr.ac.in",
      supervisor_name: "Prof. A",
      department_id: 7,
      message: "PhD student",
    });
    expect(toast.success).toHaveBeenCalledWith("Invitation sent.");
  });

  it("shows server refusals in plain words", async () => {
    api.createSupervisorInvite.mockResolvedValue({
      error: "This email belongs to a student account on the portal.",
      errorCode: "not_faculty",
    });
    const { onSent, onFacultyOnPortal } = renderForm();
    typeEmail("someone@iitr.ac.in");
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch("This email belongs to a student account on the portal.");
    expect(onSent).not.toHaveBeenCalled();
    expect(onFacultyOnPortal).not.toHaveBeenCalled();
  });

  it("points the student back to the search when the faculty is already on the portal", async () => {
    api.createSupervisorInvite.mockResolvedValue({
      error: "Prof. A is already on the portal. Search for them above.",
      errorCode: "faculty_on_portal",
    });
    const { onFacultyOnPortal } = renderForm();
    typeEmail("prof.a@iitr.ac.in");
    submit();
    await waitFor(() => expect(onFacultyOnPortal).toHaveBeenCalledWith("prof.a@iitr.ac.in"));
    expect(screen.getByRole("alert").textContent).toMatch(/already on the portal/i);
  });
});

describe("SupervisorInviteList", () => {
  it("disables Resend inside the 24 hour window and explains why", () => {
    render(<SupervisorInviteList invites={[invite()]} onChanged={vi.fn()} />);
    const row = screen.getByTestId("supervisor-invite-1");
    expect(within(row).getByText("Waiting for your supervisor to sign in")).toBeTruthy();
    expect((within(row).getByRole("button", { name: /resend/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(row).getByText(/resend once every 24 hours/i)).toBeTruthy();
  });

  it("resends when allowed", async () => {
    const onChanged = vi.fn();
    const updated = invite({ last_sent_at: "2026-10-02T11:00:00Z" });
    api.resendSupervisorInvite.mockResolvedValue({ data: { invite: updated, message: "Invitation sent again." } });
    render(<SupervisorInviteList invites={[invite({ can_resend: true, can_resend_at: null })]} onChanged={onChanged} />);
    const resend = screen.getByRole("button", { name: /resend/i });
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(resend);
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(api.resendSupervisorInvite).toHaveBeenCalledWith(1);
  });

  it("asks before cancelling", async () => {
    const onChanged = vi.fn();
    const cancelled = invite({ status: "cancelled", can_cancel: false });
    api.cancelSupervisorInvite.mockResolvedValue({ data: { invite: cancelled, message: "Invitation cancelled." } });
    render(<SupervisorInviteList invites={[invite()]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel invitation/i }));
    expect(screen.getByText("Cancel this invitation?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(api.cancelSupervisorInvite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /cancel invitation/i }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(cancelled));
    expect(api.cancelSupervisorInvite).toHaveBeenCalledWith(1);
  });

  it("shows finished invitations without actions", () => {
    render(
      <SupervisorInviteList
        invites={[invite({ id: 2, status: "accepted" }), invite({ id: 3, status: "expired" })]}
        onChanged={vi.fn()}
      />
    );
    expect(screen.getByText("Supervisor signed in")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resend/i })).toBeNull();
  });
});

describe("SupervisorInviteSection", () => {
  it("loads pending invitations and opens the form with the searched email", async () => {
    api.getSupervisorInvites.mockResolvedValue({ data: { invites: [invite()], limits: DEFAULT_INVITE_LIMITS } });
    render(<SupervisorInviteSection supervisorNotFound searchQuery="prof.b@iitr.ac.in" selfEmail="me@iitr.ac.in" />);
    expect(await screen.findByText("Invitations you sent")).toBeTruthy();
    expect(screen.getByText("Can't find your supervisor?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /invite your supervisor/i }));
    expect((screen.getByLabelText("Supervisor's IIT Roorkee email") as HTMLInputElement).value).toBe("prof.b@iitr.ac.in");
  });
});
