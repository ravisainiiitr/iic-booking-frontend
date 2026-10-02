// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceChromeProvider } from "@/components/WorkspaceHeaderActions";
import UrgentRequestsWallet from "./UrgentRequestsWallet";
import MyUrgentRequests from "./MyUrgentRequests";

const auth = vi.hoisted(() => ({
  state: {
    user: { id: 7, email: "ravi@iitr.ac.in", name: "Ravi Saini", user_type: "faculty", department_type: "internal" } as Record<string, unknown>,
    isAuthenticated: true,
    loading: false,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/DepartmentFilter", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  apiClient: new Proxy({}, { get: () => vi.fn(async () => ({ data: null })) }),
}));

const workspaceBack = <button type="button">Workspace Back</button>;

const renderPage = (page: JSX.Element, inWorkspace: boolean) =>
  render(
    <MemoryRouter>
      {inWorkspace ? (
        <WorkspaceChromeProvider value={{ actionsSlot: null, backButton: workspaceBack }}>{page}</WorkspaceChromeProvider>
      ) : (
        page
      )}
    </MemoryRouter>
  );

afterEach(() => cleanup());

describe("Urgent requests – Supervisor approval header", () => {
  it("shows the workspace Back on the title row and no Back to Dashboard link", async () => {
    renderPage(<UrgentRequestsWallet />, true);
    const heading = await screen.findByRole("heading", { level: 1, name: "Urgent requests – Supervisor approval" });
    expect(within(heading.parentElement as HTMLElement).getByRole("button", { name: "Workspace Back" })).toBeTruthy();
    expect(screen.queryByText(/Back to Dashboard/i)).toBeNull();
  });

  it("leaves Back to the site header when opened outside the dashboard", async () => {
    renderPage(<UrgentRequestsWallet />, false);
    await screen.findByRole("heading", { level: 1, name: "Urgent requests – Supervisor approval" });
    expect(screen.queryByRole("button", { name: /back/i })).toBeNull();
  });
});

describe("Student urgent booking request header", () => {
  it("shows the workspace Back beside the page title", async () => {
    auth.state = { ...auth.state, user: { id: 9, email: "aman@iitr.ac.in", name: "Aman", user_type: "student" } };
    renderPage(<MyUrgentRequests />, true);
    const heading = await screen.findByRole("heading", { level: 1, name: "Urgent booking request" });
    const row = heading.parentElement?.parentElement as HTMLElement;
    await waitFor(() => expect(within(row).getByRole("button", { name: "Workspace Back" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /back to dashboard/i })).toBeNull();
  });
});
