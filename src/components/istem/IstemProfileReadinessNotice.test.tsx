// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ api: { getIstemProfileReadiness: vi.fn() } }));
vi.mock("@/lib/api", () => ({ apiClient: state.api }));

import { IstemProfileReadinessNotice } from "./IstemProfileReadinessNotice";

const MISSING = [
  { field: "istem_link", message: "Link your portal account to your I-STEM account." },
  { field: "billing_state", message: "Billing state is empty." },
];

function readiness(over: Record<string, unknown> = {}) {
  return { data: { complete: false, missing: MISSING, internal: false, blocks_booking: true, gate: "test_accounts",
    applies_to_you: true, profile_url: "/profile", ...over } };
}

function show(props: { equipmentId?: number; onProfile?: boolean }) {
  return render(<MemoryRouter><IstemProfileReadinessNotice {...props} /></MemoryRouter>);
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("I-STEM profile readiness notice", () => {
  it("on the booking page lists what is missing with a link to the profile", async () => {
    state.api.getIstemProfileReadiness.mockResolvedValue(readiness());
    show({ equipmentId: 66 });
    expect(await screen.findByText("Billing state is empty.")).toBeTruthy();
    expect(state.api.getIstemProfileReadiness).toHaveBeenCalledWith(66);
    expect(screen.getByRole("link", { name: "Open my profile" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByText(/No GSTIN\? Leave it empty/)).toBeTruthy();
  });

  it("stays hidden on the booking page when the booking would not be refused", async () => {
    state.api.getIstemProfileReadiness.mockResolvedValue(readiness({ blocks_booking: false }));
    show({ equipmentId: 66 });
    await waitFor(() => expect(state.api.getIstemProfileReadiness).toHaveBeenCalled());
    expect(screen.queryByTestId("istem-profile-readiness")).toBeNull();
  });

  it("on the profile shows only when the rule applies to the user", async () => {
    state.api.getIstemProfileReadiness.mockResolvedValue(readiness({ blocks_booking: false }));
    show({ onProfile: true });
    expect(await screen.findByText("Complete your profile for I-STEM bookings")).toBeTruthy();
    cleanup();
    state.api.getIstemProfileReadiness.mockResolvedValue(readiness({ applies_to_you: false }));
    show({ onProfile: true });
    await waitFor(() => expect(state.api.getIstemProfileReadiness).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("istem-profile-readiness")).toBeNull();
  });
});
