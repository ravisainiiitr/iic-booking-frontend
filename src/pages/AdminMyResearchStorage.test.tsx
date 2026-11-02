// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  getMyResearchQuotas: vi.fn(),
  saveMyResearchQuotas: vi.fn(),
  setMyResearchUserQuota: vi.fn(),
  clearMyResearchUserQuota: vi.fn(),
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminMyResearchStorage from "./AdminMyResearchStorage";

const quotas = (extra = {}) => ({ data: { user_quota_gb: 100, workspace_quota_gb: 0, updated_at: null, users: [], ...extra } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminMyResearchStorage", () => {
  it("shows the 100 GB default and saves a new one", async () => {
    api.getMyResearchQuotas.mockResolvedValue(quotas());
    api.saveMyResearchQuotas.mockResolvedValue(quotas({ user_quota_gb: 150 }));
    render(<MemoryRouter><AdminMyResearchStorage /></MemoryRouter>);
    const perUser = (await screen.findByLabelText("Per user (GB)")) as HTMLInputElement;
    expect(perUser.value).toBe("100");
    fireEvent.change(perUser, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save quotas" }));
    await waitFor(() => expect(api.saveMyResearchQuotas).toHaveBeenCalledWith({ user_quota_gb: 150, workspace_quota_gb: 0 }));
  });

  it("sets and clears a user's own quota", async () => {
    const row = { id: 4, email: "pi@iitr.ac.in", name: "Prof. P", quota_gb: 500, note: "Imaging", used_bytes: 3 * 1024 ** 3 };
    api.getMyResearchQuotas.mockResolvedValue(quotas());
    api.setMyResearchUserQuota.mockResolvedValue(quotas({ users: [row] }));
    api.clearMyResearchUserQuota.mockResolvedValue(quotas());
    render(<MemoryRouter><AdminMyResearchStorage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("User email"), { target: { value: "pi@iitr.ac.in" } });
    fireEvent.change(screen.getByLabelText("Quota (GB)"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Set quota for this user" }));
    expect(await screen.findByText(/500 GB · uses 3\.0 GB · Imaging/)).toBeTruthy();
    expect(api.setMyResearchUserQuota).toHaveBeenCalledWith({ email: "pi@iitr.ac.in", quota_gb: 500, note: "" });
    fireEvent.click(screen.getByRole("button", { name: "Back to the default quota for pi@iitr.ac.in" }));
    expect(await screen.findByText("Everyone uses the default quota.")).toBeTruthy();
    expect(api.clearMyResearchUserQuota).toHaveBeenCalledWith(4);
  });
});
