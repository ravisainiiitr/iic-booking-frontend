// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { PublicationMatch } from "@/lib/publicationMatchesApi";

const api = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn(), pendingCount: vi.fn() }));
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, loading: false, user: { user_type: "dept_admin" } as { user_type: string } | null } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/publicationMatchesApi", async (orig) => {
  const actual = await orig<typeof import("@/lib/publicationMatchesApi")>();
  return { ...actual, publicationMatchesApi: api };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => <div /> }));
vi.mock("sonner", () => ({ toast }));

import PublicationMatches from "./PublicationMatches";
import { defaultSelection } from "@/lib/publicationMatchesApi";

function match(over: Partial<PublicationMatch> = {}): PublicationMatch {
  return {
    id: 7,
    review_status: "PENDING",
    paper: { title: "SEM study of thin films", doi: "10.1000/x", year: 2025, journal: "J. Films", authors: "A, B", url: "https://doi.org/10.1000/x" },
    researcher: { id: 3, name: "Prof. Asha Rao", department: "Physics", photo_url: "" },
    evidence: { source_url: "https://repo.example.org/p.pdf", oa_status: "green", licence: "cc-by",
      acknowledgement_snippet: "We thank the Institute Instrumentation Centre for the Gemini 300 FESEM.", detail: "", checked_at: null },
    mappings: [
      { id: 1, level: "DEPARTMENT", status: "SUGGESTED", confidence: 0.95, matched_phrases: ["Institute Instrumentation Centre"], rationale: "names IIC",
        department: { id: 2, name: "Institute Instrumentation Centre", code: "IIC" }, equipment: null },
      { id: 2, level: "EQUIPMENT", status: "SUGGESTED", confidence: 0.8, matched_phrases: ["Gemini 300"], rationale: "model",
        department: { id: 2, name: "Institute Instrumentation Centre", code: "IIC" }, equipment: { id: 5, name: "FESEM GEMINI 300", code: "GEM300" } },
    ],
    equipment_choices: [
      { id: 5, name: "FESEM GEMINI 300", code: "GEM300", department_id: 2, suggested: true, confidence: 0.8 },
      { id: 10, name: "FESEM APREO", code: "APREO", department_id: 2, suggested: true, confidence: 0.56 },
      { id: 38, name: "TEM", code: "TEM", department_id: 2, suggested: false, confidence: null },
    ],
    can_review: true, review_blocked_reason: "", reviewed_by: "", reviewed_at: null, review_note: "", claim_id: null,
    ...over,
  };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/publication-matches"]}>
      <Routes>
        <Route path="/publication-matches" element={<PublicationMatches />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Publication matches", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.success.mockReset();
    toast.error.mockReset();
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "dept_admin" } };
  });
  afterEach(() => cleanup());

  it("pre-ticks only strongly named instruments", () => {
    expect(defaultSelection(match())).toEqual([5]);
  });

  it("shows the researcher, paper, excerpt, source and facilities, and approves with the chosen instruments", async () => {
    api.list.mockResolvedValue({ data: { results: [match()], count: 1, pending_count: 1 } });
    api.approve.mockResolvedValue({ data: match({ review_status: "APPROVED" }) });
    renderPage();
    const card = await screen.findByTestId("match-card");
    expect(within(card).getByText("Prof. Asha Rao")).toBeTruthy();
    expect(within(card).getByText("SEM study of thin films").closest("a")?.getAttribute("href")).toBe("https://doi.org/10.1000/x");
    expect(within(card).getByText(/Gemini 300 FESEM/)).toBeTruthy();
    expect(within(card).getByText("the open-access copy").closest("a")?.getAttribute("href")).toBe("https://repo.example.org/p.pdf");
    expect(within(card).getByText("Institute Instrumentation Centre · 95%")).toBeTruthy();
    expect((within(card).getByLabelText("List on FESEM GEMINI 300") as HTMLButtonElement).getAttribute("data-state")).toBe("checked");
    expect((within(card).getByLabelText("List on FESEM APREO") as HTMLButtonElement).getAttribute("data-state")).toBe("unchecked");

    fireEvent.click(within(card).getByText("Choose another instrument (1)"));
    fireEvent.click(within(card).getByLabelText("List on TEM"));
    fireEvent.change(within(card).getByLabelText("Note"), { target: { value: "Checked the PDF" } });
    fireEvent.click(within(card).getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(7, [5, 38], "Checked the PDF"));
    await waitFor(() => expect(screen.queryByTestId("match-card")).toBeNull());
    expect(toast.success).toHaveBeenCalled();
  });

  it("department-only approval and rejection", async () => {
    api.list.mockResolvedValue({ data: { results: [match({ equipment_choices: [] })], count: 1, pending_count: 1 } });
    api.reject.mockResolvedValue({ data: match({ review_status: "REJECTED" }) });
    renderPage();
    const card = await screen.findByTestId("match-card");
    expect(within(card).getByText(/listed as a department publication/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: /Reject/ }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith(7, ""));
  });

  it("explains when another department's facilities need the Main Administrator", async () => {
    api.list.mockResolvedValue({ data: { results: [match({ can_review: false, review_blocked_reason: "the Main Administrator reviews it." })], count: 1, pending_count: 1 } });
    renderPage();
    const card = await screen.findByTestId("match-card");
    expect(within(card).getByText(/Main Administrator reviews it/)).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /Approve/ })).toBeNull();
  });

  it("server errors are shown and the card stays", async () => {
    api.list.mockResolvedValue({ data: { results: [match()], count: 1, pending_count: 1 } });
    api.approve.mockResolvedValue({ error: "Choose instruments from the departments you administer." });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Choose instruments from the departments you administer."));
    expect(screen.getByTestId("match-card")).toBeTruthy();
  });

  it("tabs load approved and rejected history", async () => {
    api.list.mockResolvedValue({ data: { results: [], count: 0, pending_count: 0 } });
    renderPage();
    await screen.findByText("Nothing is waiting for approval.");
    fireEvent.click(screen.getByRole("tab", { name: "Approved" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: "APPROVED", q: undefined }));
  });

  it("other roles see no queue and never call the API", () => {
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "manager" } };
    renderPage();
    expect(screen.getByRole("alert").textContent).toContain("Main Administrator and Department Administrators");
    expect(api.list).not.toHaveBeenCalled();
  });
});
