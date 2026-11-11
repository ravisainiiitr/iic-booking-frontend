// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  home: vi.fn(),
  communities: vi.fn(),
  community: vi.fn(),
  threads: vi.fn(),
  thread: vi.fn(),
  posts: vi.fn(),
  draft: vi.fn(),
  saveDraft: vi.fn(),
  deleteDraft: vi.fn(),
  createThread: vi.fn(),
  reply: vi.fn(),
  followCommunity: vi.fn(),
  follow: vi.fn(),
  bookmark: vi.fn(),
  react: vi.fn(),
  search: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock("@/lib/connectApi", async (orig) => {
  const actual = await orig<typeof import("@/lib/connectApi")>();
  return { ...actual, connectApi: api, attachmentObjectUrl: vi.fn(async () => null) };
});
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/PageShell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
// The TipTap editor is exercised in the browser; pages get a plain textarea stand-in.
vi.mock("@/components/connect/ConnectEditor", () => ({
  ConnectEditor: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel ?? "Message"} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { resetConnectBootstrapCache } from "@/components/connect/useConnect";
import { cleanPostHtml } from "@/components/connect/PostBody";
import { ThreadCard } from "@/components/connect/connectUi";
import { query, type ThreadCard as ThreadCardData } from "@/lib/connectApi";
import ConnectHome from "./ConnectHome";
import ConnectSearch from "./ConnectSearch";
import { SimilarDiscussions } from "@/components/connect/SimilarDiscussions";
import ConnectNewThread from "./ConnectNewThread";
import ConnectThread from "./ConnectThread";

const ON = { enabled: true, is_portal_admin: false, is_community_admin: false, is_internal: true, can_use_general: true, community_count: 2, moderates_any: false, name: "IITR Connect", tagline: "" };

const card = (over: Partial<ThreadCardData> = {}): ThreadCardData => ({
  id: 7,
  title: "Baseline drift on the XRD detector",
  type: "question",
  status: "open",
  visibility: "visible",
  community: { id: 2, slug: "xrd-3", name: "XRD Group", kind: "group" },
  category: null,
  equipment: { id: 38, name: "Rigaku SmartLab", code: "XRD1" },
  author: { id: 9, name: "Asha Verma", badge: "Lab Operator (Lab In-charge)" },
  tags: [{ slug: "calibration", name: "calibration" }],
  excerpt: "Seeing drift after warm-up",
  created_at: new Date().toISOString(),
  last_activity_at: new Date().toISOString(),
  reply_count: 3,
  view_count: 40,
  helpful_count: 2,
  is_pinned: false,
  is_solvable: true,
  is_solved: true,
  solved_at: new Date().toISOString(),
  is_known_problem: false,
  has_workaround: false,
  is_outdated: false,
  marked_resolved_at: null,
  bookmarked: false,
  following: false,
  unread: false,
  ...over,
});

const communities = [
  { id: 1, slug: "general", name: "General IITR Discussions", kind: "general", status: "active", description: "", equipment_group_id: null, is_test_only: false, member_count: null, thread_count: 4, can_post: true, can_moderate: false, my_badge: "", my_status: "active" },
  { id: 2, slug: "xrd-3", name: "XRD Group", kind: "group", status: "active", description: "", equipment_group_id: 3, is_test_only: false, member_count: 12, thread_count: 5, can_post: true, can_moderate: false, my_badge: "", my_status: "active" },
];

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

beforeEach(() => {
  resetConnectBootstrapCache();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.bootstrap.mockResolvedValue({ data: ON });
  api.communities.mockResolvedValue({ data: { results: communities } });
  api.draft.mockResolvedValue({ status: 404 });
  api.saveDraft.mockResolvedValue({ data: { context_key: "new", updated_at: new Date().toISOString() } });
  api.threads.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
  api.community.mockResolvedValue({ data: { ...communities[1], categories: [], equipment: [], staff: [] } });
  api.suggest.mockResolvedValue({ data: { results: [] } });
  api.search.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [], facets: {} } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("helpers", () => {
  it("builds query strings without empty values", () => {
    expect(query({ q: "drift", page: 2, mine: true, tag: "", bookmarked: false, x: undefined })).toBe("?q=drift&page=2&mine=1");
  });

  it("sanitises post HTML a second time on the client", () => {
    const html = cleanPostHtml(
      '<p onclick="x()">ok</p><script>alert(1)</script><img src="https://evil/x.png"><img data-attachment-id="0f8fad5b-d9cb-469f-a165-70867728950e" src="https://evil/y.png"><a href="javascript:alert(1)">bad</a><a href="https://iitr.ac.in">good</a><span data-mention-id="4">@A</span>',
    );
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("evil");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('data-attachment-id="0f8fad5b-d9cb-469f-a165-70867728950e"');
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(html).toContain('data-mention-id="4"');
  });
});

describe("ThreadCard", () => {
  it("shows the title, verified role badge, community, equipment, tags and counts", () => {
    render(
      <MemoryRouter>
        <ThreadCard thread={card()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Baseline drift on the XRD detector" })).toHaveProperty("href", expect.stringContaining("/connect/t/7"));
    expect(screen.getByText("Lab Operator (Lab In-charge)")).toBeTruthy();
    expect(screen.getByText("XRD Group")).toBeTruthy();
    expect(screen.getByText("Rigaku SmartLab")).toBeTruthy();
    expect(screen.getByText("#calibration")).toBeTruthy();
    expect(screen.getByText("Solved")).toBeTruthy();
    expect(screen.getByText("replies")).toBeTruthy();
  });
});

describe("ConnectHome", () => {
  it("says Connect is unavailable when the server reports it off", async () => {
    api.bootstrap.mockResolvedValue({ data: { ...ON, enabled: false } });
    render(
      <MemoryRouter>
        <ConnectHome />
      </MemoryRouter>,
    );
    expect(await screen.findByText("IITR Connect is not available")).toBeTruthy();
    expect(api.home).not.toHaveBeenCalled();
  });

  it("renders the landing sections and sends searches to the search page", async () => {
    api.home.mockResolvedValue({
      data: { latest: [card()], trending: [], recently_solved: [card({ id: 8, title: "Solved: peak shift" })], technical_support: [], announcements: [], active_contributors: [{ id: 9, name: "Asha Verma", accepted_answers: 2, helpful_received: 5, replies: 6 }] },
    });
    render(
      <MemoryRouter initialEntries={["/connect"]}>
        <Routes>
          <Route path="/connect" element={<ConnectHome />} />
          <Route path="/connect/search" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "IITR Connect" })).toBeTruthy();
    expect(screen.getByText("Connect. Discuss. Share Knowledge. Solve Together.")).toBeTruthy();
    expect(await screen.findByText("Solved: peak shift")).toBeTruthy();
    expect(screen.getAllByText("XRD Group").length).toBeGreaterThan(0);
    expect(screen.getByText(/5 helpful/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Search discussions, technical issues and solutions..."), { target: { value: "detector drift" } });
    fireEvent.submit(screen.getByRole("search"));
    expect((await screen.findByTestId("where")).textContent).toBe("/connect/search?q=detector%20drift");
  });
});

describe("ConnectNewThread", () => {
  it("pre-selects the community and equipment from the equipment page link and posts them", async () => {
    api.community.mockResolvedValue({
      data: { ...communities[1], categories: [], equipment: [{ equipment_id: 38, name: "Rigaku SmartLab", code: "XRD1" }], staff: [] },
    });
    api.createThread.mockResolvedValue({ data: { id: 55 } });
    render(
      <MemoryRouter initialEntries={["/connect/new?community=xrd-3&equipment=38"]}>
        <Routes>
          <Route path="/connect/new" element={<ConnectNewThread />} />
          <Route path="/connect/t/:id" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    const title = await screen.findByLabelText("Title");
    await waitFor(() => expect(api.community).toHaveBeenCalledWith("xrd-3"));
    fireEvent.change(title, { target: { value: "Detector drift after warm-up" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "<p>Details</p>" } });
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "Calibration" } });
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Post discussion" }));
    await waitFor(() => expect(api.createThread).toHaveBeenCalled());
    expect(api.createThread.mock.calls[0][0]).toMatchObject({
      community: "xrd-3",
      equipment_id: 38,
      title: "Detector drift after warm-up",
      body: "<p>Details</p>",
      tags: ["calibration"],
      type: "question",
      follow: true,
    });
    expect((await screen.findByTestId("where")).textContent).toBe("/connect/t/55");
  });

  it("validates before sending", async () => {
    render(
      <MemoryRouter initialEntries={["/connect/new?community=xrd-3"]}>
        <ConnectNewThread />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Post discussion" }));
    expect(await screen.findByText(/The title needs at least 8 characters/)).toBeTruthy();
    expect(api.createThread).not.toHaveBeenCalled();
  });

  it("autosaves the draft after a pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <MemoryRouter initialEntries={["/connect/new"]}>
        <ConnectNewThread />
      </MemoryRouter>,
    );
    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "Half written question" } });
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    expect(api.saveDraft.mock.calls.at(-1)?.[1]).toMatchObject({ title: "Half written question" });
  });
});

describe("ConnectThread", () => {
  it("shows a neutral message when the thread is not accessible", async () => {
    api.thread.mockResolvedValue({ error: "This page is not available to you.", status: 404 });
    api.posts.mockResolvedValue({ error: "x", status: 404 });
    render(
      <MemoryRouter initialEntries={["/connect/t/99"]}>
        <Routes>
          <Route path="/connect/t/:id" element={<ConnectThread />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("This discussion is not available to you")).toBeTruthy();
  });

  it("renders the thread and posts a reply", async () => {
    const opening = {
      id: 70, is_opening: true, parent_id: null, author: { id: 9, name: "Asha Verma", badge: "" }, is_verified_response: false,
      body_html: "<p>Seeing drift</p>", visibility: "visible", created_at: new Date().toISOString(), edited_at: null, edit_count: 0,
      helpful_count: 0, reactions: {}, my_reactions: [], attachments: [], is_accepted: false, can_edit: false, can_delete: false,
    };
    api.thread.mockResolvedValue({
      data: { ...card({ is_solved: false }), opening_post: opening, poll: null, accepted_post_id: null, permissions: { can_reply: true, can_moderate: false, can_edit: false, can_delete: false } },
    });
    api.posts.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    api.reply.mockResolvedValue({
      data: { ...opening, id: 71, is_opening: false, author: { id: 1, name: "Me", badge: "" }, body_html: "<p>Try a longer warm-up</p>" },
    });
    api.deleteDraft.mockResolvedValue({ status: 204 });
    render(
      <MemoryRouter initialEntries={["/connect/t/7"]}>
        <Routes>
          <Route path="/connect/t/:id" element={<ConnectThread />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Baseline drift on the XRD detector" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: "<p>Try a longer warm-up</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }));
    await waitFor(() => expect(api.reply).toHaveBeenCalledWith(7, "<p>Try a longer warm-up</p>", null, []));
    expect(await screen.findByText("Try a longer warm-up")).toBeTruthy();
  });
});

describe("Search (M6)", () => {
  it("uses the search endpoint for a query and shows only <mark> from the snippet", async () => {
    api.search.mockResolvedValue({
      data: {
        count: 1, next: null, previous: null, facets: {},
        results: [{
          ...card(),
          matched_in: "reply",
          snippet_html: 'run the <mark>tube</mark> conditioning <img src=x onerror=alert(1)><script>alert(2)</script>',
          accepted_answer: { post_id: 4, excerpt: "Run the conditioning routine first.", author: "Mohan Lal", badge: "Lab Operator (Lab In-charge)", resolution_hours: 3 },
        }],
      },
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/connect/search?q=tube"]}>
        <Routes>
          <Route path="/connect/search" element={<ConnectSearch />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Matched in a reply")).toBeTruthy();
    await waitFor(() => expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ q: "tube", sort: "relevance" })));
    expect(api.threads).not.toHaveBeenCalled();
    expect(container.querySelector("mark")?.textContent).toBe("tube");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("Run the conditioning routine first.")).toBeTruthy();
  });

  it("suggests similar discussions with the accepted answer while typing a title", async () => {
    api.suggest.mockResolvedValue({
      data: {
        results: [{
          ...card({ title: "Baseline drift on the SmartLab detector" }),
          accepted_answer: { post_id: 4, excerpt: "Condition the tube for an hour.", author: "Mohan Lal", badge: "Lab Operator (Lab In-charge)", resolution_hours: 5 },
        }],
      },
    });
    render(
      <MemoryRouter>
        <SimilarDiscussions title="Detector baseline drift" community="xrd-3" equipmentId={38} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Baseline drift on the SmartLab detector", {}, { timeout: 2000 })).toBeTruthy();
    expect(api.suggest).toHaveBeenCalledWith("Detector baseline drift", "xrd-3", 38);
    expect(screen.getByText("Condition the tube for an hour.")).toBeTruthy();
    expect(screen.getByText(/solved in 5 h/)).toBeTruthy();
  });

  it("does not ask for suggestions for very short titles", async () => {
    render(
      <MemoryRouter>
        <SimilarDiscussions title="Drift" />
      </MemoryRouter>,
    );
    await new Promise((r) => setTimeout(r, 600));
    expect(api.suggest).not.toHaveBeenCalled();
  });
});
