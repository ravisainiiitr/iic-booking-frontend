// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({ myOrcid: vi.fn() }));
vi.mock("@/lib/impactApi", () => ({ impactApi: api }));

import OrcidPromptBanner from "./OrcidPromptBanner";

const noOrcid = { data: { orcid: "", discovery_enabled: false, last_checked_at: null, last_error: "" } };

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.hash}</div>;
}

function renderBanner(userType: string | null) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<OrcidPromptBanner userType={userType} />} />
        <Route path="/my-publications" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrcidPromptBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    api.myOrcid.mockReset();
  });
  afterEach(() => cleanup());

  it("prompts a researcher with no ORCID iD and links to the Find my papers card", async () => {
    api.myOrcid.mockResolvedValue(noOrcid);
    renderBanner("faculty");
    expect(await screen.findByTestId("orcid-prompt-banner")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add ORCID iD" }));
    expect(screen.getByTestId("where").textContent).toBe("/my-publications#find-my-papers");
  });

  it("stays hidden once an ORCID iD is saved", async () => {
    api.myOrcid.mockResolvedValue({ data: { ...noOrcid.data, orcid: "0000-0002-1825-0097" } });
    renderBanner("student");
    await waitFor(() => expect(api.myOrcid).toHaveBeenCalled());
    expect(screen.queryByTestId("orcid-prompt-banner")).toBeNull();
  });

  it("is not shown to staff roles and does not call the API", () => {
    renderBanner("operator");
    expect(api.myOrcid).not.toHaveBeenCalled();
    expect(screen.queryByTestId("orcid-prompt-banner")).toBeNull();
  });

  it("stays hidden when the lookup fails", async () => {
    api.myOrcid.mockResolvedValue({ error: "Network error occurred" });
    renderBanner("external");
    await waitFor(() => expect(api.myOrcid).toHaveBeenCalled());
    expect(screen.queryByTestId("orcid-prompt-banner")).toBeNull();
  });

  it("Not now hides it for 30 days in this browser", async () => {
    api.myOrcid.mockResolvedValue(noOrcid);
    const first = renderBanner("faculty");
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("orcid-prompt-banner")).toBeNull();
    first.unmount();

    renderBanner("faculty");
    expect(api.myOrcid).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("orcid-prompt-banner")).toBeNull();

    localStorage.setItem("dashboard.orcidPrompt.snoozedAt", String(Date.now() - 31 * 86_400_000));
    cleanup();
    renderBanner("faculty");
    expect(await screen.findByTestId("orcid-prompt-banner")).toBeTruthy();
  });
});
