// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({
  token: "token-A",
  auth: {
    user: null as Record<string, unknown> | null,
    isAuthenticated: true,
    loading: false,
    updateUser: vi.fn(),
  },
  api: {
    getToken: vi.fn(() => state.token),
    updateProfile: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/api", () => ({ apiClient: state.api }));
vi.mock("sonner", () => ({ toast: state.toast }));

import { ProfileCompletionProvider, useProfileCompletion } from "./ProfileCompletionProvider";

function GateProbe() {
  const { blocking } = useProfileCompletion();
  return <div data-testid="gate">{blocking ? "waiting" : "free"}</div>;
}

function ui(path = "/dashboard") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ProfileCompletionProvider>
        <Routes>
          <Route path="*" element={<GateProbe />} />
        </Routes>
      </ProfileCompletionProvider>
    </MemoryRouter>
  );
}

const title = () => screen.queryByRole("heading", { name: "Complete your profile" });

beforeEach(() => {
  localStorage.clear();
  state.token = "token-A";
  state.auth.isAuthenticated = true;
  state.auth.loading = false;
  state.auth.updateUser.mockReset();
  state.api.updateProfile.mockReset();
  state.toast.success.mockReset();
});

afterEach(() => cleanup());

describe("Complete your profile prompt", () => {
  it.each(["student", "external", "startup_incubated_iitr", "operator", "finance", "dept_admin", "admin"])(
    "opens for %s without a mobile number and holds back the other post-login dialogs",
    async (user_type) => {
      state.auth.user = { id: 11, user_type, phone_number: "0000000000", needs_mobile_number: true };
      render(ui());
      expect(screen.getByTestId("gate").textContent).toBe("waiting");
      await waitFor(() => expect(title()).not.toBeNull());
      expect(screen.getByText("Open full profile")).toBeTruthy();
    },
  );

  it.each([
    ["faculty", null],
    ["manager", null],
    ["student", "9876543210"],
  ])("stays hidden for %s with number %j", async (user_type, phone_number) => {
    state.auth.user = { id: 12, user_type, phone_number };
    render(ui());
    expect(screen.getByTestId("gate").textContent).toBe("free");
    await new Promise((r) => setTimeout(r, 700));
    expect(title()).toBeNull();
  });

  it("only opens on the dashboard or the app's Today, never over other pages", async () => {
    state.auth.user = { id: 13, user_type: "student", phone_number: "" };
    render(ui("/profile"));
    await new Promise((r) => setTimeout(r, 700));
    expect(title()).toBeNull();
  });

  it("waits for the fresh profile after a reload", async () => {
    state.auth.loading = true;
    state.auth.user = { id: 14, user_type: "student", phone_number: "" };
    render(ui());
    await new Promise((r) => setTimeout(r, 700));
    expect(title()).toBeNull();
  });

  it("Remind me later hides it until the next sign-in", async () => {
    state.auth.user = { id: 15, user_type: "student", phone_number: null };
    const view = render(ui());
    await waitFor(() => expect(title()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Remind me later" }));
    await waitFor(() => expect(screen.getByTestId("gate").textContent).toBe("free"));
    expect(title()).toBeNull();

    view.unmount();
    render(ui());
    await new Promise((r) => setTimeout(r, 700));
    expect(title()).toBeNull();
    cleanup();

    state.token = "token-B";
    render(ui());
    await waitFor(() => expect(title()).not.toBeNull());
  });

  it("validates the number before saving", async () => {
    state.auth.user = { id: 16, user_type: "external", phone_number: "" };
    render(ui());
    await waitFor(() => expect(title()).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save mobile number" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/10-digit Indian mobile number/);
    expect(state.api.updateProfile).not.toHaveBeenCalled();
  });

  it("saves through the profile API, shows a toast and never shows again", async () => {
    state.auth.user = { id: 17, user_type: "student", phone_number: null, needs_mobile_number: true };
    state.api.updateProfile.mockResolvedValue({
      data: { id: 17, user_type: "student", phone_number: "9876543210", needs_mobile_number: false },
    });
    const view = render(ui());
    await waitFor(() => expect(title()).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "+91 98765 43210" } });
    fireEvent.click(screen.getByRole("button", { name: "Save mobile number" }));

    await waitFor(() => expect(state.api.updateProfile).toHaveBeenCalledWith({ phone_number: "9876543210" }));
    await waitFor(() =>
      expect(state.auth.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ phone_number: "9876543210", needs_mobile_number: false }),
      ),
    );
    expect(state.toast.success).toHaveBeenCalled();

    state.auth.user = { id: 17, user_type: "student", phone_number: "9876543210", needs_mobile_number: false };
    state.token = "token-C";
    view.rerender(ui());
    expect(screen.getByTestId("gate").textContent).toBe("free");
    await new Promise((r) => setTimeout(r, 700));
    expect(title()).toBeNull();
  });

  it("keeps the prompt open and shows the server message when saving fails", async () => {
    state.auth.user = { id: 18, user_type: "operator", phone_number: "" };
    state.api.updateProfile.mockResolvedValue({ error: "Enter a valid 10-digit Indian mobile number." });
    render(ui());
    await waitFor(() => expect(title()).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: "Save mobile number" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/valid 10-digit/);
    expect(title()).not.toBeNull();
    expect(state.auth.updateUser).not.toHaveBeenCalled();
  });
});
