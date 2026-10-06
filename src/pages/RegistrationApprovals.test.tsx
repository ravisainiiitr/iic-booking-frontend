// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegistrationApprovals from "./RegistrationApprovals";

const person = { id: 7, name: "Asha Rao", email: "asha@gmail.com", department: "Chemistry" };

const api = vi.hoisted(() => ({
  decideFacultyRegistration: vi.fn(async () => ({ data: { message: "Approved." } })),
  decideFacultyExtension: vi.fn(async () => ({ data: { message: "Extended." } })),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, email: "prof@iitr.ac.in", user_type: "faculty" }, isAuthenticated: true, loading: false }),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => {
  const handlers: Record<string, unknown> = {
    getFacultyRegistrationApprovals: async () => ({
      data: {
        registrations: [
          {
            id: 11,
            kind: "registration",
            status: "pending_faculty",
            user: person,
            user_type_label: "IITR Post Doctoral Fellows",
            employee_id: "PDF-1",
            phone: "",
            programme_start: "2026-01-01",
            programme_validity: "2027-01-01",
            registered_at: null,
            forwarded_at: null,
            decision_deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
            decided_at: null,
            decision_reason: "",
            disclaimer_text: "",
            disclaimer_template: "I confirm that Asha Rao works under my supervision.",
            disclaimer_version: "v1",
          },
        ],
        extensions: [
          {
            id: 21,
            kind: "extension",
            user: { ...person, id: 8, name: "Ravi Kumar" },
            user_type_label: "IITR Research Associates in Projects",
            status: "pending",
            faculty: null,
            previous_end_date: "2026-10-10",
            max_until: "2027-04-10",
            approved_until: null,
            user_reason: "",
            requested_channel: "email_link",
            created_at: null,
            decided_at: null,
            decided_role: "",
            decided_by: "",
            decision_reason: "",
            disclaimer_text: "",
            max_months: 6,
            disclaimer_template: "I request that their access be extended up to 10 Apr 2027.",
            disclaimer_version: "v1",
          },
        ],
        recent_registrations: [],
        recent_extensions: [],
        extension_max_months: 6,
      },
    }),
    ...api,
  };
  return { apiClient: new Proxy(handlers, { get: (target, key: string) => target[key] ?? (async () => ({ data: null })) }) };
});

afterEach(() => cleanup());

const submitButtons = () => screen.getAllByRole("button", { name: "Submit decision" }) as HTMLButtonElement[];

describe("Registration approvals (faculty)", () => {
  it("requires the disclaimer before approving and sends it with the decision", async () => {
    render(
      <MemoryRouter>
        <RegistrationApprovals />
      </MemoryRouter>,
    );
    expect(await screen.findByText("I confirm that Asha Rao works under my supervision.")).toBeTruthy();
    const [registrationSubmit] = submitButtons();
    expect(registrationSubmit.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(registrationSubmit.disabled).toBe(false);
    fireEvent.click(registrationSubmit);
    expect(api.decideFacultyRegistration).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ decision: "approve", disclaimer_accepted: true, disclaimer_version: "v1" }),
    );
  });

  it("caps an extension at six months and shows the chosen date in the disclaimer", async () => {
    render(
      <MemoryRouter>
        <RegistrationApprovals />
      </MemoryRouter>,
    );
    const date = (await screen.findByLabelText("Extend access until")) as HTMLInputElement;
    expect(date.value).toBe("10-04-2027");

    fireEvent.change(date, { target: { value: "31-01-2027" } });
    expect(screen.getByText("I request that their access be extended up to 31 Jan 2027.")).toBeTruthy();

    fireEvent.change(date, { target: { value: "01-05-2027" } });
    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Choose 10 Apr 2027 or earlier.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(submitButtons()[1].disabled).toBe(true);
  });

  it("needs a reason to decline and shows the response deadline", async () => {
    render(
      <MemoryRouter>
        <RegistrationApprovals />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Please respond by/)).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Decline" }))[0]);
    const [registrationSubmit] = submitButtons();
    expect(registrationSubmit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason (emailed to the user)"), { target: { value: "Not in my group" } });
    expect(registrationSubmit.disabled).toBe(false);
  });
});
