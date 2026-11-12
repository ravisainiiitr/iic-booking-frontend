// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthorRecord, ResearcherRecords } from "@/lib/authorConfirmationsApi";

const api = vi.hoisted(() => ({ list: vi.fn(), waitingCount: vi.fn(), mine: vi.fn(), decide: vi.fn(), recentWorks: vi.fn() }));
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, loading: false, user: { user_type: "dept_admin" } as { user_type: string } | null } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/authorConfirmationsApi", async (orig) => {
  const actual = await orig<typeof import("@/lib/authorConfirmationsApi")>();
  return { ...actual, authorConfirmationsApi: api };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => <div /> }));
vi.mock("sonner", () => ({ toast }));

import AuthorConfirmations from "./AuthorConfirmations";
import AuthorConfirmPrompt from "@/components/impact/AuthorConfirmPrompt";
import AuthorConfirmOnLogin from "@/components/impact/AuthorConfirmOnLogin";

function rec(id: number, works: number, over: Partial<AuthorRecord> = {}): AuthorRecord {
  return {
    id, openalex_author_id: `A${id}`, openalex_url: `https://openalex.org/A${id}`, display_name: "Asha Rao", orcid: "",
    works_count: works, institutions: ["Indian Institute of Technology Roorkee"], confidence: 0.9, rationale: "same name",
    status: "NEEDS_CONFIRMATION", decided_at: null, ...over,
  };
}

function row(over: Partial<ResearcherRecords> = {}): ResearcherRecords {
  return {
    researcher: { id: 3, name: "Prof. Asha Rao", department: "Chemistry", department_code: "CY", orcid: "" },
    waiting: [rec(11, 40), rec(12, 2)], linked: [], rejected: [], can_decide: true, ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/author-confirmations"]}>
      <Routes>
        <Route path="/author-confirmations" element={<AuthorConfirmations />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.value = { isAuthenticated: true, loading: false, user: { user_type: "dept_admin" } };
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // ignore
  }
});
afterEach(cleanup);

describe("AuthorConfirmations page", () => {
  it("lists researchers not linked yet with their lookalike records", async () => {
    api.list.mockResolvedValue({ data: { results: [row()], count: 1, waiting_count: 1 } });
    renderPage();
    const card = await screen.findByTestId("researcher-card");
    expect(within(card).getByText("Prof. Asha Rao")).toBeTruthy();
    expect(within(card).getAllByTestId("author-record")).toHaveLength(2);
    expect(api.list).toHaveBeenCalledWith({ q: undefined, unlinked: true });
  });

  it("confirming one record removes the researcher once nothing waits", async () => {
    api.list.mockResolvedValue({ data: { results: [row({ waiting: [rec(11, 40)] })], count: 1, waiting_count: 1 } });
    api.decide.mockResolvedValue({ data: row({ waiting: [], linked: [rec(11, 40, { status: "CONFIRMED" })], scan_started: true }) });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Asha Rao (40 papers)" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(3, { confirm: [11] }));
    await waitFor(() => expect(screen.queryByTestId("researcher-card")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/being looked up/));
  });

  it("None of these rejects every waiting record", async () => {
    api.list.mockResolvedValue({ data: { results: [row()], count: 1, waiting_count: 1 } });
    api.decide.mockResolvedValue({ data: row({ waiting: [], rejected: [rec(11, 40), rec(12, 2)] }) });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "None of these" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(3, { reject: [11, 12] }));
  });

  it("shows a record's recent papers on request", async () => {
    api.list.mockResolvedValue({ data: { results: [row({ waiting: [rec(11, 40)] })], count: 1, waiting_count: 1 } });
    api.recentWorks.mockResolvedValue({ data: { results: [{ title: "Catalysis on oxides", year: 2025, journal: "J. Cat.", doi: "10.1/x" }] } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Show recent papers/ }));
    expect(await screen.findByText("Catalysis on oxides")).toBeTruthy();
    expect(api.recentWorks).toHaveBeenCalledWith(11);
  });

  it("is closed to people who are not reviewers", async () => {
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "faculty" } };
    renderPage();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(api.list).not.toHaveBeenCalled();
  });
});

describe("AuthorConfirmPrompt", () => {
  it("asks a faculty member with lookalikes and lets them confirm their own record", async () => {
    api.mine.mockResolvedValue({ data: row() });
    api.decide.mockResolvedValue({ data: row({ waiting: [rec(12, 2)], linked: [rec(11, 40, { status: "CONFIRMED" })], scan_started: true }) });
    render(<AuthorConfirmPrompt userType="faculty" />);
    expect(await screen.findByTestId("author-confirm-prompt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getAllByRole("button", { name: /^Not Asha Rao/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Asha Rao (40 papers)" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(3, { confirm: [11] }));
    await waitFor(() => expect(screen.getAllByTestId("author-record")).toHaveLength(1));
  });

  it("stays hidden for other roles, when nothing waits, and after Later", async () => {
    render(<AuthorConfirmPrompt userType="student" />);
    expect(api.mine).not.toHaveBeenCalled();
    cleanup();

    api.mine.mockResolvedValue({ data: row({ waiting: [] }) });
    render(<AuthorConfirmPrompt userType="faculty" />);
    await waitFor(() => expect(api.mine).toHaveBeenCalled());
    expect(screen.queryByTestId("author-confirm-prompt")).toBeNull();
    cleanup();

    api.mine.mockResolvedValue({ data: row() });
    render(<AuthorConfirmPrompt userType="faculty" />);
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(screen.queryByTestId("author-confirm-prompt")).toBeNull();
    cleanup();
    api.mine.mockClear();
    render(<AuthorConfirmPrompt userType="faculty" />);
    expect(api.mine).not.toHaveBeenCalled();
  });
});

describe("AuthorConfirmOnLogin", () => {
  const faculty = { isAuthenticated: true, loading: false, user: { id: 3, user_type: "faculty" } as unknown as { user_type: string } };
  const renderAt = (path = "/dashboard") => render(<MemoryRouter initialEntries={[path]}><AuthorConfirmOnLogin /></MemoryRouter>);

  it("asks a faculty member at sign-in to confirm lookalikes and automatic matches, once per session", async () => {
    auth.value = faculty;
    api.mine.mockResolvedValue({ data: row({ waiting: [rec(11, 40)], linked: [rec(13, 25, { status: "AUTO_LINKED" }), rec(14, 9, { status: "CONFIRMED" })] }) });
    api.decide.mockResolvedValue({ data: row({ waiting: [], linked: [rec(11, 40, { status: "CONFIRMED" }), rec(13, 25, { status: "CONFIRMED" })] }) });
    renderAt();
    const dialog = await screen.findByTestId("author-confirm-dialog");
    expect(within(dialog).getByText("Confirm your author records")).toBeTruthy();
    expect(within(dialog).getAllByTestId("author-record")).toHaveLength(2);  // the confirmed one is not asked again
    expect(within(dialog).getByText("Matched to you automatically: please confirm")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Asha Rao (25 papers)" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(3, { confirm: [13] }));
    await waitFor(() => expect(screen.queryByTestId("author-confirm-dialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("Thank you: your author records are confirmed");
    cleanup();
    api.mine.mockClear();
    renderAt();
    expect(api.mine).not.toHaveBeenCalled();  // already asked in this sign-in session
  });

  it("is not shown to other roles, on the sign-in page, or when nothing is left to confirm", async () => {
    auth.value = { isAuthenticated: true, loading: false, user: { id: 4, user_type: "student" } as unknown as { user_type: string } };
    renderAt();
    expect(api.mine).not.toHaveBeenCalled();
    cleanup();
    auth.value = faculty;
    renderAt("/auth");
    expect(api.mine).not.toHaveBeenCalled();
    cleanup();
    api.mine.mockResolvedValue({ data: row({ waiting: [], linked: [rec(14, 9, { status: "CONFIRMED" })] }) });
    renderAt();
    await waitFor(() => expect(api.mine).toHaveBeenCalled());
    expect(screen.queryByTestId("author-confirm-dialog")).toBeNull();
  });
});
