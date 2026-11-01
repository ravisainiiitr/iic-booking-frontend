// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOnboarding: vi.fn(),
  saveOnboardingStep: vi.fn(),
  getIndianStates: vi.fn(),
  getDepartments: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));
const refreshUser = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 5 }, refreshUser }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import ProfileOnboarding from "./ProfileOnboarding";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

const status = (steps: string[], hints = {}) => ({
  data: { required: steps.length > 0, steps, hints, values: { gender: "", mobile: "", program_start_date: "", program_end_date: "" } },
});

describe("ProfileOnboarding", () => {
  it("asks each missing item in turn and finishes with the password", async () => {
    api.getOnboarding.mockResolvedValue(status(["programme", "password"]));
    api.saveOnboardingStep.mockResolvedValueOnce(status(["password"])).mockResolvedValueOnce(status([]));
    render(<ProfileOnboarding />);
    expect(await screen.findByText("Complete your profile · step 1 of 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: "2027-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Set a password")).toBeTruthy();
    expect(api.saveOnboardingStep).toHaveBeenCalledWith("programme", { program_start_date: "", program_end_date: "2027-06-30" });
    expect(screen.getByText("Complete your profile · step 2 of 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng-pass!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Str0ng-pass!" } });
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(screen.queryByTestId("profile-onboarding")).toBeNull());
    expect(refreshUser).toHaveBeenCalled();
  });

  it("pre-selects the organisation I-STEM named in its State/UT", async () => {
    api.getOnboarding.mockResolvedValue(status(["organisation"], { state: "uttarakhand", organisation: "Asha Institute", subcategory: "educational_institute" }));
    api.getIndianStates.mockResolvedValue({ data: { states: [{ value: "uttarakhand", label: "Uttarakhand" }] } });
    api.getDepartments.mockResolvedValue({ data: { departments: [{ id: 3, name: "Other College" }, { id: 9, name: "ASHA Institute" }] } });
    api.saveOnboardingStep.mockResolvedValue(status([]));
    render(<ProfileOnboarding />);
    expect(await screen.findByText(/On I-STEM:/)).toBeTruthy();
    await waitFor(() => expect(api.getDepartments).toHaveBeenCalledWith("external", false, "educational_institute", "uttarakhand"));
    await waitFor(() => expect(screen.getByRole("option", { name: "ASHA Institute" }).getAttribute("aria-selected")).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(api.saveOnboardingStep).toHaveBeenCalledWith("organisation", { department: "9" }));
  });

  it("shows a server refusal and can be put off for this session", async () => {
    api.getOnboarding.mockResolvedValue(status(["mobile"]));
    api.saveOnboardingStep.mockResolvedValue({ error: "Enter a 10-digit mobile number." });
    render(<ProfileOnboarding />);
    fireEvent.click(await screen.findByRole("button", { name: "Finish" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await waitFor(() => expect(screen.queryByTestId("profile-onboarding")).toBeNull());
    expect(sessionStorage.getItem("profile_onboarding_later")).toBe("5");
  });

  it("shows nothing when the profile is complete", async () => {
    api.getOnboarding.mockResolvedValue(status([]));
    const { container } = render(<ProfileOnboarding />);
    await waitFor(() => expect(api.getOnboarding).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
